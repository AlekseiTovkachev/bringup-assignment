# BringUp Assignment

MVP planning and implementation assets for a monday.com, Make, and client portal assignment for an accounting firm workflow.

## Contents

- `docs/` - specification, implementation notes, flowcharts, and interview preparation.
- `scripts/` - monday.com board creation and demo data scripts.
- `portal/` - demo client portal prototype.
- `skills/make-automation/` - project-local agent skill for Make API, MCP, and scenario blueprint work.

Copy `.env.example` to `.env` for local monday.com/API configuration. The real `.env` file is intentionally ignored.

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
- Engagement-letter scenario draft: `6468273` (`BringUp - Engagement Letter Hub`)

The engagement-letter scenario is created but intentionally inactive. It watches the `Clients` board, reads the changed client file, and routes File Opened / Created states through monday GraphQL update modules. Replace the demo document-link update with real Google Docs and Gmail modules after those Make connections and the engagement-letter template are available.

Useful Make scripts:

```bash
node scripts/inspect-make-mcp.mjs scenario
node scripts/build-make-blueprints.mjs
node scripts/create-make-scenario-from-blueprint.mjs tmp/make/blueprints/engagement-letter-hub.json
node scripts/export-make-scenario.mjs 6468273 tmp/make/created-engagement-letter-hub-6468273.json
```

The Free Make license currently allows 2 scenarios. One pre-existing scenario plus the engagement-letter scenario uses that capacity, so the weekly management report is generated as a local blueprint at `tmp/make/blueprints/weekly-management-report.json` but was not created in Make.
