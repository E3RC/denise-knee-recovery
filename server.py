#!/usr/bin/env python3
from __future__ import annotations

import json
import mimetypes
import os
import secrets
import sqlite3
import tempfile
from datetime import datetime, timezone
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse
import urllib.request
import urllib.error


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
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


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
    serialized = json.dumps(payload, ensure_ascii=False)
    with sqlite3.connect(DB_PATH) as conn:
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


def write_json_file(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8") + b"\n"
    with tempfile.NamedTemporaryFile("wb", delete=False, dir=path.parent) as tmp:
        tmp.write(data)
        temp_path = Path(tmp.name)
    temp_path.replace(path)


def resolve_static_path(pathname: str) -> Path | None:
    if pathname == "/":
        candidate = DOCS_DIR / "index.html"
    elif pathname == "/caregiver":
        candidate = DOCS_DIR / "caregiver" / "index.html"
    elif pathname == "/dashboard":
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

    system_prompt = f"""You are a caregiver assistant for Denise's knee replacement recovery (surgery 2026-07-06).
Your job: parse a caregiver's natural language note into structured JSON actions.

Current time: {datetime.now(timezone.utc).isoformat()}

PATIENT: Denise, total knee replacement, surgery 2026-07-06, caregiver: Brent.
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
- When the user DOES specify a time (e.g. \"at 4:30 PM\", \"around 2pm\"), use that time on today's date (2026-07-07).
- Timezone is America/Indiana/Indianapolis (EDT, UTC-4).
- For medications, match the medication_name EXACTLY to the list above.
- Use log_medication_done when someone says a medication is finished, done, no more pills, prescription is gone, or they took the last dose. This marks it complete and stops future reminders.
- For scheduled meds, calculate nextDueAt as given_at + intervalHours.
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
    from datetime import timedelta

    tz_edt = timezone(timedelta(hours=-4))
    changes = []
    state = json.loads(json.dumps(state))

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
                        next_dt = datetime.fromisoformat(given_at) + timedelta(hours=interval)
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
                        next_dt = datetime.fromisoformat(given_at) + timedelta(hours=interval)
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

        if pathname == "/api/health":
            self._json(HTTPStatus.OK, {"ok": True, "db": str(DB_PATH)}, send_body=send_body)
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
            self._redirect(f"/caregiver?next={pathname}")
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
            self.wfile.write(body)

    def _text(self, status: int, body: bytes, content_type: str, *, send_body: bool) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if send_body:
            self.wfile.write(body)

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
