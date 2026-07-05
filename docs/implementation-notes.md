# Implementation Notes

## monday Board Creation Script

`scripts/create-monday-boards.mjs` creates the core monday.com boards and columns for the assignment:

- `Clients`
- `Ongoing Tasks`
- Required and recommended operational columns from the specification

The script is intended to be rerunnable:

- If a board ID is already configured in `.env`, the script reuses that board.
- If a column ID is already configured in `.env`, the script skips that column.
- If a column already exists on the board with the same API ID or title, the script reuses it instead of creating a duplicate.

Visible monday labels can be created in Hebrew or English while keeping API IDs and env var names in English.

```bash
MONDAY_DISPLAY_LANGUAGE=he node scripts/create-monday-boards.mjs
node scripts/create-monday-boards.mjs --lang=he
node scripts/create-monday-boards.mjs --lang=en
```

For the assignment submission, use Hebrew visible labels. Keep code, API IDs, and environment variable names in English.

## Deferred: Connect Boards And Mirror Columns By API

The assignment requires the ongoing tasks board to be connected to the clients board, with mirrored client data visible from tasks.

For now, Connect Boards and Mirror column creation is documented but treated cautiously because monday.com's API defaults for relation and mirror columns are easy to misconfigure and can vary by account/workspace setup.

Recommended approach for the demo:

1. Run the script to create the two boards and regular columns.
2. Create the `Linked Client File` Connect Boards column in monday's UI.
3. Create mirror columns for client name and legal/tax ID in monday's UI.
4. Paste the resulting column IDs into `.env`.

Experimental option:

```bash
node scripts/create-monday-boards.mjs --with-relations
```

Use this only after testing against the target monday account. If it fails, keep the core board/column creation and create Connect Boards/Mirror columns manually.
