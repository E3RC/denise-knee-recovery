# FastAPI Deployment

The FastAPI application is the default Docker deployment.

## Current entry point

```bash
docker compose --profile reminders up --build
```

It listens on `127.0.0.1:8080` by default. The reminder worker is behind an explicit Compose profile so a web-only deployment cannot send notifications by mistake. Keep the legacy `denise-recovery-reminders.timer` off while the reminder profile is running, or notifications will be duplicated.

Caddy remains the canonical public ingress. Use [deploy/Caddyfile.rewrite.example](../deploy/Caddyfile.rewrite.example) to point the hostname at `127.0.0.1:8080`.

## What is authoritative

- `data/recovery.sqlite` remains the preserved database.
- `medication_events` is the durable medication history.
- `app_state` remains the compatibility projection used by the existing frontend.
- `reminder_deliveries` is the new de-duplication ledger.

The application does not delete or transform existing tables.

## Deployment

1. Run `scripts/backup_sqlite.py`.
2. Start the web service with `docker compose up -d --build` and run `scripts/check-rewrite-canary.sh`.
3. Confirm `CAREGIVER_PIN`, `SESSION_SECRET`, and both Pushover values are present.
4. Point Caddy at `127.0.0.1:8080` and reload Caddy.
5. Verify `/`, `/caregiver`, `/dashboard`, one medication event, then start the reminder profile and verify one reminder cycle. Make sure the legacy reminder timer stays disabled.
6. Roll back by restoring the previous Caddy upstream and stopping the services.
