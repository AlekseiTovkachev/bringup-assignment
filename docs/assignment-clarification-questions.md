# Assignment Clarification Questions

These are the few questions worth sending before final submission. They focus only on points that may affect assignment acceptance or require changing the built demo.

## Already Confirmed By BringUp

- Visible project materials should be Hebrew: monday boards and statuses, client-facing interface, forms/questionnaires, email and letter templates, characterization documents, flowcharts, and presentation materials.
- Implementation details and code can remain in English.
- Demo examples should be created independently for the homework. Do not wait for current client Excel files, real engagement-letter templates, onboarding questionnaires, checklists, or management reports.
- Additional questions are encouraged as characterization and implementation progress. Include Shalom Schwartz from BringUp's development/implementation team on follow-up questions.

## Recommended To Send

1. The brief describes three Make scenarios: create engagement letter, send engagement letter, and weekly management report. Is it acceptable to implement the first two as separate branches inside one router-based Make scenario, as long as the generation and email-send logic are clearly separated, or do you expect three separate Make scenarios in the Make workspace?

2. The brief says the `Ongoing Tasks` board should use connected boards and mirror fields so client data is visible from the task board. For the demo, is a connected-board relation with the key client fields available through the relation enough, or should mirror columns such as client name and tax ID be visibly configured on the task board?

3. The portal demo supports both choosing a client from a list and entering a legal/tax ID manually. From an information-security perspective, is it enough to state that this is a demo-only access model and that production would require stronger authentication, such as an email magic link, or do you expect a basic authentication layer in the homework implementation?

## Do Not Send Unless They Ask For More Detail

These are useful professional considerations, but they are probably small enough for the homework implementer to decide and state as assumptions:

- Exact business meaning of `File Opened` and `Active`.
- Whether missing information pauses the lifecycle or lives in a separate field.
- Entity-specific document requirements.
- Whether service tasks route to the assigned accountant or specialists.
- Whether recurring work is modeled as dated task instances or reusable recurring tasks.
- Portal authentication for production.
- Which specific tasks are client-visible.
- Weekly report recipient and exact report sections.
- Whether the optional intake form writes directly to `Clients` or starts as a separate intake-response queue.
- Duplicate-client handling.
- Historical Excel migration.

## Current MVP Assumptions To State If Not Clarified

- Core boards are `Clients` and `Ongoing Tasks`; `Staff` is a demo-support board for a one-user monday sandbox.
- The main client lifecycle is `Lead -> Questionnaire Sent -> Documents Received -> File Opened -> Active`.
- Missing information and document review are tracked separately from the main lifecycle status.
- `Overdue` is derived from due date and task status, not stored as a task status.
- Engagement-letter generation and sending are implemented in one Make hub scenario because of Make plan limits, while still preserving separate route logic.
- The portal is a limited client-facing view, not a mirror of monday.
- Portal write-back records client response details and does not approve documents or advance internal statuses automatically.
- Demo forms, letters, emails, task checklists, and reports use self-created sample content.
