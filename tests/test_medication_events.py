from __future__ import annotations

import json
from pathlib import Path

from app.config import Settings
from app.db import connection, initialize, record_medication_event


def settings(tmp_path: Path) -> Settings:
    return Settings(
        root=tmp_path,
        docs_dir=tmp_path,
        db_path=tmp_path / "recovery.sqlite",
        caregiver_pin="1234",
        admin_token="",
        session_secret="test-secret",
        timezone="America/New_York",
        public_base_url="",
        pushover_user_key="",
        pushover_app_token="",
        session_secure=False,
    )


def seed(settings: Settings) -> None:
    initialize(settings)
    state = {"medicationTemplates": [{"name": "Test Med", "intervalHours": 4}]}
    with connection(settings) as conn:
        conn.execute(
            "INSERT INTO app_state VALUES (?, ?, ?)",
            ("dashboard-state", json.dumps(state), "2026-07-14T12:00:00-04:00"),
        )
        conn.commit()


def test_event_is_idempotent_and_advances_projection(tmp_path: Path) -> None:
    config = settings(tmp_path)
    seed(config)
    args = dict(
        settings=config,
        event_id="event-1",
        medication_name="Test Med",
        event_type="taken",
        occurred_at="2026-07-14T12:00:00-04:00",
        given_by="Caregiver",
        notes="",
        now="2026-07-14T12:01:00-04:00",
    )
    state, created = record_medication_event(**args)
    assert created is True
    assert state["medicationTemplates"][0]["nextDueAt"] == "2026-07-14T16:00:00-04:00"
    _, duplicate = record_medication_event(**args)
    assert duplicate is False
    with connection(config) as conn:
        assert conn.execute("SELECT count(*) FROM medication_events").fetchone()[0] == 1
