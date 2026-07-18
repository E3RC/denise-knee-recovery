from __future__ import annotations

import re
from datetime import datetime
from difflib import SequenceMatcher
from typing import Any
from zoneinfo import ZoneInfo


def _clean(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


def _best_medication(text: str, medications: list[dict[str, Any]]) -> tuple[dict[str, Any] | None, str | None]:
    cleaned = _clean(text)
    subject = re.sub(r"\b(?:took|take|taken|gave|given|had|medication|medicine)\b", " ", cleaned)
    subject = re.sub(r"\s+", " ", subject).strip()
    candidates = []
    for med in medications:
        name = str(med.get("name") or "").strip()
        if not name:
            continue
        target = _clean(name)
        target_words = target.split()
        primary = target_words[0] if target_words else target
        score = max(
            1.0 if target in cleaned else 0.0,
            SequenceMatcher(None, target, subject).ratio(),
            SequenceMatcher(None, primary, subject).ratio(),
        )
        candidates.append((score, med))
    candidates.sort(key=lambda item: item[0], reverse=True)
    if not candidates or candidates[0][0] < 0.62:
        return None, None
    if len(candidates) > 1 and candidates[0][0] - candidates[1][0] < 0.08:
        return None, "I found more than one possible medication. Please type the medication name more specifically."
    return candidates[0][1], None


def parse_command(text: str, state: dict[str, Any] | None, timezone: str = "America/New_York") -> dict[str, Any]:
    text = text.strip()
    if not text:
        return {"error": "Please type what happened."}
    now = datetime.now(ZoneInfo(timezone)).isoformat(timespec="seconds")
    lower = text.casefold()
    meds = state.get("medicationTemplates", []) if isinstance(state, dict) else []
    meds = [med for med in meds if isinstance(med, dict) and med.get("name")]

    pain_match = re.search(r"\b(?:pain|hurts?|hurting)\b(?:\s+is\s*|\s*[:=]\s*)?(10|[0-9])\s*(?:/\s*10)?", lower)
    if "pain" in lower or "hurts" in lower or "hurting" in lower:
        action: dict[str, Any] = {"type": "log_pain_score", "given_at": now}
        if pain_match:
            action["value"] = int(pain_match.group(1))
            return {"actions": [action], "summary": f"I found pain rated {action['value']}/10. Apply this entry?"}
        action["type"] = "log_note"
        action["text"] = "Pain reported; severity not provided."
        return {"actions": [action], "summary": "I found a pain report but no severity. Apply the note, or type a score such as ‘pain is 4’?"}

    if re.search(r"\b(?:took|take|taken|gave|given|had)\b", lower):
        med, ambiguity = _best_medication(text, meds)
        if ambiguity:
            return {"error": ambiguity}
        if med:
            name = str(med["name"])
            return {
                "actions": [{"type": "log_medication", "medication_name": name, "given_at": now}],
                "summary": f"I matched ‘{text}’ to {name}. Apply this medication entry?",
            }
        return {"error": "I could not match that medication to the current list. Please type the name again, or use the medication buttons."}

    return {"error": "I understood the words, but not the action. Try ‘took Tylenol’ or ‘pain is 4’."}
