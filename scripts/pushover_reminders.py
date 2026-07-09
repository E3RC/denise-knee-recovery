#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


DEFAULT_CONFIG = Path("data/reminders.json")
DEFAULT_STATE = Path("data/reminder-state.json")
DEFAULT_WINDOW_MINUTES = 10
PUSHOVER_URL = "https://api.pushover.net/1/messages.json"
DAY_NAMES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def main() -> int:
    mode = parse_mode(sys.argv[1:])
    config_path = Path(os.environ.get("REMINDER_CONFIG_PATH", DEFAULT_CONFIG))
    state_path = Path(os.environ.get("REMINDER_STATE_PATH", DEFAULT_STATE))

    if not config_path.exists():
      print(f"Missing reminder config: {config_path}", file=sys.stderr)
      return 2

    config = json.loads(config_path.read_text(encoding="utf-8"))
    reminders = config.get("reminders", [])
    if not isinstance(reminders, list):
        print("Reminder config must contain a reminders array.", file=sys.stderr)
        return 2

    timezone_name = str(config.get("timezone") or os.environ.get("REMINDER_TIMEZONE") or "America/Indiana/Indianapolis")
    public_base_url = str(config.get("publicBaseUrl") or os.environ.get("PUBLIC_BASE_URL") or "").strip()
    tz = ZoneInfo(timezone_name)
    window_minutes = int(os.environ.get("REMINDER_WINDOW_MINUTES") or config.get("windowMinutes") or DEFAULT_WINDOW_MINUTES)
    now = datetime.now(tz)
    forecast_minutes = mode.get("forecast_minutes")
    if isinstance(forecast_minutes, int):
        window_start = now
        window_end = now + timedelta(minutes=forecast_minutes)
    else:
        window_start = now - timedelta(minutes=window_minutes)
        window_end = now

    state = load_state(state_path)
    sent = 0
    matched = 0

    if not mode["dry_run"]:
        user_key = env_required("PUSHOVER_USER_KEY")
        app_token = env_required("PUSHOVER_APP_TOKEN")
        if not user_key or not app_token:
            return 2
    else:
        user_key = ""
        app_token = ""

    for reminder in reminders:
        if not isinstance(reminder, dict):
            continue
        if not reminder.get("enabled", True):
            continue

        reminder_id = reminder.get("id") or derive_id(reminder)
        due_ats = compute_due_ats(reminder, tz, now)
        for due_at in due_ats:
            if due_at > window_end or due_at < window_start:
                continue

            state_key = reminder_state_key(reminder_id, reminder, due_at)
            if state.get(state_key):
                continue

            matched += 1
            if mode["dry_run"]:
                print(format_due(reminder, due_at))
                continue

            send_pushover(
                app_token=app_token,
                user_key=user_key,
                title=str(reminder.get("title") or reminder.get("name") or "Denise Recovery Reminder"),
                message=str(reminder.get("message") or ""),
                priority=int(reminder.get("priority", 0)),
                url=resolve_url(reminder.get("url"), public_base_url),
                url_title=str(reminder.get("urlTitle") or "Open caregiver page"),
            )
            state[state_key] = now.isoformat(timespec="seconds")
            sent += 1

    if mode["dry_run"]:
        label = "Upcoming reminder(s)" if isinstance(forecast_minutes, int) else "Due reminder(s)"
        print(f"{label}: {matched}")
        return 0

    sent += check_medication_timers(user_key, app_token, state, state_path, tz, window_start, window_end, public_base_url)

    save_state(state_path, state)
    print(f"Sent {sent} reminder(s).")
    return 0


def check_medication_timers(user_key: str, app_token: str, state: dict, state_path: Path, tz: ZoneInfo, window_start: datetime, window_end: datetime, public_base_url: str) -> int:
    import sqlite3

    db_path = Path(os.environ.get("DB_PATH", "data/recovery.sqlite"))
    if not db_path.exists():
        return 0

    try:
        conn = sqlite3.connect(str(db_path))
        row = conn.execute("SELECT payload FROM app_state WHERE key=?", ("dashboard-state",)).fetchone()
        conn.close()
        if not row:
            return 0
        dashboard = json.loads(row[0])
    except Exception:
        return 0

    meds = dashboard.get("medicationTemplates", [])
    if not isinstance(meds, list):
        return 0

    sent = 0
    for med in meds:
        next_due_str = med.get("nextDueAt", "")
        if not next_due_str:
            continue
        try:
            next_due = datetime.fromisoformat(next_due_str)
        except (ValueError, TypeError):
            continue

        if next_due.tzinfo is None:
            from datetime import timezone as tz_cls
            next_due = next_due.replace(tzinfo=tz_cls.utc)

        if next_due.tzinfo != tz:
            next_due = next_due.astimezone(tz)

        is_overdue = next_due < window_start
        is_due_now = next_due >= window_start and next_due <= window_end
        if not is_due_now and not is_overdue:
            continue

        med_name = med.get("name", "Medication")
        med_key = "med-timer-" + med_name.lower().replace(" ", "-").replace("(", "").replace(")", "")

        if is_overdue:
            state_key = f"med-overdue-{med_key}|{datetime.now(tz).strftime('%Y-%m-%dT%H')}"
            message = f"{med_name} ({med.get('dose', '')}) is OVERDUE. Tap to log as taken."
            title = f"Overdue: {med_name}"
        else:
            state_key = f"{med_key}|{next_due.strftime('%Y-%m-%dT%H:%M')}"
            message = f"{med_name} ({med.get('dose', '')}) is due now. Tap to log as taken."
            title = f"Medication due: {med_name}"

        if state.get(state_key):
            continue

        magic_url = make_magic_link(med_name, public_base_url)
        send_pushover(
            app_token=app_token,
            user_key=user_key,
            title=title,
            message=message,
            priority=1,
            url=magic_url or resolve_url("/dashboard/meds/", public_base_url),
            url_title="Log dose",
        )
        state[state_key] = datetime.now(tz).isoformat(timespec="seconds")
        sent += 1

    if sent:
        save_state(state_path, state)
    return sent


def parse_mode(args: list[str]) -> dict[str, Any]:
    if any(arg in ("--dry-run", "--due", "--check") for arg in args):
        return {"dry_run": True, "forecast_minutes": None}
    if "--forecast" in args:
        index = args.index("--forecast")
        minutes = 720
        if index + 1 < len(args):
            try:
                minutes = int(args[index + 1])
            except ValueError:
                minutes = 720
        return {"dry_run": True, "forecast_minutes": minutes}
    return {"dry_run": False, "forecast_minutes": None}


def compute_due_ats(reminder: dict[str, object], tz: ZoneInfo, now: datetime) -> list[datetime]:
    reminder_type = str(reminder.get("type") or "daily").lower()
    if reminder_type == "daily":
        due_today = compute_due_at(reminder, tz, now)
        if due_today is None:
            return []
        return [due_today, due_today + timedelta(days=1)]
    due_once = compute_due_at(reminder, tz, now)
    return [due_once] if due_once else []


def env_required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if value:
        return value
    print(f"Missing required env var: {name}", file=sys.stderr)
    return ""


def load_state(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def save_state(path: Path, state: dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def derive_id(reminder: dict[str, object]) -> str:
    raw = json.dumps(reminder, sort_keys=True, ensure_ascii=False)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:12]


def reminder_state_key(reminder_id: str, reminder: dict[str, object], due_at: datetime) -> str:
    if reminder.get("type") == "daily":
        return f"{reminder_id}:{due_at.date().isoformat()}:{due_at.strftime('%H:%M')}"
    return f"{reminder_id}:{due_at.isoformat(timespec='minutes')}"


def compute_due_at(reminder: dict[str, object], tz: ZoneInfo, now: datetime) -> datetime | None:
    reminder_type = str(reminder.get("type") or "daily").lower()
    time_text = str(reminder.get("time") or "").strip()
    if not time_text or ":" not in time_text:
        return None

    hour_text, minute_text = time_text.split(":", 1)
    try:
        hour = int(hour_text)
        minute = int(minute_text)
    except ValueError:
        return None

    if reminder_type == "daily":
        allowed_days = normalize_days(reminder.get("daysOfWeek"))
        if allowed_days and DAY_NAMES[now.weekday()] not in allowed_days:
            return None
        return now.replace(hour=hour, minute=minute, second=0, microsecond=0)

    if reminder_type == "once":
        date_text = str(reminder.get("date") or "").strip()
        try:
            due_date = datetime.strptime(date_text, "%Y-%m-%d").date()
        except ValueError:
            return None
        return datetime(due_date.year, due_date.month, due_date.day, hour, minute, tzinfo=tz)

    return None


def normalize_days(value: object) -> set[str]:
    if not isinstance(value, list):
        return set()
    normalized = set()
    for item in value:
        text = str(item).strip().lower()[:3]
        if text in DAY_NAMES:
            normalized.add(text)
    return normalized


def format_due(reminder: dict[str, object], due_at: datetime) -> str:
    name = str(reminder.get("name") or reminder.get("title") or reminder.get("id") or "Reminder")
    return f"{due_at.isoformat(timespec='minutes')} | {name} | {reminder.get('id', '')}"


def make_magic_link(med_name: str, base_url: str) -> str:
    import hashlib
    import hmac
    import time
    import urllib.parse

    pin = os.environ.get("CAREGIVER_PIN", "").strip()
    if not pin or not base_url:
        return ""

    expiry = int(time.time()) + 900
    payload = str(expiry)
    sig = hmac.new(pin.encode(), payload.encode(), hashlib.sha256).hexdigest()[:16]
    token = f"{expiry}:{sig}"
    return f"{base_url}/api/magic-link?t={urllib.parse.quote(token)}&m={urllib.parse.quote(med_name)}"


def resolve_url(value: object, public_base_url: str) -> str:
    url = str(value or "").strip()
    if not url:
        return ""
    if url.startswith(("http://", "https://")):
        return url
    if not public_base_url:
        return ""
    return urllib.parse.urljoin(public_base_url.rstrip("/") + "/", url.lstrip("/"))


def send_pushover(
    *,
    app_token: str,
    user_key: str,
    title: str,
    message: str,
    priority: int,
    url: str = "",
    url_title: str = "",
) -> None:
    fields = {
        "token": app_token,
        "user": user_key,
        "title": title,
        "message": message,
        "priority": str(priority),
    }
    if url:
        fields["url"] = url
        fields["url_title"] = url_title or "Open caregiver page"
    payload = urllib.parse.urlencode(fields).encode("utf-8")
    request = urllib.request.Request(PUSHOVER_URL, data=payload, method="POST")
    with urllib.request.urlopen(request, timeout=15) as response:
        if response.status >= 300:
            raise RuntimeError(f"Pushover returned HTTP {response.status}")


if __name__ == "__main__":
    raise SystemExit(main())
