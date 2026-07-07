#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path


REQUIRED_SPIROMETER_TIMES = {
    "00:15",
    "00:45",
    "01:15",
    "01:45",
    "02:15",
    "02:45",
    "03:15",
    "03:45",
    "04:15",
    "04:45",
    "05:15",
    "05:45",
    "06:15",
    "06:45",
    "07:15",
    "07:45",
    "08:15",
    "08:45",
    "09:15",
    "09:45",
    "10:15",
    "10:45",
    "11:15",
    "11:45",
    "12:15",
    "12:45",
    "13:15",
    "13:45",
    "14:15",
    "14:45",
    "15:15",
    "15:45",
    "16:15",
    "16:45",
    "17:15",
    "17:45",
    "18:15",
    "18:45",
    "19:15",
    "19:45",
    "20:15",
    "20:45",
    "21:15",
    "21:45",
    "22:15",
    "22:45",
    "23:15",
    "23:45",
}
REQUIRED_SLEEP_WINDOW = {"start": "22:00", "end": "06:00"}
REQUIRED_MED_IDS = {
    "tylenol-morning-07072026",
    "meloxicam-morning-07072026",
    "pepcid-morning-07072026",
    "dexamethasone-morning-07072026",
    "aspirin-morning-07072026",
    "cephalexin-morning-07072026",
    "journavx-loading-07072026",
    "tylenol-midday-07072026",
    "cephalexin-midday-07072026",
    "tylenol-evening-07072026",
    "aspirin-evening-07072026",
    "dexamethasone-evening-07072026",
    "cephalexin-evening-07072026",
    "journavx-12h-07072026",
    "lyrica-bedtime-07072026",
    "senokot-morning-07072026",
    "senokot-evening-07072026",
    "txa-evening-07072026",
    "txa-evening-07082026",
    "txa-evening-07092026",
}
REQUIRED_PRN_IDS = {
    "oxy-next-dose-0258",
    "oxy-overdue-2049",
    "tramadol-next-dose-0220-07072026",
    "ondansetron-next-window-0600-07072026",
}
REQUIRED_OVERNIGHT_IDS = {
    "spirometer-catchup-2250-07062026",
    "tylenol-next-dose-0200-07072026",
    "vitals-check-2300-07062026",
    "vitals-check-0000-07072026",
    "vitals-check-0100-07072026",
    "vitals-check-0200-07072026",
    "vitals-check-0300-07072026",
    "vitals-check-0400-07072026",
    "vitals-check-0500-07072026",
    "vitals-check-0600-07072026",
}


def fail(message: str) -> int:
    print(f"FAIL: {message}", file=sys.stderr)
    return 1


def main() -> int:
    repo_root = Path(__file__).resolve().parents[1]
    reminders_path = repo_root / "data" / "reminders.json"
    intake_path = repo_root / "docs" / "medical-intake.md"
    agent_path = repo_root / "docs" / "medagents-integration.md"

    if not reminders_path.exists():
        return fail(f"missing reminders file: {reminders_path}")
    reminders = json.loads(reminders_path.read_text(encoding="utf-8"))
    reminder_rows = reminders.get("reminders", [])
    reminder_by_id = {row.get("id"): row for row in reminder_rows if isinstance(row, dict)}

    sleep_window = reminders.get("sleepWindow", {})
    if sleep_window.get("start") != REQUIRED_SLEEP_WINDOW["start"] or sleep_window.get("end") != REQUIRED_SLEEP_WINDOW["end"]:
        return fail("sleep window does not match 22:00-06:00")

    spirometer_times = {
        row.get("time")
        for row in reminder_rows
        if isinstance(row, dict) and "spirometer" in str(row.get("id", "")).lower()
        and row.get("type") == "daily"
    }
    if spirometer_times != REQUIRED_SPIROMETER_TIMES:
        return fail(f"spirometer reminder times mismatch: {sorted(spirometer_times)}")

    missing_med = sorted(i for i in REQUIRED_MED_IDS if i not in reminder_by_id)
    if missing_med:
        return fail(f"missing required medication reminders: {missing_med}")

    missing_prn = sorted(i for i in REQUIRED_PRN_IDS if i not in reminder_by_id)
    if missing_prn:
        return fail(f"missing required PRN reminders: {missing_prn}")

    missing_med_urls = sorted(
        i for i in (REQUIRED_MED_IDS | REQUIRED_PRN_IDS)
        if reminder_by_id.get(i, {}).get("url") != "/dashboard/meds/"
        or reminder_by_id.get(i, {}).get("urlTitle") != "Open meds page"
    )
    if missing_med_urls:
        return fail(f"medication reminders missing meds-page Pushover URL: {missing_med_urls}")

    missing_overnight = sorted(i for i in REQUIRED_OVERNIGHT_IDS if i not in reminder_by_id)
    if missing_overnight:
        return fail(f"missing required overnight reminders: {missing_overnight}")

    if not intake_path.exists():
        return fail("missing medical intake notes")
    intake_text = intake_path.read_text(encoding="utf-8")
    required_intake_phrases = [
        "Google Sheet: `Denise Knee Recovery Tracker`",
        "Sleep window for reminders: 10:00 PM to 6:00 AM",
        "Temporary exception: ignore the 10:00 PM reminder cutoff until Wednesday morning",
        "Dr Knees",
        "backup nurse",
    ]
    missing_intake = [phrase for phrase in required_intake_phrases if phrase not in intake_text]
    if missing_intake:
        return fail(f"medical intake note missing phrases: {missing_intake}")

    if not agent_path.exists():
        return fail("missing MedAgents integration note")
    agent_text = agent_path.read_text(encoding="utf-8")
    required_agent_phrases = [
        "Dr Knees",
        "backup nurse",
        "medication timing",
        "next-dose timers",
    ]
    missing_agent = [phrase for phrase in required_agent_phrases if phrase not in agent_text]
    if missing_agent:
        return fail(f"MedAgents integration note missing phrases: {missing_agent}")

    print("PASS: medical readiness audit checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
