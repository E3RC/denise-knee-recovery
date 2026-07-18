from __future__ import annotations

from datetime import datetime
from typing import Any


def public_summary(state: dict[str, Any] | None, updated_at: str | None) -> dict[str, Any]:
    state = state or {}
    patient = state.get("patient") if isinstance(state.get("patient"), dict) else {}
    surgery_date = str(patient.get("surgeryDate") or "")
    recovery_day = None
    if surgery_date and updated_at:
        try:
            recovery_day = max(0, (datetime.fromisoformat(updated_at).date() - datetime.fromisoformat(surgery_date).date()).days)
        except ValueError:
            recovery_day = None
    checks = state.get("quickChecks") if isinstance(state.get("quickChecks"), list) else []
    return {
        "asOf": updated_at,
        "patient": {
            "name": str(patient.get("name") or "Denise"),
            "procedure": str(patient.get("procedure") or "Recovery"),
            "surgeryDate": surgery_date,
        },
        "stats": {"recoveryDay": recovery_day, "quickChecksLogged": len(checks)},
        "recentChecks": [
            {"id": str(item.get("id", "")), "at": str(item.get("at", ""))}
            for item in checks[:8]
            if isinstance(item, dict)
        ],
    }
