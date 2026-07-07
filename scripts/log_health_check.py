#!/usr/bin/env python3
from __future__ import annotations

import os
import re
import subprocess
import sys
import json
import hashlib
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


DEFAULT_BASE = Path.home() / "Library/Application Support/DeniseRecovery/reminder-runner"
DEFAULT_LOG = DEFAULT_BASE / "reminders-launchd.log"
DEFAULT_ERR = DEFAULT_BASE / "reminders-launchd.err"
DEFAULT_STATE = DEFAULT_BASE / "log-health-state.json"
DEFAULT_SUMMARY = DEFAULT_BASE / "log-health-summary.txt"
DEFAULT_LABEL = "com.denise.recovery.reminders"
DEFAULT_TIMEZONE = "America/Indiana/Indianapolis"

ERROR_PATTERNS = [
    re.compile(r"Missing required env var", re.IGNORECASE),
    re.compile(r"Missing reminder config", re.IGNORECASE),
    re.compile(r"Operation not permitted", re.IGNORECASE),
    re.compile(r"Traceback \(most recent call last\)", re.IGNORECASE),
    re.compile(r"ModuleNotFoundError", re.IGNORECASE),
    re.compile(r"PermissionError", re.IGNORECASE),
    re.compile(r"launchctl.*failed", re.IGNORECASE),
    re.compile(r"error", re.IGNORECASE),
]


@dataclass
class Finding:
    source: Path
    line: str
    signature: str


def main() -> int:
    tz_name = os.environ.get("LOG_HEALTH_TIMEZONE", DEFAULT_TIMEZONE)
    tz = ZoneInfo(tz_name)
    now = datetime.now(tz)

    log_paths = [
        Path(os.environ.get("LOG_HEALTH_STDOUT_PATH", DEFAULT_LOG)),
        Path(os.environ.get("LOG_HEALTH_STDERR_PATH", DEFAULT_ERR)),
    ]
    summary_path = Path(os.environ.get("LOG_HEALTH_SUMMARY_PATH", DEFAULT_SUMMARY))
    state_path = Path(os.environ.get("LOG_HEALTH_STATE_PATH", DEFAULT_STATE))
    agent_label = os.environ.get("LOG_HEALTH_AGENT_LABEL", DEFAULT_LABEL)
    max_lines = int(os.environ.get("LOG_HEALTH_MAX_LINES", "250"))

    state = load_state(state_path)
    if not state:
        state = initialize_state(log_paths)
        save_state(state_path, state)
        write_summary(summary_path, now, [])
        print(f"[{now.isoformat(timespec='seconds')}] log health check initialized")
        return 0
    findings, next_state = scan_logs(log_paths, state, max_lines=max_lines)
    if not findings:
        save_state(state_path, next_state)
        write_summary(summary_path, now, [])
        print(f"[{now.isoformat(timespec='seconds')}] log health check: clean")
        return 0

    write_summary(summary_path, now, findings)
    save_state(state_path, next_state)
    known = seen_signatures(state)
    new_findings = [finding for finding in findings if finding.signature not in known]
    if not new_findings:
        print(f"[{now.isoformat(timespec='seconds')}] log health check: known issues only")
        return 0

    message = format_message(now, new_findings)
    print(message)
    trigger_restart(agent_label)
    remember_signatures(state_path, new_findings)
    maybe_notify(message)
    return 1


def scan_logs(log_paths: list[Path], state: dict[str, object], *, max_lines: int) -> tuple[list[Finding], dict[str, object]]:
    findings: list[Finding] = []
    next_state: dict[str, object] = {"files": {}}
    file_state = state.get("files") if isinstance(state, dict) else {}
    file_state = file_state if isinstance(file_state, dict) else {}
    for path in log_paths:
        if not path.exists():
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            findings.append(Finding(path, f"unreadable log: {exc}"))
            continue
        previous = file_state.get(str(path), {})
        previous = previous if isinstance(previous, dict) else {}
        offset = int(previous.get("offset", 0) or 0)
        if offset > len(text):
            offset = 0
        window = text[offset:]
        next_state["files"][str(path)] = {"offset": len(text), "updated": path.stat().st_mtime}
        lines = window.splitlines() if window else text.splitlines()[-max_lines:]
        for line in lines[-max_lines:]:
            if any(pattern.search(line) for pattern in ERROR_PATTERNS):
                findings.append(Finding(path, line.strip(), hash_line(path, line.strip())))
    return findings, next_state


def format_message(now: datetime, findings: list[Finding]) -> str:
    lines = [f"[{now.isoformat(timespec='seconds')}] log health check found {len(findings)} issue(s)"]
    for finding in findings[:10]:
        lines.append(f"{finding.source.name}: {finding.line}")
    if len(findings) > 10:
        lines.append(f"... {len(findings) - 10} more")
    return "\n".join(lines)


def maybe_notify(message: str) -> None:
    if os.environ.get("LOG_HEALTH_NOTIFY", "false").lower() not in ("1", "true", "yes", "on"):
        return
    user_key = os.environ.get("PUSHOVER_USER_KEY", "").strip()
    app_token = os.environ.get("PUSHOVER_APP_TOKEN", "").strip()
    if not user_key or not app_token:
        return
    payload = {
        "token": app_token,
        "user": user_key,
        "title": "Denise log check found an error",
        "message": message[:1024],
        "priority": "1",
    }
    try:
        import urllib.parse
        import urllib.request

        request = urllib.request.Request(
            "https://api.pushover.net/1/messages.json",
            data=urllib.parse.urlencode(payload).encode("utf-8"),
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=15):
            pass
    except Exception as exc:  # pragma: no cover - alert path best effort
        print(f"pushover notify failed: {exc}", file=sys.stderr)


def trigger_restart(agent_label: str) -> None:
    if not agent_label.strip():
        return
    try:
        subprocess.run(
            ["launchctl", "kickstart", "-k", f"gui/{os.getuid()}/{agent_label}"],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except FileNotFoundError:
        return


def write_summary(path: Path, now: datetime, findings: list[Finding]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [f"Log health check: {now.isoformat(timespec='seconds')}", ""]
    if not findings:
        lines.append("No issues found.")
    else:
        for finding in findings:
            lines.append(f"{finding.source.name}: {finding.line}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def load_state(path: Path) -> dict[str, object]:
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def seen_signatures(state: dict[str, object]) -> set[str]:
    values = state.get("seen_signatures", [])
    if not isinstance(values, list):
        return set()
    return {str(value) for value in values}


def remember_signatures(path: Path, findings: list[Finding]) -> None:
    state = load_state(path)
    current = seen_signatures(state)
    current.update(finding.signature for finding in findings)
    state["seen_signatures"] = sorted(current)
    save_state(path, state)


def initialize_state(log_paths: list[Path]) -> dict[str, object]:
    files: dict[str, object] = {}
    for path in log_paths:
        if not path.exists():
            continue
        files[str(path)] = {"offset": path.stat().st_size, "updated": path.stat().st_mtime}
    return {"files": files}


def save_state(path: Path, state: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def hash_line(path: Path, line: str) -> str:
    return hashlib.sha1(f"{path}:{line}".encode("utf-8")).hexdigest()[:16]


if __name__ == "__main__":
    raise SystemExit(main())
