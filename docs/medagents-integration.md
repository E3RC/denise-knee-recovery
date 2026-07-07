# MedAgents Integration

Vendored reference copy:

- `vendor/MedAgents`

## What it is used for

- Medical-reasoning workflow reference
- Agent role inspiration for `Dr Knees`
- Multi-expert evidence gathering structure

## What it is not used for

- It does not replace surgeon instructions.
- It does not invent medication timing or dosing.
- It does not write to the public family page.

## How it maps to this project

- Expert gathering -> doctor notes, nurse notes, discharge packet, Google Sheet
- Analysis proposition -> Dr Knees review pass
- Report summarization -> project manager summary
- Collaborative consultation -> backup nurse / med-safety check
- Decision making -> final schedule, reminders, and caregiver checklist updates

## Operational rule

Use the vendored MedAgents source as a reference layer, not as an autonomous medical authority.

## Current project usage

- `Dr Knees` should review doctor notes, nurse notes, and the Google Sheet before suggesting schedule changes.
- The backup nurse pass should verify reminders, next-dose timers, and sleep-window rules.
- The project manager should keep Issue #1, #2, #4, #6, #8, and #9 aligned with the live state.
