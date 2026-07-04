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
