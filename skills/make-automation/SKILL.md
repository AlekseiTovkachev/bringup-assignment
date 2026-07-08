---
name: make-automation
description: Create, clone, update, inspect, and document Make.com automations using Make's official API, MCP server, and scenario blueprints. Use when a task mentions Make, Make.com, Integromat, scenarios, blueprints, webhooks, MCP, monday-to-Make automation, engagement-letter automation, or avoiding the Make visual interface.
---

# Make Automation

## Overview

Use Make's API and MCP server as the first path for repeatable automation work. Keep Make UI usage to first-time OAuth/connection setup, debugging visual module layout, or cases where the API cannot safely create the required entity.

## Project Setup

- `.mcp.json` defines a `make` MCP server that runs `node scripts/make-mcp.mjs`.
- `scripts/make-mcp.mjs` loads `.env`, then starts Make through `npx -y mcp-remote`.
- Required for direct MCP token mode: `MAKE_MCP_TOKEN` and `MAKE_ZONE` such as `us1.make.com`.
- Optional fallback: omit `MAKE_MCP_TOKEN` to use Make's OAuth MCP endpoint.
- For direct Make API calls, use `MAKE_API_TOKEN` with the scopes required by the endpoint.
- For this project, prefer the focused updater scripts for known scenarios, such as `scripts/update-make-engagement-letter-google-docs.mjs`, `scripts/update-make-engagement-letter-gmail.mjs`, `scripts/upsert-make-weekly-report-scenario.mjs`, and `scripts/export-make-scenario.mjs`. Use `scripts/create-make-scenario-from-blueprint.mjs` only with a reviewed, redacted blueprint.

Never commit `.env`, webhook URLs, API tokens, MCP tokens, connection IDs, or live customer payloads.

## Workflow

1. Identify the team, organization, zone, target folder, and whether the task is a new scenario, a clone, or an update.
2. Prefer cloning or templating a known-good scenario over hand-writing a full blueprint.
3. Retrieve existing blueprints with `GET /scenarios/{scenarioId}/blueprint` when a source scenario exists.
4. Store reusable blueprint templates with placeholders for names, connections, hooks, data stores, and environment-specific IDs.
5. Create with `POST /scenarios` or clone with `POST /scenarios/{scenarioId}/clone`.
6. Keep new scenarios inactive until credentials, scheduling, and test data are confirmed.
7. Verify through the API or MCP before claiming the automation is ready.

## API Patterns

- Create scenario: `POST https://<MAKE_ZONE>/api/v2/scenarios?confirmed=true`
- Clone scenario: `POST https://<MAKE_ZONE>/api/v2/scenarios/{scenarioId}/clone`
- Get blueprint: `GET https://<MAKE_ZONE>/api/v2/scenarios/{scenarioId}/blueprint`
- Update scenario: `PATCH https://<MAKE_ZONE>/api/v2/scenarios/{scenarioId}`

Make expects `blueprint` and `scheduling` as JSON-encoded strings in create/update bodies, not nested objects.

Read `references/make-api.md` for request shapes and examples when performing API work.

## MCP Usage

Use MCP when the user wants account-aware inspection or management and the client has a Make MCP token/OAuth session available. Make exposes active/on-demand scenarios as callable tools and can also expose management tools on eligible plans.

Start the local MCP wrapper manually for smoke checks:

```bash
node scripts/make-mcp.mjs
```

This command is a long-running MCP server. Stop it after the check unless the user explicitly wants it left running.

## BringUp Demo Notes

- Expected demo automations include engagement-letter generation, sending engagement letters, weekly reporting, and client-response handling.
- Prefer Make watching monday.com changes directly unless the portal explicitly needs to trigger Make.
- The current engagement-letter hub uses a Make `gateway:CustomWebHook` trigger called by monday outgoing webhook automations. It fetches the full item with `monday:GetItemV2`, then routes using the fetched item values.
- Keep the scenario on `scheduling: {"type":"immediately"}` in webhook mode. Use the old monday watcher/polling mode only as a fallback when webhook automations are unavailable.
- Keep demo data synthetic and avoid real tax IDs, client documents, or email addresses.
- The current Make Free license may only allow two total scenarios. If capacity is full, create the engagement-letter hub first and keep the weekly report as a local blueprint until a slot is available.
