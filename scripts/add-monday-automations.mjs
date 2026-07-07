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

const label = {
  onboardingLead: env("AUTOMATION_LABEL_ONBOARDING_LEAD", "Lead"),
  onboardingActive: env("AUTOMATION_LABEL_ONBOARDING_ACTIVE", "Active"),
  serviceVatReporting: env("AUTOMATION_LABEL_SERVICE_VAT_REPORTING", "VAT Reporting"),
  servicePayroll: env("AUTOMATION_LABEL_SERVICE_PAYROLL", "Payroll"),
  serviceBookkeeping: env("AUTOMATION_LABEL_SERVICE_BOOKKEEPING", "Bookkeeping"),
  taskNotStarted: env("AUTOMATION_LABEL_TASK_NOT_STARTED", "Not Started"),
  taskWaitingForClient: env("AUTOMATION_LABEL_TASK_WAITING_FOR_CLIENT", "Waiting for Client"),
  taskDone: env("AUTOMATION_LABEL_TASK_DONE", "Done"),
  engagementNotCreated: env("AUTOMATION_LABEL_ENGAGEMENT_NOT_CREATED", "Not Created"),
  clientResponseNone: env("AUTOMATION_LABEL_CLIENT_RESPONSE_NONE", "None"),
  clientResponseNeedsReview: env("AUTOMATION_LABEL_CLIENT_RESPONSE_NEEDS_REVIEW", "Needs Review"),
  documentCheckNotStarted: env("AUTOMATION_LABEL_DOCUMENT_CHECK_NOT_STARTED", "Not Started"),
};

const name = {
  clientsBoard: env("AUTOMATION_NAME_CLIENTS_BOARD", "Clients"),
  tasksBoard: env("AUTOMATION_NAME_TASKS_BOARD", "Ongoing Tasks"),
  linkedClientColumn: env("AUTOMATION_NAME_LINKED_CLIENT_COLUMN", "Linked Client File"),
  assignedAccountantColumn: env("AUTOMATION_NAME_ASSIGNED_ACCOUNTANT_COLUMN", "Assigned Accountant"),
  ownerColumn: env("AUTOMATION_NAME_OWNER_COLUMN", "Owner"),
  onboardingStatusColumn: env("AUTOMATION_NAME_ONBOARDING_STATUS_COLUMN", "Onboarding Status"),
  serviceTypesColumn: env("AUTOMATION_NAME_SERVICE_TYPES_COLUMN", "Service Types"),
  serviceTypeColumn: env("AUTOMATION_NAME_SERVICE_TYPE_COLUMN", "Service Type"),
  reportingPeriodColumn: env("AUTOMATION_NAME_REPORTING_PERIOD_COLUMN", "Reporting Period"),
  dueDateColumn: env("AUTOMATION_NAME_DUE_DATE_COLUMN", "Due Date"),
  taskStatusColumn: env("AUTOMATION_NAME_TASK_STATUS_COLUMN", "Task Status"),
  documentCheckColumn: env("AUTOMATION_NAME_DOCUMENT_CHECK_COLUMN", "Document Check"),
  engagementStatusColumn: env(
    "AUTOMATION_NAME_ENGAGEMENT_LETTER_STATUS_COLUMN",
    "Engagement Letter Status",
  ),
  clientResponseColumn: env("AUTOMATION_NAME_CLIENT_RESPONSE_COLUMN", "Client Response"),
  clientResponseDetailsColumn: env(
    "AUTOMATION_NAME_CLIENT_RESPONSE_DETAILS_COLUMN",
    "Client Response Details",
  ),
  lastClientUpdateColumn: env("AUTOMATION_NAME_LAST_CLIENT_UPDATE_COLUMN", "Last Client Update"),
  lastUpdatedColumn: env("AUTOMATION_NAME_LAST_UPDATED_COLUMN", "Last Updated"),
  missingInformationColumn: env("AUTOMATION_NAME_MISSING_INFORMATION_COLUMN", "Missing Information"),
  clientRequestColumn: env("AUTOMATION_NAME_CLIENT_REQUEST_COLUMN", "Client Request"),
};

const automationSpecs = [
  {
    key: "active-client-vat-task",
    boardKey: "clients",
    title: "Create VAT task when client becomes active",
    prompt: `Trigger:
When ${name.onboardingStatusColumn} changes to ${label.onboardingActive}

Conditions:
- Only if ${name.serviceTypesColumn} contains ${label.serviceVatReporting}

Actions:
- Create an item in the Ongoing Tasks board and connect boards:
  Target board: ${name.tasksBoard}
  Connect the triggering ${name.clientsBoard} item to the newly created ${name.tasksBoard} item using the ${name.tasksBoard} board relation column ${name.linkedClientColumn}.
  Item name: Prepare VAT report - {{item name}}
  ${name.linkedClientColumn}: {{item}}
  ${name.serviceTypeColumn}: ${label.serviceVatReporting}
  ${name.reportingPeriodColumn}: Current month
  ${name.ownerColumn}: ${name.assignedAccountantColumn}
  ${name.dueDateColumn}: 15 days after trigger date
  ${name.taskStatusColumn}: ${label.taskNotStarted}`,
  },
  {
    key: "active-client-payroll-task",
    boardKey: "clients",
    title: "Create payroll task when client becomes active",
    prompt: `Trigger:
When ${name.onboardingStatusColumn} changes to ${label.onboardingActive}

Conditions:
- Only if ${name.serviceTypesColumn} contains ${label.servicePayroll}

Actions:
- Create an item in the Ongoing Tasks board and connect boards:
  Target board: ${name.tasksBoard}
  Connect the triggering ${name.clientsBoard} item to the newly created ${name.tasksBoard} item using the ${name.tasksBoard} board relation column ${name.linkedClientColumn}.
  Item name: Run payroll - {{item name}}
  ${name.linkedClientColumn}: {{item}}
  ${name.serviceTypeColumn}: ${label.servicePayroll}
  ${name.reportingPeriodColumn}: Current month
  ${name.ownerColumn}: ${name.assignedAccountantColumn}
  ${name.dueDateColumn}: 10 days after trigger date
  ${name.taskStatusColumn}: ${label.taskNotStarted}`,
  },
  {
    key: "active-client-bookkeeping-task",
    boardKey: "clients",
    title: "Create bookkeeping task when client becomes active",
    prompt: `Trigger:
When ${name.onboardingStatusColumn} changes to ${label.onboardingActive}

Conditions:
- Only if ${name.serviceTypesColumn} contains ${label.serviceBookkeeping}

Actions:
- Create an item in the Ongoing Tasks board and connect boards:
  Target board: ${name.tasksBoard}
  Connect the triggering ${name.clientsBoard} item to the newly created ${name.tasksBoard} item using the ${name.tasksBoard} board relation column ${name.linkedClientColumn}.
  Item name: Bookkeeping monthly close - {{item name}}
  ${name.linkedClientColumn}: {{item}}
  ${name.serviceTypeColumn}: ${label.serviceBookkeeping}
  ${name.reportingPeriodColumn}: Current month
  ${name.ownerColumn}: ${name.assignedAccountantColumn}
  ${name.dueDateColumn}: 25 days after trigger date
  ${name.taskStatusColumn}: ${label.taskNotStarted}`,
  },
  {
    key: "task-due-today-owner-notice",
    boardKey: "tasks",
    title: "Notify owner when an open task reaches its due date",
    prompt: `Trigger:
When ${name.dueDateColumn} arrives
Details:
Time: 9:00 AM
Timezone: Asia/Jerusalem

Conditions:
- Only if ${name.taskStatusColumn} is not ${label.taskDone}

Actions:
- Send a notification:
  Recipient: ${name.ownerColumn}
  Message: Task "{{item name}}" is due today and is not marked ${label.taskDone}. Please review or update the task status.`,
  },
  {
    key: "task-waiting-for-client",
    boardKey: "tasks",
    title: "Surface client-blocked tasks",
    prompt: `Trigger:
When ${name.taskStatusColumn} changes to ${label.taskWaitingForClient}

Actions:
- Set ${name.lastUpdatedColumn} to today
- Send a notification:
  Recipient: ${name.ownerColumn}
  Message: Task "{{item name}}" is waiting for client input. Please follow up and keep the client file current.
- Update the linked client file:
  Linked board relation: ${name.linkedClientColumn}
  ${name.clientResponseColumn}: ${label.clientResponseNeedsReview}
  ${name.clientResponseDetailsColumn}: Task "{{item name}}" is waiting for client input. Check ${name.missingInformationColumn} / ${name.clientRequestColumn} on the task.
  ${name.lastClientUpdateColumn}: today`,
  },
  {
    key: "portal-response-review",
    boardKey: "clients",
    title: "Notify accountant when portal response is recorded",
    prompt: `Trigger:
When ${name.clientResponseColumn} changes to anything other than ${label.clientResponseNone}

Actions:
- Set ${name.lastClientUpdateColumn} to today
- Send a notification:
  Recipient: ${name.assignedAccountantColumn}
  Message: Client "{{item name}}" submitted a portal response. Review ${name.clientResponseDetailsColumn} before changing the onboarding or task status.`,
  },
  {
    key: "intake-form-defaults",
    boardKey: "clients",
    title: "Initialize new intake form leads",
    prompt: `Trigger:
When a new item is created

Actions:
- Change ${name.onboardingStatusColumn} to ${label.onboardingLead}
- Change ${name.documentCheckColumn} to ${label.documentCheckNotStarted}
- Change ${name.engagementStatusColumn} to ${label.engagementNotCreated}
- Change ${name.clientResponseColumn} to ${label.clientResponseNone}
- Set ${name.lastClientUpdateColumn} to today`,
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
  if (spec.boardKey === "clients") return requireBoardId(name.clientsBoard, CLIENTS_BOARD_ID);
  if (spec.boardKey === "tasks") return requireBoardId(name.tasksBoard, TASKS_BOARD_ID);

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

function env(name, fallback) {
  return process.env[name] || fallback;
}
