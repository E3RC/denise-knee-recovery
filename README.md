# Denise Knee Recovery

Family-safe landing page plus a private caregiver dashboard for Denise's recovery.

## What runs where

- `/` is the public family update landing page.
- `/caregiver` is the caregiver PIN entry page.
- `/dashboard` is the caregiver dashboard after PIN sign-in.
- Caregiver state persists in SQLite when the self-hosted server is running.
- Public updates stay family-safe and should not expose PII.
- When the host is published through Tailscale Funnel, caregiver routes remain PIN-protected by the app. Do not treat them as public pages.

## mele01 move checklist

Use this for the host move on July 6, 2026 so the caregiver state and publish path stay intact:

1. Copy the repo to `mele01`.
2. Copy the current SQLite file from the old host if you need the existing caregiver state:

```bash
scp old-host:/path/to/repo/data/recovery.sqlite ./data/recovery.sqlite
```

3. Copy `.env.example` to `.env`, replace both placeholder values, and lock it down:

```bash
cp .env.example .env
chmod 600 .env
```

4. Keep `.env`, SQLite backups, and any caregiver exports off Git.
5. Run `bash scripts/deploy-mele01.sh`.
6. Verify the public page at `/`.
7. Verify `/caregiver` prompts for the PIN before you share the Funnel URL with anyone.
8. Confirm `tailscale up` is complete and the host is logged into the correct tailnet before you run any deploy helper.

If you do not copy `data/recovery.sqlite`, the family page still works, but caregiver history starts from a fresh database on `mele01`.

## Local run

```bash
python3 server.py
```

Open:

- `http://localhost:8080/`
- `http://localhost:8080/dashboard`

## Docker run

```bash
cp .env.example .env
docker compose up --build
```

The server stores state in `data/recovery.sqlite`.
Before you publish, set real values for `ADMIN_TOKEN` and `CAREGIVER_PIN` in `.env`.
Use long random values and do not reuse the placeholder text from `.env.example`.

## Tailscale internet tunnel

If you want this reachable from the internet through Tailscale, run the app on `mele01` and then expose the local port:

```bash
sudo tailscale funnel --bg --yes 8080
```

That publishes the app through Tailscale without opening a normal inbound port on the host. The family landing page is public at `/`, while caregiver access still requires the PIN flow at `/caregiver`. If you only want tailnet access, use Tailscale Serve instead of Funnel.

For a one-command deploy on `mele01`, use:

```bash
bash scripts/deploy-mele01.sh
```

Or if you want the smaller helper that assumes Docker is already configured:

```bash
bash scripts/tailscale-funnel.sh
```

If you only want private tailnet access:

```bash
bash scripts/tailscale-serve.sh
```

After publishing, confirm both:

- `/` loads the family-safe update page.
- `/caregiver` shows the PIN screen instead of caregiver data.

Rollback / disable:

```bash
tailscale funnel 8080 off
tailscale serve --http=80 localhost:8080 off
```

## Admin updates

Set an admin token before starting the server:

```bash
export ADMIN_TOKEN='your-long-random-token'
```

Then send updates with one request:

```bash
curl -X POST http://localhost:8080/api/admin/update \
  -H 'Content-Type: application/json' \
  -H 'X-Admin-Token: your-long-random-token' \
  -d '{"dashboardState": {...}, "familyUpdates": {...}}'
```

- `dashboardState` replaces the caregiver dashboard state in SQLite.
- `familyUpdates` replaces `docs/family-updates.json` with a family-safe feed.
- Keep admin token use on the host shell or over tailnet-only access. Do not paste it into public docs, issues, or chat logs.

## Pushover reminders

This repo now includes a host-side reminder runner in `scripts/pushover_reminders.py`.

Suggested setup:

```bash
cp templates/reminders.example.json data/reminders.json
python3 scripts/pushover_reminders.py
```

For this Mac, the simplest always-on option is the included launchd agent:

```bash
bash scripts/install-reminders-launchd.sh
```

The installer copies only the Pushover keys into `~/Library/Application Support/DeniseRecovery/reminders.env` so launchd can read them without depending on the repo path.
It also copies the reminder runner and `data/reminders.json` into `~/Library/Application Support/DeniseRecovery/reminder-runner/` because launchd on this Mac cannot read the repo under `Documents` reliably.
On this Mac the launchd agent checks every minute and uses a 30-minute catch-up window so it can still deliver reminders if the machine wakes a little late.

It reads:
- `PUSHOVER_USER_KEY`
- `PUSHOVER_APP_TOKEN`
- `data/reminders.json`

Recommended cron on `mele01`:

```cron
*/5 * * * * cd /path/to/repo && set -a && . ./.env && set +a && python3 scripts/pushover_reminders.py >> /tmp/denise-reminders.log 2>&1
```

The reminder template already includes starter items for meals, medication checks, walks, exercises, and a PT follow-up example. Update the times and messages once Denise's real discharge plan is fully entered.

If reminders still do not arrive, check the launchd logs in `~/Library/Application Support/DeniseRecovery/reminder-runner/reminders-launchd.log` and `~/Library/Application Support/DeniseRecovery/reminder-runner/reminders-launchd.err`, then run `python3 scripts/pushover_reminders.py` once by hand to confirm the key path is still good.

## Caregiver sign-in

- `/caregiver` is the PIN entry page.
- `/dashboard` requires a valid caregiver session cookie.
- `GET` and `POST` to `/api/dashboard-state` require the caregiver session too.
- If `CAREGIVER_PIN` is unset, caregiver login is effectively disabled. Do not publish without setting it.

## Privacy rules

- Keep PII off public pages.
- Do not publish medication names, doses, opioid names, bowel details, or private caregiver notes on the family page.
- Treat emergency guidance as informational only.

## Data flow

- The family page reads `docs/family-updates.json`.
- The caregiver dashboard saves locally in the browser and syncs to SQLite when the API is available.
- The Google Sheet remains the source for family-safe public updates.
- The mele01 handoff is only complete when both `.env` secrets and `data/recovery.sqlite` are moved or intentionally regenerated.

## Backup

- Export dashboard data from the caregiver UI when you want a JSON backup.
- SQLite lives in `data/recovery.sqlite` and can be copied as a file backup.
- Before a host move or risky deploy, make a timestamped copy of `data/recovery.sqlite`.
