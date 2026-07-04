# Change Rules

## Protected assumptions

- `docs/index.html` remains the default public landing page until explicitly changed.
- The family update experience is the primary public product.
- The Google Sheet remains the working database unless an approved replacement is documented first.

## Changes that require explicit approval before coding

- Replacing or repurposing `docs/index.html`.
- Adding new public routes.
- Adding authentication, caregiver dashboards, admin tools, or claims of private access.
- Changing the database or data flow away from Google Sheets.
- Publishing any content that is not clearly family-safe and public-safe.

## Changes that are generally safe

- Visual restyling that keeps the landing-page role intact.
- Accessibility improvements.
- Mobile-first layout improvements.
- Reliability fixes that do not widen the public data surface.

## Workflow rules

- Use a branch or pull request for non-trivial changes.
- Keep commits scoped so rollback is easy.
- Use GitHub issues as the task queue before coding.
- Start new work with a short issue comment that states intent, files, assumptions, blockers, and a plan.
- Link PRs back to the source issue with `Refs #X` or `Closes #X`.
- Use issue 2 as the standing coordination protocol for Brent, ChatGPT, and Codex.
- Update the docs in this folder when product assumptions change.
- If the requested change conflicts with these rules, stop and document the decision before implementation.
