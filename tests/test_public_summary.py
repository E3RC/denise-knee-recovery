from app.services import public_summary


def test_public_summary_excludes_private_state() -> None:
    payload = public_summary(
        {
            "patient": {"name": "Denise", "surgeryDate": "2026-07-06", "privateNote": "secret"},
            "medicationTemplates": [{"name": "Private medication"}],
            "quickChecks": [{"id": "walk-check", "at": "2026-07-14T12:00:00-04:00"}],
        },
        "2026-07-14T12:00:00-04:00",
    )
    assert payload["stats"]["recoveryDay"] == 8
    assert "medicationTemplates" not in payload
    assert "privateNote" not in payload["patient"]
