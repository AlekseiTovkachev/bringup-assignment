# Interview Questions

These are questions worth asking or mentioning during the assignment discussion. They show the assumptions behind the MVP and the places where a real implementation would need firm-specific decisions.

## Process And Scope

1. What language should the system use: Hebrew, English, or a mix across monday, the portal, emails, and generated documents?
2. Can you provide examples of the current Excel files, email templates, engagement-letter template, onboarding questionnaire, recurring task checklist, and manager reports?
3. What client fields are required beyond the assignment fields, and do they change by entity type?
4. What documents are required for onboarding each entity type, and who confirms they are complete and valid?
5. What are the firm's actual service types, recurrence rules, and deadline rules for VAT, payroll, bookkeeping, deductions, and annual reports?
6. Is historical Excel migration expected now, or is it explicitly outside the MVP?
7. Are there duplicate-client rules, such as blocking a second lead with the same legal/tax ID?

## Client Lifecycle

1. When is a client file considered active in the firm's real process: after documents are approved, after engagement letter is sent, after signature, or after manual approval?
2. What exactly does `Documents Received` mean: all required documents arrived, or all documents were reviewed and accepted?
3. What event should trigger `File Opened`: firm acceptance, internal file creation, engagement-letter generation, or engagement-letter signature?
4. Should missing information pause the lifecycle, or should it be tracked separately while preserving the current onboarding status?
5. Which client statuses should be shown externally, and which should remain internal?

## Tasks And Ownership

1. Are ongoing tasks owned by the assigned accountant by default, or are some services routed to specialists?
2. Should recurring work be generated as dated task instances per reporting period, or as reusable recurring tasks?
3. When a task is overdue but waiting for the client, should escalation go to the accountant, manager, client, or more than one person?
4. Which tasks should be visible to clients in the portal, and which are internal-only?
5. What information should each task include in the weekly management report?

## Portal And Permissions

1. Should the client portal require authentication, such as a magic link, or is tax-ID lookup acceptable only for the demo?
2. What client-facing information may the portal show, and what must remain internal?
3. What should the portal write-back be allowed to change: only a comment/client response, or also a controlled status field?
4. Should the portal support choosing from a list of clients for the demo, tax-ID lookup, or both?
5. Does the portal need to be Hebrew/right-to-left for client-facing use?

## Automations And Integrations

1. Should task generation from service types be handled by monday.com automations, Make, or a hybrid?
2. Who should receive automation failure notifications?
3. Should engagement-letter generation and email sending be one Make scenario or two separate scenarios?
4. What should happen if a client has no email address or the engagement-letter link is missing?
5. Should the weekly management report be an email, a generated document, or both, and who receives it?
6. Should the report include only exceptions and risks, or all open work?

## Access And Operations

1. Who should have access to all client files in monday, and who should see only assigned work?
2. Do managers need a separate view from accountants?
3. Are there audit or history requirements for client responses and staff status changes?
4. Should client-facing messages be template-based and approved by the firm?
5. Are there specific data privacy rules the firm wants reflected in the demo or production design?

## AI

1. If AI is discussed during the interview, should it be treated only as a development aid, or is the firm interested in future product-level AI assistance?
2. If product-level AI is ever considered, where would it be acceptable: drafting emails, summarizing overdue work, generating manager-report commentary, classifying missing documents, or helping staff write client updates?
3. What information should AI never process or expose because of client confidentiality?
