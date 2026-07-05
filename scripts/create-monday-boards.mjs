#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

loadDotEnv();

const MONDAY_API_URL = process.env.MONDAY_API_URL || "https://api.monday.com/v2";
const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN;
const BOARD_KIND = process.env.MONDAY_BOARD_KIND || "public";
const WORKSPACE_ID = process.env.MONDAY_WORKSPACE_ID || "";
const BOARD_PREFIX = process.env.MONDAY_BOARD_PREFIX || "";
const DRY_RUN = process.argv.includes("--dry-run");
const WITH_RELATIONS = process.argv.includes("--with-relations");
const DISPLAY_LANGUAGE = getArgValue("--lang") || process.env.MONDAY_DISPLAY_LANGUAGE || "he";
const labels = getLabels(DISPLAY_LANGUAGE);

const config = {
  clients: {
    envName: "MONDAY_CLIENTS_BOARD_ID",
    envPrefix: "CLIENT",
    name: `${BOARD_PREFIX}${labels.boards.clients}`,
    columns: [
      text("client_name", labels.columns.clientName, "MONDAY_CLIENT_NAME_COLUMN_ID"),
      text("legal_tax_id", labels.columns.legalTaxId),
      dropdown("entity_type", labels.columns.entityType, [
        labels.entityTypes.individual,
        labels.entityTypes.company,
        labels.entityTypes.partnership,
        labels.entityTypes.nonprofit,
        labels.entityTypes.other,
      ]),
      text("primary_contact_name", labels.columns.primaryContactName),
      email("email", labels.columns.email),
      phone("phone", labels.columns.phone),
      people("assigned_accountant", labels.columns.assignedAccountant),
      status("onboarding_status", labels.columns.onboardingStatus, [
        labels.onboarding.lead,
        labels.onboarding.questionnaireSent,
        labels.onboarding.documentsReceived,
        labels.onboarding.fileOpened,
        labels.onboarding.active,
      ]),
      dropdown("service_types", labels.columns.serviceTypes, [
        labels.serviceTypes.bookkeeping,
        labels.serviceTypes.payroll,
        labels.serviceTypes.monthlyReporting,
        labels.serviceTypes.vatReporting,
        labels.serviceTypes.deductions,
        labels.serviceTypes.annualReport,
      ]),
      longText("missing_information", labels.columns.missingInformation),
      status("document_check", labels.columns.documentCheck, [
        labels.documentCheck.notStarted,
        labels.documentCheck.inReview,
        labels.documentCheck.approved,
        labels.documentCheck.missingInvalid,
      ]),
      status("engagement_letter_status", labels.columns.engagementLetterStatus, [
        labels.engagementLetter.notCreated,
        labels.engagementLetter.created,
        labels.engagementLetter.sent,
        labels.engagementLetter.error,
      ]),
      link("engagement_letter_link", labels.columns.engagementLetterLink),
      status("client_response", labels.columns.clientResponse, [
        labels.clientResponse.none,
        labels.clientResponse.responseReceived,
        labels.clientResponse.documentsSent,
        labels.clientResponse.needsReview,
      ], "MONDAY_CLIENT_RESPONSE_COLUMN_ID"),
      longText(
        "client_response_details",
        labels.columns.clientResponseDetails,
        "MONDAY_CLIENT_RESPONSE_DETAILS_COLUMN_ID",
      ),
      date("last_client_update", labels.columns.lastClientUpdate, "MONDAY_CLIENT_LAST_UPDATE_COLUMN_ID"),
      longText("intake_notes", labels.columns.intakeNotes, "MONDAY_CLIENT_INTAKE_NOTES_COLUMN_ID"),
      checkbox("consent_confirmed", labels.columns.consentConfirmed, "MONDAY_CLIENT_CONSENT_CONFIRMED_COLUMN_ID"),
    ],
  },
  ongoingTasks: {
    envName: "MONDAY_ONGOING_TASKS_BOARD_ID",
    envPrefix: "TASK",
    name: `${BOARD_PREFIX}${labels.boards.ongoingTasks}`,
    columns: [
      dropdown("service_type", labels.columns.serviceType, [
        labels.serviceTypes.bookkeeping,
        labels.serviceTypes.payroll,
        labels.serviceTypes.monthlyReporting,
        labels.serviceTypes.vatReporting,
        labels.serviceTypes.deductions,
        labels.serviceTypes.annualReport,
      ]),
      text("reporting_period", labels.columns.reportingPeriod),
      people("owner", labels.columns.owner),
      date("due_date", labels.columns.dueDate),
      status("task_status", labels.columns.taskStatus, [
        labels.taskStatus.notStarted,
        labels.taskStatus.inProgress,
        labels.taskStatus.waitingForClient,
        labels.taskStatus.done,
      ], "MONDAY_TASK_STATUS_COLUMN_ID"),
      longText("client_request", labels.columns.clientRequest),
      date("last_updated", labels.columns.lastUpdated),
    ],
  },
};

const relationColumns = [
  {
    boardKey: "ongoingTasks",
    column: boardRelation(
      "linked_client_file",
      labels.columns.linkedClientFile,
      "MONDAY_TASK_LINKED_CLIENT_COLUMN_ID",
      ({ boardIds }) => ({
        boardIds: [boardIds.clients],
        allowMultipleItems: false,
      }),
    ),
  },
  {
    boardKey: "clients",
    column: boardRelation(
      "linked_ongoing_tasks",
      labels.columns.linkedOngoingTasks,
      "MONDAY_CLIENT_LINKED_ONGOING_TASKS_COLUMN_ID",
      ({ boardIds }) => ({
        boardIds: [boardIds.ongoingTasks],
        allowMultipleItems: true,
      }),
    ),
  },
];

const mirrorColumns = [
  {
    boardKey: "ongoingTasks",
    column: mirror(
      "client_name",
      labels.columns.clientName,
      "MONDAY_TASK_CLIENT_NAME_COLUMN_ID",
      ({ columnIds }) => ({
        relationColumnId: columnIds.MONDAY_TASK_LINKED_CLIENT_COLUMN_ID,
        displayedColumnId: columnIds.MONDAY_CLIENT_NAME_COLUMN_ID,
      }),
    ),
  },
  {
    boardKey: "ongoingTasks",
    column: mirror(
      "legal_tax_id",
      labels.columns.legalTaxId,
      "MONDAY_TASK_LEGAL_TAX_ID_COLUMN_ID",
      ({ columnIds }) => ({
        relationColumnId: columnIds.MONDAY_TASK_LINKED_CLIENT_COLUMN_ID,
        displayedColumnId: columnIds.MONDAY_CLIENT_LEGAL_TAX_ID_COLUMN_ID,
      }),
    ),
  },
];

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

async function main() {
  if (!MONDAY_API_TOKEN && !DRY_RUN) {
    throw new Error(
      "Missing MONDAY_API_TOKEN. Add it to .env or export it before running this script.",
    );
  }

  const created = {};
  const boardIds = {};
  const columnIds = {};

  for (const [boardKey, boardConfig] of Object.entries(config)) {
    const existingBoardId = process.env[boardConfig.envName];
    const boardId =
      existingBoardId || (await createBoard(boardConfig.name, boardConfig.envName));
    const existingColumns = await getBoardColumns(boardId);

    boardIds[boardKey] = boardId;
    created[boardConfig.envName] = boardId;
    console.log(`\n${boardConfig.name}: ${boardId}`);

    for (const column of boardConfig.columns) {
      const envName = column.envName || envColumnName(boardConfig.envPrefix, column.id);
      const columnId = await createOrReuseColumn(boardId, column, envName, existingColumns);

      columnIds[envName] = columnId;
      created[envName] = columnId;
      console.log(`  ${column.title}: ${columnId}`);
    }
  }

  if (WITH_RELATIONS) {
    for (const relation of relationColumns) {
      const boardConfig = config[relation.boardKey];
      const boardId = boardIds[relation.boardKey];
      const existingColumns = await getBoardColumns(boardId);
      const column = materializeColumn(relation.column, { boardIds, columnIds });
      const envName = column.envName || envColumnName(boardConfig.envPrefix, column.id);
      const columnId = await createOrReuseColumn(boardId, column, envName, existingColumns);

      columnIds[envName] = columnId;
      created[envName] = columnId;
      console.log(`  ${column.title}: ${columnId}`);
    }

    for (const mirrorColumn of mirrorColumns) {
      const boardConfig = config[mirrorColumn.boardKey];
      const boardId = boardIds[mirrorColumn.boardKey];
      const existingColumns = await getBoardColumns(boardId);
      const column = materializeColumn(mirrorColumn.column, { boardIds, columnIds });
      const envName = column.envName || envColumnName(boardConfig.envPrefix, column.id);
      const columnId = await createOrReuseColumn(boardId, column, envName, existingColumns);

      columnIds[envName] = columnId;
      created[envName] = columnId;
      console.log(`  ${column.title}: ${columnId}`);
    }
  } else {
    console.log(
      "\nDeferred: create Connect Boards and Mirror columns manually, or rerun with --with-relations after testing the monday API defaults in this account.",
    );
  }

  console.log("\nPaste these values into .env:");
  for (const [key, value] of Object.entries(created)) {
    console.log(`${key}=${value}`);
  }
}

async function createBoard(boardName, envName) {
  if (DRY_RUN) {
    console.log(`[dry-run] create board: ${boardName}`);
    return `$${envName}`;
  }

  const mutation = `
    mutation CreateBoard($boardName: String!, $boardKind: BoardKind!, $workspaceId: ID) {
      create_board(board_name: $boardName, board_kind: $boardKind, workspace_id: $workspaceId) {
        id
      }
    }
  `;

  const variables = {
    boardName,
    boardKind: BOARD_KIND,
    workspaceId: WORKSPACE_ID || null,
  };

  const data = await mondayRequest(mutation, variables);
  return data.create_board.id;
}

async function createColumn(boardId, column) {
  if (DRY_RUN) {
    console.log(`[dry-run] create column on ${boardId}: ${column.title}`);
    return column.id;
  }

  const mutation = `
    mutation CreateColumn(
      $boardId: ID!
      $title: String!
      $columnType: ColumnType!
      $id: String
      $defaults: JSON
    ) {
      create_column(
        board_id: $boardId
        title: $title
        column_type: $columnType
        id: $id
        defaults: $defaults
      ) {
        id
        title
      }
    }
  `;

  const variables = {
    boardId: String(boardId),
    title: column.title,
    columnType: column.type,
    id: column.id,
    defaults: column.defaults ? JSON.stringify(column.defaults) : null,
  };

  const data = await mondayRequest(mutation, variables);
  return data.create_column.id;
}

async function createOrReuseColumn(boardId, column, envName, existingColumns) {
  const configuredColumnId = process.env[envName];

  if (configuredColumnId) {
    console.log(`  [skip] ${column.title} already configured as ${envName}`);
    return configuredColumnId;
  }

  const existingById = existingColumns.byId.get(column.id);
  if (existingById) {
    console.log(`  [reuse] ${column.title} found by id`);
    return existingById.id;
  }

  const existingByTitle = existingColumns.byTitle.get(normalizeTitle(column.title));
  if (existingByTitle) {
    console.log(`  [reuse] ${column.title} found by title`);
    return existingByTitle.id;
  }

  const createdColumnId = await createColumn(boardId, column);
  existingColumns.byId.set(createdColumnId, { id: createdColumnId, title: column.title });
  existingColumns.byTitle.set(normalizeTitle(column.title), {
    id: createdColumnId,
    title: column.title,
  });

  return createdColumnId;
}

async function getBoardColumns(boardId) {
  const empty = { byId: new Map(), byTitle: new Map() };

  if (DRY_RUN || String(boardId).startsWith("$")) {
    return empty;
  }

  const query = `
    query BoardColumns($boardIds: [ID!]!) {
      boards(ids: $boardIds) {
        columns {
          id
          title
          type
        }
      }
    }
  `;

  const data = await mondayRequest(query, { boardIds: [String(boardId)] });
  const columns = data.boards?.[0]?.columns || [];

  for (const column of columns) {
    empty.byId.set(column.id, column);
    empty.byTitle.set(normalizeTitle(column.title), column);
  }

  return empty;
}

async function mondayRequest(query, variables) {
  const response = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: MONDAY_API_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`monday API HTTP ${response.status}: ${JSON.stringify(body)}`);
  }

  if (body?.errors?.length) {
    throw new Error(`monday API error: ${JSON.stringify(body.errors, null, 2)}`);
  }

  return body.data;
}

function text(id, title, envName) {
  return { id, title, type: "text", envName };
}

function longText(id, title, envName) {
  return { id, title, type: "long_text", envName };
}

function email(id, title, envName) {
  return { id, title, type: "email", envName };
}

function phone(id, title, envName) {
  return { id, title, type: "phone", envName };
}

function people(id, title, envName) {
  return { id, title, type: "people", envName };
}

function date(id, title, envName) {
  return { id, title, type: "date", envName };
}

function checkbox(id, title, envName) {
  return { id, title, type: "checkbox", envName };
}

function link(id, title, envName) {
  return { id, title, type: "link", envName };
}

function boardRelation(id, title, envName, buildDefaults) {
  return {
    id,
    title,
    type: "board_relation",
    envName,
    buildDefaults,
  };
}

function mirror(id, title, envName, buildSettings) {
  return {
    id,
    title,
    type: "mirror",
    envName,
    buildDefaults: (context) => {
      const settings = buildSettings(context);

      return {
        relationColumnId: settings.relationColumnId,
        displayedColumnId: settings.displayedColumnId,
      };
    },
  };
}

function status(id, title, labels, envName) {
  return {
    id,
    title,
    type: "status",
    envName,
    defaults: {
      labels: Object.fromEntries(labels.map((label, index) => [index, label])),
    },
  };
}

function dropdown(id, title, labels, envName) {
  return {
    id,
    title,
    type: "dropdown",
    envName,
    defaults: {
      labels: labels.map((name, idValue) => ({ id: idValue + 1, name })),
    },
  };
}

function materializeColumn(column, context) {
  if (!column.buildDefaults) return column;

  return {
    ...column,
    defaults: column.buildDefaults(context),
  };
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

function envColumnName(prefix, columnId) {
  return `MONDAY_${prefix}_${columnId.toUpperCase()}_COLUMN_ID`;
}

function normalizeTitle(title) {
  return title.trim().toLowerCase();
}

function getArgValue(name) {
  const inlineValue = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inlineValue) return inlineValue.slice(name.length + 1);

  const index = process.argv.indexOf(name);
  if (index !== -1) return process.argv[index + 1];

  return "";
}

function getLabels(language) {
  const normalizedLanguage = language.toLowerCase();
  const translations = getTranslations();

  if (!translations[normalizedLanguage]) {
    throw new Error(
      `Unsupported MONDAY_DISPLAY_LANGUAGE "${language}". Use "he" or "en".`,
    );
  }

  return translations[normalizedLanguage];
}

function getTranslations() {
  return {
    he: {
      boards: {
        clients: "לקוחות",
        ongoingTasks: "משימות שוטפות",
      },
      columns: {
        clientName: "שם לקוח",
        legalTaxId: "ח.פ / עוסק מורשה",
        entityType: "סוג ישות",
        primaryContactName: "איש קשר ראשי",
        email: "אימייל",
        phone: "טלפון",
        assignedAccountant: "רואה חשבון אחראי",
        onboardingStatus: "סטטוס קליטה",
        serviceTypes: "סוגי שירות",
        missingInformation: "מידע חסר",
        documentCheck: "בדיקת מסמכים",
        engagementLetterStatus: "סטטוס מכתב התקשרות",
        engagementLetterLink: "קישור למכתב התקשרות",
        clientResponse: "תגובת לקוח",
        clientResponseDetails: "פירוט תגובת לקוח",
        lastClientUpdate: "עדכון אחרון מהלקוח",
        intakeNotes: "הערות קליטה",
        consentConfirmed: "אישור הסכמה",
        serviceType: "סוג שירות",
        reportingPeriod: "תקופת דיווח",
        owner: "אחראי",
        dueDate: "תאריך יעד",
        taskStatus: "סטטוס משימה",
        clientRequest: "מידע חסר / בקשה מהלקוח",
        lastUpdated: "עודכן לאחרונה",
        linkedClientFile: "תיק לקוח מקושר",
        linkedOngoingTasks: "משימות שוטפות מקושרות",
      },
      entityTypes: {
        individual: "יחיד / עצמאי",
        company: "חברה בע״מ",
        partnership: "שותפות",
        nonprofit: "עמותה",
        other: "אחר",
      },
      onboarding: {
        lead: "ליד",
        questionnaireSent: "שאלון נשלח",
        documentsReceived: "מסמכים התקבלו",
        fileOpened: "תיק נפתח",
        active: "פעיל",
      },
      serviceTypes: {
        bookkeeping: "הנהלת חשבונות",
        payroll: "שכר",
        monthlyReporting: "דיווח חודשי",
        vatReporting: "דיווח מע״מ",
        deductions: "ניכויים",
        annualReport: "דוח שנתי",
      },
      documentCheck: {
        notStarted: "טרם נבדק",
        inReview: "בבדיקה",
        approved: "מאושר",
        missingInvalid: "חסר / לא תקין",
      },
      engagementLetter: {
        notCreated: "טרם נוצר",
        created: "נוצר",
        sent: "נשלח",
        error: "שגיאה",
      },
      clientResponse: {
        none: "אין תגובה",
        responseReceived: "תגובה התקבלה",
        documentsSent: "מסמכים נשלחו",
        needsReview: "דורש בדיקה",
      },
      taskStatus: {
        notStarted: "טרם התחיל",
        inProgress: "בתהליך",
        waitingForClient: "ממתין ללקוח",
        done: "בוצע",
      },
    },
    en: {
      boards: {
        clients: "Clients",
        ongoingTasks: "Ongoing Tasks",
      },
      columns: {
        clientName: "Client Name",
        legalTaxId: "Legal/Tax ID",
        entityType: "Entity Type",
        primaryContactName: "Primary Contact Name",
        email: "Email",
        phone: "Phone",
        assignedAccountant: "Assigned Accountant",
        onboardingStatus: "Onboarding Status",
        serviceTypes: "Service Types",
        missingInformation: "Missing Information",
        documentCheck: "Document Check",
        engagementLetterStatus: "Engagement Letter Status",
        engagementLetterLink: "Engagement Letter Link",
        clientResponse: "Client Response",
        clientResponseDetails: "Client Response Details",
        lastClientUpdate: "Last Client Update",
        intakeNotes: "Intake Notes",
        consentConfirmed: "Consent Confirmed",
        serviceType: "Service Type",
        reportingPeriod: "Reporting Period",
        owner: "Owner",
        dueDate: "Due Date",
        taskStatus: "Task Status",
        clientRequest: "Missing Information / Client Request",
        lastUpdated: "Last Updated",
        linkedClientFile: "Linked Client File",
        linkedOngoingTasks: "Linked Ongoing Tasks",
      },
      entityTypes: {
        individual: "Individual",
        company: "Company Ltd",
        partnership: "Partnership",
        nonprofit: "Nonprofit",
        other: "Other",
      },
      onboarding: {
        lead: "Lead",
        questionnaireSent: "Questionnaire Sent",
        documentsReceived: "Documents Received",
        fileOpened: "File Opened",
        active: "Active",
      },
      serviceTypes: {
        bookkeeping: "Bookkeeping",
        payroll: "Payroll",
        monthlyReporting: "Monthly Reporting",
        vatReporting: "VAT Reporting",
        deductions: "Deductions",
        annualReport: "Annual Report",
      },
      documentCheck: {
        notStarted: "Not Started",
        inReview: "In Review",
        approved: "Approved",
        missingInvalid: "Missing/Invalid",
      },
      engagementLetter: {
        notCreated: "Not Created",
        created: "Created",
        sent: "Sent",
        error: "Error",
      },
      clientResponse: {
        none: "None",
        responseReceived: "Response Received",
        documentsSent: "Documents Sent",
        needsReview: "Needs Review",
      },
      taskStatus: {
        notStarted: "Not Started",
        inProgress: "In Progress",
        waitingForClient: "Waiting for Client",
        done: "Done",
      },
    },
  };
}
