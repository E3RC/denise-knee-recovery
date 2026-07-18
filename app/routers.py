from __future__ import annotations

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from .auth import COOKIE_NAME, require_caregiver, set_login_cookie
from .command_parser import parse_command
from .db import load_state, record_medication_event, save_state
from .services import public_summary


router = APIRouter()


class PinRequest(BaseModel):
    pin: str = Field(min_length=1, max_length=128)


class StatePayload(BaseModel):
    model_config = {"extra": "allow"}


class MedicationEvent(BaseModel):
    eventId: str = Field(default_factory=lambda: secrets.token_urlsafe(16), max_length=100)
    medicationName: str = Field(min_length=1, max_length=200)
    eventType: str = Field(default="taken", pattern="^(taken|completed)$")
    occurredAt: str
    givenBy: str = Field(default="Caregiver", max_length=100)
    notes: str = Field(default="", max_length=1000)


@router.get("/api/health")
def health(request: Request) -> dict[str, bool]:
    return {"ok": True}


@router.get("/api/public-summary")
def get_public_summary(request: Request) -> dict:
    state, updated_at = load_state(request.app.state.settings)
    return public_summary(state, updated_at)


@router.post("/api/caregiver-session")
def login(payload: PinRequest, response: Response, request: Request) -> dict[str, object]:
    settings = request.app.state.settings
    if not settings.caregiver_pin or not secrets.compare_digest(payload.pin, settings.caregiver_pin):
        response.status_code = 401
        return {"ok": False, "error": "incorrect PIN"}
    set_login_cookie(response, settings)
    return {"ok": True, "redirectTo": "/dashboard"}


@router.post("/api/caregiver-logout")
def logout(response: Response) -> dict[str, bool]:
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/api/dashboard-state")
def get_state(request: Request) -> dict:
    require_caregiver(request)
    state, _ = load_state(request.app.state.settings)
    return state or {}


@router.post("/api/dashboard-state")
def put_state(payload: StatePayload, request: Request) -> dict[str, bool]:
    require_caregiver(request)
    settings = request.app.state.settings
    save_state(settings, payload.model_dump(), datetime.now(timezone.utc).isoformat(timespec="seconds"))
    return {"ok": True}


@router.post("/api/medication-events")
def medication_event(payload: MedicationEvent, request: Request) -> dict:
    require_caregiver(request)
    settings = request.app.state.settings
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    try:
        state, created = record_medication_event(
            settings,
            event_id=payload.eventId,
            medication_name=payload.medicationName,
            event_type=payload.eventType,
            occurred_at=payload.occurredAt,
            given_by=payload.givenBy,
            notes=payload.notes,
            now=now,
        )
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "created": created, "state": state}


@router.post("/api/caregiver-command")
def caregiver_command(payload: dict, request: Request) -> dict:
    require_caregiver(request)
    text = str(payload.get("text") or "").strip()
    state, _ = load_state(request.app.state.settings)
    return parse_command(text, state, request.app.state.settings.timezone)
