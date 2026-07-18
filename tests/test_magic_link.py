from __future__ import annotations

import importlib
import sys
from pathlib import Path

from fastapi.testclient import TestClient
from app.db import create_magic_link_token, initialize

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def test_magic_link_redirects_once_into_dashboard(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("DB_PATH", str(tmp_path / "recovery.sqlite"))
    monkeypatch.setenv("CAREGIVER_PIN", "1234")
    monkeypatch.setenv("SESSION_SECRET", "test-secret")
    monkeypatch.setenv("SESSION_SECURE", "0")

    import app.main as main_module

    importlib.reload(main_module)
    client = TestClient(main_module.app)
    settings = main_module.app.state.settings
    initialize(settings)
    token = create_magic_link_token(settings, "/dashboard/meds/?med=Tylenol")

    response = client.get(f"/api/magic-link?t={token}", follow_redirects=False)

    assert response.status_code == 303
    assert response.headers["location"] == "/dashboard/meds/?med=Tylenol"
    assert "denise_caregiver=" in response.headers.get("set-cookie", "")
    reused = client.get(f"/api/magic-link?t={token}", follow_redirects=False)
    assert reused.headers["location"] == "/caregiver"


def test_magic_link_rejects_unknown_token(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("DB_PATH", str(tmp_path / "recovery.sqlite"))
    monkeypatch.setenv("CAREGIVER_PIN", "1234")
    monkeypatch.setenv("SESSION_SECRET", "test-secret")
    monkeypatch.setenv("SESSION_SECURE", "0")

    import app.main as main_module

    importlib.reload(main_module)
    client = TestClient(main_module.app)
    initialize(main_module.app.state.settings)

    response = client.get("/api/magic-link?t=bad-token", follow_redirects=False)

    assert response.status_code == 303
    assert response.headers["location"] == "/caregiver"


def test_magic_link_rejects_expired_token(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("DB_PATH", str(tmp_path / "recovery.sqlite"))
    monkeypatch.setenv("CAREGIVER_PIN", "1234")
    monkeypatch.setenv("SESSION_SECRET", "test-secret")
    monkeypatch.setenv("SESSION_SECURE", "0")

    import app.main as main_module

    importlib.reload(main_module)
    client = TestClient(main_module.app)
    settings = main_module.app.state.settings
    initialize(settings)
    token = create_magic_link_token(settings, "/dashboard/meds/", ttl_seconds=-1)

    response = client.get(f"/api/magic-link?t={token}", follow_redirects=False)

    assert response.status_code == 303
    assert response.headers["location"] == "/caregiver"
