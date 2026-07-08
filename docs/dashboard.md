# Manager Dashboard

The manager dashboard is part of the monday.com build, not the Make or portal layer. It should give a manager a fast operational view of workload, risk, and onboarding progress.

The assignment requires these dashboard views:

- Workload by accountant.
- Overdue tasks.
- Clients grouped by onboarding status.

## Recommended Dashboard

Create one monday dashboard, for example `ניהול משרד`, connected to these boards:

- `לקוחות`
- `משימות שוטפות`
- `צוות`, only if the account supports clean staff-based dashboard grouping

Use the current demo relation columns when working in a one-user monday sandbox:

- Client owner: `איש צוות אחראי לדמו`
- Task owner: `איש צוות אחראי לדמו`

Use the real People columns in a production-like account with multiple monday users:

- Client owner: `רואה חשבון אחראי`
- Task owner: `אחראי`

## Required Widgets

### Workload By Accountant

Purpose: show whether work is distributed reasonably across accountants.

Recommended widget:

- Chart widget, bar chart.

Source:

- Board: `משימות שוטפות`.

Grouping:

- Group by `איש צוות אחראי לדמו` for the demo, or `אחראי` for production.

Filter:

- `סטטוס משימה` is not `בוצע`.

Measure:

- Count items.

Expected demo behavior:

- The seed data should show several staff members with different counts of open work.

### Overdue Tasks

Purpose: expose operational risk.

Recommended widget:

- Table widget.

Source:

- Board: `משימות שוטפות`.

Filter:

- `תאריך יעד` is before today.
- `סטטוס משימה` is not `בוצע`.

Useful columns:

- Task name
- `תיק לקוח מקושר`
- `איש צוות אחראי לדמו` or `אחראי`
- `סוג שירות`
- `תקופת דיווח`
- `תאריך יעד`
- `סטטוס משימה`
- `מידע חסר / בקשה מהלקוח`

Expected demo behavior:

- At least one seeded task should be overdue and not done, so the widget is not empty during the walkthrough.

### Clients By Onboarding Status

Purpose: show pipeline health from lead through active client.

Recommended widget:

- Chart widget, stacked bar or pie chart.

Source:

- Board: `לקוחות`.

Grouping:

- `סטטוס קליטה`.

Measure:

- Count items.

Expected demo behavior:

- Seed data should include clients across several statuses: `ליד`, `שאלון נשלח`, `מסמכים התקבלו`, `תיק נפתח`, and `פעיל`.

## Useful Optional Widgets

Add these only if the dashboard remains easy to scan:

- Waiting for client: table from `משימות שוטפות` where `סטטוס משימה = ממתין ללקוח`.
- Upcoming deadlines: table or calendar from `משימות שוטפות` where `תאריך יעד` is in the next 7 days and `סטטוס משימה` is not `בוצע`.
- Active clients by service type: chart from `לקוחות`, grouped by `סוגי שירות`, filtered to `סטטוס קליטה = פעיל`.
- Engagement letters needing attention: table from `לקוחות` where `סטטוס קליטה = תיק נפתח` and `סטטוס מכתב התקשרות` is empty, `טרם נוצר`, or `שגיאה`.

## Demo Notes

The dashboard can be configured manually in monday. The repo currently scripts board schema, demo data, automations, Make scenarios, and portal behavior, but monday dashboard widget creation is more reliable through the UI than through API scripting.

Keep the dashboard as evidence for the assignment requirements. Do not overload it with every field from the system; detailed operational work belongs in the board views.
