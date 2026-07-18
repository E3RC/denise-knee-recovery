from __future__ import annotations

import json
import hashlib
import secrets
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .config import Settings


STATE_KEY = "dashboard-state"


@contextmanager
def connection(settings: Settings) -> Iterator[sqlite3.Connection]:
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(settings.db_path, timeout=10)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def initialize(settings: Settings) -> None:
    with connection(settings) as conn:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS app_state (
              key TEXT PRIMARY KEY,
              payload TEXT NOT NULL,
              updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS medication_events (
              event_id TEXT PRIMARY KEY,
              medication_name TEXT NOT NULL,
              event_type TEXT NOT NULL CHECK(event_type IN ('taken', 'completed')),
              occurred_at TEXT NOT NULL,
              recorded_at TEXT NOT NULL,
              given_by TEXT NOT NULL DEFAULT '',
              notes TEXT NOT NULL DEFAULT ''
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS medication_events_med_time
            ON medication_events(medication_name, occurred_at)
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS reminder_deliveries (
              delivery_key TEXT PRIMARY KEY,
              medication_name TEXT NOT NULL,
              due_at TEXT NOT NULL,
              status TEXT NOT NULL CHECK(status IN ('pending', 'sent', 'failed')),
              attempted_at TEXT NOT NULL,
              sent_at TEXT,
              error TEXT NOT NULL DEFAULT ''
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS magic_link_tokens (
              token_hash TEXT PRIMARY KEY,
              destination TEXT NOT NULL,
              expires_at INTEGER NOT NULL,
              used_at TEXT
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS magic_link_tokens_expiry
            ON magic_link_tokens(expires_at)
        """)
        conn.commit()


def load_state(settings: Settings) -> tuple[dict[str, Any] | None, str | None]:
    with connection(settings) as conn:
        row = conn.execute(
            "SELECT payload, updated_at FROM app_state WHERE key = ?", (STATE_KEY,)
        ).fetchone()
    if not row:
        return None, None
    try:
        payload = json.loads(row["payload"])
    except json.JSONDecodeError:
        return None, row["updated_at"]
    return (payload if isinstance(payload, dict) else None), row["updated_at"]


def save_state(settings: Settings, payload: dict[str, Any], now: str) -> None:
    serialized = json.dumps(payload, ensure_ascii=False)
    with connection(settings) as conn:
        conn.execute("BEGIN IMMEDIATE")
        current_row = conn.execute("SELECT payload FROM app_state WHERE key = ?", (STATE_KEY,)).fetchone()
        if current_row:
            current = json.loads(current_row["payload"])
            current_meds = {
                str(med.get("name", "")).casefold(): med
                for med in current.get("medicationTemplates", [])
                if isinstance(med, dict)
            }
            for incoming in payload.get("medicationTemplates", []):
                if not isinstance(incoming, dict):
                    continue
                saved = current_meds.get(str(incoming.get("name", "")).casefold())
                if not saved or not saved.get("lastGivenAt"):
                    continue
                incoming_time = parse_time(incoming.get("lastGivenAt"), datetime.now())
                saved_time = parse_time(saved.get("lastGivenAt"), datetime.now())
                if saved_time > incoming_time:
                    for field in ("lastGivenAt", "givenTime", "givenBy", "dispensed", "nextDueAt", "stopRule"):
                        if field in saved:
                            incoming[field] = saved[field]
            serialized = json.dumps(payload, ensure_ascii=False)
        conn.execute(
            """
            INSERT INTO app_state(key, payload, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at
            """,
            (STATE_KEY, serialized, now),
        )
        conn.commit()


def parse_time(value: object, fallback: datetime) -> datetime:
    text = str(value or "").strip()
    if not text:
        return fallback
    parsed = datetime.fromisoformat(text[:-1] + "+00:00" if text.endswith("Z") else text)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def record_medication_event(
    settings: Settings,
    *,
    event_id: str,
    medication_name: str,
    event_type: str,
    occurred_at: str,
    given_by: str,
    notes: str,
    now: str,
) -> tuple[dict[str, Any], bool]:
    with connection(settings) as conn:
        conn.execute("BEGIN IMMEDIATE")
        duplicate = conn.execute(
            "SELECT 1 FROM medication_events WHERE event_id = ?", (event_id,)
        ).fetchone()
        row = conn.execute("SELECT payload FROM app_state WHERE key = ?", (STATE_KEY,)).fetchone()
        state = json.loads(row["payload"]) if row else {}
        if duplicate:
            return state, False

        meds = state.get("medicationTemplates", [])
        match = next(
            (med for med in meds if str(med.get("name", "")).casefold() == medication_name.casefold()),
            None,
        )
        if match is None:
            raise ValueError("unknown medication")
        conn.execute(
            "INSERT INTO medication_events VALUES (?, ?, ?, ?, ?, ?, ?)",
            (event_id, match.get("name", medication_name), event_type, occurred_at, now, given_by, notes),
        )
        previous = parse_time(match.get("lastGivenAt"), datetime.min.replace(tzinfo=None)) if match.get("lastGivenAt") else None
        occurred = parse_time(occurred_at, datetime.now())
        if previous is None or occurred >= previous:
            match.update(lastGivenAt=occurred_at, givenTime=occurred_at, givenBy=given_by, dispensed=True)
            if event_type == "completed":
                match.update(nextDueAt="", stopRule="Completed")
            else:
                interval = int(match.get("intervalHours", 0) or 0)
                match["nextDueAt"] = (
                    (occurred + timedelta(hours=interval)).isoformat(timespec="seconds")
                    if interval > 0 else ""
                )
        conn.execute(
            """
            INSERT INTO app_state VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at
            """,
            (STATE_KEY, json.dumps(state, ensure_ascii=False), now),
        )
        conn.commit()
    return state, True


def create_magic_link_token(settings: Settings, destination: str, ttl_seconds: int = 900) -> str:
    """Persist a random, single-use token and return its opaque public value."""
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    expires_at = int(datetime.now(timezone.utc).timestamp()) + ttl_seconds
    with connection(settings) as conn:
        conn.execute("DELETE FROM magic_link_tokens WHERE expires_at < ?", (int(datetime.now(timezone.utc).timestamp()),))
        conn.execute(
            "INSERT INTO magic_link_tokens(token_hash, destination, expires_at) VALUES (?, ?, ?)",
            (token_hash, destination, expires_at),
        )
        conn.commit()
    return token


def consume_magic_link_token(settings: Settings, token: str, now: str) -> str | None:
    """Atomically consume a token so it cannot establish more than one session."""
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    timestamp = int(datetime.now(timezone.utc).timestamp())
    with connection(settings) as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            """
            SELECT destination FROM magic_link_tokens
            WHERE token_hash = ? AND expires_at >= ? AND used_at IS NULL
            """,
            (token_hash, timestamp),
        ).fetchone()
        if not row:
            conn.commit()
            return None
        conn.execute("UPDATE magic_link_tokens SET used_at = ? WHERE token_hash = ?", (now, token_hash))
        conn.commit()
    return str(row["destination"])
