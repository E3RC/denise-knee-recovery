# Denise Knee Recovery

Recovery tracker for Denise's total knee replacement, with a public family update page and a caregiver dashboard.

## Project overview

- Primary caregiver: Brent Soper
- Long-term direction: reusable open-source recovery dashboard for multiple surgery types
- Current deployment target: static GitHub Pages from `docs/`

## Where things live

- Public family landing page: `docs/index.html`
- Caregiver dashboard: `docs/dashboard/index.html`
- Shared public assets: `docs/style.css`, `docs/app.js`
- Issue-first workflow rules: `docs/CHANGE_RULES.md`

## Working model

- ChatGPT and Brent use GitHub Issues as the task queue.
- Codex reads issue context, implements the next increment, and opens a PR that references the source issue.
- ChatGPT review notes on GitHub are treated as project input.

## Product intent

- Reduce caregiver mental load
- Track medications
- Track recovery progress
- Present a "What's Next?" workflow
- Maintain a complete recovery journal
- Export data for surgeon follow-ups

## Data model

The dashboard keeps a clear split between:

- seed/default content: patient info, equipment, contacts, and milestone templates
- user-entered state: log entries, checklist state, notes, and exported data

Current dashboard persistence uses `localStorage` for:

- `surgeryDate`
- `checklist`
- `activityLog`
- `meds`
- `timeline`
- `equipment`
- `notes`

The dashboard also exposes CSV and JSON export so the state can later move to a Sheet-backed or API-backed store without changing the UI first.

## Run locally

Open the repo in a static server pointed at `docs/`, or load `docs/index.html` directly if your browser allows local file access.

Example:

```bash
cd /path/to/denise-knee-recovery
python3 -m http.server 8000 -d docs
```

Then open:

- `http://localhost:8000/`
- `http://localhost:8000/dashboard/`

## Hosting

- GitHub Pages remains the current free host for the public site.
- The dashboard is kept under `docs/dashboard/` so it can be served from the same Pages site.
- If the data layer later moves to Google Sheets or an API, the static UI can stay in place.

## Storage

- Public family content stays in repo-backed static files.
- Caregiver state currently stays in browser `localStorage`.
- Google Sheets remains the working database for sheet-driven updates when that workflow is used.

## Export and import

- JSON export/import is built into the dashboard.
- CSV export is available for quick follow-up review.
- A printable follow-up summary is available for visits.

## Safety

- This app is not medical advice.
- Do not invent medication timing or doses.
- Use only surgeon/pharmacy instructions for actual medication handling.
- Keep private medical details off public pages, issue comments, and deployment artifacts.

## Project docs

- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_NOTES.md`
- `docs/RECOVERY_PROTOCOL.md`
- `docs/ROADMAP.md`
- `docs/dashboard/index.html`
- `docs/PRODUCT_DECISIONS.md`
- `docs/PRIVACY_MODEL.md`
- `docs/DEPLOYMENT_CHECKLIST.md`
- `docs/CHANGE_RULES.md`
