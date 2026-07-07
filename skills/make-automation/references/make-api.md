# Make API Reference Notes

## Authentication

Use:

```http
Authorization: Token <MAKE_API_TOKEN>
```

Pick the base URL for the account zone, for example:

```text
https://us1.make.com/api/v2
https://eu1.make.com/api/v2
```

## Create Scenario

Endpoint:

```http
POST /scenarios?confirmed=true
```

Minimum body shape:

```json
{
  "teamId": 123,
  "folderId": 456,
  "blueprint": "{\"name\":\"Scenario name\",\"flow\":[],\"metadata\":{\"version\":1}}",
  "scheduling": "{\"type\":\"indefinitely\",\"interval\":900}"
}
```

Notes:

- Required scope: `scenarios:write`.
- `blueprint` is a string containing JSON.
- `scheduling` is a string containing JSON.
- Use `confirmed=true` when creating a scenario that installs an app for the first time in the organization.
- Keep created scenarios inactive until validated.

## Get Scenario Blueprint

Endpoint:

```http
GET /scenarios/{scenarioId}/blueprint?draft=true
```

Use this to turn a manually-created or known-good scenario into a reusable template. Store templates without secrets and replace environment-specific entity IDs before creating or cloning.

## Clone Scenario

Endpoint:

```http
POST /scenarios/{scenarioId}/clone?organizationId=<organizationId>
```

Body shape:

```json
{
  "name": "Cloned scenario name",
  "teamId": 123,
  "states": false,
  "account": {
    "111": 222
  },
  "hook": {
    "333": 444
  },
  "datastore": {
    "555": 666
  }
}
```

Map original entity IDs to destination entity IDs when cloning across teams. Use `notAnalyze=true` only when intentionally suppressing blueprint analysis and planning to repair the clone afterward.

## cURL Skeletons

Fetch a blueprint:

```bash
curl "https://${MAKE_ZONE}/api/v2/scenarios/${MAKE_SCENARIO_ID}/blueprint?draft=true" \
  -H "Authorization: Token ${MAKE_API_TOKEN}"
```

Create a scenario from `scenario.json`:

```bash
curl -X POST "https://${MAKE_ZONE}/api/v2/scenarios?confirmed=true" \
  -H "Authorization: Token ${MAKE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @scenario.json
```

## Safety Checklist

- Confirm the zone before any write.
- Confirm the target team/folder.
- Do not activate schedules before test data succeeds.
- Do not commit live blueprint exports without redacting connections, hooks, keys, and customer data.
- Verify created scenario details or blueprint after API writes.

## Project Scripts

Use these from the repo root:

```bash
node scripts/inspect-make-mcp.mjs scenario
node scripts/call-make-mcp.mjs scenarios_list '{"teamId":2094513}'
node scripts/build-make-blueprints.mjs
node scripts/create-make-scenario-from-blueprint.mjs tmp/make/blueprints/engagement-letter-hub.json
node scripts/export-make-scenario.mjs 6468273 tmp/make/created-engagement-letter-hub-6468273.json
```

`scripts/build-make-blueprints.mjs` reads monday board/column IDs from `.env` and writes local blueprint files under `tmp/make/blueprints/`.
