# Denise Knee Recovery Dashboard - ChatGPT Project History

This document summarizes the design discussions between Brent and ChatGPT so Codex has the architectural context.

## Goal
Build a caregiver dashboard for Denise's outpatient total knee replacement.

## Known Equipment
- Drive Medical 10210-1 walker with front wheels
- Built-in shower seat
- Elevated bidet toilet seats
- Pulsar Flow automated cold therapy system

## Dashboard Vision
- Mobile-first caregiver command center
- "What's Next" workflow
- Medication Administration Record (MAR)
- Recovery log
- Pain tracking
- Walking/PT tracking
- Milestones
- Emergency contacts
- Equipment inventory
- Exportable recovery history

## Architecture
- Static GitHub Pages application
- PWA
- LocalStorage initially
- JSON data model
- Expandable to backend later

## Workflow
ChatGPT acts as product owner / architect.
Codex performs implementation.
ChatGPT reviews completed work and writes the next implementation specification.

## Important Note
Avoid regenerating existing files. Always inspect the current codebase before implementing the next feature. Build incrementally on the existing implementation.

## Next Major Feature
Implement a Recovery Engine that drives the UI state (Pre-op, Surgery Day, Home Recovery, Weeks 2-6) and powers the dynamic "What's Next" panel, task scheduling, milestone progression, and daily workflow.

## Ops Update
- Local Pushover reminders on the Mac run through a launchd agent because the repo lives under `Documents` and launchd cannot reliably read that path here.
- The launchd copy uses support-folder secrets and a support-folder runner copy under `~/Library/Application Support/DeniseRecovery/reminder-runner/`.
- Reminder delivery is intentionally frequent and forgiving so scheduled items are less likely to be missed if the machine wakes late.
- Keep all PII and secrets out of public pages and Git history.
