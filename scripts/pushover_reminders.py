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
from zoneinfo import ZoneInfo


DEFAULT_CONFIG = Path("data/reminders.json")
DEFAULT_STATE = Path("data/reminder-state.json")
DEFAULT_WINDOW_MINUTES = 10
PUSHOVER_URL = "https://api.pushover.net/1/messages.json"
DAY_NAMES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def main() -> int:
    user_key = env_required("PUSHOVER_USER_KEY")
    app_token = env_required("PUSHOVER_APP_TOKEN")
    if not user_key or not app_token:
        return 2

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
    tz = ZoneInfo(timezone_name)
    window_minutes = int(os.environ.get("REMINDER_WINDOW_MINUTES") or config.get("windowMinutes") or DEFAULT_WINDOW_MINUTES)
    now = datetime.now(tz)
    window_start = now - timedelta(minutes=window_minutes)

    state = load_state(state_path)
    sent = 0

    for reminder in reminders:
        if not isinstance(reminder, dict):
            continue
        if not reminder.get("enabled", True):
            continue

        reminder_id = reminder.get("id") or derive_id(reminder)
        due_at = compute_due_at(reminder, tz, now)
        if due_at is None:
            continue
        if due_at > now or due_at < window_start:
            continue

        state_key = reminder_state_key(reminder_id, reminder, due_at)
        if state.get(state_key):
            continue

        send_pushover(
            app_token=app_token,
            user_key=user_key,
            title=str(reminder.get("title") or reminder.get("name") or "Denise Recovery Reminder"),
            message=str(reminder.get("message") or ""),
            priority=int(reminder.get("priority", 0)),
        )
        state[state_key] = now.isoformat(timespec="seconds")
        sent += 1

    save_state(state_path, state)
    print(f"Sent {sent} reminder(s).")
    return 0


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


def send_pushover(*, app_token: str, user_key: str, title: str, message: str, priority: int) -> None:
    payload = urllib.parse.urlencode(
        {
            "token": app_token,
            "user": user_key,
            "title": title,
            "message": message,
            "priority": str(priority),
        }
    ).encode("utf-8")
    request = urllib.request.Request(PUSHOVER_URL, data=payload, method="POST")
    with urllib.request.urlopen(request, timeout=15) as response:
        if response.status >= 300:
            raise RuntimeError(f"Pushover returned HTTP {response.status}")


if __name__ == "__main__":
    raise SystemExit(main())
