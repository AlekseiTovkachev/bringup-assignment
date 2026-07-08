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
const WITH_MIRRORS = process.argv.includes("--with-mirrors");
const WITH_CLIENT_BACKLINKS = process.argv.includes("--with-client-backlinks");
const CLEANUP_STARTER_ITEMS = process.argv.includes("--cleanup-starter-items");
const APPLY_BOARD_METADATA = process.argv.includes("--apply-board-metadata");
const FRESH = process.argv.includes("--fresh");
const WRITE_ENV = process.argv.includes("--write-env");
const ARCHIVE_BOARD_IDS = getListArgValue("--archive-boards");
const DISPLAY_LANGUAGE = getArgValue("--lang") || process.env.MONDAY_DISPLAY_LANGUAGE || "he";
const labels = getLabels(DISPLAY_LANGUAGE);

const config = {
  staff: {
    envName: "MONDAY_STAFF_BOARD_ID",
    envPrefix: "STAFF",
    name: `${BOARD_PREFIX}${labels.boards.staff}`,
    itemTerminology: labels.itemTerminology.staff,
    primaryNameEnv: "MONDAY_STAFF_NAME_COLUMN_ID",
    primaryNameColumnId: "name",
    primaryNameTitle: labels.columns.staffName,
    columns: [
      dropdown("role", labels.columns.staffRole, [
        labels.staffRoles.partner,
        labels.staffRoles.seniorAccountant,
        labels.staffRoles.accountant,
        labels.staffRoles.payrollSpecialist,
        labels.staffRoles.admin,
      ]),
      email("email", labels.columns.email),
      phone("phone", labels.columns.phone),
      dropdown("specialties", labels.columns.specialties, [
        labels.serviceTypes.bookkeeping,
        labels.serviceTypes.payroll,
        labels.serviceTypes.monthlyReporting,
        labels.serviceTypes.vatReporting,
        labels.serviceTypes.deductions,
        labels.serviceTypes.annualReport,
      ]),
      numbers("weekly_capacity_hours", labels.columns.weeklyCapacityHours),
      status("staff_status", labels.columns.staffStatus, [
        labels.staffStatus.active,
        labels.staffStatus.onLeave,
        labels.staffStatus.inactive,
      ]),
    ],
  },
  clients: {
    envName: "MONDAY_CLIENTS_BOARD_ID",
    envPrefix: "CLIENT",
    name: `${BOARD_PREFIX}${labels.boards.clients}`,
    itemTerminology: labels.itemTerminology.clients,
    primaryNameEnv: "MONDAY_CLIENT_NAME_COLUMN_ID",
    primaryNameColumnId: "name",
    primaryNameTitle: labels.columns.clientName,
    columns: [
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
    itemTerminology: labels.itemTerminology.tasks,
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
    boardKey: "clients",
    column: boardRelation(
      "demo_assigned_staff",
      labels.columns.demoAssignedStaff,
      "MONDAY_CLIENT_DEMO_ASSIGNED_STAFF_COLUMN_ID",
      ({ boardIds }) => ({
        boardIds: [boardIds.staff],
        allowMultipleItems: false,
      }),
    ),
  },
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
    boardKey: "ongoingTasks",
    column: boardRelation(
      "demo_owner_staff",
      labels.columns.demoOwnerStaff,
      "MONDAY_TASK_DEMO_OWNER_STAFF_COLUMN_ID",
      ({ boardIds }) => ({
        boardIds: [boardIds.staff],
        allowMultipleItems: false,
      }),
    ),
  },
  ...(WITH_CLIENT_BACKLINKS
    ? [
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
      ]
    : []),
];

const mirrorColumns = [
  {
    boardKey: "ongoingTasks",
    column: mirror(
      "client_name",
      labels.columns.clientName,
      "MONDAY_TASK_CLIENT_NAME_COLUMN_ID",
      ({ boardIds, columnIds }) => ({
        relationColumnId: columnIds.MONDAY_TASK_LINKED_CLIENT_COLUMN_ID,
        displayedBoardId: boardIds.clients,
        displayedColumnId: config.clients.primaryNameColumnId,
      }),
    ),
  },
  {
    boardKey: "ongoingTasks",
    column: mirror(
      "legal_tax_id",
      labels.columns.legalTaxId,
      "MONDAY_TASK_LEGAL_TAX_ID_COLUMN_ID",
      ({ boardIds, columnIds }) => ({
        relationColumnId: columnIds.MONDAY_TASK_LINKED_CLIENT_COLUMN_ID,
        displayedBoardId: boardIds.clients,
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

  if (ARCHIVE_BOARD_IDS.length) {
    for (const boardId of ARCHIVE_BOARD_IDS) {
      await archiveBoard(boardId);
    }
    return;
  }

  if (FRESH) {
    await archiveConfiguredBoards(Object.values(config));
  }

  const created = {};
  const boardIds = {};
  const columnIds = {};

  for (const [boardKey, boardConfig] of Object.entries(config)) {
    const existingBoardId = configuredEnv(boardConfig.envName);
    const createdBoard = !existingBoardId;
    const boardId =
      existingBoardId || (await createBoard(boardConfig.name, boardConfig.envName));

    boardIds[boardKey] = boardId;
    created[boardConfig.envName] = boardId;
    console.log(`\n${boardConfig.name}: ${boardId}`);

    const shouldApplyBoardMetadata = createdBoard || APPLY_BOARD_METADATA;

    if (boardConfig.itemTerminology && shouldApplyBoardMetadata) {
      try {
        await updateBoardItemTerminology(boardId, boardConfig.itemTerminology);
        console.log(
          `  item terminology: ${boardConfig.itemTerminology.singular} / ${boardConfig.itemTerminology.plural}`,
        );
      } catch (error) {
        console.warn(`  [warn] item terminology was not updated: ${error.message}`);
      }
    }

    if (createdBoard || CLEANUP_STARTER_ITEMS) {
      await archiveStarterItems(boardId);
    }

    const existingColumns = await getBoardColumns(boardId);

    if (boardConfig.primaryNameEnv) {
      if (shouldApplyBoardMetadata) {
        try {
          await updateColumnTitle(
            boardId,
            boardConfig.primaryNameColumnId,
            boardConfig.primaryNameTitle,
          );
        } catch (error) {
          console.warn(
            `  [warn] primary column title was not updated: ${error.message}`,
          );
        }
      }

      columnIds[boardConfig.primaryNameEnv] = boardConfig.primaryNameColumnId;
      created[boardConfig.primaryNameEnv] = boardConfig.primaryNameColumnId;
      console.log(
        `  ${boardConfig.primaryNameTitle}: primary item name (${boardConfig.primaryNameColumnId})`,
      );
    }

    for (const column of boardConfig.columns) {
      const envName = column.envName || envColumnName(boardConfig.envPrefix, column.id);
      const columnId = await createOrReuseColumn(boardId, column, envName, existingColumns);

      columnIds[envName] = columnId;
      created[envName] = columnId;
      console.log(`  ${column.title}: ${columnId}`);
    }

    if (createdBoard) {
      await archiveStarterItems(boardId);
    }
  }

  if (WITH_RELATIONS) {
    for (const relation of relationColumns) {
      const boardConfig = config[relation.boardKey];
      const boardId = boardIds[relation.boardKey];
      const existingColumns = await getBoardColumns(boardId);
      const column = materializeColumn(relation.column, { boardIds, columnIds });
      const envName = column.envName || envColumnName(boardConfig.envPrefix, column.id);
      const columnId = await createOrReuseOptionalColumn(boardId, column, envName, existingColumns);
      if (!columnId) continue;

      columnIds[envName] = columnId;
      created[envName] = columnId;
      console.log(`  ${column.title}: ${columnId}`);
    }

    if (!WITH_CLIENT_BACKLINKS) {
      created.MONDAY_CLIENT_LINKED_ONGOING_TASKS_COLUMN_ID = "";
    }

    if (!WITH_MIRRORS) {
      for (const mirrorColumn of mirrorColumns) {
        created[mirrorColumn.column.envName] = "";
      }
    }

    if (WITH_MIRRORS) for (const mirrorColumn of mirrorColumns) {
      const boardConfig = config[mirrorColumn.boardKey];
      const boardId = boardIds[mirrorColumn.boardKey];
      const existingColumns = await getBoardColumns(boardId);
      const column = materializeOptionalColumn(mirrorColumn.column, { boardIds, columnIds });
      if (!column) continue;
      const envName = column.envName || envColumnName(boardConfig.envPrefix, column.id);
      const columnId = await createOrReuseOptionalColumn(boardId, column, envName, existingColumns);
      if (!columnId) continue;

      columnIds[envName] = columnId;
      created[envName] = columnId;
      console.log(`  ${column.title}: ${columnId}`);
    }
  } else {
    console.log(
      "\nRelations skipped. Rerun with --with-relations for the recommended demo links between staff, clients, and tasks.",
    );
  }

  if (WRITE_ENV) {
    Object.assign(created, automationEnvValues(labels));
  }

  console.log("\nPaste these values into .env:");
  for (const [key, value] of Object.entries(created)) {
    console.log(`${key}=${value}`);
  }

  if (WRITE_ENV && DRY_RUN) {
    console.log("\n[dry-run] .env would be updated with board and column IDs.");
  } else if (WRITE_ENV) {
    writeEnvValues(created);
    console.log("\n.env updated with board and column IDs.");
  }
}

async function archiveConfiguredBoards(boardConfigs) {
  const boardIds = [
    ...new Set(boardConfigs.map((boardConfig) => process.env[boardConfig.envName]).filter(Boolean)),
  ];

  if (!boardIds.length) {
    console.log("[fresh] no configured boards to archive");
    return;
  }

  for (const boardId of boardIds) {
    await archiveBoard(boardId);
  }
}

async function archiveBoard(boardId) {
  if (DRY_RUN || String(boardId).startsWith("$")) {
    console.log(`[dry-run] archive board: ${boardId}`);
    return;
  }

  const mutation = `
    mutation ArchiveBoard($boardId: ID!) {
      archive_board(board_id: $boardId) {
        id
      }
    }
  `;

  try {
    await mondayRequest(mutation, { boardId: String(boardId) });
    console.log(`[fresh] archived board: ${boardId}`);
  } catch (error) {
    console.warn(`[fresh] could not archive board ${boardId}: ${error.message}`);
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

async function updateColumnTitle(boardId, columnId, title) {
  if (DRY_RUN || String(boardId).startsWith("$")) {
    console.log(`[dry-run] rename column ${columnId} on ${boardId}: ${title}`);
    return;
  }

  const mutation = `
    mutation UpdateColumnTitle($boardId: ID!, $columnId: String!, $title: String!) {
      change_column_title(
        board_id: $boardId
        column_id: $columnId
        title: $title
      ) {
        id
        title
      }
    }
  `;

  await mondayRequest(mutation, {
    boardId: String(boardId),
    columnId,
    title,
  });
}

async function updateBoardItemTerminology(boardId, itemTerminology) {
  if (DRY_RUN || String(boardId).startsWith("$")) {
    console.log(
      `[dry-run] set item terminology on ${boardId}: ${itemTerminology.singular}/${itemTerminology.plural}`,
    );
    return;
  }

  const mutation = `
    mutation UpdateBoardItemTerminology($boardId: ID!, $value: String!) {
      update_board(
        board_id: $boardId
        board_attribute: item_nickname
        new_value: $value
      )
    }
  `;

  const value = JSON.stringify(itemTerminologyPayload(itemTerminology));

  await mondayRequest(mutation, {
    boardId: String(boardId),
    value,
  });
}

async function archiveStarterItems(boardId) {
  if (DRY_RUN || String(boardId).startsWith("$")) {
    console.log(`[dry-run] archive monday starter item on ${boardId}`);
    return;
  }

  const query = `
    query BoardStarterItems($boardIds: [ID!]!) {
      boards(ids: $boardIds) {
        items_page(limit: 25) {
          items {
            id
            name
          }
        }
      }
    }
  `;

  const data = await mondayRequest(query, { boardIds: [String(boardId)] });
  const items = data.boards?.[0]?.items_page?.items || [];
  const starterItems = items.filter((item) => isStarterItemName(item.name));

  if (!starterItems.length) {
    console.log("  [skip] no monday starter item found");
    return;
  }

  const mutation = `
    mutation ArchiveStarterItem($itemId: ID!) {
      archive_item(item_id: $itemId) {
        id
      }
    }
  `;

  for (const item of starterItems) {
    await mondayRequest(mutation, { itemId: String(item.id) });
    console.log(`  [archive] monday starter item: ${item.name} (${item.id})`);
  }
}

function itemTerminologyPayload(itemTerminology) {
  return {
    preset_type: itemTerminology.presetType,
    singular: itemTerminology.apiSingular || itemTerminology.singular,
    plural: itemTerminology.apiPlural || itemTerminology.plural,
  };
}

async function createOrReuseColumn(boardId, column, envName, existingColumns) {
  const configuredColumnId = configuredEnv(envName);

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

async function createOrReuseOptionalColumn(boardId, column, envName, existingColumns) {
  try {
    return await createOrReuseColumn(boardId, column, envName, existingColumns);
  } catch (error) {
    console.warn(`  [warn] ${column.title} was not created: ${error.message}`);
    return null;
  }
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
    throw new Error(`monday API error: ${summarizeMondayErrors(body.errors)}`);
  }

  return body.data;
}

function summarizeMondayErrors(errors) {
  return errors
    .map((error) => {
      const code = error.extensions?.code;
      return code ? `${code}: ${error.message}` : error.message;
    })
    .join("; ");
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

function numbers(id, title, envName) {
  return { id, title, type: "numbers", envName };
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
    buildDefaults: (context) => ({ settings: relationSettings(buildDefaults(context)) }),
  };
}

function relationSettings(settings) {
  return {
    ...settings,
    boardIds: settings.boardIds?.map((boardId) => Number(boardId)),
    boardId: settings.boardId ? Number(settings.boardId) : undefined,
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
        settings: {
          relation_column: {
            [settings.relationColumnId]: true,
          },
          displayed_linked_columns: [
            {
              board_id: String(settings.displayedBoardId),
              column_ids: [settings.displayedColumnId],
            },
          ],
        },
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
      labels: labels.map((label, idValue) => ({ id: idValue + 1, label })),
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

function materializeOptionalColumn(column, context) {
  try {
    return materializeColumn(column, context);
  } catch (error) {
    console.warn(`  [warn] ${column.title} was skipped: ${error.message}`);
    return null;
  }
}

function configuredEnv(name) {
  return FRESH ? "" : process.env[name];
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

function writeEnvValues(values) {
  const envPath = path.join(process.cwd(), ".env");
  const existingContents = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const lines = existingContents ? existingContents.split(/\r?\n/) : [];
  const seen = new Set();
  const updatedLines = lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (!match || !Object.prototype.hasOwnProperty.call(values, match[1])) return line;

    seen.add(match[1]);
    return `${match[1]}=${values[match[1]]}`;
  });

  for (const [key, value] of Object.entries(values)) {
    if (!seen.has(key)) {
      updatedLines.push(`${key}=${value}`);
    }
  }

  fs.writeFileSync(envPath, `${trimTrailingEmptyLines(updatedLines).join("\n")}\n`);

  for (const [key, value] of Object.entries(values)) {
    process.env[key] = String(value);
  }
}

function trimTrailingEmptyLines(lines) {
  const trimmed = [...lines];

  while (trimmed.length && trimmed[trimmed.length - 1] === "") {
    trimmed.pop();
  }

  return trimmed;
}

function normalizeTitle(title) {
  return title.trim().toLowerCase();
}

function isStarterItemName(name) {
  const normalized = normalizeTitle(name || "");

  return [
    "task 1",
    "item 1",
    "לקוח 1",
    "משימה 1",
    "פריט 1",
  ].includes(normalized);
}

function getArgValue(name) {
  const inlineValue = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inlineValue) return inlineValue.slice(name.length + 1);

  const index = process.argv.indexOf(name);
  if (index !== -1) return process.argv[index + 1];

  return "";
}

function getListArgValue(name) {
  return getArgValue(name)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function automationEnvValues(labels) {
  return {
    AUTOMATION_LABEL_ONBOARDING_LEAD: labels.onboarding.lead,
    AUTOMATION_LABEL_ONBOARDING_ACTIVE: labels.onboarding.active,
    AUTOMATION_LABEL_ONBOARDING_FILE_OPENED: labels.onboarding.fileOpened,
    AUTOMATION_LABEL_SERVICE_VAT_REPORTING: labels.serviceTypes.vatReporting,
    AUTOMATION_LABEL_SERVICE_PAYROLL: labels.serviceTypes.payroll,
    AUTOMATION_LABEL_SERVICE_BOOKKEEPING: labels.serviceTypes.bookkeeping,
    AUTOMATION_LABEL_TASK_NOT_STARTED: labels.taskStatus.notStarted,
    AUTOMATION_LABEL_TASK_WAITING_FOR_CLIENT: labels.taskStatus.waitingForClient,
    AUTOMATION_LABEL_TASK_DONE: labels.taskStatus.done,
    AUTOMATION_LABEL_ENGAGEMENT_NOT_CREATED: labels.engagementLetter.notCreated,
    AUTOMATION_LABEL_ENGAGEMENT_CREATED: labels.engagementLetter.created,
    AUTOMATION_LABEL_ENGAGEMENT_SENT: labels.engagementLetter.sent,
    AUTOMATION_LABEL_CLIENT_RESPONSE_NONE: labels.clientResponse.none,
    AUTOMATION_LABEL_CLIENT_RESPONSE_NEEDS_REVIEW: labels.clientResponse.needsReview,
    AUTOMATION_LABEL_DOCUMENT_CHECK_NOT_STARTED: labels.documentCheck.notStarted,

    AUTOMATION_NAME_CLIENTS_BOARD: labels.boards.clients,
    AUTOMATION_NAME_TASKS_BOARD: labels.boards.ongoingTasks,
    AUTOMATION_NAME_LINKED_CLIENT_COLUMN: labels.columns.linkedClientFile,
    AUTOMATION_NAME_ASSIGNED_ACCOUNTANT_COLUMN: labels.columns.assignedAccountant,
    AUTOMATION_NAME_OWNER_COLUMN: labels.columns.owner,
    AUTOMATION_NAME_ONBOARDING_STATUS_COLUMN: labels.columns.onboardingStatus,
    AUTOMATION_NAME_SERVICE_TYPES_COLUMN: labels.columns.serviceTypes,
    AUTOMATION_NAME_SERVICE_TYPE_COLUMN: labels.columns.serviceType,
    AUTOMATION_NAME_REPORTING_PERIOD_COLUMN: labels.columns.reportingPeriod,
    AUTOMATION_NAME_DUE_DATE_COLUMN: labels.columns.dueDate,
    AUTOMATION_NAME_TASK_STATUS_COLUMN: labels.columns.taskStatus,
    AUTOMATION_NAME_DOCUMENT_CHECK_COLUMN: labels.columns.documentCheck,
    AUTOMATION_NAME_ENGAGEMENT_LETTER_STATUS_COLUMN: labels.columns.engagementLetterStatus,
    AUTOMATION_NAME_CLIENT_RESPONSE_COLUMN: labels.columns.clientResponse,
    AUTOMATION_NAME_CLIENT_RESPONSE_DETAILS_COLUMN: labels.columns.clientResponseDetails,
    AUTOMATION_NAME_LAST_CLIENT_UPDATE_COLUMN: labels.columns.lastClientUpdate,
    AUTOMATION_NAME_LAST_UPDATED_COLUMN: labels.columns.lastUpdated,
    AUTOMATION_NAME_MISSING_INFORMATION_COLUMN: labels.columns.missingInformation,
    AUTOMATION_NAME_CLIENT_REQUEST_COLUMN: labels.columns.clientRequest,
  };
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
        staff: "צוות",
        clients: "לקוחות",
        ongoingTasks: "משימות שוטפות",
      },
      itemTerminology: {
        staff: {
          presetType: "custom",
          singular: "איש צוות",
          plural: "צוות",
          apiSingular: "Staff Member",
          apiPlural: "Staff",
        },
        clients: {
          presetType: "clients",
          singular: "לקוח",
          plural: "לקוחות",
          apiSingular: "Client",
          apiPlural: "Clients",
        },
        tasks: {
          presetType: "tasks",
          singular: "משימה",
          plural: "משימות",
          apiSingular: "Task",
          apiPlural: "Tasks",
        },
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
        staffName: "שם איש צוות",
        staffRole: "תפקיד",
        specialties: "התמחויות",
        weeklyCapacityHours: "קיבולת שבועית בשעות",
        staffStatus: "סטטוס צוות",
        demoAssignedStaff: "איש צוות אחראי לדמו",
        serviceType: "סוג שירות",
        reportingPeriod: "תקופת דיווח",
        owner: "אחראי",
        dueDate: "תאריך יעד",
        taskStatus: "סטטוס משימה",
        clientRequest: "מידע חסר / בקשה מהלקוח",
        lastUpdated: "עודכן לאחרונה",
        demoOwnerStaff: "איש צוות אחראי לדמו",
        linkedClientFile: "תיק לקוח מקושר",
        linkedOngoingTasks: "משימות שוטפות מקושרות",
      },
      staffRoles: {
        partner: "שותף",
        seniorAccountant: "רואה חשבון בכיר",
        accountant: "רואה חשבון",
        payrollSpecialist: "מומחה שכר",
        admin: "אדמין",
      },
      staffStatus: {
        active: "פעיל",
        onLeave: "בחופשה",
        inactive: "לא פעיל",
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
        staff: "Staff",
        clients: "Clients",
        ongoingTasks: "Ongoing Tasks",
      },
      itemTerminology: {
        staff: {
          presetType: "custom",
          singular: "Staff Member",
          plural: "Staff",
        },
        clients: {
          presetType: "clients",
          singular: "Client",
          plural: "Clients",
        },
        tasks: {
          presetType: "tasks",
          singular: "Task",
          plural: "Tasks",
        },
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
        staffName: "Staff Member",
        staffRole: "Role",
        specialties: "Specialties",
        weeklyCapacityHours: "Weekly Capacity Hours",
        staffStatus: "Staff Status",
        demoAssignedStaff: "Demo Assigned Staff",
        serviceType: "Service Type",
        reportingPeriod: "Reporting Period",
        owner: "Owner",
        dueDate: "Due Date",
        taskStatus: "Task Status",
        clientRequest: "Missing Information / Client Request",
        lastUpdated: "Last Updated",
        demoOwnerStaff: "Demo Owner Staff",
        linkedClientFile: "Linked Client File",
        linkedOngoingTasks: "Linked Ongoing Tasks",
      },
      staffRoles: {
        partner: "Partner",
        seniorAccountant: "Senior Accountant",
        accountant: "Accountant",
        payrollSpecialist: "Payroll Specialist",
        admin: "Admin",
      },
      staffStatus: {
        active: "Active",
        onLeave: "On Leave",
        inactive: "Inactive",
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
