import { env, mondayGraphQL, requiredEnv } from "./monday-client.js";
import { PublicError } from "./validation.js";

const clientColumns = {
  taxId: env("MONDAY_CLIENT_LEGAL_TAX_ID_COLUMN_ID", "legal_tax_id"),
  entityType: env("MONDAY_CLIENT_ENTITY_TYPE_COLUMN_ID", "entity_type"),
  accountant: env("MONDAY_CLIENT_ASSIGNED_ACCOUNTANT_COLUMN_ID", "assigned_accountant"),
  demoAssignedStaff: env("MONDAY_CLIENT_DEMO_ASSIGNED_STAFF_COLUMN_ID", "demo_assigned_staff"),
  onboardingStatus: env("MONDAY_CLIENT_ONBOARDING_STATUS_COLUMN_ID", "onboarding_status"),
  response: env("MONDAY_CLIENT_RESPONSE_COLUMN_ID", "client_response"),
  responseDetails: env("MONDAY_CLIENT_RESPONSE_DETAILS_COLUMN_ID", "client_response_details"),
  lastClientUpdate: env("MONDAY_CLIENT_LAST_UPDATE_COLUMN_ID", "last_client_update"),
};

const taskColumns = {
  linkedClient: env("MONDAY_TASK_LINKED_CLIENT_COLUMN_ID", "linked_client_file"),
  owner: env("MONDAY_TASK_OWNER_COLUMN_ID", "owner"),
  dueDate: env("MONDAY_TASK_DUE_DATE_COLUMN_ID", "due_date"),
  reportingPeriod: env("MONDAY_TASK_REPORTING_PERIOD_COLUMN_ID", "reporting_period"),
  status: env("MONDAY_TASK_STATUS_COLUMN_ID", "task_status"),
  serviceType: env("MONDAY_TASK_SERVICE_TYPE_COLUMN_ID", "service_type"),
  clientRequest: env("MONDAY_TASK_CLIENT_REQUEST_COLUMN_ID", "client_request"),
};

const doneTaskLabel = env("AUTOMATION_LABEL_TASK_DONE", "בוצע");

export async function getPortalClientByTaxId(taxId) {
  const client = await findClientByTaxId(taxId);
  if (!client) {
    throw new PublicError("לא נמצא תיק לקוח תואם.", 404);
  }

  const tasks = await findOpenTasksForClient(client);
  const accountant = await getClientAccountantName(client);
  return {
    client: {
      name: client.name,
      taxId: getColumnText(client, clientColumns.taxId) || taxId,
      entityType: getColumnText(client, clientColumns.entityType),
      accountant,
      onboardingStatus: getColumnText(client, clientColumns.onboardingStatus),
      tasks: tasks.map(toPortalTask),
    },
  };
}

export async function listPortalClientOptions() {
  const items = await listBoardItems(
    requiredEnv("MONDAY_CLIENTS_BOARD_ID"),
    [
      clientColumns.taxId,
      clientColumns.entityType,
      clientColumns.onboardingStatus,
    ],
    Number(env("PORTAL_CLIENT_LOOKUP_LIMIT", "100")),
  );

  return items
    .map((item) => ({
      name: item.name,
      taxId: normalize(getColumnText(item, clientColumns.taxId)),
      entityType: getColumnText(item, clientColumns.entityType),
      onboardingStatus: getColumnText(item, clientColumns.onboardingStatus),
    }))
    .filter((client) => client.name && client.taxId)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
}

export async function recordPortalResponse({ taxId, responseType, details }) {
  const client = await findClientByTaxId(taxId);
  if (!client) {
    throw new PublicError("לא נמצא תיק לקוח תואם.", 404);
  }

  const submittedDate = new Date().toISOString().slice(0, 10);
  const columnValues = {
    [clientColumns.response]: { label: responseType },
    [clientColumns.responseDetails]: details || responseType,
    [clientColumns.lastClientUpdate]: { date: submittedDate },
  };

  await mondayGraphQL(
    `mutation RecordPortalResponse($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
      change_multiple_column_values(
        board_id: $boardId,
        item_id: $itemId,
        column_values: $columnValues
      ) {
        id
      }
    }`,
    {
      boardId: requiredEnv("MONDAY_CLIENTS_BOARD_ID"),
      itemId: client.id,
      columnValues: JSON.stringify(columnValues),
    },
  );

  return { ok: true, submittedDate };
}

async function findClientByTaxId(taxId) {
  const items = await listBoardItems(
    requiredEnv("MONDAY_CLIENTS_BOARD_ID"),
    [
      clientColumns.taxId,
      clientColumns.entityType,
      clientColumns.accountant,
      clientColumns.demoAssignedStaff,
      clientColumns.onboardingStatus,
      clientColumns.response,
      clientColumns.responseDetails,
      clientColumns.lastClientUpdate,
    ],
    Number(env("PORTAL_CLIENT_LOOKUP_LIMIT", "100")),
  );

  return items.find((item) => normalize(getColumnText(item, clientColumns.taxId)) === taxId);
}

async function getClientAccountantName(client) {
  const directName =
    getColumnText(client, clientColumns.accountant) ||
    getColumnText(client, clientColumns.demoAssignedStaff);
  if (directName) return directName;

  const demoAssignedStaffColumn = getColumn(client, clientColumns.demoAssignedStaff);
  const linkedStaffNames = getLinkedItemNames(demoAssignedStaffColumn);
  if (linkedStaffNames.length) return linkedStaffNames.join(", ");

  const linkedStaffIds = getLinkedItemIds(demoAssignedStaffColumn);
  if (!linkedStaffIds.length) return "";

  const staffNames = await listItemNamesByIds(linkedStaffIds);
  return staffNames.join(", ");
}

async function findOpenTasksForClient(client) {
  const items = await listBoardItems(
    requiredEnv("MONDAY_ONGOING_TASKS_BOARD_ID"),
    [
      taskColumns.linkedClient,
      taskColumns.owner,
      taskColumns.dueDate,
      taskColumns.reportingPeriod,
      taskColumns.status,
      taskColumns.serviceType,
      taskColumns.clientRequest,
    ],
    Number(env("PORTAL_TASK_LOOKUP_LIMIT", "100")),
  );

  return items.filter((item) => {
    const status = getColumnText(item, taskColumns.status);
    return !isDoneStatus(status) && taskLinkedToClient(item, client);
  });
}

async function listBoardItems(boardId, columnIds, limit) {
  const data = await mondayGraphQL(
    `query PortalBoardItems($boardIds: [ID!], $columnIds: [String!], $limit: Int!) {
      boards(ids: $boardIds) {
        items_page(limit: $limit) {
          items {
            id
            name
            column_values(ids: $columnIds) {
              id
              text
              value
              type
              ... on BoardRelationValue {
                linked_item_ids
                linked_items {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }`,
    {
      boardIds: [boardId],
      columnIds,
      limit,
    },
  );

  return data.boards?.[0]?.items_page?.items || [];
}

async function listItemNamesByIds(itemIds) {
  const uniqueItemIds = [...new Set(itemIds.map(String).filter(Boolean))];
  if (!uniqueItemIds.length) return [];

  const data = await mondayGraphQL(
    `query PortalLinkedItemNames($itemIds: [ID!]) {
      items(ids: $itemIds) {
        id
        name
      }
    }`,
    { itemIds: uniqueItemIds },
  );

  return (data.items || []).map((item) => item.name).filter(Boolean);
}

function toPortalTask(item) {
  return {
    title: item.name,
    owner: getColumnText(item, taskColumns.owner),
    dueDate: getColumnDate(item, taskColumns.dueDate),
    reportingPeriod: getColumnText(item, taskColumns.reportingPeriod),
    status: getColumnText(item, taskColumns.status),
    serviceType: getColumnText(item, taskColumns.serviceType),
    clientRequest: getColumnText(item, taskColumns.clientRequest),
  };
}

function taskLinkedToClient(task, client) {
  const linkedIds = getLinkedItemIds(getColumn(task, taskColumns.linkedClient));
  const clientId = String(client.id);

  if (linkedIds.some((linkedId) => String(linkedId) === clientId)) {
    return true;
  }

  return getColumnText(task, taskColumns.linkedClient) === client.name;
}

function getColumnDate(item, columnId) {
  const parsed = parseColumnValue(getColumn(item, columnId));
  return parsed?.date || getColumnText(item, columnId);
}

function getColumnText(item, columnId) {
  return getColumn(item, columnId)?.text || "";
}

function getLinkedItemIds(column) {
  const typedIds = [
    ...(column?.linked_item_ids || []),
    ...(column?.linked_items || []).map((item) => item.id),
  ];
  const parsed = parseColumnValue(column);
  const linkedItems = parsed?.linkedPulseIds || parsed?.linkedItemIds || [];

  return [...typedIds, ...linkedItems
    .map((entry) => entry.linkedPulseId || entry.linkedItemId || entry.itemId || entry.id)
    .filter(Boolean)]
    .map(String)
    .filter((id, index, ids) => ids.indexOf(id) === index);
}

function getLinkedItemNames(column) {
  return (column?.linked_items || [])
    .map((item) => item.name)
    .filter(Boolean);
}

function getColumn(item, columnId) {
  return item.column_values?.find((column) => column.id === columnId);
}

function parseColumnValue(column) {
  if (!column?.value) return null;
  try {
    return JSON.parse(column.value);
  } catch {
    return null;
  }
}

function normalize(value) {
  return String(value || "").replace(/\D/g, "");
}

function isDoneStatus(status) {
  return status === doneTaskLabel || ["Done", "בוצע", "הושלם"].includes(status);
}
