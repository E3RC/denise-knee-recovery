# Denise Knee Recovery — Final Archive Report

**Site archived:** August 20, 2026  
**Host:** mele01 (Tailscale `100.107.121.28`)  
**Public URL (planned):** `https://recovery.brentanddenise.com` — DNS not configured (NXDOMAIN)  
**Last data update:** `2026-07-14T08:43:26-04:00` (recovery day 8)  
**Surgery date:** `2026-07-06`

---

## 1. Site Architecture

Two Docker Compose stacks ran on mele01:

| Container | Image | Command | Port | Purpose |
|---|---|---|---|---|
| `denise-knee-recovery-app` | `denise-knee-recovery-app` | `python server.py` | 8090→8080 | Original app (Python `http.server`) |
| `denise-knee-recovery-rewrite-web` | `denise-knee-recovery-rewrite-web` | `uvicorn app.main:app` | 8091→8080 | FastAPI rewrite (preferred live path) |
| `denise-knee-recovery-rewrite-reminders` | `denise-knee-recovery-rewrite-reminders` | `python -m app.reminder_worker` | — | Pushover reminder worker |

**Exposure:** No Tailscale Funnel or Serve config was active at archive time ("No serve config"). No Caddy reverse proxy was configured on mele01. The site was accessible only via mele01's TailNet IP at port 8091.

**Configuration (.env):**
- `PUBLIC_BASE_URL=https://recovery.brentanddenise.com`
- `CAREGIVER_PIN=57446516`
- `ADMIN_TOKEN` — set (secret)
- `PUSHOVER_USER_KEY` / `PUSHOVER_APP_TOKEN` — set (Pushover notifications)
- `SESSION_SECRET` — set (secret)
- `REWRITE_HOST_PORT=8091`, `REWRITE_BIND=0.0.0.0`

---

## 2. Patient Profile

- **Name:** Denise
- **Caregiver:** Brent Soper
- **Procedure:** Total knee replacement
- **Surgery date:** 2026-07-06
- **Surgery location:** ASC Surgical Ventures, LLC, 3028 Beacon Parkway, Granger, IN 46530
- **Walker:** Drive Medical 10210-1 walker with front wheels
- **Weight bearing:** Use walker until instructed by therapy/surgery team (typically 2-3 weeks)
- **Follow-up appointment:** 2026-07-30 at 11:15 AM in Navarre
- **Checklist phase (at archive):** `early-home-recovery`

---

## 3. Medications

13 medication templates were tracked. All were dispensed (except Oxycodone and Dexamethasone/Tranexamic acid which were marked complete or PRN).

| # | Medication | Dose | Purpose | Schedule | Interval | Last Given | Dispensed |
|---|---|---|---|---|---|---|---|
| 1 | Oxycodone HCl (IR) | 5 mg tablet | Severe breakthrough pain | PRN | 6h | 2026-07-11T22:25 | No |
| 2 | Tramadol HCl | 50 mg tablet | Moderate pain | PRN | 4h | 2026-07-13T19:14 | Yes |
| 3 | Ondansetron 4 mg (Zofran) | 4 mg tablet | Post-op nausea | PRN | 8h | 2026-07-12T20:40 | Yes |
| 4 | Acetaminophen | 2×500 mg caplets | Baseline pain control | Scheduled | 8h | 2026-07-14T11:07 | Yes |
| 5 | Meloxicam | 15 mg tablet | Anti-inflammatory | Scheduled | 24h | 2026-07-14T12:43 | Yes |
| 6 | Famotidine (Pepcid) | 20 mg tablet | Stomach protection | Scheduled | 24h | 2026-07-13T12:50 | Yes |
| 7 | Cephalexin | 500 mg capsule | Antibiotic | Scheduled | 8h | 2026-07-12T20:39 | Yes |
| 8 | Aspirin EC | 81 mg tablet | Clot prevention | Scheduled | 12h | 2026-07-14T01:29 | Yes |
| 9 | Senokot | 8.6 mg tablet | Constipation prevention | PRN while on pain meds | 12h | 2026-07-14T01:28 | Yes |
| 10 | Pregabalin | 50 mg capsule | Nighttime nerve pain | Scheduled | 24h | 2026-07-13T12:39 | Yes |
| 11 | Journavx | 50 mg tablet | Scheduled post-op pain | Special rule (loading dose then q12h) | 12h | 2026-07-14T01:27 | Yes |
| 12 | Dexamethasone | 4 mg tablet | Post-op steroid | Scheduled | 12h | 2026-07-07T12:25 | No (completed) |
| 13 | Tranexamic acid | 3×650 mg tablets | Bleeding control | Scheduled | 24h | 2026-07-10T01:10 | No (completed) |

**Medication events recorded:** 69 (in `medication_events` table)

Key events:
- `2026-07-10T01:10` — Tranexamic acid: **completed** (prescription finished)
- `2026-07-07T12:25` — Dexamethasone: **completed** (prescription finished)
- All other events between 2026-07-10 and 2026-07-14 were **taken** by the caregiver

---

## 4. Activity Log Summary (65 entries, July 6–14)

**Day 0 (Surgery day — July 6):**
- Home since 3:00 PM; using Recovery Plus chiller and PulsarFlow DVT leg sleeves
- Pain levels: 8 (4:50 PM) → 5 (6:00 PM) → 4 (8:00 PM)
- Discharge instructions entered into private recovery guidance
- Sitting up straight milestone completed
- First Tramadol dose at 4:55 PM
- Evening: Metformin and clonazepam (regular meds), bathroom trip caused shortness of breath
- Quick checks: meals, hydration, ice completed

**Day 1 (July 7):**
- Morning check-in: 4 hours sleep, pain 3.5, cold machine ran all night
- Overnight meds reported: Tylenol ~11 PM, Percocet at 3 AM, Tramadol at 5:30 AM
- 8:08 AM: Tylenol 2×500mg given (next due 4:08 PM)
- 8:15 AM: Meloxicam 15mg taken
- 8:35 AM: Journavx taken, incentive spirometer passed
- 8:53 AM: TXA bottle confirmed (3 tablets at bedtime; surgery-night dose missed)
- 9:00 AM: Called surgeon office about missed TXA dose
- 12:25 PM: Dexamethasone 4mg taken
- 12:31 PM: Pepcid 20mg, Aspirin 81mg, Cephalexin 500mg, Journavx 50mg all taken
- Pain score: 3/10 at midnight
- Evening quick checks: hydration, walk, meal completed
- 10:02 PM: Senokot taken
- 11:45 PM: Aspirin taken

**Days 2–7 (July 8–12):**
- Recovery day 8 reached on July 14
- Pain scores tracked: 5.5/10 (July 10 AM), 6/10 (July 10 PM), 7/10 (July 11), 6/10 (July 12 AM)
- Daily quick check clusters logged on July 9, 11, and 12
- Meals logged (breakfast noted on July 11 at 10:00 AM EDT)
- Walking, ice, hydration, exercise, and rest logged via quick checks
- Medication adherence tracked primarily via Pushover link notifications

**July 9 (recovery day 3):**
- Bulk of recovery data logged around 2:18 AM EDT: ice/elevation, walk, hydration, meal, exercise, rest

**July 11–14:**
- Structured quick check logging: medication check, hydration, ice/elevation, meal, rest/elevation, bowel check, incision check
- Daily medication rounds via Pushover alerts (all 10 active meds taken)

---

## 5. Recovery Notes (9 entries)

1. **Discharge activity:** Rest today, do more tomorrow as tolerated, move every hour while awake, use walker until therapy/surgery team says otherwise.
2. **Pain and swelling:** Keep leg propped on 1–2 pillows under calf/ankle (never under knee), use ice 20–30 min every hour for first few weeks.
3. **Wound care:** Remove bandage 7 days post-op, shower 1–2 days after surgery and pat dry, no creams/ointments on incision, no baths/swimming until cleared.
4. **ACE bandage:** Remove before showering, put back on after, keep using until first PT visit.
5. **Exercises and walking:** Weeks 1–2 focus on motion/swelling control with light walking, heel slides, knee extensions, ankle pumps. Step goals: week 1 up to 750/day, week 2 up to 1200/day, week 3 up to 2000/day.
6. **Call surgeon for:** Redness, heat, incision drainage, swelling not improving with elevation, calf tenderness/redness/pain, fever >101.5, foul-smelling/pus-like drainage, pain not controlled with ice/rest/elevation/meds.
7. **Follow-up appointment:** 2026-07-30 at 11:15 AM in Navarre. OSMC after hours: (877) 713-3731. Beacon Bone & Joint: (574) 647-1670.
8. Dexamethasone: prescription has no more doses remaining.
9. *(Untimestamped note — content empty or lost in migration)*

---

## 6. Quick Checks (8 entries)

| Check ID | Timestamp |
|---|---|
| hydration-check | 2026-07-12T12:38:32.636Z |
| meal-check | 2026-07-12T12:38:36.988Z |
| ice-check | 2026-07-12T12:38:35.654Z |
| walk-check | 2026-07-07T23:16:46.985Z |
| med-check | 2026-07-12T12:38:30.170Z |
| incision-check | 2026-07-11T12:48:32.056Z |
| rest-check | 2026-07-12T12:38:40.916Z |
| bowel-check | 2026-07-12T12:38:45.247Z |

---

## 7. Reminder Delivery Stats

- **Total reminder deliveries:** 1,465 (in `reminder_deliveries` table)
- Delivery types by category:
  - General care (meals, walks, exercises, checks): ~1,377 deliveries
  - Medication reminders: 8 deliveries
- Reminder system delivered Pushover notifications for meals, hydration, ice, medication, walks, exercise, rest, and incision checks
- A live reminder schedule (`reminders.json`) with 5 recurring daily reminders (breakfast 8:30 AM, lunch 12:00 PM, dinner 6:00 PM, evening log 8:00 PM, etc.)

---

## 8. Family Updates

The public family-safe landing page (`docs/family-updates.json`) was last updated 2026-07-09. It contains 1 update entry:

- **July 6 (Day 0):** Surgery day — "Denise had surgery today. We will post simple updates here as recovery gets underway."

---

## 9. Git History

### On mele01 (local, unpushed commits at archive time):
1. `97e2c58` — medication-event-ledger
2. `4afa5b9` — restore-medication-deep-links
3. `f2088d3` — refresh-medication-link-cache
4. `257cc66` — Restore public page entry points
5. `a4d6d23` — Make app scripts executable
6. *(committed locally at archive time)* — Archive: add public-summary API, medication deep links, restore public page entry points, and final doc updates

### On GitHub (main, commits ahead of mele01 at archive time):
- 48 "Publish latest family updates" commits (all modifying `docs/family-updates.json`)
- `d596816` — Add FastAPI recovery application (rewrite)
- `2930683` — Align deployment scripts with FastAPI stack

### Divergence:
mele01's local repo had diverged from GitHub main. At archive time, the mele01 files (server.py, docs, scripts) were overlaid onto the GitHub main checkout, and all changes were committed in a single archive commit.

---

## 10. Recovery Timeline

| Date | Day | Key Events |
|---|---|---|
| 2026-07-06 | 0 (surgery day) | Surgery at ASC Surgical Ventures. Home by 3 PM. First Tramadol at 4:55 PM. Discharge instructions entered. Quick checks for meals, hydration, ice started. |
| 2026-07-07 | 1 | Morning check-in (4h sleep, pain 3.5). Medication rounds started: Tylenol, Meloxicam, Journavx, Dexamethasone, Pepcid, Aspirin, Cephalexin. TXA dose missed, surgeon contacted. Evening recovery logging. |
| 2026-07-08 | 2 | Overnight med reporting, incision check. |
| 2026-07-09 | 3 | Bulk recovery logging (2:18 AM): ice, walk, hydration, meal, exercise, rest. |
| 2026-07-10 | 4 | Pain scores tracked: 5.5 AM, 6 PM. Medication corrections (Tramadol manual correction). |
| 2026-07-11 | 5 | Incision check, bowel check, pain 7/10. Full medication round via Pushover. |
| 2026-07-12 | 6 | Full day: med checks, hydration, ice, meal, incision, rest, bowel. Cephalexin dose completed. |
| 2026-07-13 | 7 | Final medication round: Tramadol, Acetaminophen, Meloxicam, Pregabalin, Famotidine, Senokot, Aspirin, Journavx. |
| 2026-07-14 | 8 | Last data update at 08:43 EDT. Acetaminophen and Meloxicam final logged doses. |

---

## 11. Archive Contents

This archive was created by syncing the running site on mele01 to GitHub at `E3RC/denise-knee-recovery`.

### Code:
- `server.py` — Original app (mele01 version with public-summary API, medication event ledger)
- `app/` — FastAPI rewrite application
- `docs/` — All frontend assets (public landing page, caregiver dashboard, patient view)
- `scripts/` — Deployment and reminder scripts
- `templates/` — Example configs and CSV template
- `docker-compose.yml` / `docker-compose.rewrite.yml` — Docker Compose configs
- `Dockerfile` / `Dockerfile.rewrite` — Container definitions
- `.env.example` — Example environment configuration

### Archived Data:
- `data/recovery.sqlite` — Live database (409KB, from rewrite app; 3 tables: app_state, medication_events, reminder_deliveries)
- `data/reminders.json` — Live Pushover reminder schedule
- `data/reminders.original.json` — Reminder schedule from original app
- `data/reminder-state.json` — Pushover reminder state/delivery tracking
- `archive/.env.rewrite` — Runtime environment configuration (with secrets redacted before commit)
- `archive/recovery-live-20260714-094430.sqlite` — Live backup snapshot from July 14
- `archive/recovery-pre-med-ledger-20260710-163827.sqlite` — Pre-medication-ledger backup from July 10

### Note on .gitignore:
The data files (SQLite, reminders.json, .env.rewrite) were removed from `.gitignore` for this archive commit only. They are included as historical artifacts.
