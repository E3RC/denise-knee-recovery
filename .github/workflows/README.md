# Workflow notes

This folder is reserved for future GitHub Actions.

Planned workflows:

1. `publish-family-updates.yml`
   - Read sanitized data from the Google Sheet `Family Updates` tab.
   - Generate `docs/family-updates.json`.
   - Commit the generated file back to the repo.
   - Only publish rows where `Show On Web = YES`.

2. `pushover-reminders.yml`
   - Run scheduled reminder checks.
   - Send Brent-only Pushover messages.
   - Never send family-facing/private medication details to the public site.

Required secrets when ready:

- `PUSHOVER_USER_KEY`
- `PUSHOVER_APP_TOKEN`
- Google service account or other Google Sheets access credentials, if we automate Sheet reads from GitHub Actions

Important: do not commit real tokens, prescription details, private logs, or doctor contact info.
