# Accounting Firm Client Management

This context describes the operational language for a lightweight client onboarding and service-management system for an accounting firm.

## Language

**Client**:
The legal or business entity served by the accounting firm.
_Avoid_: Account, customer

**Client File**:
The accounting firm's operational record for one client, represented as one item on the Clients board. It includes identity, contact, assignment, onboarding, and service-management details, but not the client's accounting ledger or financial history.
_Avoid_: Client profile, accounting record, CRM account

**Onboarding Status**:
The current stage of a client file before it becomes active, from initial lead through questionnaire, document collection, and file opening.
_Avoid_: Pipeline status, sales stage

**Missing Information**:
Information or documents still needed from the client before the client file can progress. Missing information is tracked separately from onboarding status so the lifecycle stage is not lost.
_Avoid_: Blocked status, missing status

**Document Check**:
The internal review state of documents received from the client. It shows whether the documents still need review, are being reviewed, were approved, or are missing/invalid.
_Avoid_: Document status

**File Opened**:
The onboarding stage where the firm has accepted the client and created the internal working file. It does not mean the engagement letter has already been signed.
_Avoid_: Signed, fully active

**Active**:
The onboarding stage where the client file is ready for ongoing service. The file becomes active only after readiness is confirmed, including approved required documents, assigned accountant, engagement-letter progress, and recurring task setup.
_Avoid_: File opened, automatically ready

**Engagement Letter**:
The formal service agreement document generated for a client file after the file is opened.
_Avoid_: Contract, onboarding document

**Engagement Letter Status**:
The state of the engagement letter workflow, such as not created, created, sent, or signed.
_Avoid_: File status, document check

**Service Type**:
A category of accounting service provided to a client, such as bookkeeping, payroll, VAT reporting, or annual report preparation.
_Avoid_: Product, package

**Task Template**:
A reusable definition of operational work created for a client file based on its service types. A task template describes what work is needed before it becomes a dated ongoing task.
_Avoid_: Automation recipe, checklist item

**Ongoing Task**:
Period-specific operational work linked to a client file after or during onboarding. It is assigned to a staff member and tracked with a due date, reporting period, service type, and status.
_Avoid_: Ticket, issue

**Task Status**:
The work state of an ongoing task, such as not started, in progress, waiting for client, or done. Lateness is derived from due date and completion state, not stored as a task status.
_Avoid_: Overdue status

**Assigned Accountant**:
The staff member primarily responsible for a client file. By default, ongoing tasks created for the client file are assigned to this person unless a specific task owner is set.
_Avoid_: Account owner, salesperson

**Client Portal**:
The external web interface where a client can view limited information about their client file and open tasks. For the MVP it uses tax ID lookup; production use would require authenticated access.
_Avoid_: monday board, Make scenario

**Client Response**:
A client-facing update submitted through the client portal, such as confirming that requested documents were sent. It signals client action but does not replace firm verification.
_Avoid_: Document approval, staff confirmation
