from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from .config import load_settings
from .db import connection, create_magic_link_token, initialize, load_state


def due_medications(settings, now: datetime) -> list[dict]:
    state, _ = load_state(settings)
    if not state:
        return []
    results = []
    for med in state.get("medicationTemplates", []):
        if not isinstance(med, dict) or med.get("stopRule") == "Completed":
            continue
        raw = str(med.get("nextDueAt") or "")
        if not raw:
            continue
        try:
            due = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if due.tzinfo is None:
                due = due.replace(tzinfo=now.tzinfo)
            due = due.astimezone(now.tzinfo)
        except ValueError:
            continue
        is_prn = str(med.get("scheduled", "")).upper().startswith("PRN")
        if due <= now and not (is_prn and due < now):
            results.append({"med": med, "due": due})
    return results


def delivery_key(kind: str, name: str, due_at: str) -> str:
    return f"{kind}:{name.casefold()}:{due_at}"


def claim(settings, medication_name: str, due_at: str, now: str, kind: str = "medication") -> bool:
    key = delivery_key(kind, medication_name, due_at)
    with connection(settings) as conn:
        conn.execute("BEGIN IMMEDIATE")
        existing = conn.execute(
            "SELECT status, attempted_at FROM reminder_deliveries WHERE delivery_key = ?", (key,)
        ).fetchone()
        if existing:
            if existing["status"] == "sent":
                return False
            try:
                attempted = datetime.fromisoformat(existing["attempted_at"])
                if datetime.fromisoformat(now) - attempted < timedelta(minutes=15):
                    return False
            except ValueError:
                pass
            conn.execute(
                "UPDATE reminder_deliveries SET status='pending', attempted_at=?, error='' WHERE delivery_key=?",
                (now, key),
            )
        else:
            conn.execute(
                "INSERT INTO reminder_deliveries(delivery_key, medication_name, due_at, status, attempted_at) VALUES (?, ?, ?, 'pending', ?)",
                (key, medication_name, due_at, now),
            )
        conn.commit()
    return True


def finish(settings, medication_name: str, due_at: str, now: str, error: str = "", kind: str = "medication") -> None:
    key = delivery_key(kind, medication_name, due_at)
    with connection(settings) as conn:
        conn.execute(
            "UPDATE reminder_deliveries SET status=?, sent_at=?, error=? WHERE delivery_key=?",
            ("failed" if error else "sent", None if error else now, error[:1000], key),
        )
        conn.commit()


def send_pushover(settings, med: dict, due: datetime) -> None:
    destination = "/dashboard/meds/?med=" + urllib.parse.quote(str(med.get("name", "")))
    url = ""
    if settings.public_base_url:
        token = create_magic_link_token(settings, destination)
        url = settings.public_base_url.rstrip("/") + "/api/magic-link?t=" + urllib.parse.quote(token)
    send_message(
        settings,
        title=f"Medication due: {med.get('name', 'Medication')}",
        message=f"{med.get('name', 'Medication')} ({med.get('dose', '')}) is due now.",
        priority=1,
        url=url,
    )


def send_message(settings, *, title: str, message: str, priority: int = 0, url: str = "") -> None:
    fields = {
        "token": settings.pushover_app_token,
        "user": settings.pushover_user_key,
        "title": title,
        "message": message,
        "priority": str(priority),
    }
    if url and url.startswith("/") and settings.public_base_url:
        url = settings.public_base_url.rstrip("/") + url
    if url:
        fields["url"] = url
        fields["url_title"] = "Open caregiver login"
    request = urllib.request.Request(
        "https://api.pushover.net/1/messages.json",
        data=urllib.parse.urlencode(fields).encode(),
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        if response.status >= 300:
            raise RuntimeError(f"Pushover returned HTTP {response.status}")


def general_reminders(settings, now: datetime) -> list[dict]:
    path = settings.root / "data" / "reminders.json"
    if not path.exists():
        return []
    try:
        config = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    results = []
    for reminder in config.get("reminders", []):
        if not isinstance(reminder, dict) or not reminder.get("enabled", True):
            continue
        reminder_type = str(reminder.get("type") or "daily").lower()
        raw_time = str(reminder.get("time") or "")
        try:
            hour, minute = (int(part) for part in raw_time.split(":", 1))
        except (ValueError, TypeError):
            continue
        if reminder_type == "daily":
            due = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            days = reminder.get("daysOfWeek")
            if isinstance(days, list) and days:
                allowed = {str(day).strip().lower()[:3] for day in days}
                if due.strftime("%a").lower()[:3] not in allowed:
                    continue
        elif reminder_type == "once":
            try:
                date = datetime.strptime(str(reminder.get("date")), "%Y-%m-%d").date()
            except (ValueError, TypeError):
                continue
            due = now.replace(year=date.year, month=date.month, day=date.day, hour=hour, minute=minute, second=0, microsecond=0)
        else:
            continue
        if now - timedelta(minutes=10) <= due <= now:
            results.append({"reminder": reminder, "due": due})
    return results


def run_once(settings) -> int:
    if not settings.pushover_user_key or not settings.pushover_app_token:
        raise RuntimeError("PUSHOVER_USER_KEY and PUSHOVER_APP_TOKEN are required")
    now = datetime.now(ZoneInfo(settings.timezone))
    now_text = now.isoformat(timespec="seconds")
    sent = 0
    for item in general_reminders(settings, now):
        reminder = item["reminder"]
        due = item["due"]
        name = str(reminder.get("id") or reminder.get("name") or reminder.get("title") or "reminder")
        due_text = due.isoformat(timespec="seconds")
        if not claim(settings, name, due_text, now_text, kind="general"):
            continue
        try:
            send_message(
                settings,
                title=str(reminder.get("title") or reminder.get("name") or "Denise Recovery Reminder"),
                message=str(reminder.get("message") or ""),
                priority=int(reminder.get("priority", 0)),
                url=str(reminder.get("url") or ""),
            )
            finish(settings, name, due_text, now_text, kind="general")
            sent += 1
        except Exception as exc:
            finish(settings, name, due_text, now_text, str(exc), kind="general")
            print(f"Reminder failed for {name}: {exc}")
    for item in due_medications(settings, now):
        med = item["med"]
        due = item["due"]
        due_text = due.isoformat(timespec="seconds")
        if not claim(settings, str(med.get("name", "Medication")), due_text, now_text):
            continue
        try:
            send_pushover(settings, med, due)
            finish(settings, str(med.get("name", "Medication")), due_text, now_text)
            sent += 1
        except Exception as exc:
            finish(settings, str(med.get("name", "Medication")), due_text, now_text, str(exc))
            print(f"Reminder failed for {med.get('name')}: {exc}")
    return sent


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    settings = load_settings()
    initialize(settings)
    if args.once:
        print(f"Sent {run_once(settings)} medication reminder(s).")
        return 0
    while True:
        print(f"Sent {run_once(settings)} medication reminder(s).", flush=True)
        time.sleep(60)


if __name__ == "__main__":
    raise SystemExit(main())
