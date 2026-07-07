# Agent Instructions

## Make Automation

- For tasks that create, clone, update, inspect, or document Make.com automations, read `skills/make-automation/SKILL.md` before acting.
- Use `.mcp.json` to expose Make's official MCP server through `scripts/make-mcp.mjs`.
- Keep Make API tokens, MCP tokens, webhook URLs, and connection IDs in `.env`, never in committed docs or blueprints.
- Prefer reusable scenario blueprints and clone/create scripts over manual Make UI steps when the task can be done safely through the API.
