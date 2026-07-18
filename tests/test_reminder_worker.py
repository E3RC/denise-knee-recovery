from __future__ import annotations

import json
from dataclasses import replace
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from zoneinfo import ZoneInfo

from app.config import Settings
from app.db import connection, consume_magic_link_token, initialize
from app.reminder_worker import claim, due_medications, general_reminders, send_pushover


def settings(tmp_path: Path) -> Settings:
    return Settings(
        root=tmp_path,
        docs_dir=tmp_path,
        db_path=tmp_path / "recovery.sqlite",
        caregiver_pin="",
        admin_token="",
        session_secret="",
        timezone="America/New_York",
        public_base_url="",
        pushover_user_key="test-user",
        pushover_app_token="test-app",
        session_secure=False,
    )


def test_worker_finds_only_current_medication_windows(tmp_path: Path) -> None:
    config = settings(tmp_path)
    initialize(config)
    now = datetime.now(ZoneInfo(config.timezone)).replace(microsecond=0)
    state = {
        "medicationTemplates": [
            {"name": "Due", "nextDueAt": now.isoformat()},
            {"name": "Future", "nextDueAt": (now + timedelta(hours=2)).isoformat()},
        ]
    }
    with connection(config) as conn:
        conn.execute(
            "INSERT INTO app_state VALUES (?, ?, ?)",
            ("dashboard-state", json.dumps(state), now.isoformat()),
        )
        conn.commit()
    due = due_medications(config, now)
    assert [item["med"]["name"] for item in due] == ["Due"]


def test_worker_claims_one_delivery_key_once(tmp_path: Path) -> None:
    config = settings(tmp_path)
    initialize(config)
    assert claim(config, "Test Med", "2026-07-14T12:00:00-04:00", "2026-07-14T12:00:01-04:00") is True
    assert claim(config, "Test Med", "2026-07-14T12:00:00-04:00", "2026-07-14T12:00:02-04:00") is False


def test_worker_reads_general_reminders_from_existing_config(tmp_path: Path) -> None:
    config = settings(tmp_path)
    (tmp_path / "data").mkdir()
    (tmp_path / "data" / "reminders.json").write_text(
        json.dumps({"reminders": [{"id": "check", "type": "daily", "time": "12:00", "message": "Check in"}]}),
        encoding="utf-8",
    )
    now = datetime(2026, 7, 14, 12, 5, tzinfo=ZoneInfo(config.timezone))
    reminders = general_reminders(config, now)
    assert [item["reminder"]["id"] for item in reminders] == ["check"]


def test_medication_reminder_uses_an_opaque_one_time_link(tmp_path: Path, monkeypatch) -> None:
    config = replace(settings(tmp_path), public_base_url="https://recovery.example")
    initialize(config)
    sent: dict[str, object] = {}

    def capture_message(_settings, **kwargs) -> None:
        sent.update(kwargs)

    monkeypatch.setattr("app.reminder_worker.send_message", capture_message)
    send_pushover(config, {"name": "Test Med", "dose": "10 mg"}, datetime.now(ZoneInfo(config.timezone)))

    link = str(sent["url"])
    parsed = urlparse(link)
    token = parse_qs(parsed.query)["t"][0]
    assert parsed.path == "/api/magic-link"
    assert "Test%20Med" not in link
    assert consume_magic_link_token(config, token, "2026-07-18T12:00:00+00:00") == "/dashboard/meds/?med=Test%20Med"
