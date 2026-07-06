# BringUp Assignment Specification

## Scope

This MVP models client onboarding and ongoing task tracking for a mid-sized accounting firm. The system is centered on monday.com boards, Make automations, and a small client-facing portal.

## Out Of Scope

The MVP does not replace the firm's accounting software. The following are out of scope:

- Accounting ledger or bookkeeping records.
- Accounting financial statements, tax calculations, or actual bookkeeping outputs.
- Full document upload and storage repository.
- E-signature flow.
- Production-grade portal authentication.
- Full role-based permissions model.
- Migration of all historical Excel data.
- Full recurring-task engine for every real-world deadline rule.
- Client billing or payment tracking.

## Client Onboarding Flow

1. A new lead is created manually or through the intake form.
2. An admin or accountant reviews the basic details and assigns an accountant.
3. The onboarding questionnaire is sent and `Onboarding Status` becomes `Questionnaire Sent`.
4. The client returns the questionnaire and requested documents.
5. Staff marks `Documents Received` once all required onboarding documents arrived.
6. Staff reviews the documents using `Document Check`.
7. If information is missing, staff fills `Missing Information`; the main onboarding status is not overwritten.
8. Once the firm accepts the client, staff sets `Onboarding Status` to `File Opened`.
9. Make generates the engagement letter and saves the link on the client file.
10. Make sends the engagement letter and marks it sent.
11. Staff confirms readiness and sets `Onboarding Status` to `Active`.
12. monday creates ongoing task instances based on the selected service types.

## monday Board Design

### Clients Board

The `Clients` board contains one item per client file. A client file is the firm's operational record for a client, not the client's full accounting ledger.

Required by the assignment:

- `Client Name`
- `Legal/Tax ID`
- `Entity Type`
- `Primary Contact Name`
- `Email`
- `Phone`
- `Assigned Accountant`
- `Onboarding Status`
- `Service Types`

In monday, `Client Name` should be the primary item name on the `Clients` board, not a separate text column. Each row/item is a client file, and the first column should contain the client or business name.

Recommended additions for operational completeness:

- `Missing Information`
- `Document Check`
- `Engagement Letter Status`
- `Engagement Letter Link`
- `Client Response`
- `Client Response Details`
- `Last Client Update`
- `Intake Notes`
- `Consent Confirmed`
- `Linked Ongoing Tasks`

The onboarding status follows the main lifecycle:

`Lead -> Questionnaire Sent -> Documents Received -> File Opened -> Active`

Missing information and document review are tracked separately so that the lifecycle stage is not lost when a client file is waiting for client action or staff review.

### Ongoing Tasks Board

The `Ongoing Tasks` board contains dated task instances linked to client files. Each task represents work for a specific service and reporting period.

Required by the assignment:

- `Linked Client File`
- `Owner`
- `Due Date`
- `Reporting Period`
- `Task Status`

Recommended additions for operational completeness:

- `Task Name`
- `Client Name` mirror
- `Legal/Tax ID` mirror
- `Service Type`
- `Missing Information / Client Request`
- `Last Updated`

Task status describes the work state:

`Not Started -> In Progress -> Waiting for Client -> Done`

Overdue work is derived from `Due Date` and `Task Status`, not stored as a status value. This allows a task to remain `Waiting for Client` while still appearing in overdue dashboard views.

### Staff Board For Demo Data

The required production model can use monday `People` columns for `Assigned Accountant` and task `Owner`. In a one-user demo account, a small `Staff` board can be added to simulate a multi-person accounting firm without inviting real users.

Recommended demo fields:

- `Staff Member` as the primary item name
- `Role`
- `Email`
- `Phone`
- `Specialties`
- `Weekly Capacity Hours`
- `Staff Status`

The `Clients` and `Ongoing Tasks` boards can include demo staff relation columns for sample-data grouping and dashboard walkthroughs. These demo staff links do not replace the real `People` columns in a production workspace.

## monday Automations

The MVP uses monday automations for internal workflow changes that should happen inside the monday workspace.

1. When `Onboarding Status` changes to `Active`, create linked ongoing task instances based on the selected service types. In monday this can be implemented with service-specific automations or item templates; if task generation needs more dynamic rules, Make can create the items through the monday API. If Make handles this dynamic task creation, the implementation should still include at least three meaningful internal monday.com automations.
2. When an ongoing task reaches its due date and `Task Status` is not `Done`, notify the task owner.
3. When an ongoing task changes into a client-blocked state, update the linked client file with a clear response-needed indicator and notify the assigned accountant.

Client-response automation for the portal write-back enhancement:

- When a client submits a portal response, update the linked client file with the response type and timestamp, then notify the assigned accountant so the firm can review and decide the next internal status change.

## Manager Dashboard

The dashboard gives management a short operational picture of workload, risk, and onboarding progress.

Required by the assignment:

- Workload by accountant: count of open ongoing tasks grouped by owner.
- Overdue tasks: ongoing tasks where due date is before today and task status is not `Done`.
- Client files by onboarding status: count or chart grouped by `Onboarding Status`.

Recommended additions if the dashboard remains clear:

- Tasks waiting for client.
- Upcoming deadlines for the next 7 days.
- Active clients by service type.

## Intake Form

A monday Form or Fillout form is included as a lightweight intake channel that captures new lead details directly into the `Clients` board.

Recommended fields:

- Client or business name
- Legal/Tax ID
- Entity type
- Primary contact name
- Email
- Phone
- Requested service types
- Free-text notes
- Consent or confirmation checkbox, if required by the firm

On submission, the form creates a new client file with `Onboarding Status = Lead` and notifies the intake owner.

## Client Portal

The client portal is a small Vercel-hosted web app connected to monday. It gives clients a friendly, limited view of their own client file and open requests without exposing the internal monday workspace.

Core capabilities:

- Identify the client file by legal/tax ID for the demo. Production use should add stronger authentication, such as an email magic link.
- Show client-facing onboarding/file status in plain language.
- Show open tasks or requests that need client attention, including due dates and reporting periods where relevant.
- Hide internal notes, staff workload, dashboards, monday item IDs, and information about other clients.

Portal write-back capability:

- Let the client submit a simple response or action confirmation, such as confirming that requested information was sent. The portal should record the response details and timestamp on the client file and notify the assigned accountant, but it should not automatically approve documents or advance internal lifecycle statuses.

## Minimum Demo Path

The implementation should be demoed through one primary client file, supported by a few extra sample clients for dashboards.

Primary demo path:

1. Create demo client file `Acme Ltd`.
2. Set service types to `VAT Reporting` and `Payroll`.
3. Move onboarding status from `Lead` to `Questionnaire Sent`.
4. Add missing information, then clear it.
5. Move onboarding status to `Documents Received`.
6. Set `Document Check` to `Approved`.
7. Move onboarding status to `File Opened`.
8. Show the Make-generated engagement-letter link.
9. Show the engagement-letter email/send status.
10. Move onboarding status to `Active`.
11. Show linked ongoing tasks created from service types.
12. Show dashboard views for workload, overdue tasks, and client-file status.
13. Open the client portal, enter the demo legal/tax ID, and show file status plus open tasks.
14. Submit a client response from the portal and show the monday update.

## Make Scenarios

Make handles cross-system automations between monday, Google Docs, Gmail, and scheduled reporting.

### Scenario 1: Generate Engagement Letter

Trigger: a client file's `Onboarding Status` changes to `File Opened`.

Actions:

- Read client file details from monday.
- Create a Google Docs engagement letter from a template.
- Save the generated document URL to `Engagement Letter Link`.
- Set `Engagement Letter Status` to `Created`.

Error handling:

- If required client details are missing, notify the assigned accountant and leave the engagement-letter status unchanged or set an integration error field.

### Scenario 2: Send Engagement Letter

Trigger: `Engagement Letter Status` changes to `Created` and the client file has an email address and document link.

Actions:

- Send a professional Gmail message to the client with the engagement-letter link.
- Set `Engagement Letter Status` to `Sent`.

Error handling:

- If the email address or document link is missing, notify the assigned accountant and avoid sending a partial or broken message.

### Scenario 3: Weekly Management Report

Trigger: scheduled weekly.

Actions:

- Query open and late ongoing tasks from monday.
- Query client files with missing information.
- Summarize operational risk areas in an email to the office manager.

Recommended report sections:

- Overdue tasks
- Tasks due this week
- Tasks waiting for client
- Load by accountant
- Client files blocked by missing information

Each task row should include client name, service type, reporting period, owner, due date, task status, and a link to the monday item.

Error handling:

- If no matching tasks exist, send a short "no open risks found" email rather than failing silently.
- If monday data cannot be fetched, notify the manager that the weekly report failed.
