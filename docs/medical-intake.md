# Medical Intake

Source of truth for the Denise recovery workflow:

- Google Sheet: `Denise Knee Recovery Tracker`
- Private dashboard state
- Discharge paperwork and nurse notes
- Doctor notes and photo evidence shared by Brent
- `Dr Knees` review pass
- backup nurse review pass

## Confirmed recovery facts

- Surgery date: 2026-07-06
- Procedure: total knee replacement
- Caregiver: Brent Soper
- Home equipment includes a walker, shower seat, bidet seats, and Pulsar Flow cold therapy
- Sleep window for reminders: 10:00 PM to 6:00 AM
- Temporary exception: ignore the 10:00 PM reminder cutoff until Wednesday morning.
- Incentive spirometer should be reminded twice per hour while awake; overnight reminders are active during the temporary exception.
- Scheduled log-health checks run daily with Pushover notification disabled by default. Use the summary file for status unless a human asks for a manual check.

## Medication rules captured from discharge notes

- Pain meds can start tonight or are PRN as instructed by the surgeon/pharmacy.
- Non-pain meds start tomorrow morning.
- No dose calculations should be invented by the app.
- Reminders should reflect the actual bottle-label directions and logged times.

## Current med schedule intent

- Tylenol: scheduled
- Meloxicam: scheduled
- Aspirin: scheduled
- Lyrica: bedtime
- Stomach protection medicine: scheduled
- Dexamethasone: scheduled
- Cephalexin: scheduled
- Journavx: loading dose tomorrow morning, then 12-hour follow-up timing
- Oxycodone: PRN, timer starts from the logged dose
- Tramadol: PRN, timer starts from the logged dose
- Ondansetron: PRN, dissolves on the tongue; next available reminder should be phrased as optional if nausea returns
- Senokot: PRN / constipation support

## Open items still needing exact transcription

- Exact med start times if the bottle labels specify more precise timing
- Physical therapy appointment details
- Weight-bearing instructions
- Any surgeon-specific restrictions not already captured in the notes
- The live reminder runner on mele01 uses systemd and reads from `data/reminders.json`. Run `--due` or `--forecast` from the repo root for diagnostics.
