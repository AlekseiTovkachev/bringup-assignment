# BringUp Assignment - Development Brief

## Project Context

A mid-sized accounting firm, with about 15 employees and 200 clients, wants to build a management system. Today the office works with Excel files and emails, and the main pain points are:

- Onboarding a new client is manual, including collecting documents, opening a client file, and assigning the responsible accountant.
- There is no control over recurring tasks, such as monthly reports, VAT, deductions, and annual reports, so work can fall between the cracks.
- Clients do not have a transparent view of the status of their handling.

The goal is to demonstrate a real short project: characterization, monday.com setup, Make automations, and a small external interface. The important part is not only execution quality, but also the reasoning behind implementation decisions.

## Part A - System Characterization

Before building the system, prepare a short characterization document that covers:

- The onboarding flow for a new client, from lead stage to an active client file.
- The planned board structure: which boards exist, which columns they contain, and how they connect to each other.
- The planned automations: what is handled inside monday.com, what is handled in Make, and why.
- Assumptions and open questions that should be clarified with the firm.

## Part B - monday.com System

Build a workspace that includes at least the following.

### Clients Board

The `Clients` board should track client and client-file information.

Required fields:

- Client name
- Legal entity number / tax ID
- Entity type
- Contact person
- Email
- Phone
- Assigned accountant
- Onboarding status
- Service types, such as bookkeeping, payroll, monthly reporting, VAT, deductions, or annual report

Suggested onboarding statuses:

- Lead
- Questionnaire sent
- Documents received
- File opened
- Active

### Ongoing Tasks Board

The `Ongoing Tasks` board should contain tasks linked to clients using monday.com connected boards and mirror fields.

Required fields:

- Linked client
- Responsible person
- Deadline
- Reporting month / reporting period
- Status

Implementation should use monday.com connected boards and mirror columns so client data is visible from the task board without duplicate manual entry.

### monday.com Automations

Create at least three internal monday.com automations.

Examples of relevant automation intent:

- When a client becomes active, create ongoing tasks for that client.
- When a task is delayed or reaches its deadline, notify the responsible accountant.
- When a task or client-facing request changes status, update the linked client file or notify the relevant staff member.

The automations should be practical and explainable, with clear triggers, conditions, and target updates or notifications.

### Manager Dashboard

Create a management dashboard that shows operational status.

Required dashboard views:

- Workload by accountant.
- Overdue tasks.
- Clients grouped by onboarding status.

### Optional Intake Form

An intake form is an encouraged enhancement, but not required for the core system. It can be built with monday Forms or Fillout and should create new leads directly in the `Clients` board.

## Part C - Make Integrations

Build three Make scenarios.

### Scenario 1 - Create Engagement Letter

When a client reaches the `File opened` status:

- Generate an engagement letter automatically from a Google Docs template.
- Insert client data into the document.
- Save the generated document link back to the relevant monday.com item.

### Scenario 2 - Send Engagement Letter

Send the generated engagement letter to the client by Gmail:

- Use a professional email template.
- Include the generated document link.
- Update the status in monday.com to show that the letter was sent.

### Scenario 3 - Weekly Management Report

Create a scheduled weekly scenario that:

- Collects all open and overdue tasks.
- Sends a summary to the office manager by email.
- Presents the summary as a table or document-style report.

The Make scenarios should include correct field mapping between monday.com, Google Docs, and Gmail, plus basic error handling for issues such as missing email addresses or missing generated document links.

## Part D - External Client Portal

Build a simple web app connected directly to monday.com and deploy it through Vercel.

The portal should let a client identify their file using a legal entity number / tax ID or by choosing from a list. After identification, the client should see:

- Their file or onboarding status.
- Their open tasks or requests.
- The information in friendly, client-facing language.

The portal should use a real monday.com API connection and present the data in a readable, client-facing UX.

### Bonus Client Write-Back

A useful bonus capability is allowing the client to perform a limited action that writes back to monday.com, such as confirming receipt or submission of requested documents. This should update a controlled client-facing request or status, but it should not automatically approve documents or advance internal statuses without staff review.

## Encouraged But Not Required

The assignment mentions a few enhancements and aids that are encouraged, but not mandatory for the core implementation:

- Add a lead intake form using monday Forms, Fillout, or a similar form tool.
- Add a client portal write-back action that updates monday.com when the client submits a limited response or action confirmation.
- Use AI during planning or development if helpful, while still being able to explain the implementation decisions. This does not require adding AI functionality to the delivered system.
