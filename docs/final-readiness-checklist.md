# Final Readiness Checklist

This checklist compares the assignment brief, `docs/spec.md`, `docs/open-questions.md`, and the current implementation. It focuses on remaining checks, implementation gaps, refinement work, and decisions before submission/presentation.

## Current Baseline

- monday board schema is scripted: `Staff`, `Clients`, and `Ongoing Tasks`.
- Live monday boards were regenerated and demo data is seeded:
  - Staff: `5099974938`
  - Clients: `5099974942`
  - Ongoing Tasks: `5099974963`
- Portal is Hebrew/RTL, connected to monday, supports client dropdown plus manual legal/tax ID lookup, shows status/tasks/accountant, and writes a controlled client response back to monday.
- Engagement-letter Make hub is scripted, recreated, active, and documented as a router scenario with Google Docs generation and Gmail sending: `6493164`.
- Weekly management report scenario is scripted, recreated, and active: `6493169`.
- monday automations were created through the connector:
  - 5 active workflows on `Clients`.
  - 2 active workflows on `Ongoing Tasks`.
- Dashboard setup is documented for manual monday configuration.
- Intake form payloads are scripted, and the agreed delivery path is to add a monday Form/intake queue and include it in the demo checklist.
- BringUp said mirror columns are not a strict concern for this submission.
- BringUp accepted the current Make scenario-count design: one engagement-letter hub with router branches is fine.

## Highest Priority Remaining

- [ ] **Update deployed/Vercel env vars**
  - Vercel must use the regenerated monday board IDs and column IDs from `.env`.
  - Recheck deployed `/api/portal-client-options`, `/api/portal-client`, and `/api/portal-response` after updating.

- [ ] **Run the real engagement-letter demo**
  - Pick the exact demo client state.
  - Trigger `סטטוס קליטה -> תיק נפתח`.
  - Confirm Google Doc is created, filename is Hebrew, accountant name appears, monday link/status update works.
  - Trigger/send path and confirm Hebrew email plus `נשלח` status.

- [ ] **Eyeball the monday waiting-for-client automation**
  - The automation was created and active, but monday simplified the linked-client update part.
  - Confirm in the monday UI whether it really updates the linked client as intended.
  - If it does not, keep only date/notification behavior and explain linked-client update as a Make/future refinement.

- [ ] **Create the intake form**
  - Add monday Form view or intake queue.
  - Include the agreed fields and confirm the new-lead defaults automation applies.

- [ ] **Create the dashboard**
  - Workload by accountant.
  - Overdue tasks.
  - Clients by onboarding status.
  - Use seeded data to make every widget non-empty.

- [ ] **Prepare Hebrew presentation/demo materials**
  - Short Hebrew walkthrough.
  - Architecture/flow explanation.
  - Security limitation sentence.
  - Clarify that implementation/code artifacts can stay English.

## Must Check Before Submission

- [ ] **Portal live smoke test**
  - `npm run portal:smoke` already passed for the non-live local UI/API-mock smoke test.
  - Live service check against regenerated boards already returned 5 clients and `Acme Ltd -> Dana Cohen`.
  - Run the portal locally or on Vercel with real env vars.
  - Verify the client dropdown loads from monday.
  - Select `Acme Ltd` and confirm the legal/tax ID field fills.
  - Confirm the accountant panel shows `Dana Cohen`.
  - Confirm open tasks render.
  - Submit a client response and confirm monday updates `תגובת לקוח`, `פירוט תגובת לקוח`, and `עדכון אחרון מהלקוח`.

- [ ] **Vercel deployment/env check**
  - Confirm the deployed URL works, not only local code.
  - Confirm Vercel has `MONDAY_API_TOKEN`, board IDs, and column IDs.
  - Confirm `/api/portal-client-options`, `/api/portal-client`, and `/api/portal-response` work in the deployed environment.

- [ ] **Make engagement-letter live check**
  - Export or inspect scenario `6493164`.
  - Confirm scheduling is `immediately`, not on-demand or polling.
  - Confirm module `10` is `gateway:CustomWebHook`.
  - Confirm `GetItemV2` maps the item ID from the webhook payload.
  - Confirm monday calls the Make webhook when `סטטוס קליטה` changes to `תיק נפתח`.
  - Confirm monday calls the Make webhook when `סטטוס מכתב התקשרות` changes to `נוצר`.
  - Confirm generate branch filters on `סטטוס קליטה = תיק נפתח` and letter status not already created/sent.
  - Confirm send branch filters on status `נוצר`, link exists, and email exists.
  - Confirm generated document name is Hebrew.
  - Confirm document template replacements include accountant name.
  - Run one controlled test client through `תיק נפתח -> נוצר -> נשלח`.

- [ ] **Weekly management report live check**
  - Confirm live scenario `6493169` exists and is scheduled weekly.
  - Confirm recipient email is correct.
  - Confirm subject/body are Hebrew.
  - Confirm report sections include overdue, due soon, waiting for client, workload, and clients with missing information.
  - Send/run one test report if Make allows.

- [ ] **monday automations live check**
  - Connector list confirms 7 active workflows total.
  - Required minimum:
    - [x] Active client creates ongoing tasks.
    - [x] Open task due date notifies owner.
    - [ ] Waiting-for-client task updates/notifies linked client/accountant.
  - Optional bonus:
    - [x] Portal response notifies assigned accountant.
    - [x] Intake form defaults new leads.

- [ ] **Dashboard live check**
  - Confirm dashboard exists in monday.
  - Required widgets:
    - Workload by accountant.
    - Overdue tasks.
    - Clients grouped by onboarding status.
  - Confirm seeded data makes each widget non-empty/useful.

## Decisions Already Confirmed

- [x] **Mirror columns on `Ongoing Tasks`**
  - BringUp does not treat mirroring as important for this submission.
  - Current default setup can stay relation-first.
  - Mirror columns remain optional through script flags if there is time.

- [x] **Make scenario count expectation**
  - BringUp accepted the current design.
  - Keep the engagement-letter hub with router branches for generation/sending instead of splitting only to satisfy a scenario count.

## Still Implement Or Verify

- [ ] **Intake form**
  - User wants to implement it.
  - Agreed path: add a monday Form view or intake queue and include it in the final checklist/demo.
  - Best path if monday allows it cleanly: add the Form view on `לקוחות`, so submissions create lead items directly in the `Clients` board.
  - Fields: client/business name, legal/tax ID, entity type, contact name, email, phone, service types, notes, consent.
  - Add/default fields for new submissions:
    - `סטטוס קליטה = ליד`
    - `בדיקת מסמכים = טרם נבדק`
    - `סטטוס מכתב התקשרות = טרם נוצר`
    - `תגובת לקוח = אין תגובה`
  - If monday only creates a separate form-response board, present it as an optional intake queue and map/move accepted leads into `לקוחות`.

- [ ] **Make error handling**
  - Current route filters prevent broken sends when email/link is missing.
  - Check whether the scenario visibly notifies someone on missing required data or module failure.
  - If not, either add a clear monday update/notification path or state the MVP uses guard filters plus audit updates as basic handling.

## Refinement

- [ ] **Hebrew submission package**
  - BringUp confirmed visible materials should be Hebrew.
  - Portal/monday/letters/emails are Hebrew, but many repo docs are English.
  - Create or translate the final-facing characterization package:
    - onboarding flow,
    - board structure,
    - automations split between monday and Make,
    - assumptions/open questions,
    - flowcharts,
    - demo script.
  - Code docs can remain English, but final presentation materials should be Hebrew.

- [ ] **Demo script**
  - Write a short Hebrew walkthrough:
    1. Show boards and key columns.
    2. Show onboarding statuses.
    3. Move a client to `תיק נפתח`.
    4. Show generated engagement letter link.
    5. Show/send email state.
    6. Move client to `פעיל`.
    7. Show tasks/dashboard.
    8. Open portal, choose client, send update.
    9. Show monday write-back.

- [ ] **Demo data reset**
  - Decide the exact starting state for `Acme Ltd`.
  - Make sure statuses, engagement-letter fields, and tasks are in a state that will let the demo run smoothly.
  - Avoid accidentally starting from `נשלח` if the demo needs to show generation.

- [ ] **Portal UX visual check**
  - Check desktop and mobile widths.
  - Confirm Hebrew text does not overflow.
  - Confirm the response radio group is clearly selected and submits correctly.
  - Confirm the native client dropdown is acceptable RTL; if not, use manual lookup during demo or replace it later.

- [ ] **Security explanation**
  - Prepare one sentence: tax-ID/list lookup is demo-only; production would require magic link/login and stricter authorization.

- [ ] **Repository cleanup**
  - Review untracked/modified files.
  - Decide what should be committed/submitted.
  - Ensure `.env` and generated tmp files remain ignored.
  - Keep `bringup-make-handoff-2026-07-07.md` only if useful for handoff; otherwise exclude from final package.

## Lower Priority

- [ ] Add direct browser automation/screenshot verification for portal.
- [ ] Add fuller Make failure routes for module errors.
- [ ] Add a real generated document-style weekly report if email alone feels too light.
- [ ] Add production auth skeleton only if explicitly expected.
- [ ] Add upload support only as a future improvement; it is out of scope for the MVP.
