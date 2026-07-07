# BringUp Assignment

MVP planning and implementation assets for a monday.com, Make, and client portal assignment for an accounting firm workflow.

## Contents

- `docs/` - specification, implementation notes, flowcharts, and interview preparation.
- `scripts/` - monday.com board creation and demo data scripts.
- `portal/` - demo client portal prototype.
- `skills/make-automation/` - project-local agent skill for Make API, MCP, and scenario blueprint work.

Copy `.env.example` to `.env` for local monday.com/API configuration. The real `.env` file is intentionally ignored.

## Client Portal

The `portal/` folder contains the external client portal UI. Vercel serves it from `/`, while `/api/portal-client` and `/api/portal-response` run as serverless functions that call monday.com with `MONDAY_API_TOKEN`. The browser never receives the monday API token.

Required Vercel env vars are the monday token, board IDs, and the `MONDAY_CLIENT_*` / `MONDAY_TASK_*` column IDs from `.env.example`. Check the portal code locally with:

```bash
npm run portal:check
```

## Demo Setup

The current recommended setup is intentionally lightweight: it creates `Staff`, `Clients`, and `Ongoing Tasks`, connects clients/tasks/staff for the demo, and avoids mirror/backlink columns that can make monday slower in a small sandbox.

```bash
# Preview the board/column plan.
node scripts/create-monday-boards.mjs --dry-run --fresh --with-relations

# Create a clean board set and write the generated IDs back to .env.
node scripts/create-monday-boards.mjs --fresh --with-relations --write-env

# Preview and then create sample staff, clients, and tasks.
node scripts/seed-demo-data.mjs --dry-run
node scripts/seed-demo-data.mjs
```

`--fresh` archives the board IDs currently configured in `.env` before creating a new set. That is useful while polishing the demo, but do not use it casually after manual edits in monday.

## monday Automations

The public monday.com GraphQL API does not expose an automation-creation mutation, so automation setup uses the Monday MCP `create_automation` tool. The repo keeps the MCP prompts in a script so the setup is repeatable:

```bash
# Human-readable prompts.
node scripts/add-monday-automations.mjs

# JSON payloads for the Monday MCP create_automation tool.
node scripts/add-monday-automations.mjs --format=mcp-json
```

The default board IDs target the current demo boards. Override them for a fresh workspace with `--clients-board-id=<id>` and `--tasks-board-id=<id>`, or fill `MONDAY_CLIENTS_BOARD_ID` and `MONDAY_ONGOING_TASKS_BOARD_ID` in `.env`.

Automation prompts read board/column display names and status labels from `AUTOMATION_NAME_*` and `AUTOMATION_LABEL_*` in `.env`, so the same script can target Hebrew or renamed monday boards.

Optional heavier demo extras:

```bash
node scripts/create-monday-boards.mjs --fresh --with-relations --with-mirrors --with-client-backlinks --write-env
node scripts/seed-demo-data.mjs --with-client-backlinks
```

Use the optional mirror/backlink path only if the monday workspace stays responsive. The default setup is enough for the implementation demo.

## Make MCP

This repo includes a project MCP config at `.mcp.json`. MCP clients that read project configs can start Make through:

```bash
node scripts/make-mcp.mjs
```

Set `MAKE_MCP_TOKEN` and `MAKE_ZONE` in `.env` to use Make's direct MCP token URL. Without `MAKE_MCP_TOKEN`, the launcher falls back to Make's OAuth MCP endpoint.

For scenario creation and cloning, use the project-local skill at `skills/make-automation/SKILL.md`.

The current Make workspace uses:

- Organization: `8285840`
- Team: `2094513`
- Folder: `365478` (`BringUp Assignment`)
- Engagement-letter scenario: `6478914` (`BringUp - Engagement Letter Hub`)
- Weekly report scenario: `6478901` (`BringUp - Weekly Management Report`)

The engagement-letter scenario is active and webhook-driven. Its trigger is `gateway:CustomWebHook`, Make scheduling is `immediately`, and the hook ID is read from `MAKE_ENGAGEMENT_LETTER_WEBHOOK_HOOK_ID`. Keep the hook URL only in `.env`.

Expected hook payload shape:

```json
{
  "event": {
    "pulseId": 3057452786,
    "columnId": "onboarding_status",
    "value": {
      "label": {
        "text": "תיק נפתח"
      }
    }
  }
}
```

The generation route fires when `event.columnId` is the onboarding status column and the label is `AUTOMATION_LABEL_ONBOARDING_FILE_OPENED`. The send route fires when `event.columnId` is the engagement-letter status column and the label is `AUTOMATION_LABEL_ENGAGEMENT_CREATED`. Column updates use monday's native `ChangeMultipleColumnValuesV2` module rather than raw GraphQL.

To connect monday to the hook, add monday board automations on the Clients board:

- When `סטטוס קליטה` changes to `תיק נפתח`, call the webhook URL from `MAKE_GENERATE_ENGAGEMENT_LETTER_WEBHOOK_URL`.
- When `סטטוס מכתב התקשרות` changes to `נוצר`, call the webhook URL from `MAKE_SEND_ENGAGEMENT_LETTER_WEBHOOK_URL`.

Useful Make scripts:

```bash
node scripts/inspect-make-mcp.mjs scenario
node scripts/build-make-blueprints.mjs
node scripts/create-make-scenario-from-blueprint.mjs tmp/make/blueprints/engagement-letter-hub.json
node scripts/create-make-engagement-letter-scenario.mjs
node scripts/update-make-engagement-letter-google-docs.mjs
node scripts/update-make-engagement-letter-gmail.mjs
node scripts/upsert-make-weekly-report-scenario.mjs --dry-run
node scripts/export-make-scenario.mjs 6478914 tmp/make/created-engagement-letter-hub-6478914.json
```

The full engagement-letter scenario script reads names, monday labels, board IDs, column IDs, Make connection IDs, and Google Drive folder/template IDs from `.env`. For translated or renamed monday setups, update the `AUTOMATION_LABEL_*` and `AUTOMATION_NAME_*` values instead of editing the script. Generated engagement letters are written to `GOOGLE_DRIVE_ENGAGEMENT_OUTPUT_FOLDER_ID`.

Scenario 2 email sending requires a Make `google-email` connection. If `MAKE_GMAIL_CONNECTION_ID` is blank, authorize the Gmail credential request URL from `.env`, list Make connections, then set the new connection ID before running `update-make-engagement-letter-gmail.mjs`.

Scenario 3 is scripted by `scripts/upsert-make-weekly-report-scenario.mjs`. Run it with `--dry-run` to regenerate `tmp/make/blueprints/weekly-management-report.json` without touching Make. The live weekly report sends to `MAKE_WEEKLY_REPORT_RECIPIENT_EMAIL`.
