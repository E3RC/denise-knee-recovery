# Change Rules

## Protected assumptions

- `docs/index.html` remains the default public landing page until explicitly changed.
- The family update experience is the primary public product.
- The Google Sheet remains the working source for family-safe public updates.
- Caregiver dashboard state now persists in SQLite on the self-hosted server.
- Published caregiver access stays behind the `/caregiver` PIN flow and must not be reframed as a public route.

## Changes that require explicit approval before coding

- Replacing or repurposing `docs/index.html`.
- Adding new public routes.
- Adding authentication, caregiver dashboards, admin tools, or claims of private access.
- Changing the family-safe update flow away from Google Sheets without approval.
- Publishing any content that is not clearly family-safe and public-safe.

## Approved admin path

- A tailnet-only admin API may update caregiver state and regenerate the family-safe feed when the change is explicitly requested.
- The admin API must not expose PII on the public landing page.
- The caregiver dashboard and caregiver API must remain PIN-protected when the host is published to the internet.
- Deployment docs and scripts may harden secret handling, backup steps, and preflight checks as long as they do not widen the public surface area.

## Changes that are generally safe

- Visual restyling that keeps the landing-page role intact.
- Accessibility improvements.
- Mobile-first layout improvements.
- Reliability fixes that do not widen the public data surface.
- Deployment and runbook improvements that keep `.env`, SQLite data, and caregiver exports out of Git.

## Workflow rules

- Use a branch or pull request for non-trivial changes.
- Keep commits scoped so rollback is easy.
- Use GitHub issues as the task queue before coding.
- Start new work with a short issue comment that states intent, files, assumptions, blockers, and a plan.
- Link PRs back to the source issue with `Refs #X` or `Closes #X`.
- Use issue 2 as the standing coordination protocol for Brent, ChatGPT, and Codex.
- Update the docs in this folder when product assumptions change.
- Before a host move, back up `data/recovery.sqlite`, move `.env` out-of-band, and verify `/caregiver` still prompts for a PIN after publish.
- Never commit real `ADMIN_TOKEN`, real `CAREGIVER_PIN`, SQLite databases, or caregiver export artifacts.
- If the requested change conflicts with these rules, stop and document the decision before implementation.
