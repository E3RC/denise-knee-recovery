# Project: Denise Knee Recovery Dashboard

Build a self-hosted recovery dashboard for a total knee replacement caregiver workflow.

## Core goal

Create a private caregiver dashboard and a public/family-safe dashboard.

The public dashboard must NOT show medication names, doses, opioid names, bowel details, or private medical notes.

## Tech stack

Use:

- Docker Compose
- Node.js / TypeScript
- React or Next.js
- SQLite for simple local storage
- Local JSON seed data
- Git-friendly file structure

## Repo structure

```text
denise-knee-dashboard/
  README.md
  docker-compose.yml
  .env.example
  docs/
    PROJECT_SPEC.md
    PRIVACY_RULES.md
    CARE_SCHEDULE.md
    GIT_WORKFLOW.md
  app/
    package.json
    src/
      pages/
      components/
      lib/
      data/
  data/
    recovery-log.sqlite
    seed-schedule.json
```

## Dashboard modes

### Public dashboard

Route:

```text
/dashboard
```

Show only:

- Current recovery day
- Next public task
- Today's activity checklist
- Walks completed
- Ice/compression sessions
- Hydration reminders
- Meals
- Exercises
- Rest/elevation
- Encouraging message

Use generic care language:

- Care check
- Recovery medication check
- Comfort check
- Hydration
- Walk
- Ice & compression
- Exercises
- Rest & elevate

Do NOT show:

- Medication names
- Medication doses
- Pain medicine names
- Opioid names
- Bowel movement details
- Incision photos
- Private caregiver notes

### Caregiver dashboard

Route:

```text
/caregiver
```

PIN protected using env variable:

```env
CAREGIVER_PIN=1234
```

Show:

- Medication tracker
- Actual medication names and doses
- Time given
- Next eligible dose
- Pain score
- Nausea status
- Ice/compression log
- Walk log
- Exercise log
- Hydration log
- Bowel movement tracker
- Temperature
- Notes for surgeon
- Red flag checklist

## Public schedule example

Use this as seed data:

```json
[
  {
    "time": "Morning",
    "task": "Comfort check",
    "public": true,
    "category": "care"
  },
  {
    "time": "Morning",
    "task": "Hydration",
    "public": true,
    "category": "hydration"
  },
  {
    "time": "Morning",
    "task": "Walk",
    "public": true,
    "category": "movement"
  },
  {
    "time": "Morning",
    "task": "Ice & compression",
    "public": true,
    "category": "ice"
  },
  {
    "time": "Midday",
    "task": "Recovery medication check",
    "public": true,
    "category": "care"
  },
  {
    "time": "Afternoon",
    "task": "Walk",
    "public": true,
    "category": "movement"
  },
  {
    "time": "Afternoon",
    "task": "Exercises",
    "public": true,
    "category": "exercise"
  },
  {
    "time": "Afternoon",
    "task": "Ice & compression",
    "public": true,
    "category": "ice"
  },
  {
    "time": "Evening",
    "task": "Dinner / light food",
    "public": true,
    "category": "meal"
  },
  {
    "time": "Evening",
    "task": "Walk",
    "public": true,
    "category": "movement"
  },
  {
    "time": "Bedtime",
    "task": "Final comfort check",
    "public": true,
    "category": "care"
  },
  {
    "time": "Bedtime",
    "task": "Rest & elevate",
    "public": true,
    "category": "rest"
  }
]
```

## Medication privacy model

Medication records should include:

- id
- medication_name
- dose
- instructions
- scheduled_time
- given_time
- next_due_time
- is_prn
- pain_score_before
- pain_score_after
- notes

But public dashboard must only expose:

- Recovery medication check
- status: pending / completed / skipped
- next generic care time

## Database tables

Create SQLite schema:

### patients

- id
- name
- surgery_date
- surgery_type

### care_tasks

- id
- task_label_public
- task_label_private
- category
- scheduled_time
- completed_at
- public_visible
- notes

### medication_events

- id
- medication_name
- dose
- scheduled_time
- given_time
- next_due_time
- is_prn
- pain_score_before
- pain_score_after
- notes

### vitals

- id
- recorded_at
- temperature
- pain_score
- nausea
- dizziness
- notes

### activity_log

- id
- recorded_at
- activity_type
- amount
- unit
- notes

### bowel_log

- id
- recorded_at
- status
- notes

### surgeon_notes

- id
- created_at
- note
- resolved

## Required features

1. Public display page
2. Caregiver login page
3. Caregiver dashboard
4. Add medication event
5. Add pain score
6. Add walk
7. Add ice/compression session
8. Add hydration
9. Add notes
10. Mark public task complete
11. Daily reset while preserving history
12. Export recovery log as CSV and JSON
13. Mobile-friendly layout
14. Large TV-friendly public dashboard

## Visual style

- Clean medical dashboard
- Large readable cards
- High contrast
- Big buttons
- Mobile-first
- TV-safe public view
- No clutter

## Git workflow

Create initial commit with:

- project scaffold
- README
- docker-compose
- SQLite schema
- seed data
- placeholder dashboard

Use branches:

- main = stable
- dev = active work
- feature/public-dashboard
- feature/caregiver-mode
- feature/medication-tracker
- feature/export

## README must include

- how to run locally
- how to run with Docker
- env variables
- privacy rules
- dashboard URLs
- backup/export instructions

## First deliverable

Build a working MVP where:

- `docker compose up -d` starts the app
- `/dashboard` shows the public recovery dashboard
- `/caregiver` asks for PIN
- after PIN, caregiver dashboard appears
- caregiver can log tasks
- public dashboard updates without showing private medication details
