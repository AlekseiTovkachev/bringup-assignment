# Open Questions And Assignment Ambiguities

This document captures ambiguity we identify while designing the assignment solution. These questions are intended to be asked back to the client or mentioned as assumptions in the final specification.

## Confirmed By BringUp

- Visible project materials should be Hebrew: monday boards and statuses, client-facing interface, forms/questionnaires, email and letter templates, characterization documents, flowcharts, and presentation materials.
- Implementation details and code can remain in English.
- Demo examples should be created independently for the homework instead of waiting for current client files, spreadsheets, templates, checklists, or reports.
- Additional questions are encouraged as characterization and implementation progress. Include Shalom Schwartz from BringUp's development/implementation team on follow-up questions.

## Questions To Ask The Firm

These are the highest-value questions to ask or mention before implementation. None of them should block the assignment MVP, but each one affects the production version.

1. What client fields are required beyond the assignment fields, and do they change by entity type?
2. What documents are required for onboarding each entity type, and who confirms they are complete and valid?
3. What are the firm's actual service types, recurrence rules, and deadline rules for VAT, payroll, bookkeeping, and annual reports?
4. Are ongoing tasks owned by the assigned accountant by default, or are some services routed to specialists?
5. When is a client file considered active in the firm's real process: after documents are approved, after engagement letter is sent, after signature, or after manual approval?
6. Should the client portal require authentication, such as a magic link, or is tax-ID lookup acceptable only for the demo?
7. What client-facing information may the portal show, and what must remain internal?
8. Who should have access to all client files in monday, and who should see only assigned work?
9. Should the weekly management report be an email, a generated document, or both, and who receives it?
10. Is historical Excel migration expected now, or is it explicitly outside the MVP?
11. If AI is discussed during the interview, should it be treated only as a development aid, or is the firm interested in future product-level AI assistance?

## Resolved For MVP

**Should the main monday item represent the client or the client file?**

Recommended assumption: the `Clients` board contains one item per client file. The client file is the accounting firm's operational record for a client, while the client is the legal or business entity behind that record.

Reasoning: the assignment asks for a `Clients` board, but the Hebrew term `תיק` implies the firm's working file/dossier. Modeling the item as a client file keeps the business language accurate without adding a separate board.

**Should missing client information be part of the main onboarding status?**

Recommended assumption: no. The main onboarding status should remain a linear lifecycle: `Lead`, `Questionnaire Sent`, `Documents Received`, `File Opened`, `Active`. Missing or blocking information should be tracked in a separate field so the current lifecycle stage is preserved.

Reasoning: a client file can be both `Questionnaire Sent` and waiting on missing documents. Treating `Blocked` as a replacement status would lose useful process information and make dashboards less clear.

**What should `Documents Received` mean?**

Recommended assumption: `Documents Received` means all required onboarding documents were received from the client, but the documents have not necessarily been professionally reviewed or approved yet.

Reasoning: receiving documents and approving their quality are different workflow events. The client-facing portal can show that documents were received, while the internal team tracks review using a separate `Document Check` field with values such as `Not Started`, `In Review`, `Approved`, and `Missing/Invalid`.

**What triggers `File Opened`?**

Recommended assumption: `File Opened` means the firm accepted the client and created the internal working file. This status triggers automatic engagement-letter generation.

Reasoning: the assignment says the engagement letter is generated when the client reaches `File Opened`. Therefore `File Opened` cannot mean the engagement letter was already signed. The engagement letter should have its own fields, such as `Engagement Letter Link` and `Engagement Letter Status` with values like `Not Created`, `Created`, `Sent`, and `Signed`.

**When does a client file become `Active`?**

Recommended assumption: a client file becomes `Active` only after readiness is confirmed: required documents are approved, the assigned accountant is confirmed, the engagement letter has at least been sent or signed according to firm policy, and recurring tasks are ready to be created.

Reasoning: `Active` is a business-readiness judgment, not a mechanical result of one field changing. For the MVP, the assigned accountant or admin changes the onboarding status to `Active` manually, and that status change triggers monday automations that create recurring ongoing tasks.

**How should service types affect ongoing task creation?**

Recommended assumption: selected service types drive ongoing task creation. When a client file becomes `Active`, the system creates task instances from predefined task templates for each selected service type.

Reasoning: different clients need different operational work. A client receiving only annual-report service should not get payroll tasks, while a client receiving bookkeeping and VAT reporting should get tasks for those services. For the MVP, a small representative template set is enough.

**Should ongoing tasks be reusable recurring tasks or dated task instances?**

Recommended assumption: ongoing tasks should be dated task instances for a specific reporting period, such as `Prepare VAT report - 2026-07`.

Reasoning: the assignment explicitly requires ongoing tasks to include a reporting month, deadline, responsible person, and status. Period-specific task instances make overdue work, accountant workload, and monthly reporting progress visible in the dashboard.

**Who should own ongoing tasks by default?**

Recommended assumption: ongoing tasks are assigned by default to the client file's assigned accountant, with the option to override the owner on individual tasks.

Reasoning: this keeps the MVP automation simple, supports the assignment's dashboard requirement for workload by accountant, and still leaves room for real firms where payroll, bookkeeping, or annual-report tasks may be handled by specialists.

**Should `Overdue` be a task status?**

Recommended assumption: no. Task status should describe the work state: `Not Started`, `In Progress`, `Waiting for Client`, or `Done`. `Overdue` should be derived from `Due Date < today` and `Status != Done`.

Reasoning: a task can be both `Waiting for Client` and overdue. Keeping lateness as a derived condition preserves the true work state and makes dashboards more reliable.

**How should the client portal identify a client?**

Recommended assumption: the MVP portal uses tax ID/company-number lookup because the assignment explicitly suggests it. The portal should expose only limited demo-safe information: file status, open task names, due dates, and task statuses.

Production question to ask: should the portal require email-based magic-link authentication or another login method? Tax ID alone is not sufficient access control for real client data because company numbers can be known, guessed, or publicly available.

**What should the client portal show?**

Recommended assumption: the client portal is for external clients only and should show a curated view of the client's own file: onboarding/file status, assigned accountant contact if approved, open task names, service types, reporting periods, due dates, task statuses, and missing information requested from the client.

Reasoning: the portal is not a mirror of monday. It should not expose internal notes, manager dashboards, staff workload, sensitive documents, financial records, monday item IDs, or information about other clients.

**What should the portal's write-back action do?**

Recommended assumption: the portal's bonus write-back action should let the client submit a limited response or action confirmation, such as confirming that requested documents or information were sent. This updates client-response fields in monday, such as `Client Response Type`, `Client Response Details`, `Last Client Update`, and an optional update/comment on the client file.

Reasoning: clients can report that they acted, but the firm must still verify receipt and quality. The portal should not automatically set `Documents Received` or `Document Check = Approved`.

**How many monday boards should the MVP use?**

Recommended assumption: use two core boards: `Clients` and `Ongoing Tasks`. The `Clients` board contains one item per client file. The `Ongoing Tasks` board contains period-specific task instances linked back to the client file.

Reasoning: the assignment explicitly requires these two boards and evaluates correct board structure, columns, relationships, and automations. Additional boards such as `Task Templates`, `Staff`, `Service Types`, or `Documents` may be useful later, but for the MVP they add complexity without being required.

**Which columns should the `Clients` board contain?**

Recommended assumption: include the fields required by the assignment: client name, legal/tax ID, entity type, primary contact name, email, phone, assigned accountant, onboarding status, and service types. Add operational fields for missing information, document check, engagement letter status/link, client response, last client update, and linked ongoing tasks.

Reasoning: the required fields satisfy the brief. The added fields support the chosen workflow boundaries: missing information does not overwrite onboarding status, document review is separate from document receipt, engagement-letter generation has somewhere to write its output, and the portal write-back can record client action without approving documents automatically.

**Which columns should the `Ongoing Tasks` board contain?**

Recommended assumption: include the fields required by the assignment: linked client file, owner, due date, reporting period, and task status. Add task name, client-name mirror, legal/tax-ID mirror, service type, missing information/client request, and last updated.

Reasoning: the required fields satisfy the brief. The added fields make the task board usable for filtering, dashboards, portal display, and debugging integrations.

**Which internal monday automations should the MVP include?**

Recommended assumption: include three core monday automations: create linked ongoing tasks when a client file becomes active, notify the task owner when a due date arrives and the task is not done, and surface client-blocked task updates on the linked client file so the assigned accountant knows client action is needed.

Reasoning: these automations directly address the assignment's pain points: manual onboarding, recurring tasks falling between chairs, and lack of visibility into client-file status. A fourth optional automation can notify the assigned accountant when the portal records a client response.

**Should engagement-letter generation and email sending be one Make scenario or two?**

Resolved MVP choice: use one Make hub scenario with a router. The scenario watches monday item changes, fetches the full client file, then routes to either the Google Docs generation branch or the Gmail send branch.

Reasoning: the Make Free license may limit the workspace to two live scenarios, so a single engagement-letter hub leaves room for the weekly management report. The router still keeps generation and sending logically separated: generation runs when the client file reaches `File Opened`; sending runs only after `Engagement Letter Status = Created` and the email/link fields exist.

**Should the weekly management report be an email or a generated document?**

Recommended assumption: send the report as a structured email for the MVP. Include overdue tasks, tasks due this week, tasks waiting for client, load by accountant, and client files blocked by missing information.

Reasoning: email is faster to build, easier for a manager to review, and directly satisfies the assignment. A generated Google Doc can be added later if the firm wants an archived weekly report.

**What should the manager dashboard show?**

Recommended assumption: include the dashboard views required by the assignment: workload by accountant, overdue tasks, and client files by onboarding status. Add tasks waiting for client, upcoming deadlines, and active clients by service type only if the dashboard remains clean.

Reasoning: the dashboard should help managers spot workload pressure and operational risk quickly, not display every possible field.

**Should the MVP include an intake form?**

Recommended assumption: include a monday Form or Fillout intake form as an optional enhancement, not a core dependency. The form should collect client/business name, legal/tax ID, entity type, primary contact, email, phone, requested service types, notes, and any required consent.

Reasoning: the assignment marks the intake form as an advantage. It is useful, but the core score depends more on board structure, automations, Make scenarios, and the portal.

**What is out of scope for the MVP?**

Recommended assumption: exclude accounting ledgers, accounting financial statements, tax calculations, document upload/storage, e-signatures, production-grade authentication, full role-based permissions, historical Excel migration, a complete recurring-task engine, and client billing/payment tracking.

Reasoning: the assignment evaluates workflow design, monday implementation, Make automations, and an API-connected portal. It does not ask for a replacement accounting platform.

**What is the client onboarding flow?**

Recommended assumption: create a lead, assign an accountant, send questionnaire, receive documents, review documents, keep missing information separate from lifecycle status, open the file after client acceptance, generate and send the engagement letter, manually confirm readiness, then activate the client file and create ongoing task instances based on service types.

Reasoning: this flow follows the assignment's required lifecycle while preserving important business boundaries between receipt, review, file opening, engagement-letter handling, and activation.

**What should the minimum live demo path be?**

Recommended assumption: demo one primary client file, such as `Acme Ltd`, through the full lifecycle: lead, questionnaire sent, missing information, documents received, document approval, file opened, engagement-letter generation/sending, active status, ongoing task creation, dashboard visibility, portal lookup, and portal write-back.

Reasoning: a single coherent story is easier to present and defend than disconnected feature clicks. A few additional sample clients can be added only to make dashboard charts meaningful.

**What current firm materials should be requested before implementation?**

Resolved homework choice: do not request current firm materials for this assignment. Build reasonable self-contained demo examples for spreadsheets, email copy, engagement-letter text, onboarding form questions, recurring-task checklists, and management reports.

Reasoning: BringUp replied that demo examples should be built independently for the homework. In a real project, existing artifacts would still be requested because they reveal the firm's real terminology, required fields, service categories, deadlines, and communication style.

## Still Open

**Should the delivered solution include AI assistance?**

Recommended assumption for the assignment: no product-level AI feature is required. The brief's AI note is best read as permission to use AI during planning, development, and interview preparation, while still being able to explain every decision.

Future product question to ask only if relevant: would AI add value to the firm's workflow, and are there acceptable use cases for it given client confidentiality and professional responsibility?

Possible future use cases: draft client emails from approved templates, summarize weekly overdue-task risks for the manager, generate a short explanation of missing information for a client, or help prepare engagement-letter text from a firm-approved template.

Reasoning: accounting-client data is sensitive. If AI is ever added to the product, the safer design is human-in-the-loop: AI can draft or summarize, while staff review and approve anything client-facing.

**What language should the system use?**

Resolved MVP choice: use Hebrew for visible demo surfaces: monday labels and statuses, portal UI, portal API messages, forms/questionnaires, engagement-letter document, Gmail engagement-letter email, automation prompts, default weekly report email, characterization documents, flowcharts, and presentation materials.

Implementation note: keep code identifiers, environment variable names, and API column IDs in English for maintainability. The scripts still support `--lang=en` for intentionally creating an English monday workspace.

Remaining validation question: does monday provide a comfortable Hebrew/right-to-left editing experience for the firm's users, especially in table/grid views, forms, dashboards, automations, and mixed Hebrew-English values?

Reasoning: the assignment is written in Hebrew and the firm's clients are likely Hebrew speakers, so production client-facing workflows should be Hebrew. Hebrew labels are not the same as full RTL ergonomics, so the actual monday workspace should be tested with Hebrew sample data.

**What exact client data is required beyond the fields listed in the assignment?**

Recommended assumption for MVP: store operational onboarding and service-management data only: name, legal/tax ID, entity type, contact person, email, phone, assigned accountant, onboarding status, service types, engagement-letter link, and notes/missing information. Full accounting records remain outside scope.
