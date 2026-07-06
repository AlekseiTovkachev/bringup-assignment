# BringUp Assignment

MVP planning and implementation assets for a monday.com, Make, and client portal assignment for an accounting firm workflow.

## Contents

- `docs/` - specification, implementation notes, flowcharts, and interview preparation.
- `scripts/` - monday.com board creation and demo data scripts.
- `portal/` - demo client portal prototype.

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

Optional heavier demo extras:

```bash
node scripts/create-monday-boards.mjs --fresh --with-relations --with-mirrors --with-client-backlinks --write-env
node scripts/seed-demo-data.mjs --with-client-backlinks
```

Use the optional mirror/backlink path only if the monday workspace stays responsive. The default setup is enough for the implementation demo.
