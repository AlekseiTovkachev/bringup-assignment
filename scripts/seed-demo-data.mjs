#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

loadDotEnv();

const MONDAY_API_URL = process.env.MONDAY_API_URL || "https://api.monday.com/v2";
const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN;
const DRY_RUN = process.argv.includes("--dry-run");
const UPDATE_EXISTING = process.argv.includes("--update");
const WITH_CLIENT_BACKLINKS = process.argv.includes("--with-client-backlinks");
const DISPLAY_LANGUAGE = getArgValue("--lang") || process.env.MONDAY_DISPLAY_LANGUAGE || "en";
const labels = getLabels(DISPLAY_LANGUAGE);

const boards = {
  staff: requiredEnv("MONDAY_STAFF_BOARD_ID"),
  clients: requiredEnv("MONDAY_CLIENTS_BOARD_ID"),
  tasks: requiredEnv("MONDAY_ONGOING_TASKS_BOARD_ID"),
};

const columns = {
  staff: {
    role: columnId("MONDAY_STAFF_ROLE_COLUMN_ID", "role"),
    email: columnId("MONDAY_STAFF_EMAIL_COLUMN_ID", "email"),
    phone: columnId("MONDAY_STAFF_PHONE_COLUMN_ID", "phone"),
    specialties: columnId("MONDAY_STAFF_SPECIALTIES_COLUMN_ID", "specialties"),
    capacity: columnId("MONDAY_STAFF_WEEKLY_CAPACITY_HOURS_COLUMN_ID", "weekly_capacity_hours"),
    status: columnId("MONDAY_STAFF_STAFF_STATUS_COLUMN_ID", "staff_status"),
  },
  clients: {
    legalTaxId: columnId("MONDAY_CLIENT_LEGAL_TAX_ID_COLUMN_ID", "legal_tax_id"),
    entityType: columnId("MONDAY_CLIENT_ENTITY_TYPE_COLUMN_ID", "entity_type"),
    primaryContactName: columnId("MONDAY_CLIENT_PRIMARY_CONTACT_NAME_COLUMN_ID", "primary_contact_name"),
    email: columnId("MONDAY_CLIENT_EMAIL_COLUMN_ID", "email"),
    phone: columnId("MONDAY_CLIENT_PHONE_COLUMN_ID", "phone"),
    assignedAccountant: columnId("MONDAY_CLIENT_ASSIGNED_ACCOUNTANT_COLUMN_ID", "assigned_accountant"),
    onboardingStatus: columnId("MONDAY_CLIENT_ONBOARDING_STATUS_COLUMN_ID", "onboarding_status"),
    serviceTypes: columnId("MONDAY_CLIENT_SERVICE_TYPES_COLUMN_ID", "service_types"),
    missingInformation: columnId("MONDAY_CLIENT_MISSING_INFORMATION_COLUMN_ID", "missing_information"),
    documentCheck: columnId("MONDAY_CLIENT_DOCUMENT_CHECK_COLUMN_ID", "document_check"),
    engagementLetterStatus: columnId(
      "MONDAY_CLIENT_ENGAGEMENT_LETTER_STATUS_COLUMN_ID",
      "engagement_letter_status",
    ),
    engagementLetterLink: columnId("MONDAY_CLIENT_ENGAGEMENT_LETTER_LINK_COLUMN_ID", "engagement_letter_link"),
    clientResponse: columnId("MONDAY_CLIENT_RESPONSE_COLUMN_ID", "client_response"),
    clientResponseDetails: columnId("MONDAY_CLIENT_RESPONSE_DETAILS_COLUMN_ID", "client_response_details"),
    lastClientUpdate: columnId("MONDAY_CLIENT_LAST_UPDATE_COLUMN_ID", "last_client_update"),
    intakeNotes: columnId("MONDAY_CLIENT_INTAKE_NOTES_COLUMN_ID", "intake_notes"),
    consentConfirmed: columnId("MONDAY_CLIENT_CONSENT_CONFIRMED_COLUMN_ID", "consent_confirmed"),
    demoAssignedStaff: process.env.MONDAY_CLIENT_DEMO_ASSIGNED_STAFF_COLUMN_ID,
    linkedOngoingTasks: process.env.MONDAY_CLIENT_LINKED_ONGOING_TASKS_COLUMN_ID,
  },
  tasks: {
    linkedClient: process.env.MONDAY_TASK_LINKED_CLIENT_COLUMN_ID,
    demoOwnerStaff: process.env.MONDAY_TASK_DEMO_OWNER_STAFF_COLUMN_ID,
    serviceType: columnId("MONDAY_TASK_SERVICE_TYPE_COLUMN_ID", "service_type"),
    reportingPeriod: columnId("MONDAY_TASK_REPORTING_PERIOD_COLUMN_ID", "reporting_period"),
    owner: columnId("MONDAY_TASK_OWNER_COLUMN_ID", "owner"),
    dueDate: columnId("MONDAY_TASK_DUE_DATE_COLUMN_ID", "due_date"),
    taskStatus: columnId("MONDAY_TASK_STATUS_COLUMN_ID", "task_status"),
    clientRequest: columnId("MONDAY_TASK_CLIENT_REQUEST_COLUMN_ID", "client_request"),
    lastUpdated: columnId("MONDAY_TASK_LAST_UPDATED_COLUMN_ID", "last_updated"),
  },
};

const demoUserId = process.env.MONDAY_DEMO_USER_ID;

const staffRows = [
  {
    name: "Dana Cohen",
    role: labels.staffRoles.seniorAccountant,
    email: "dana.cohen@example.com",
    phone: "+972501112222",
    specialties: [labels.serviceTypes.vatReporting, labels.serviceTypes.annualReport],
    capacity: 36,
    status: labels.staffStatus.active,
  },
  {
    name: "Noam Levi",
    role: labels.staffRoles.payrollSpecialist,
    email: "noam.levi@example.com",
    phone: "+972502223333",
    specialties: [labels.serviceTypes.payroll, labels.serviceTypes.deductions],
    capacity: 32,
    status: labels.staffStatus.active,
  },
  {
    name: "Maya Rosen",
    role: labels.staffRoles.accountant,
    email: "maya.rosen@example.com",
    phone: "+972503334444",
    specialties: [labels.serviceTypes.bookkeeping, labels.serviceTypes.monthlyReporting],
    capacity: 34,
    status: labels.staffStatus.active,
  },
  {
    name: "Yair Ben-David",
    role: labels.staffRoles.admin,
    email: "yair.bd@example.com",
    phone: "+972504445555",
    specialties: [labels.serviceTypes.bookkeeping],
    capacity: 24,
    status: labels.staffStatus.onLeave,
  },
];

const clientRows = [
  {
    name: "Acme Ltd",
    staff: "Dana Cohen",
    legalTaxId: "512345678",
    entityType: labels.entityTypes.company,
    contact: "Ari Gold",
    email: "ari@acme.example.com",
    phone: "+972551111111",
    onboardingStatus: labels.onboarding.fileOpened,
    serviceTypes: [labels.serviceTypes.vatReporting, labels.serviceTypes.payroll],
    missingInformation: "Signed payroll authorization is still needed.",
    documentCheck: labels.documentCheck.approved,
    engagementLetterStatus: labels.engagementLetter.created,
    engagementLetterLink: "https://docs.example.com/acme-engagement-letter",
    clientResponse: labels.clientResponse.none,
    notes: "Primary demo client for full onboarding flow.",
    consent: true,
  },
  {
    name: "North Star Studio",
    staff: "Noam Levi",
    legalTaxId: "514200111",
    entityType: labels.entityTypes.partnership,
    contact: "Lior Shani",
    email: "lior@northstar.example.com",
    phone: "+972552222222",
    onboardingStatus: labels.onboarding.active,
    serviceTypes: [labels.serviceTypes.bookkeeping],
    missingInformation: "",
    documentCheck: labels.documentCheck.approved,
    engagementLetterStatus: labels.engagementLetter.sent,
    engagementLetterLink: "https://docs.example.com/north-star-engagement-letter",
    clientResponse: labels.clientResponse.responseReceived,
    notes: "Active client with monthly bookkeeping.",
    consent: true,
  },
  {
    name: "Green Path Nonprofit",
    staff: "Maya Rosen",
    legalTaxId: "580044321",
    entityType: labels.entityTypes.nonprofit,
    contact: "Tamar Bar",
    email: "tamar@greenpath.example.org",
    phone: "+972553333333",
    onboardingStatus: labels.onboarding.documentsReceived,
    serviceTypes: [labels.serviceTypes.annualReport],
    missingInformation: "Board approval document is pending.",
    documentCheck: labels.documentCheck.inReview,
    engagementLetterStatus: labels.engagementLetter.notCreated,
    engagementLetterLink: "",
    clientResponse: labels.clientResponse.needsReview,
    notes: "Useful for showing document review before file opening.",
    consent: true,
  },
  {
    name: "Blue Harbor Ltd",
    staff: "Dana Cohen",
    legalTaxId: "515888120",
    entityType: labels.entityTypes.company,
    contact: "Omer Katz",
    email: "omer@blueharbor.example.com",
    phone: "+972554444444",
    onboardingStatus: labels.onboarding.active,
    serviceTypes: [labels.serviceTypes.vatReporting, labels.serviceTypes.monthlyReporting],
    missingInformation: "",
    documentCheck: labels.documentCheck.approved,
    engagementLetterStatus: labels.engagementLetter.sent,
    engagementLetterLink: "https://docs.example.com/blue-harbor-engagement-letter",
    clientResponse: labels.clientResponse.none,
    notes: "Active client for workload/dashboard volume.",
    consent: true,
  },
  {
    name: "Cedar Foods",
    staff: "Noam Levi",
    legalTaxId: "516777901",
    entityType: labels.entityTypes.company,
    contact: "Rina Tal",
    email: "rina@cedarfoods.example.com",
    phone: "+972555555555",
    onboardingStatus: labels.onboarding.questionnaireSent,
    serviceTypes: [labels.serviceTypes.payroll, labels.serviceTypes.deductions],
    missingInformation: "Waiting for employee list and bank details.",
    documentCheck: labels.documentCheck.notStarted,
    engagementLetterStatus: labels.engagementLetter.notCreated,
    engagementLetterLink: "",
    clientResponse: labels.clientResponse.none,
    notes: "Early onboarding example.",
    consent: false,
  },
];

const taskRows = [
  {
    name: "Prepare VAT report - 2026-06",
    client: "Acme Ltd",
    staff: "Dana Cohen",
    serviceType: labels.serviceTypes.vatReporting,
    period: "2026-06",
    dueDate: "2026-07-15",
    status: labels.taskStatus.inProgress,
    request: "",
  },
  {
    name: "Collect payroll authorization",
    client: "Acme Ltd",
    staff: "Noam Levi",
    serviceType: labels.serviceTypes.payroll,
    period: "2026-07",
    dueDate: "2026-07-10",
    status: labels.taskStatus.waitingForClient,
    request: "Client needs to send signed payroll authorization.",
  },
  {
    name: "Bookkeeping monthly close - 2026-07",
    client: "North Star Studio",
    staff: "Maya Rosen",
    serviceType: labels.serviceTypes.bookkeeping,
    period: "2026-07",
    dueDate: "2026-07-25",
    status: labels.taskStatus.notStarted,
    request: "",
  },
  {
    name: "Annual report document review",
    client: "Green Path Nonprofit",
    staff: "Dana Cohen",
    serviceType: labels.serviceTypes.annualReport,
    period: "2026",
    dueDate: "2026-08-15",
    status: labels.taskStatus.inProgress,
    request: "Board approval document is pending.",
  },
  {
    name: "Monthly reporting package - 2026-06",
    client: "Blue Harbor Ltd",
    staff: "Dana Cohen",
    serviceType: labels.serviceTypes.monthlyReporting,
    period: "2026-06",
    dueDate: "2026-07-08",
    status: labels.taskStatus.done,
    request: "",
  },
  {
    name: "Payroll setup checklist",
    client: "Cedar Foods",
    staff: "Noam Levi",
    serviceType: labels.serviceTypes.payroll,
    period: "2026-07",
    dueDate: "2026-07-18",
    status: labels.taskStatus.waitingForClient,
    request: "Waiting for employee list and bank details.",
  },
];

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

async function main() {
  if (!MONDAY_API_TOKEN && !DRY_RUN) {
    throw new Error("Missing MONDAY_API_TOKEN. Add it to .env or export it before running this script.");
  }

  const existingStaff = await getExistingItems(boards.staff);
  const existingClients = await getExistingItems(boards.clients);
  const existingTasks = await getExistingItems(boards.tasks);

  const staffIds = new Map();
  const clientIds = new Map();
  const taskIdsByClient = new Map();

  console.log("\nStaff");
  for (const staff of staffRows) {
    const id = await createOrReuseItem(boards.staff, existingStaff, staff.name, staffValues(staff));
    staffIds.set(staff.name, id);
  }

  console.log("\nClients");
  for (const client of clientRows) {
    const id = await createOrReuseItem(
      boards.clients,
      existingClients,
      client.name,
      clientValues(client),
    );
    clientIds.set(client.name, id);
    await updateRelationValues(
      boards.clients,
      id,
      client.name,
      clientRelationValues(staffIds.get(client.staff)),
    );
  }

  console.log("\nOngoing Tasks");
  for (const task of taskRows) {
    const id = await createOrReuseItem(
      boards.tasks,
      existingTasks,
      task.name,
      taskValues(task),
    );
    await updateRelationValues(
      boards.tasks,
      id,
      task.name,
      taskRelationValues(clientIds.get(task.client), staffIds.get(task.staff)),
    );
    addGroupedId(taskIdsByClient, task.client, id);
  }

  if (WITH_CLIENT_BACKLINKS && columns.clients.linkedOngoingTasks) {
    console.log("\nClient Backlinks");
    for (const [clientName, taskIds] of taskIdsByClient.entries()) {
      await updateRelationValues(
        boards.clients,
        clientIds.get(clientName),
        clientName,
        clientBacklinkValues(taskIds),
      );
    }
  }
}

function staffValues(staff) {
  return compactValues({
    [columns.staff.role]: dropdownValue([staff.role]),
    [columns.staff.email]: emailValue(staff.email),
    [columns.staff.phone]: phoneValue(staff.phone),
    [columns.staff.specialties]: dropdownValue(staff.specialties),
    [columns.staff.capacity]: staff.capacity,
    [columns.staff.status]: statusValue(staff.status),
  });
}

function clientValues(client) {
  return compactValues({
    [columns.clients.legalTaxId]: client.legalTaxId,
    [columns.clients.entityType]: dropdownValue([client.entityType]),
    [columns.clients.primaryContactName]: client.contact,
    [columns.clients.email]: emailValue(client.email),
    [columns.clients.phone]: phoneValue(client.phone),
    [columns.clients.assignedAccountant]: peopleValue(),
    [columns.clients.onboardingStatus]: statusValue(client.onboardingStatus),
    [columns.clients.serviceTypes]: dropdownValue(client.serviceTypes),
    [columns.clients.missingInformation]: client.missingInformation,
    [columns.clients.documentCheck]: statusValue(client.documentCheck),
    [columns.clients.engagementLetterStatus]: statusValue(client.engagementLetterStatus),
    [columns.clients.engagementLetterLink]: linkValue(client.engagementLetterLink, "Engagement letter"),
    [columns.clients.clientResponse]: statusValue(client.clientResponse),
    [columns.clients.clientResponseDetails]: "",
    [columns.clients.lastClientUpdate]: dateValue("2026-07-06"),
    [columns.clients.intakeNotes]: client.notes,
    [columns.clients.consentConfirmed]: checkboxValue(client.consent),
  });
}

function clientRelationValues(staffId) {
  return compactValues({
    [columns.clients.demoAssignedStaff]: relationValue(staffId),
  });
}

function clientBacklinkValues(taskIds) {
  return compactValues({
    [columns.clients.linkedOngoingTasks]: relationValue(taskIds),
  });
}

function taskValues(task) {
  return compactValues({
    [columns.tasks.serviceType]: dropdownValue([task.serviceType]),
    [columns.tasks.reportingPeriod]: task.period,
    [columns.tasks.owner]: peopleValue(),
    [columns.tasks.dueDate]: dateValue(task.dueDate),
    [columns.tasks.taskStatus]: statusValue(task.status),
    [columns.tasks.clientRequest]: task.request,
    [columns.tasks.lastUpdated]: dateValue("2026-07-06"),
  });
}

function taskRelationValues(clientId, staffId) {
  return compactValues({
    [columns.tasks.linkedClient]: relationValue(clientId),
    [columns.tasks.demoOwnerStaff]: relationValue(staffId),
  });
}

async function createOrReuseItem(boardId, existingItems, name, values) {
  const existing = existingItems.get(normalizeName(name));

  if (existing) {
    console.log(`  [reuse] ${name}: ${existing.id}`);
    if (UPDATE_EXISTING) {
      await changeItemValues(boardId, existing.id, values);
      console.log(`  [update] ${name}`);
    }
    return existing.id;
  }

  if (DRY_RUN) {
    console.log(`  [dry-run] create ${name}: ${JSON.stringify(values)}`);
    const dryRunId = `$${normalizeName(name).replace(/\s+/g, "_")}`;
    existingItems.set(normalizeName(name), { id: dryRunId, name });
    return dryRunId;
  }

  const mutation = `
    mutation CreateDemoItem($boardId: ID!, $itemName: String!, $columnValues: JSON) {
      create_item(
        board_id: $boardId
        item_name: $itemName
        column_values: $columnValues
        create_labels_if_missing: true
      ) {
        id
        name
      }
    }
  `;

  const data = await mondayRequest(mutation, {
    boardId: String(boardId),
    itemName: name,
    columnValues: JSON.stringify(values),
  });

  const item = data.create_item;
  console.log(`  [create] ${name}: ${item.id}`);
  existingItems.set(normalizeName(name), item);
  return item.id;
}

async function changeItemValues(boardId, itemId, values) {
  if (DRY_RUN) return;

  const mutation = `
    mutation UpdateDemoItem($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
      change_multiple_column_values(
        board_id: $boardId
        item_id: $itemId
        column_values: $columnValues
        create_labels_if_missing: true
      ) {
        id
      }
    }
  `;

  await mondayRequest(mutation, {
    boardId: String(boardId),
    itemId: String(itemId),
    columnValues: JSON.stringify(values),
  });
}

async function updateRelationValues(boardId, itemId, itemName, values) {
  if (!Object.keys(values).length) return;

  if (DRY_RUN) {
    console.log(`  [dry-run] link ${itemName}: ${JSON.stringify(values)}`);
    return;
  }

  try {
    await changeItemValues(boardId, itemId, values);
    console.log(`  [link] ${itemName}`);
  } catch (error) {
    console.warn(`  [warn] relation links skipped for ${itemName}: ${error.message}`);
  }
}

async function getExistingItems(boardId) {
  const items = new Map();
  if (DRY_RUN || String(boardId).startsWith("$")) return items;

  let cursor = null;
  do {
    const query = `
      query DemoItems($boardId: ID!, $cursor: String) {
        boards(ids: [$boardId]) {
          items_page(limit: 100, cursor: $cursor) {
            cursor
            items {
              id
              name
            }
          }
        }
      }
    `;

    const data = await mondayRequest(query, {
      boardId: String(boardId),
      cursor,
    });

    const page = data.boards?.[0]?.items_page;
    for (const item of page?.items || []) {
      items.set(normalizeName(item.name), item);
    }
    cursor = page?.cursor || null;
  } while (cursor);

  return items;
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

function compactValues(values) {
  return Object.fromEntries(
    Object.entries(values).filter((entry) => {
      const [columnId, value] = entry;
      if (!columnId || columnId === "undefined" || value === undefined || value === null) return false;
      if (typeof value === "string" && value.length === 0) return false;
      if (value && typeof value === "object" && Object.keys(value).length === 0) return false;
      return true;
    }),
  );
}

function statusValue(label) {
  return label ? { label } : undefined;
}

function dropdownValue(labels) {
  const compactLabels = labels.filter(Boolean);
  return compactLabels.length ? { labels: compactLabels } : undefined;
}

function dateValue(date) {
  return date ? { date } : undefined;
}

function emailValue(email) {
  return email ? { email, text: email } : undefined;
}

function phoneValue(phone) {
  return phone ? { phone, countryShortName: "IL" } : undefined;
}

function linkValue(url, text) {
  return url ? { url, text } : undefined;
}

function checkboxValue(checked) {
  return { checked: checked ? "true" : "false" };
}

function peopleValue() {
  if (!demoUserId) return undefined;
  return {
    personsAndTeams: [
      {
        id: Number(demoUserId),
        kind: "person",
      },
    ],
  };
}

function relationValue(itemId) {
  if (!itemId) return undefined;
  const itemIds = Array.isArray(itemId) ? itemId : [itemId];
  return {
    item_ids: itemIds.map((id) => {
      const numericId = Number(id);
      return Number.isFinite(numericId) ? numericId : id;
    }),
  };
}

function addGroupedId(groups, key, id) {
  if (!id) return;
  const ids = groups.get(key) || [];
  ids.push(id);
  groups.set(key, ids);
}

function columnId(envName, fallback) {
  return process.env[envName] || fallback;
}

function requiredEnv(name) {
  const value = process.env[name];
  if (value) return value;
  if (DRY_RUN) return `$${name}`;
  throw new Error(`Missing ${name}. Run create-monday-boards.mjs and paste the IDs into .env first.`);
}

function normalizeName(name) {
  return name.trim().toLowerCase();
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

function getLabels(language) {
  const normalizedLanguage = language.toLowerCase();
  const translations = getTranslations();

  if (!translations[normalizedLanguage]) {
    throw new Error(`Unsupported MONDAY_DISPLAY_LANGUAGE "${language}". Use "he" or "en".`);
  }

  return translations[normalizedLanguage];
}

function getTranslations() {
  return {
    he: {
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
