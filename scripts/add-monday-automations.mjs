#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

loadDotEnv();

const FORMAT = getArgValue("--format") || "markdown";
const CLIENTS_BOARD_ID =
  getArgValue("--clients-board-id") ||
  process.env.MONDAY_CLIENTS_BOARD_ID ||
  "5099844460";
const TASKS_BOARD_ID =
  getArgValue("--tasks-board-id") ||
  getArgValue("--ongoing-tasks-board-id") ||
  process.env.MONDAY_ONGOING_TASKS_BOARD_ID ||
  "5099844469";

const automationSpecs = [
  {
    key: "active-client-vat-task",
    boardKey: "clients",
    title: "Create VAT task when client becomes active",
    prompt: `Trigger:
When Onboarding Status changes to Active

Conditions:
- Only if Service Types contains VAT Reporting

Actions:
- Create an item in the Ongoing Tasks board and connect boards:
  Target board: Ongoing Tasks
  Connect the triggering Clients item to the newly created Ongoing Tasks item using the Ongoing Tasks board relation column Linked Client File.
  Item name: Prepare VAT report - {{item name}}
  Linked Client File: {{item}}
  Service Type: VAT Reporting
  Reporting Period: Current month
  Owner: Assigned Accountant
  Due Date: 15 days after trigger date
  Task Status: Not Started`,
  },
  {
    key: "active-client-payroll-task",
    boardKey: "clients",
    title: "Create payroll task when client becomes active",
    prompt: `Trigger:
When Onboarding Status changes to Active

Conditions:
- Only if Service Types contains Payroll

Actions:
- Create an item in the Ongoing Tasks board and connect boards:
  Target board: Ongoing Tasks
  Connect the triggering Clients item to the newly created Ongoing Tasks item using the Ongoing Tasks board relation column Linked Client File.
  Item name: Run payroll - {{item name}}
  Linked Client File: {{item}}
  Service Type: Payroll
  Reporting Period: Current month
  Owner: Assigned Accountant
  Due Date: 10 days after trigger date
  Task Status: Not Started`,
  },
  {
    key: "active-client-bookkeeping-task",
    boardKey: "clients",
    title: "Create bookkeeping task when client becomes active",
    prompt: `Trigger:
When Onboarding Status changes to Active

Conditions:
- Only if Service Types contains Bookkeeping

Actions:
- Create an item in the Ongoing Tasks board and connect boards:
  Target board: Ongoing Tasks
  Connect the triggering Clients item to the newly created Ongoing Tasks item using the Ongoing Tasks board relation column Linked Client File.
  Item name: Bookkeeping monthly close - {{item name}}
  Linked Client File: {{item}}
  Service Type: Bookkeeping
  Reporting Period: Current month
  Owner: Assigned Accountant
  Due Date: 25 days after trigger date
  Task Status: Not Started`,
  },
  {
    key: "task-due-today-owner-notice",
    boardKey: "tasks",
    title: "Notify owner when an open task reaches its due date",
    prompt: `Trigger:
When Due Date arrives
Details:
Time: 9:00 AM
Timezone: Asia/Jerusalem

Conditions:
- Only if Task Status is not Done

Actions:
- Send a notification:
  Recipient: Owner
  Message: Task "{{item name}}" is due today and is not marked Done. Please review or update the task status.`,
  },
  {
    key: "task-waiting-for-client",
    boardKey: "tasks",
    title: "Surface client-blocked tasks",
    prompt: `Trigger:
When Task Status changes to Waiting for Client

Actions:
- Set Last Updated to today
- Send a notification:
  Recipient: Owner
  Message: Task "{{item name}}" is waiting for client input. Please follow up and keep the client file current.
- Update the linked client file:
  Linked board relation: Linked Client File
  Client Response: Needs Review
  Client Response Details: Task "{{item name}}" is waiting for client input. Check Missing Information / Client Request on the task.
  Last Client Update: today`,
  },
  {
    key: "portal-response-review",
    boardKey: "clients",
    title: "Notify accountant when portal response is recorded",
    prompt: `Trigger:
When Client Response changes to anything other than None

Actions:
- Set Last Client Update to today
- Send a notification:
  Recipient: Assigned Accountant
  Message: Client "{{item name}}" submitted a portal response. Review Client Response Details before changing the onboarding or task status.`,
  },
  {
    key: "intake-form-defaults",
    boardKey: "clients",
    title: "Initialize new intake form leads",
    prompt: `Trigger:
When a new item is created

Actions:
- Change Onboarding Status to Lead
- Change Document Check to Not Started
- Change Engagement Letter Status to Not Created
- Change Client Response to None
- Set Last Client Update to today`,
  },
];

main();

function main() {
  const payloads = automationSpecs.map((spec) => ({
    key: spec.key,
    title: spec.title,
    boardId: boardIdFor(spec),
    userPrompt: spec.prompt,
  }));

  if (FORMAT === "json") {
    console.log(JSON.stringify(payloads, null, 2));
    return;
  }

  if (FORMAT === "mcp-json") {
    console.log(
      JSON.stringify(
        payloads.map(({ boardId, userPrompt }) => ({ boardId, userPrompt })),
        null,
        2,
      ),
    );
    return;
  }

  if (FORMAT !== "markdown") {
    throw new Error('Unsupported --format. Use "markdown", "json", or "mcp-json".');
  }

  console.log("# monday.com automation MCP payloads\n");
  console.log(
    "Use these with the Monday MCP create_automation tool. The public monday.com GraphQL API does not expose an automation-creation mutation, so this script is the repo source of truth for the MCP prompts.\n",
  );

  for (const payload of payloads) {
    console.log(`## ${payload.title}`);
    console.log(`Board ID: ${payload.boardId}`);
    console.log();
    console.log("```text");
    console.log(payload.userPrompt);
    console.log("```\n");
  }
}

function boardIdFor(spec) {
  if (spec.boardKey === "clients") return requireBoardId("Clients", CLIENTS_BOARD_ID);
  if (spec.boardKey === "tasks") return requireBoardId("Ongoing Tasks", TASKS_BOARD_ID);

  throw new Error(`Unknown board key "${spec.boardKey}" for automation "${spec.key}".`);
}

function requireBoardId(boardName, boardId) {
  if (/^\d+$/.test(String(boardId))) return String(boardId);

  throw new Error(
    `Missing ${boardName} board ID. Set the matching MONDAY_*_BOARD_ID in .env or pass --${boardName
      .toLowerCase()
      .replace(/\s+/g, "-")}-board-id=<id>.`,
  );
}

function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const contents = fs.readFileSync(envPath, "utf8");

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function getArgValue(name) {
  const inlineValue = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inlineValue) return inlineValue.slice(name.length + 1);

  const index = process.argv.indexOf(name);
  if (index !== -1) return process.argv[index + 1];

  return "";
}
