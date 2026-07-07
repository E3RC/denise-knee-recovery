# Caregiver Flow Audit

Date: 2026-07-06
Product: Knee'd to Know recovery dashboard
Destination: Local folder, `audits/2026-07-06-caregiver-flow`
Capture tool: Installed Chrome controlled through local Node browser automation. The preferred in-app Browser tool was not exposed in this session.

## Scope

Audited the current self-hosted Tailscale app through the local server at `http://127.0.0.1:8080`.

Screens captured:

1. `01-family-mobile.png` - public family update page
2. `02-caregiver-login-mobile.png` - caregiver PIN screen
3. `03-dashboard-mobile.png` - authenticated caregiver dashboard
4. `04-meds-list-mobile.png` - medication list
5. `05-med-detail-mobile.png` - selected medication detail
6. `06-dashboard-desktop.png` - desktop dashboard
7. `07-meds-list-desktop.png` - desktop medication list

## Step List

1. Public family page - Healthy.
   The family page is readable, family-safe, and does not expose medication detail. The update hierarchy is clear.

2. Caregiver login - Healthy.
   The PIN screen has a clear single task, strong touch target, visible privacy boundary, and no extra distractions.

3. Authenticated dashboard, mobile - Usable but dense.
   The styling is now loading correctly. The dashboard is complete, but the page is long and still asks a tired caregiver to parse many sections.

4. Medication list, mobile - Healthy after cleanup.
   The list now starts with medication names, a dispensed status control, and a small next-dose line.

5. Medication detail, mobile - Improved during audit.
   The selected medication now opens without leaving the full list above it, and timer/Pushover context is limited to the selected medication.

6. Dashboard, desktop - Healthy but visually crowded.
   The desktop layout is consistent and functional. It could use stronger grouping around the top three caregiver actions.

7. Medication list, desktop - Healthy.
   The simplified medication list remains scannable on desktop.

## Strengths

- The public/private split is clear: public family page, PIN-gated caregiver dashboard, private medication workspace.
- The medication list includes the real medication names from the private state, including Oxycodone HCl (IR).
- The safety language is visible and avoids dose calculation or medical-instruction replacement.
- Touch targets are large enough across the main caregiver and medication flows.
- After fixes, the audited flow produced no console errors.

## Issues Found And Fixed

1. Dashboard service worker registration returned 404.
   Evidence: `console-errors.json` showed `/dashboard` trying to register `http://127.0.0.1:8080/sw.js`.
   Fix: changed registration to `/dashboard/sw.js` with scope `/dashboard/`.

2. Missing favicon caused a root-page resource 404.
   Evidence: `console-errors.json` included a root 404 during family-page capture.
   Fix: added explicit icon links to family, caregiver, dashboard, and meds pages.

3. Medication detail mode still repeated the medication list before showing details.
   Evidence: first `05-med-detail-mobile.png` showed the full medication list above Oxy details.
   Fix: detail mode now hides the medication list card and shows only the selected medication context.

4. Medication timer and Pushover panels repeated every medication in detail mode.
   Evidence: first medication detail capture showed all medication timer candidates.
   Fix: timer and Pushover panels now show only the selected medication while in detail mode.

## UX Risks

- The main dashboard is still a long operational page. It works, but it asks for too much scanning during a stressful care window.
- The most important caregiver actions are present, but not yet prioritized as a compact "do this now" control set.
- Some copy is still explanatory rather than operational. The app should increasingly favor short labels and direct controls.

## Accessibility Risks

- Screenshot review can confirm visible target size and rough hierarchy, but not full keyboard focus order or screen-reader output.
- Button labels are mostly clear, but visual contrast and focus states should still be checked with automated tooling and keyboard testing.
- The long dashboard page may be difficult with zoomed text because repeated cards increase vertical burden.

## Evidence Limits

- This was a screenshot and browser-console audit, not a full WCAG audit.
- The audit used local Chrome automation because the Product Design Browser tool was not exposed in this session.
- Pushover delivery, installed iOS browser behavior, and real Tailscale network latency were not measured from screenshots.

## Recommendations

1. Turn the top of the dashboard into a compact command center: next task, meds shortcut, quick log, and safety contact.
2. Move lower-frequency sections like profile, equipment, photo log, and milestones behind collapsible groups or separate pages.
3. Keep the meds page list-first. Avoid putting all medication details on one screen unless a single med is selected.
4. Add a quick error-state checklist before every publish: dashboard CSS 200, JS 200, service worker 200, caregiver login 200, meds page 200, console clean.
5. Run a keyboard and screen-reader pass when the immediate surgery-day pressure eases.
