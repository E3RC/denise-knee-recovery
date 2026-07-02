#!/usr/bin/env python3
"""Sync family-safe Google Sheet updates into docs/family-updates.json.

This script reads only the Family Updates tab/range and writes the JSON feed used
by the GitHub Pages site. It intentionally does not read Meds, Daily Log, or
other private tabs.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from google.oauth2 import service_account
from googleapiclient.discovery import build


DEFAULT_RANGE = "'Family Updates'!A:J"
OUTPUT_PATH = Path("docs/family-updates.json")
TIMEZONE = "America/Indiana/Indianapolis"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

FIELD_MAP = {
    "date": "date",
    "day #": "dayNumber",
    "day": "dayNumber",
    "surgery day #": "dayNumber",
    "headline": "headline",
    "public update": "publicUpdate",
    "pain trend": "painTrend",
    "mobility": "mobility",
    "pt / milestone": "ptMilestone",
    "pt milestone": "ptMilestone",
    "mood": "mood",
    "needs / visitors": "needsVisitors",
    "needs visitors": "needsVisitors",
    "show on web": "showOnWeb",
}


def main() -> int:
    spreadsheet_id = os.environ.get("SPREADSHEET_ID", "").strip()
    service_account_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    sheet_range = os.environ.get("FAMILY_UPDATES_RANGE", DEFAULT_RANGE).strip() or DEFAULT_RANGE

    if not spreadsheet_id:
        print("Missing required env var: SPREADSHEET_ID", file=sys.stderr)
        return 2

    if not service_account_json:
        print("Missing required env var: GOOGLE_SERVICE_ACCOUNT_JSON", file=sys.stderr)
        return 2

    try:
        service_account_info = json.loads(service_account_json)
    except json.JSONDecodeError as exc:
        print(f"GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON: {exc}", file=sys.stderr)
        return 2

    credentials = service_account.Credentials.from_service_account_info(
        service_account_info,
        scopes=SCOPES,
    )

    service = build("sheets", "v4", credentials=credentials)
    result = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=spreadsheet_id, range=sheet_range)
        .execute()
    )

    rows = result.get("values", [])
    if not rows:
        write_feed([])
        print("No rows found; wrote empty feed.")
        return 0

    headers = [normalize_header(value) for value in rows[0]]
    updates = []

    for row in rows[1:]:
        raw = row_to_dict(headers, row)
        update = convert_row(raw)

        if not update.get("date") and not update.get("headline") and not update.get("publicUpdate"):
            continue

        if str(update.get("showOnWeb", "")).strip().upper() != "YES":
            continue

        updates.append(update)

    updates.sort(key=lambda item: item.get("date", ""), reverse=True)
    write_feed(updates)
    print(f"Wrote {len(updates)} family update(s) to {OUTPUT_PATH}")
    return 0


def normalize_header(value: object) -> str:
    return str(value or "").strip().lower()


def row_to_dict(headers: list[str], row: list[object]) -> dict[str, str]:
    data: dict[str, str] = {}
    for index, header in enumerate(headers):
        if not header:
            continue
        data[header] = str(row[index]).strip() if index < len(row) else ""
    return data


def convert_row(raw: dict[str, str]) -> dict[str, object]:
    update: dict[str, object] = {
        "date": "",
        "dayNumber": "",
        "headline": "",
        "publicUpdate": "",
        "painTrend": "",
        "mobility": "",
        "ptMilestone": "",
        "mood": "",
        "needsVisitors": "",
        "showOnWeb": "NO",
    }

    for source_key, value in raw.items():
        target_key = FIELD_MAP.get(source_key)
        if not target_key:
            continue
        update[target_key] = value

    day_number = str(update.get("dayNumber", "")).strip()
    if day_number.isdigit():
        update["dayNumber"] = int(day_number)

    return update


def write_feed(updates: list[dict[str, object]]) -> None:
    now = datetime.now(ZoneInfo(TIMEZONE)).isoformat(timespec="seconds")
    feed = {
        "lastUpdated": now,
        "updates": updates,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(feed, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
