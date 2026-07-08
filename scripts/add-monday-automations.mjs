#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

loadDotEnv();

const FORMAT = getArgValue("--format") || "markdown";
const CLIENTS_BOARD_ID =
  getArgValue("--clients-board-id") ||
  process.env.MONDAY_CLIENTS_BOARD_ID;
const TASKS_BOARD_ID =
  getArgValue("--tasks-board-id") ||
  getArgValue("--ongoing-tasks-board-id") ||
  process.env.MONDAY_ONGOING_TASKS_BOARD_ID;

const label = {
  onboardingLead: env("AUTOMATION_LABEL_ONBOARDING_LEAD", "ליד"),
  onboardingActive: env("AUTOMATION_LABEL_ONBOARDING_ACTIVE", "פעיל"),
  serviceVatReporting: env("AUTOMATION_LABEL_SERVICE_VAT_REPORTING", "דיווח מע״מ"),
  servicePayroll: env("AUTOMATION_LABEL_SERVICE_PAYROLL", "שכר"),
  serviceBookkeeping: env("AUTOMATION_LABEL_SERVICE_BOOKKEEPING", "הנהלת חשבונות"),
  taskNotStarted: env("AUTOMATION_LABEL_TASK_NOT_STARTED", "טרם התחיל"),
  taskWaitingForClient: env("AUTOMATION_LABEL_TASK_WAITING_FOR_CLIENT", "ממתין ללקוח"),
  taskDone: env("AUTOMATION_LABEL_TASK_DONE", "בוצע"),
  engagementNotCreated: env("AUTOMATION_LABEL_ENGAGEMENT_NOT_CREATED", "טרם נוצר"),
  clientResponseNone: env("AUTOMATION_LABEL_CLIENT_RESPONSE_NONE", "אין תגובה"),
  clientResponseNeedsReview: env("AUTOMATION_LABEL_CLIENT_RESPONSE_NEEDS_REVIEW", "דורש בדיקה"),
  documentCheckNotStarted: env("AUTOMATION_LABEL_DOCUMENT_CHECK_NOT_STARTED", "טרם נבדק"),
  onboardingFileOpened: env("AUTOMATION_LABEL_ONBOARDING_FILE_OPENED", "תיק נפתח"),
  engagementCreated: env("AUTOMATION_LABEL_ENGAGEMENT_CREATED", "נוצר"),
};

const engagementWebhookUrl = env(
  "MAKE_ENGAGEMENT_LETTER_WEBHOOK_URL",
  "<MAKE_ENGAGEMENT_LETTER_WEBHOOK_URL>",
);

const name = {
  clientsBoard: env("AUTOMATION_NAME_CLIENTS_BOARD", "לקוחות"),
  tasksBoard: env("AUTOMATION_NAME_TASKS_BOARD", "משימות שוטפות"),
  linkedClientColumn: env("AUTOMATION_NAME_LINKED_CLIENT_COLUMN", "תיק לקוח מקושר"),
  assignedAccountantColumn: env("AUTOMATION_NAME_ASSIGNED_ACCOUNTANT_COLUMN", "רואה/ת חשבון מטפל/ת"),
  ownerColumn: env("AUTOMATION_NAME_OWNER_COLUMN", "אחראי"),
  onboardingStatusColumn: env("AUTOMATION_NAME_ONBOARDING_STATUS_COLUMN", "סטטוס קליטה"),
  serviceTypesColumn: env("AUTOMATION_NAME_SERVICE_TYPES_COLUMN", "סוגי שירות"),
  serviceTypeColumn: env("AUTOMATION_NAME_SERVICE_TYPE_COLUMN", "סוג שירות"),
  reportingPeriodColumn: env("AUTOMATION_NAME_REPORTING_PERIOD_COLUMN", "תקופת דיווח"),
  dueDateColumn: env("AUTOMATION_NAME_DUE_DATE_COLUMN", "תאריך יעד"),
  taskStatusColumn: env("AUTOMATION_NAME_TASK_STATUS_COLUMN", "סטטוס משימה"),
  documentCheckColumn: env("AUTOMATION_NAME_DOCUMENT_CHECK_COLUMN", "בדיקת מסמכים"),
  engagementStatusColumn: env(
    "AUTOMATION_NAME_ENGAGEMENT_LETTER_STATUS_COLUMN",
    "סטטוס מכתב התקשרות",
  ),
  clientResponseColumn: env("AUTOMATION_NAME_CLIENT_RESPONSE_COLUMN", "תגובת לקוח"),
  clientResponseDetailsColumn: env(
    "AUTOMATION_NAME_CLIENT_RESPONSE_DETAILS_COLUMN",
    "פירוט תגובת לקוח",
  ),
  lastClientUpdateColumn: env("AUTOMATION_NAME_LAST_CLIENT_UPDATE_COLUMN", "עדכון אחרון מהלקוח"),
  lastUpdatedColumn: env("AUTOMATION_NAME_LAST_UPDATED_COLUMN", "עודכן לאחרונה"),
  missingInformationColumn: env("AUTOMATION_NAME_MISSING_INFORMATION_COLUMN", "מידע חסר"),
  clientRequestColumn: env("AUTOMATION_NAME_CLIENT_REQUEST_COLUMN", "בקשת לקוח"),
};

const automationSpecs = [
  {
    key: "active-client-vat-task",
    boardKey: "clients",
    title: "יצירת משימת מע״מ כשהלקוח הופך לפעיל",
    prompt: `טריגר:
כאשר ${name.onboardingStatusColumn} משתנה ל-${label.onboardingActive}

תנאים:
- רק אם ${name.serviceTypesColumn} כולל ${label.serviceVatReporting}

פעולות:
- ליצור פריט בלוח ${name.tasksBoard} ולקשר בין הלוחות:
  לוח יעד: ${name.tasksBoard}
  לקשר את פריט ${name.clientsBoard} שהפעיל את האוטומציה לפריט החדש בלוח ${name.tasksBoard} באמצעות עמודת הקשר ${name.linkedClientColumn}.
  שם הפריט: הכנת דיווח מע״מ - {{item name}}
  ${name.linkedClientColumn}: {{item}}
  ${name.serviceTypeColumn}: ${label.serviceVatReporting}
  ${name.reportingPeriodColumn}: החודש הנוכחי
  ${name.ownerColumn}: ${name.assignedAccountantColumn}
  ${name.dueDateColumn}: 15 ימים אחרי תאריך הטריגר
  ${name.taskStatusColumn}: ${label.taskNotStarted}`,
  },
  {
    key: "active-client-payroll-task",
    boardKey: "clients",
    title: "יצירת משימת שכר כשהלקוח הופך לפעיל",
    prompt: `טריגר:
כאשר ${name.onboardingStatusColumn} משתנה ל-${label.onboardingActive}

תנאים:
- רק אם ${name.serviceTypesColumn} כולל ${label.servicePayroll}

פעולות:
- ליצור פריט בלוח ${name.tasksBoard} ולקשר בין הלוחות:
  לוח יעד: ${name.tasksBoard}
  לקשר את פריט ${name.clientsBoard} שהפעיל את האוטומציה לפריט החדש בלוח ${name.tasksBoard} באמצעות עמודת הקשר ${name.linkedClientColumn}.
  שם הפריט: הפקת שכר - {{item name}}
  ${name.linkedClientColumn}: {{item}}
  ${name.serviceTypeColumn}: ${label.servicePayroll}
  ${name.reportingPeriodColumn}: החודש הנוכחי
  ${name.ownerColumn}: ${name.assignedAccountantColumn}
  ${name.dueDateColumn}: 10 ימים אחרי תאריך הטריגר
  ${name.taskStatusColumn}: ${label.taskNotStarted}`,
  },
  {
    key: "active-client-bookkeeping-task",
    boardKey: "clients",
    title: "יצירת משימת הנהלת חשבונות כשהלקוח הופך לפעיל",
    prompt: `טריגר:
כאשר ${name.onboardingStatusColumn} משתנה ל-${label.onboardingActive}

תנאים:
- רק אם ${name.serviceTypesColumn} כולל ${label.serviceBookkeeping}

פעולות:
- ליצור פריט בלוח ${name.tasksBoard} ולקשר בין הלוחות:
  לוח יעד: ${name.tasksBoard}
  לקשר את פריט ${name.clientsBoard} שהפעיל את האוטומציה לפריט החדש בלוח ${name.tasksBoard} באמצעות עמודת הקשר ${name.linkedClientColumn}.
  שם הפריט: סגירת הנהלת חשבונות חודשית - {{item name}}
  ${name.linkedClientColumn}: {{item}}
  ${name.serviceTypeColumn}: ${label.serviceBookkeeping}
  ${name.reportingPeriodColumn}: החודש הנוכחי
  ${name.ownerColumn}: ${name.assignedAccountantColumn}
  ${name.dueDateColumn}: 25 ימים אחרי תאריך הטריגר
  ${name.taskStatusColumn}: ${label.taskNotStarted}`,
  },
  {
    key: "task-due-today-owner-notice",
    boardKey: "tasks",
    title: "התראה לאחראי כשמשימה פתוחה מגיעה לתאריך היעד",
    prompt: `טריגר:
כאשר ${name.dueDateColumn} מגיע
פרטים:
שעה: 09:00
אזור זמן: Asia/Jerusalem

תנאים:
- רק אם ${name.taskStatusColumn} אינו ${label.taskDone}

פעולות:
- לשלוח התראה:
  נמען: ${name.ownerColumn}
  הודעה: המשימה "{{item name}}" מגיעה היום לתאריך היעד ואינה מסומנת כ-${label.taskDone}. יש לבדוק או לעדכן את סטטוס המשימה.`,
  },
  {
    key: "task-waiting-for-client",
    boardKey: "tasks",
    title: "הצפת משימות שממתינות ללקוח",
    prompt: `טריגר:
כאשר ${name.taskStatusColumn} משתנה ל-${label.taskWaitingForClient}

פעולות:
- להגדיר את ${name.lastUpdatedColumn} להיום
- לשלוח התראה:
  נמען: ${name.ownerColumn}
  הודעה: המשימה "{{item name}}" ממתינה לקלט מהלקוח. יש לבצע מעקב ולעדכן את תיק הלקוח.
- לעדכן את תיק הלקוח המקושר:
  עמודת קשר ללוח: ${name.linkedClientColumn}
  ${name.clientResponseColumn}: ${label.clientResponseNeedsReview}
  ${name.clientResponseDetailsColumn}: המשימה "{{item name}}" ממתינה לקלט מהלקוח. יש לבדוק את ${name.clientRequestColumn} במשימה ולעדכן את ${name.missingInformationColumn} בתיק הלקוח לפי הצורך.
  ${name.lastClientUpdateColumn}: היום`,
  },
  {
    key: "portal-response-review",
    boardKey: "clients",
    title: "התראה לרואה החשבון כשנרשמת תגובת פורטל",
    prompt: `טריגר:
כאשר ${name.clientResponseColumn} משתנה לכל ערך שאינו ${label.clientResponseNone}

פעולות:
- להגדיר את ${name.lastClientUpdateColumn} להיום
- לשלוח התראה:
  נמען: ${name.assignedAccountantColumn}
  הודעה: הלקוח "{{item name}}" שלח תגובה בפורטל. יש לבדוק את ${name.clientResponseDetailsColumn} לפני שינוי סטטוס הקליטה או המשימה.`,
  },
  {
    key: "intake-form-defaults",
    boardKey: "clients",
    title: "אתחול לידים חדשים מטופס קליטה",
    prompt: `טריגר:
כאשר נוצר פריט חדש

פעולות:
- לשנות את ${name.onboardingStatusColumn} ל-${label.onboardingLead}
- לשנות את ${name.documentCheckColumn} ל-${label.documentCheckNotStarted}
- לשנות את ${name.engagementStatusColumn} ל-${label.engagementNotCreated}
- לשנות את ${name.clientResponseColumn} ל-${label.clientResponseNone}
- להגדיר את ${name.lastClientUpdateColumn} להיום`,
  },
  {
    key: "engagement-letter-create-webhook",
    boardKey: "clients",
    title: "הפעלת Make ליצירת מכתב התקשרות",
    prompt: `טריגר:
כאשר ${name.onboardingStatusColumn} משתנה ל-${label.onboardingFileOpened}

פעולות:
- לקרוא ל-webhook:
  URL: ${engagementWebhookUrl}
  Method: POST
  Body: {"itemId":"{{item id}}","boardId":"${CLIENTS_BOARD_ID || "<MONDAY_CLIENTS_BOARD_ID>"}","source":"monday-onboarding-file-opened"}`,
  },
  {
    key: "engagement-letter-send-webhook",
    boardKey: "clients",
    title: "הפעלת Make לשליחת מכתב התקשרות",
    prompt: `טריגר:
כאשר ${name.engagementStatusColumn} משתנה ל-${label.engagementCreated}

פעולות:
- לקרוא ל-webhook:
  URL: ${engagementWebhookUrl}
  Method: POST
  Body: {"itemId":"{{item id}}","boardId":"${CLIENTS_BOARD_ID || "<MONDAY_CLIENTS_BOARD_ID>"}","source":"monday-engagement-letter-created"}`,
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
