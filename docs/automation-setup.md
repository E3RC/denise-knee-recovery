# Automation setup

This project can automatically publish the family-safe web page from the Google Sheet.

## What gets published

Only rows from the Google Sheet tab named `Family Updates` are published, and only when:

```text
Show On Web = YES
```

The workflow writes the public JSON feed here:

```text
docs/family-updates.json
```

The public web page reads that JSON file.

## Required GitHub Secrets

Go to:

```text
GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret
```

Add these secrets:

```text
SPREADSHEET_ID
GOOGLE_SERVICE_ACCOUNT_JSON
```

### SPREADSHEET_ID

Use this value:

```text
1JOTV__Eg5X0kdw0rHABoQol9-Hrm4YD4JyehWGGLzR8
```

### GOOGLE_SERVICE_ACCOUNT_JSON

This should be the full JSON key from a Google Cloud service account that has read access to the Google Sheet.

Important:

- Share the Google Sheet with the service account email.
- Give it Viewer access only.
- Do not commit this JSON file into GitHub.
- Paste the whole JSON into the GitHub Secret value.

## Manual run

Go to:

```text
GitHub repo -> Actions -> Publish family updates -> Run workflow
```

## Scheduled run

The workflow runs daily from GitHub Actions. You can also run it manually whenever you update the Family Updates tab.

## Privacy warning

Do not add medication details, private symptoms, doctor contacts, or anything sensitive to the `Family Updates` tab if `Show On Web` is set to `YES`.
