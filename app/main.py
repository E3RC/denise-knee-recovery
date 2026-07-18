from __future__ import annotations

import time
from pathlib import Path
from urllib.parse import quote

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from .config import load_settings
from .auth import COOKIE_NAME, valid_cookie
from .db import consume_magic_link_token, initialize
from .routers import router


settings = load_settings()
app = FastAPI(title="Denise Knee Recovery", docs_url=None, redoc_url=None)
app.state.settings = settings


@app.on_event("startup")
def startup() -> None:
    initialize(settings)


app.include_router(router)
app.mount("/assets", StaticFiles(directory=settings.docs_dir), name="assets")


def page(path: str) -> FileResponse:
    target = settings.docs_dir / path
    if not target.is_file():
        return JSONResponse({"error": "not found"}, status_code=404)
    return FileResponse(target)


def protected_page(request: Request, path: str) -> FileResponse | RedirectResponse:
    settings = request.app.state.settings
    if not valid_cookie(settings, request.cookies.get(COOKIE_NAME)):
        requested = quote(request.url.path, safe="/")
        return RedirectResponse(f"/caregiver?next={requested}", status_code=303)
    return page(path)


@app.get("/")
def family_page() -> FileResponse:
    return page("index.html")


@app.get("/caregiver")
def caregiver_page() -> FileResponse:
    return page("caregiver/index.html")


@app.get("/dashboard")
@app.get("/dashboard/")
def dashboard_page(request: Request) -> FileResponse:
    return protected_page(request, "dashboard/index.html")


@app.get("/dashboard/meds/")
def medication_page(request: Request) -> FileResponse:
    return protected_page(request, "dashboard/meds/index.html")


@app.get("/patient")
@app.get("/patient/")
def patient_page(request: Request) -> FileResponse:
    return protected_page(request, "patient/index.html")


@app.get("/api/magic-link")
def magic_link(request: Request) -> RedirectResponse:
    settings = request.app.state.settings
    token = str(request.query_params.get("t", "")).strip()
    if not token:
        return RedirectResponse("/caregiver", status_code=303)

    destination = consume_magic_link_token(settings, token, str(int(time.time())))
    if not destination:
        return RedirectResponse("/caregiver", status_code=303)

    response = RedirectResponse(destination, status_code=303)
    from .auth import set_login_cookie

    set_login_cookie(response, settings)
    return response


@app.get("/{asset_path:path}")
def static_asset(asset_path: str) -> FileResponse:
    return page(asset_path)
