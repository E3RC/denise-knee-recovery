# Project Manager Status

## Current issue map

- #1 Build v0.1 static recovery dashboard PWA
- #2 Dev coordination protocol between Brent, ChatGPT, and Codex
- #4 Issue #4: caregiver data entry and milestone editing
- #6 Fix caregiver dashboard buttons not responding after issue #4 merge
- #8 Self-hosted deployment on mele01
- #9 Denise data handoff for Codex

## Current operating notes

- Keep the family page private/public split intact.
- Keep PII and secrets out of public files.
- Keep the reminder schedule aligned with the discharge packet and logged dose times.
- Do not invent medication timing or dosing.
- Treat the backup nurse role as the source for reminder and med-safety checks.
- Run the scheduled log-health check every 15 minutes to catch launchd or reminder regressions early.

## Open risk

- `vendor/MedAgents` is now present as a local medical-reasoning reference layer for Dr Knees / backup nurse workflow mapping.
- The live reminder runner uses the support-folder config path, so host-side runs must set `REMINDER_CONFIG_PATH=reminders.json` inside the reminder-runner directory.
- The log-health checker watches `reminders-launchd.log` and `reminders-launchd.err`, writes a summary file, and attempts a reminder-agent restart when a real error pattern is detected.
