# Implementation Notes

## monday Board Creation Script

`scripts/create-monday-boards.mjs` creates the core monday.com boards and columns for the assignment:

- `Staff`
- `Clients`
- `Ongoing Tasks`
- Required and recommended operational columns from the specification

The script is intended to be rerunnable:

- If a board ID is already configured in `.env`, the script reuses that board.
- If a column ID is already configured in `.env`, the script skips that column.
- If a column already exists on the board with the same API ID or title, the script reuses it instead of creating a duplicate.
- If `--fresh` is passed, the script archives the boards currently configured in `.env`, ignores stale board/column IDs for that run, and creates a clean set of boards.
- If `--write-env` is passed, the script updates `.env` with the board and column IDs it just created or reused.

The `Clients` board uses monday's primary item-name column as the client name. Do not create a separate `Client Name` text column on that board. In `.env`, `MONDAY_CLIENT_NAME_COLUMN_ID=name` is a convention that means "use the item name".

Monday still calls rows "items" in parts of the API, but each item on the `Clients` board represents one client file. The script sets board item terminology to `Client/Clients` and `Task/Tasks` when it creates new boards. For existing boards, pass `--apply-board-metadata` to retry item terminology and primary-column title updates.

Some monday tokens can create boards and columns but still get `USER_UNAUTHORIZED` for metadata mutations such as `update_board` item terminology or `change_column_title` on the primary column. Those updates are cosmetic. If monday rejects them, keep the board schema and change the wording manually in the monday UI if the demo needs it.

Monday creates a default starter row such as `Task 1` when a board is created. The script archives that row on newly created boards. To clean existing boards that were created before this behavior was added, rerun with `--cleanup-starter-items`.

For the "active clients in a separate table" layout, keep one `Clients` board and configure the board view to group by `Onboarding Status`. This lets monday display sections such as `Lead`, `Questionnaire Sent`, `Documents Received`, `File Opened`, and `Active` from the actual status field instead of duplicating the lifecycle as physical groups.

The `Staff` board is a demo-support board for one-user monday sandboxes. It lets the demo show multiple accountants, roles, specialties, and workload distribution even when the account has only one real monday user. The real `People` columns remain in place for production; the demo staff relation columns can be used for sample data, dashboard grouping, and interview walkthroughs.

Visible monday labels can be created in English or Hebrew while keeping API IDs and env var names in English. During script polishing, use English as the default:

```bash
node scripts/create-monday-boards.mjs --dry-run --fresh --with-relations
node scripts/create-monday-boards.mjs --fresh --with-relations --write-env
```

For the assignment submission, use Hebrew visible labels if needed by passing `--lang=he`. Keep code, API IDs, and environment variable names in English.

## Relations And Optional Mirror Columns

The working default script path creates the relation columns needed for the demo:

- `Clients` to `Staff` through `Demo Assigned Staff`
- `Ongoing Tasks` to `Clients` through `Linked Client File`
- `Ongoing Tasks` to `Staff` through `Demo Owner Staff`

This keeps the workspace responsive while still showing a multi-accountant workflow in a one-user monday sandbox.

Mirror columns and reverse client backlinks are supported, but they are not part of the default polishing flow because they add extra cross-board recalculation in monday. Use them only for a final presentation if the account remains responsive:

```bash
node scripts/create-monday-boards.mjs --fresh --with-relations --with-mirrors --with-client-backlinks --write-env
node scripts/seed-demo-data.mjs --with-client-backlinks
```

If the API rejects mirror column settings in another monday account, keep the default relation columns and add mirrors manually in the monday UI only if the demo truly needs them.

## Demo Seed Data

`scripts/seed-demo-data.mjs` adds sample staff, clients, and ongoing tasks:

```bash
node scripts/seed-demo-data.mjs --dry-run
node scripts/seed-demo-data.mjs
node scripts/seed-demo-data.mjs --update
```

The seed script is idempotent by item name: it reuses existing staff, clients, and tasks instead of creating duplicates. Use `--update` to refresh column values on existing demo rows.

If `MONDAY_DEMO_USER_ID` is set, the script also fills the real `People` columns with that user. In a one-user sandbox this should usually be your own monday user ID. The demo staff relations still show the simulated accounting team.

For best results, run board creation with `--with-relations` before seeding so the script can link clients and tasks to staff and to each other. If relation column IDs are missing, the seed script still creates the core rows and skips those links.

Keep the default polishing flow lightweight. `--with-relations` creates only the useful one-way demo links: clients to demo staff, tasks to clients, and tasks to demo staff.

## Manual monday View Polish

After the scripts run, configure the demo views in monday:

1. On `Clients`, group the main table by `Onboarding Status`. This creates the active-client style layout without creating separate lifecycle groups through the API.
2. On `Ongoing Tasks`, add a Kanban view grouped by `Task Status`.
3. On `Ongoing Tasks`, add a saved table view for tasks where `Task Status` is `Waiting for Client`.
4. Keep dashboards simple: workload by demo staff, overdue or near-due tasks, and clients by onboarding status.

These views are intentionally manual for now because monday's UI has reliable controls for grouping and saved views, while the API behavior for view/group configuration is more account-dependent.
