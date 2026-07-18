from __future__ import annotations

import hashlib
import hmac
import secrets
import time

from fastapi import HTTPException, Request, Response

from .config import Settings


COOKIE_NAME = "denise_caregiver"
COOKIE_MAX_AGE = 12 * 60 * 60


def _secret(settings: Settings) -> str:
    return settings.session_secret or settings.caregiver_pin


def _sign(settings: Settings, value: str) -> str:
    return hmac.new(_secret(settings).encode(), value.encode(), hashlib.sha256).hexdigest()


def create_cookie(settings: Settings) -> str:
    expiry = str(int(time.time()) + COOKIE_MAX_AGE)
    nonce = secrets.token_urlsafe(12)
    payload = f"{expiry}.{nonce}"
    return f"{payload}.{_sign(settings, payload)}"


def valid_cookie(settings: Settings, value: str | None) -> bool:
    if not _secret(settings) or not value:
        return False
    try:
        expiry, nonce, signature = value.split(".", 2)
        payload = f"{expiry}.{nonce}"
        return int(expiry) >= int(time.time()) and hmac.compare_digest(signature, _sign(settings, payload))
    except (ValueError, TypeError):
        return False


def require_caregiver(request: Request) -> None:
    settings: Settings = request.app.state.settings
    if not valid_cookie(settings, request.cookies.get(COOKIE_NAME)):
        raise HTTPException(status_code=401, detail="caregiver sign-in required")


def set_login_cookie(response: Response, settings: Settings) -> None:
    response.set_cookie(
        COOKIE_NAME,
        create_cookie(settings),
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        secure=settings.session_secure,
        samesite="lax",
        path="/",
    )
