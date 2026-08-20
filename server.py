#!/usr/bin/env python3
from __future__ import annotations

import json
import mimetypes
import os
import secrets
import sqlite3
import tempfile
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse
import urllib.request
import urllib.error
from zoneinfo import ZoneInfo


ET = ZoneInfo("America/Indiana/Indianapolis")


ROOT = Path(__file__).resolve().parent
DOCS_DIR = ROOT / "docs"
DATA_DIR = ROOT / "data"
DB_PATH = Path(os.environ.get("DB_PATH", DATA_DIR / "recovery.sqlite"))
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8080"))
MAX_BODY_BYTES = 1_000_000
STATE_KEY = "dashboard-state"
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "").strip()
CAREGIVER_PIN = os.environ.get("CAREGIVER_PIN", "").strip()
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "").strip()
DEEPSEEK_MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat").strip()
SESSION_COOKIE_NAME = "caregiver_session"
SESSION_TOKEN = secrets.token_urlsafe(32) if CAREGIVER_PIN else ""

mimetypes.add_type("application/manifest+json", ".webmanifest")


def now_iso() -> str:
    return datetime.now(ET).isoformat(timespec="seconds")


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS app_state (
              key TEXT PRIMARY KEY,
              payload TEXT NOT NULL,
              updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS medication_events (
              event_id TEXT PRIMARY KEY,
              medication_name TEXT NOT NULL,
              event_type TEXT NOT NULL CHECK(event_type IN ('taken', 'completed')),
              occurred_at TEXT NOT NULL,
              recorded_at TEXT NOT NULL,
              given_by TEXT NOT NULL DEFAULT '',
              notes TEXT NOT NULL DEFAULT ''
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS medication_events_med_time ON medication_events(medication_name, occurred_at)")


def load_state() -> dict | None:
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute(
            "SELECT payload FROM app_state WHERE key = ?",
            (STATE_KEY,),
        ).fetchone()
    if not row:
        return None
    try:
        parsed = json.loads(row[0])
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def save_state(payload: dict) -> None:
    # Legacy whole-dashboard saves may be stale. Never let them roll medication clocks back.
    with sqlite3.connect(DB_PATH, timeout=10) as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("SELECT payload FROM app_state WHERE key = ?", (STATE_KEY,)).fetchone()
        current = json.loads(row[0]) if row else {}
        current_meds = {str(m.get("name", "")).casefold(): m for m in current.get("medicationTemplates", [])}
        for incoming in payload.get("medicationTemplates", []):
            saved = current_meds.get(str(incoming.get("name", "")).casefold())
            if not saved or not saved.get("lastGivenAt"):
                continue
            incoming_time = _parse_event_time(incoming.get("lastGivenAt")) if incoming.get("lastGivenAt") else None
            saved_time = _parse_event_time(saved.get("lastGivenAt"))
            if incoming_time is None or saved_time > incoming_time:
                for field in ("lastGivenAt", "givenTime", "givenBy", "dispensed", "nextDueAt", "stopRule"):
                    if field in saved:
                        incoming[field] = saved[field]
        serialized = json.dumps(payload, ensure_ascii=False)
        conn.execute(
            """
            INSERT INTO app_state (key, payload, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
              payload = excluded.payload,
              updated_at = excluded.updated_at
            """,
            (STATE_KEY, serialized, now_iso()),
        )
        conn.commit()



def _parse_event_time(value: object) -> datetime:
    text = str(value or "").strip()
    if not text:
        return datetime.now(ET)
    parsed = datetime.fromisoformat(text[:-1] + "+00:00" if text.endswith("Z") else text)
    if parsed.tzinfo is None:
        raise ValueError("occurredAt must include a timezone offset")
    return parsed


def _state_updated_at() -> str | None:
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute("SELECT updated_at FROM app_state WHERE key = ?", (STATE_KEY,)).fetchone()
    return str(row[0]) if row else None


def record_medication_event(payload: dict) -> tuple[dict, bool]:
    """Append an idempotent dose event and atomically update its state projection."""
    event_id = str(payload.get("eventId") or "").strip()
    med_name = str(payload.get("medicationName") or "").strip()
    event_type = str(payload.get("eventType") or "taken").strip()
    occurred = _parse_event_time(payload.get("occurredAt"))
    occurred_at = occurred.isoformat(timespec="seconds")
    if not event_id or len(event_id) > 100: raise ValueError("eventId is required")
    if not med_name: raise ValueError("medicationName is required")
    if event_type not in ("taken", "completed"): raise ValueError("invalid eventType")
    with sqlite3.connect(DB_PATH, timeout=10) as conn:
        conn.execute("BEGIN IMMEDIATE")
        duplicate = conn.execute("SELECT 1 FROM medication_events WHERE event_id=?", (event_id,)).fetchone()
        row = conn.execute("SELECT payload FROM app_state WHERE key=?", (STATE_KEY,)).fetchone()
        state = json.loads(row[0]) if row else {}
        if duplicate: return state, False
        match = next((m for m in state.get("medicationTemplates", []) if str(m.get("name", "")).casefold()==med_name.casefold()), None)
        if match is None: raise ValueError("unknown medication")
        given_by = str(payload.get("givenBy") or "Caregiver")
        conn.execute("INSERT INTO medication_events VALUES (?,?,?,?,?,?,?)", (event_id, str(match.get("name")), event_type, occurred_at, now_iso(), given_by, str(payload.get("notes") or "")))
        previous = _parse_event_time(match.get("lastGivenAt")) if match.get("lastGivenAt") else None
        if previous is None or occurred >= previous:
            match.update(lastGivenAt=occurred_at, givenTime=occurred_at, givenBy=given_by, dispensed=True)
            if event_type == "completed":
                match.update(nextDueAt="", stopRule="Completed")
            else:
                interval = int(match.get("intervalHours", 0) or 0)
                match["nextDueAt"] = (occurred + timedelta(hours=interval)).isoformat(timespec="seconds") if interval > 0 else ""
        conn.execute("INSERT INTO app_state VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at", (STATE_KEY, json.dumps(state, ensure_ascii=False), now_iso()))
        conn.commit()
    return state, True


def write_json_file(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8") + b"\n"
    with tempfile.NamedTemporaryFile("wb", delete=False, dir=path.parent) as tmp:
        tmp.write(data)
        temp_path = Path(tmp.name)
    temp_path.replace(path)


def _current_phase_for_day(day_number: int) -> dict[str, object]:
    phases = [
        {
            "label": "Surgery day",
            "range": "Day 0-1",
            "summary": "Focus on rest, walking as tolerated, icing, elevation, hydration, and getting home safely.",
        },
        {
            "label": "Early home recovery",
            "range": "Days 2-7",
            "summary": "Short frequent walks, steady hydration, ice, elevation, and watching the incision.",
        },
        {
            "label": "Week 2",
            "range": "Days 8-14",
            "summary": "Keep the rehab rhythm steady while range of motion and confidence build.",
        },
        {
            "label": "Weeks 3 to 6",
            "range": "Days 15-42",
            "summary": "Track mobility, swelling, and follow-up progress without rushing heavier activity.",
        },
        {
            "label": "Longer recovery",
            "range": "Day 43+",
            "summary": "Progress keeps building over months, with milestones and follow-up guiding the pace.",
        },
    ]
    if day_number <= 1:
        return phases[0]
    if day_number <= 7:
        return phases[1]
    if day_number <= 14:
        return phases[2]
    if day_number <= 42:
        return phases[3]
    return phases[4]


def build_public_summary(state: dict | None, *, updated_at: str | None = None) -> dict[str, object]:
    state = state or {}
    patient = state.get("patient") if isinstance(state.get("patient"), dict) else {}
    surgery_date_text = str(patient.get("surgeryDate") or "").strip()
    as_of = updated_at or now_iso()
    try:
        as_of_dt = _parse_event_time(as_of)
    except Exception:
        as_of_dt = datetime.now(ET)
        as_of = as_of_dt.isoformat(timespec="seconds")
    recovery_day = None
    if surgery_date_text:
        try:
            surgery_dt = datetime.fromisoformat(f"{surgery_date_text}T12:00:00-04:00")
            recovery_day = max(0, (as_of_dt.date() - surgery_dt.date()).days)
        except ValueError:
            recovery_day = None
    phase = _current_phase_for_day(int(recovery_day or 0)) if recovery_day is not None else {"label": "Recovery", "range": "?", "summary": "Current recovery details are updating."}
    quick_checks = state.get("quickChecks") if isinstance(state.get("quickChecks"), list) else []
    recent_checks = []
    for entry in quick_checks[:8]:
        if not isinstance(entry, dict):
            continue
        recent_checks.append({
            "id": str(entry.get("id", "")),
            "at": str(entry.get("at", "")),
        })
    return {
        "asOf": as_of,
        "patient": {
            "name": str(patient.get("name") or "Denise"),
            "procedure": str(patient.get("procedure") or "Recovery"),
            "surgeryDate": surgery_date_text,
        },
        "stats": {
            "recoveryDay": recovery_day,
            "phase": phase,
            "quickChecksLogged": len(quick_checks),
        },
        "recentChecks": recent_checks,
    }


def resolve_static_path(pathname: str) -> Path | None:
    if pathname == "/":
        candidate = DOCS_DIR / "index.html"
    elif pathname == "/caregiver":
        candidate = DOCS_DIR / "caregiver" / "index.html"
    elif pathname == "/dashboard" or pathname.startswith("/dashboard/meds"):
        candidate = DOCS_DIR / "dashboard" / "index.html"
    elif pathname == "/patient":
        candidate = DOCS_DIR / "patient" / "index.html"
    elif pathname.startswith("/dashboard/") or pathname.startswith("/caregiver/") or pathname.startswith("/patient/"):
        candidate = DOCS_DIR / pathname.lstrip("/")
        if pathname.endswith("/"):
            candidate = candidate / "index.html"
    else:
        candidate = DOCS_DIR / pathname.lstrip("/")
        if pathname.endswith("/"):
            candidate = candidate / "index.html"

    try:
        resolved = candidate.resolve()
    except FileNotFoundError:
        return None

    try:
        resolved.relative_to(DOCS_DIR.resolve())
    except ValueError:
        return None

    return resolved if resolved.is_file() else None


def parse_cookies(header: str) -> dict[str, str]:
    cookie = SimpleCookie()
    cookie.load(header)
    return {key: morsel.value for key, morsel in cookie.items()}


def is_private_path(pathname: str) -> bool:
    if pathname == "/api/dashboard-state":
        return True
    if pathname in ("/dashboard", "/dashboard/", "/patient", "/patient/"):
        return True
    return False


def parse_caregiver_command(text: str, current_state: dict | None) -> dict:
    if not DEEPSEEK_API_KEY:
        return {"error": "AI assistant is not configured"}

    med_names = []
    if current_state and isinstance(current_state.get("medicationTemplates"), list):
        for m in current_state["medicationTemplates"]:
            name = m.get("name", "")
            dose = m.get("dose", "")
            label = f"{name} ({dose})" if dose else name
            med_names.append(label)

    med_list = "\n".join(f"- {n}" for n in med_names) if med_names else "(none)"

    now_edt = datetime.now(ET)
    surgery_date = os.environ.get("SURGERY_DATE", "2026-07-06")
    system_prompt = f"""You are a caregiver assistant for Denise's knee replacement recovery (surgery {surgery_date}).
Your job: parse a caregiver's natural language note into structured JSON actions.

Current time: {now_edt.isoformat()} (Eastern)

PATIENT: Denise, total knee replacement, surgery {surgery_date}, caregiver: Brent.
CURRENT MEDICATIONS:
{med_list}

Output ONLY valid JSON with this structure:
{{"actions": [...], "summary": "brief confirmation"}}

Each action must have a "type" field. Supported types:

- log_medication: {{"type":"log_medication","medication_name":"exact name from list","given_at":"ISO8601","notes":"optional"}}
- log_medication_done: {{"type":"log_medication_done","medication_name":"exact name from list","notes":"optional"}}
- log_nausea_med: {{"type":"log_nausea_med","given_at":"ISO8601","notes":"optional"}}
- log_pain_score: {{"type":"log_pain_score","value":0-10,"given_at":"ISO8601"}}
- log_vital: {{"type":"log_vital","vital_type":"temperature|blood_pressure|heart_rate|nausea_level","value":"string","given_at":"ISO8601"}}
- log_walk: {{"type":"log_walk","distance":"string","duration_minutes":0,"given_at":"ISO8601"}}
- log_ice: {{"type":"log_ice","duration_minutes":0,"given_at":"ISO8601"}}
- log_exercise: {{"type":"log_exercise","description":"string","given_at":"ISO8601"}}
- log_hydration: {{"type":"log_hydration","amount":"string","given_at":"ISO8601"}}
- log_meal: {{"type":"log_meal","description":"string","given_at":"ISO8601"}}
- log_bowel: {{"type":"log_bowel","status":"string","given_at":"ISO8601"}}
- quick_check: {{"type":"quick_check","check_id":"hydration-check|walk-check|ice-check|meal-check|exercise-check|med-check|incision-check|rest-check|bowel-check","given_at":"ISO8601"}}
- log_note: {{"type":"log_note","text":"string","given_at":"ISO8601"}}

RULES:
- CRITICAL: When NO specific time is mentioned (e.g. \"I took Tylenol\", \"pain is 3\", \"did a walk\"), set given_at to the CURRENT time listed above. NEVER use midnight (00:00:00) unless the user explicitly says midnight.
- When the user DOES specify a time (e.g. \"at 4:30 PM\", \"around 2pm\"), use that time on today's date ({now_edt.strftime('%Y-%m-%d')}).
- Timezone is America/Indiana/Indianapolis (EDT, UTC-4).
- For medications, match the medication_name EXACTLY to the list above.
- Use log_medication_done when someone says a medication is finished, done, no more pills, prescription is gone, or they took the last dose. This marks it complete and stops future reminders.
- For scheduled meds, calculate nextDueAt as given_at + intervalHours.
- Tylenol/Acetaminophen has a MAX of 3 doses per 24 hours regardless of the 8-hour interval. Warn in the summary if the caregiver seems to be approaching the 3x/day limit.
- If the medication isn't in the list but is clearly an OTC nausea/digestive med, use log_nausea_med.
- Keep summary to one sentence confirming what was done.
- If text is vague, ask for clarification in the summary."""

    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text},
        ],
        "temperature": 0.1,
        "max_tokens": 600,
    }

    try:
        req = urllib.request.Request(
            "https://api.deepseek.com/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return {"error": f"DeepSeek API error: {exc.code}"}
    except Exception as exc:
        return {"error": f"AI request failed: {exc}"}

    try:
        content = body["choices"][0]["message"]["content"]
        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
            if content.startswith("json"):
                content = content[4:].strip()
        result = json.loads(content)
    except (KeyError, json.JSONDecodeError, IndexError):
        return {"error": "AI returned invalid response", "raw": body}

    return result


def apply_command_actions(state: dict, actions: list[dict]) -> dict:
    import copy
    changes = []
    state = copy.deepcopy(state)

    med_templates = state.get("medicationTemplates", [])
    med_index = {m["name"].lower(): m for m in med_templates if m.get("name")}

    for action in actions:
        action_type = action.get("type", "")
        given_at = action.get("given_at", now_iso())
        changes.append(action_type)

        if action_type == "log_medication":
            med_name = action.get("medication_name", "")
            key = med_name.lower()
            for k, tmpl in med_index.items():
                if key in k or k in key:
                    tmpl["lastGivenAt"] = given_at
                    tmpl["givenTime"] = given_at
                    tmpl["dispensed"] = True
                    tmpl["givenBy"] = "Caregiver"
                    if tmpl.get("notes"):
                        tmpl["notes"] += f" | AI-logged: {given_at}"
                    else:
                        tmpl["notes"] = f"AI-logged: {given_at}"
                    interval = int(tmpl.get("intervalHours", 0) or 0)
                    if interval > 0:
                        # Handle both "Z" and "+00:00" timezone formats
                        given_at_normalized = given_at.replace("Z", "+00:00") if given_at.endswith("Z") else given_at
                        next_dt = datetime.fromisoformat(given_at_normalized) + timedelta(hours=interval)
                        tmpl["nextDueAt"] = next_dt.isoformat()
                    break
            if action.get("notes"):
                pass

        elif action_type == "log_nausea_med":
            for tmpl in med_templates:
                name_lower = tmpl.get("name", "").lower()
                if "nausea" in name_lower or "zofran" in name_lower or "ondansetron" in name_lower:
                    tmpl["lastGivenAt"] = given_at
                    tmpl["givenTime"] = given_at
                    tmpl["dispensed"] = True
                    tmpl["notes"] = (tmpl.get("notes", "") + f" | AI-logged: {given_at}").strip()
                    interval = int(tmpl.get("intervalHours", 0) or 0)
                    if interval > 0:
                        # Handle both "Z" and "+00:00" timezone formats
                        given_at_normalized = given_at.replace("Z", "+00:00") if given_at.endswith("Z") else given_at
                        next_dt = datetime.fromisoformat(given_at_normalized) + timedelta(hours=interval)
                        tmpl["nextDueAt"] = next_dt.isoformat()
                    break

        elif action_type == "log_pain_score":
            score = action.get("value", "")
            note = f"Pain score: {score}/10"
            if action.get("notes"):
                note += f" ({action['notes']})"
            activity = state.setdefault("activityLog", [])
            activity.append({"type": "Pain score", "text": note, "at": given_at})

        elif action_type in ("log_walk", "log_ice", "log_exercise", "log_hydration", "log_meal", "log_bowel"):
            type_label = {
                "log_walk": "Walk", "log_ice": "Cold therapy",
                "log_exercise": "Exercise", "log_hydration": "Hydration",
                "log_meal": "Meal", "log_bowel": "Bowel"
            }.get(action_type, "Activity")
            detail_parts = []
            for k in ("distance", "duration_minutes", "amount", "description", "status"):
                if action.get(k):
                    detail_parts.append(str(action[k]))
            text = " | ".join(detail_parts) if detail_parts else action_type
            activity = state.setdefault("activityLog", [])
            activity.append({"type": type_label, "text": text, "at": given_at})

        elif action_type == "quick_check":
            check_id = action.get("check_id", "")
            checks = state.setdefault("quickChecks", [])
            checks.append({"id": check_id, "at": given_at})

        elif action_type == "log_note":
            notes_list = state.setdefault("notes", [])
            notes_list.append({
                "type": "AI Note",
                "text": action.get("text", ""),
                "at": given_at,
            })

        elif action_type == "log_vital":
            vital_type = action.get("vital_type", "")
            value = action.get("value", "")
            activity = state.setdefault("activityLog", [])
            activity.append({
                "type": f"Vital: {vital_type}",
                "text": str(value),
                "at": given_at,
            })

    return state


class Handler(BaseHTTPRequestHandler):
    server_version = "DeniseRecovery/1.0"

    def do_GET(self) -> None:  # noqa: N802
        self._dispatch(send_body=True)

    def do_HEAD(self) -> None:  # noqa: N802
        self._dispatch(send_body=False)

    def _dispatch(self, send_body: bool) -> None:
        parsed = urlparse(self.path)
        pathname = unquote(parsed.path)

        if pathname == "/api/magic-link":
            self._handle_magic_link(parsed)
            return

        if pathname == "/api/health":
            self._json(HTTPStatus.OK, {"ok": True, "db": str(DB_PATH)}, send_body=send_body)
            return

        if pathname == "/api/public-summary":
            state = load_state()
            if state is None:
                self._json(HTTPStatus.NOT_FOUND, {"error": "dashboard state not found"}, send_body=send_body)
                return
            self._json(HTTPStatus.OK, build_public_summary(state, updated_at=_state_updated_at()), send_body=send_body)
            return

        if pathname == "/api/dashboard-state":
            if not self._has_caregiver_access():
                self._json(HTTPStatus.UNAUTHORIZED, {"error": "caregiver sign-in required"}, send_body=send_body)
                return
            state = load_state()
            if state is None:
                self._json(HTTPStatus.NOT_FOUND, {"error": "dashboard state not found"}, send_body=send_body)
                return
            self._json(HTTPStatus.OK, state, send_body=send_body)
            return

        if is_private_path(pathname) and not self._has_caregiver_access():
            from urllib.parse import quote
            self._redirect(f"/caregiver?next={quote(pathname)}")
            return

        asset = resolve_static_path(pathname)
        if asset is None:
            self._json(HTTPStatus.NOT_FOUND, {"error": "not found"}, send_body=send_body)
            return

        content_type = mimetypes.guess_type(asset.name)[0] or "application/octet-stream"
        self._text(HTTPStatus.OK, asset.read_bytes(), content_type, send_body=send_body)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        pathname = unquote(parsed.path)

        if pathname == "/api/caregiver-session":
            self._handle_caregiver_session()
            return

        if pathname == "/api/caregiver-logout":
            self._clear_caregiver_session()
            self._json(HTTPStatus.OK, {"ok": True})
            return

        if pathname == "/api/caregiver/command":
            if not self._has_caregiver_access():
                self._json(HTTPStatus.UNAUTHORIZED, {"error": "caregiver sign-in required"})
                return
            self._handle_caregiver_command()
            return

        if pathname == "/api/medication-events":
            if not self._has_caregiver_access():
                self._json(HTTPStatus.UNAUTHORIZED, {"error": "caregiver sign-in required"})
                return
            payload = self._read_json_body()
            if payload is None:
                return
            if not isinstance(payload, dict):
                self._json(HTTPStatus.BAD_REQUEST, {"error": "event must be an object"})
                return
            try:
                state, created = record_medication_event(payload)
            except (ValueError, TypeError) as exc:
                self._json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                return
            self._json(HTTPStatus.CREATED if created else HTTPStatus.OK, {"ok": True, "created": created, "state": state})
            return

        if pathname == "/api/admin/update":
            if not ADMIN_TOKEN or not self._authorized_admin():
                self._json(HTTPStatus.UNAUTHORIZED, {"error": "missing or invalid admin token"})
                return
            self._handle_admin_update()
            return

        if pathname != "/api/dashboard-state":
            self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})
            return

        if not self._has_caregiver_access():
            self._json(HTTPStatus.UNAUTHORIZED, {"error": "caregiver sign-in required"})
            return

        payload = self._read_json_body()
        if payload is None:
            return
        if not isinstance(payload, dict):
            self._json(HTTPStatus.BAD_REQUEST, {"error": "dashboard state must be an object"})
            return

        save_state(payload)
        self._json(HTTPStatus.OK, {"ok": True})

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Allow", "GET, HEAD, POST, OPTIONS")
        self.end_headers()

    def _handle_caregiver_session(self) -> None:
        if not CAREGIVER_PIN:
            self._json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "caregiver pin is not configured"})
            return

        payload = self._read_json_body()
        if payload is None:
            return

        pin = str(payload.get("pin", "")).strip() if isinstance(payload, dict) else ""
        if pin != CAREGIVER_PIN:
            self._json(HTTPStatus.UNAUTHORIZED, {"error": "incorrect PIN"})
            return

        cookie = (
            f"{SESSION_COOKIE_NAME}={SESSION_TOKEN}; Path=/; HttpOnly; SameSite=Lax"
        )
        self._json(
            HTTPStatus.OK,
            {"ok": True, "redirectTo": "/dashboard"},
            extra_headers={"Set-Cookie": cookie},
        )

    def _clear_caregiver_session(self) -> None:
        cookie = f"{SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
        self._json(HTTPStatus.OK, {"ok": True}, extra_headers={"Set-Cookie": cookie})

    def _handle_magic_link(self, parsed) -> None:
        import hashlib, hmac, time
        from urllib.parse import quote
        params = dict(q.split("=", 1) for q in parsed.query.split("&") if "=" in q)
        token = unquote(params.get("t", ""))

        if not token or not CAREGIVER_PIN:
            self._redirect("/caregiver")
            return

        try:
            parts = token.split(":", 1)
            expiry = int(parts[0])
            sig = parts[1]
        except (ValueError, IndexError):
            self._redirect("/caregiver")
            return

        payload = f"{expiry}"
        expected = hmac.new(CAREGIVER_PIN.encode(), payload.encode(), hashlib.sha256).hexdigest()[:16]
        if time.time() > expiry or not hmac.compare_digest(expected, sig):
            self._redirect("/caregiver")
            return

        cookie = f"{SESSION_COOKIE_NAME}={SESSION_TOKEN}; Path=/; HttpOnly; SameSite=Lax"
        med = unquote(params.get("m", ""))
        target = f"/dashboard/meds/?med={quote(med)}" if med else "/dashboard/meds/"
        self.send_response(HTTPStatus.FOUND)
        self.send_header("Location", target)
        self.send_header("Set-Cookie", cookie)
        self.end_headers()

    def _handle_caregiver_command(self) -> None:
        payload = self._read_json_body()
        if payload is None:
            return
        text = str(payload.get("text", "")).strip() if isinstance(payload, dict) else ""
        if not text:
            self._json(HTTPStatus.BAD_REQUEST, {"error": "text is required"})
            return
        if not DEEPSEEK_API_KEY:
            self._json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "AI assistant is not configured"})
            return

        current_state = load_state()
        result = parse_caregiver_command(text, current_state)

        if "error" in result:
            self._json(HTTPStatus.BAD_GATEWAY, result)
            return

        self._json(HTTPStatus.OK, result)

    def _handle_admin_update(self) -> None:
        payload = self._read_json_body()
        if payload is None:
            return
        if not isinstance(payload, dict):
            self._json(HTTPStatus.BAD_REQUEST, {"error": "update must be an object"})
            return

        dashboard_state = payload.get("dashboardState")
        if dashboard_state is not None:
            if not isinstance(dashboard_state, dict):
                self._json(HTTPStatus.BAD_REQUEST, {"error": "dashboardState must be an object"})
                return
            save_state(dashboard_state)

        family_updates = payload.get("familyUpdates")
        if family_updates is not None:
            if not isinstance(family_updates, dict):
                self._json(HTTPStatus.BAD_REQUEST, {"error": "familyUpdates must be an object"})
                return
            write_json_file(DOCS_DIR / "family-updates.json", family_updates)

        self._json(HTTPStatus.OK, {"ok": True})

    def _read_json_body(self) -> object | None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid content length"})
            return None

        if length < 0 or length > MAX_BODY_BYTES:
            self._json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": "payload too large"})
            return None

        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid JSON"})
            return None

    def _has_caregiver_access(self) -> bool:
        if not CAREGIVER_PIN:
            return False
        cookies = parse_cookies(self.headers.get("Cookie", ""))
        return cookies.get(SESSION_COOKIE_NAME, "") == SESSION_TOKEN

    def _authorized_admin(self) -> bool:
        token = self.headers.get("X-Admin-Token", "").strip()
        auth = self.headers.get("Authorization", "").strip()
        if not token and auth.startswith("Bearer "):
            token = auth.removeprefix("Bearer ").strip()
        return bool(token and token == ADMIN_TOKEN)

    def _redirect(self, location: str) -> None:
        self.send_response(HTTPStatus.SEE_OTHER)
        self.send_header("Location", location)
        self.end_headers()

    def _json(
        self,
        status: int,
        payload: object,
        *,
        send_body: bool = True,
        extra_headers: dict[str, str] | None = None,
    ) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for key, value in (extra_headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        if send_body:
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def _text(self, status: int, body: bytes, content_type: str, *, send_body: bool) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if send_body:
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def log_message(self, format: str, *args: object) -> None:
        return


def main() -> int:
    init_db()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Serving {DOCS_DIR} on http://{HOST}:{PORT}")
    print(f"SQLite database: {DB_PATH}")
    print(f"Caregiver PIN configured: {'yes' if CAREGIVER_PIN else 'no'}")
    print(f"Admin token configured: {'yes' if ADMIN_TOKEN else 'no'}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
