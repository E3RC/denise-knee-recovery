from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    root: Path
    docs_dir: Path
    db_path: Path
    caregiver_pin: str
    admin_token: str
    session_secret: str
    timezone: str
    public_base_url: str
    pushover_user_key: str
    pushover_app_token: str
    session_secure: bool


def load_settings() -> Settings:
    root = Path(__file__).resolve().parents[1]
    return Settings(
        root=root,
        docs_dir=root / "docs",
        db_path=Path(os.environ.get("DB_PATH", root / "data" / "recovery.sqlite")),
        caregiver_pin=os.environ.get("CAREGIVER_PIN", "").strip(),
        admin_token=os.environ.get("ADMIN_TOKEN", "").strip(),
        session_secret=os.environ.get("SESSION_SECRET", "").strip(),
        timezone=os.environ.get("RECOVERY_TIMEZONE", "America/New_York").strip(),
        public_base_url=os.environ.get("PUBLIC_BASE_URL", "").strip(),
        pushover_user_key=os.environ.get("PUSHOVER_USER_KEY", "").strip(),
        pushover_app_token=os.environ.get("PUSHOVER_APP_TOKEN", "").strip(),
        session_secure=os.environ.get("SESSION_SECURE", "1").strip().lower() not in {"0", "false", "no"},
    )
