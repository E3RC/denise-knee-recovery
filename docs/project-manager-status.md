# Project Manager Status

## Current issue map

- #1 Build v0.1 static recovery dashboard PWA
- #2 Dev coordination protocol between Brent, ChatGPT, and Codex
- #4 Issue #4: caregiver data entry and milestone editing
- #6 Fix caregiver dashboard buttons not responding after issue #4 merge
- #8 Self-hosted deployment on mele01
- #9 Denise data handoff for Codex

Default model for the coordination workflow: `5.4 Mini Light`.

## Current operating notes

- Keep the family page private/public split intact.
- Keep PII and secrets out of public files.
- Keep the reminder schedule aligned with the discharge packet and logged dose times.
- Do not invent medication timing or dosing.
- Treat the backup nurse role as the source for reminder and med-safety checks.
- Run the scheduled log-health check daily with Pushover notifications off by default; use manual checks during active debugging.
- Until Wednesday morning, ignore the 10:00 PM cutoff and keep overnight medication, vitals, and incentive-spirometer reminders active.

## Open risk

- `vendor/MedAgents` is now present as a local medical-reasoning reference layer for Dr Knees / backup nurse workflow mapping.
- The live reminder runner reads `data/reminders.json` from the repo root and runs via systemd timer.
- The reminder runner supports `--due` and `--forecast <minutes>` for proving what will fire without sending Pushover messages.
- The log-health checker watches `reminders.log` and `reminders.err`, writes a summary file, and attempts a systemd service restart when a real new error pattern is detected.
