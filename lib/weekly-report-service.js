import { env, mondayGraphQL, requiredEnv } from "./monday-client.js";

const taskColumns = {
  linkedClient: env("MONDAY_TASK_LINKED_CLIENT_COLUMN_ID", "linked_client_file"),
  ownerPeople: env("MONDAY_TASK_OWNER_COLUMN_ID", "owner"),
  demoOwnerStaff: env("MONDAY_TASK_DEMO_OWNER_STAFF_COLUMN_ID", "demo_owner_staff"),
  dueDate: env("MONDAY_TASK_DUE_DATE_COLUMN_ID", "due_date"),
  reportingPeriod: env("MONDAY_TASK_REPORTING_PERIOD_COLUMN_ID", "reporting_period"),
  status: env("MONDAY_TASK_STATUS_COLUMN_ID", "task_status"),
  serviceType: env("MONDAY_TASK_SERVICE_TYPE_COLUMN_ID", "service_type"),
  clientRequest: env("MONDAY_TASK_CLIENT_REQUEST_COLUMN_ID", "client_request"),
};

const clientColumns = {
  email: env("MONDAY_CLIENT_EMAIL_COLUMN_ID", "email"),
  missingInformation: env("MONDAY_CLIENT_MISSING_INFORMATION_COLUMN_ID", "missing_information"),
  onboardingStatus: env("MONDAY_CLIENT_ONBOARDING_STATUS_COLUMN_ID", "onboarding_status"),
};

const doneTaskLabel = env("AUTOMATION_LABEL_TASK_DONE", "בוצע");
const waitingForClientLabel = env("AUTOMATION_LABEL_TASK_WAITING_FOR_CLIENT", "ממתין ללקוח");

export async function buildWeeklyReport() {
  const dueSoonDays = Number(env("MAKE_WEEKLY_REPORT_DUE_SOON_DAYS", "7"));
  const today = localDate();
  const dueSoonEnd = addDays(today, dueSoonDays);
  const [tasks, clients] = await Promise.all([
    listBoardItems(requiredEnv("MONDAY_ONGOING_TASKS_BOARD_ID"), taskColumnIds()),
    listBoardItems(requiredEnv("MONDAY_CLIENTS_BOARD_ID"), [
      clientColumns.email,
      clientColumns.missingInformation,
      clientColumns.onboardingStatus,
    ]),
  ]);

  const openTasks = tasks.filter((task) => !isDoneStatus(getColumnText(task, taskColumns.status)));
  const overdueTasks = openTasks.filter((task) => {
    const dueDate = getColumnDate(task, taskColumns.dueDate);
    return dueDate && dueDate < today;
  });
  const dueSoonTasks = openTasks.filter((task) => {
    const dueDate = getColumnDate(task, taskColumns.dueDate);
    return dueDate && dueDate >= today && dueDate <= dueSoonEnd;
  });
  const waitingTasks = openTasks.filter(
    (task) => getColumnText(task, taskColumns.status) === waitingForClientLabel,
  );
  const workloadRows = workloadByOwner(openTasks);
  const missingInfoClients = clients.filter((client) =>
    getColumnLongText(client, clientColumns.missingInformation).trim(),
  );

  const subject = env(
    "MAKE_WEEKLY_REPORT_EMAIL_SUBJECT_STATIC",
    `דוח ניהולי שבועי - ${today}`,
  );

  return {
    generatedAt: new Date().toISOString(),
    subject,
    html: renderWeeklyReportHtml({
      dueSoonDays,
      generatedAt: new Date(),
      overdueTasks,
      dueSoonTasks,
      waitingTasks,
      workloadRows,
      missingInfoClients,
    }),
    counts: {
      overdueTasks: overdueTasks.length,
      dueSoonTasks: dueSoonTasks.length,
      waitingTasks: waitingTasks.length,
      workloadOwners: workloadRows.length,
      missingInfoClients: missingInfoClients.length,
    },
  };
}

function taskColumnIds() {
  return [
    taskColumns.linkedClient,
    taskColumns.ownerPeople,
    taskColumns.demoOwnerStaff,
    taskColumns.dueDate,
    taskColumns.reportingPeriod,
    taskColumns.status,
    taskColumns.serviceType,
    taskColumns.clientRequest,
  ].filter(Boolean);
}

async function listBoardItems(boardId, columnIds) {
  const limit = Number(env("MAKE_WEEKLY_REPORT_ITEM_LIMIT", "100"));
  const data = await mondayGraphQL(
    `query WeeklyReportItems($boardIds: [ID!], $columnIds: [String!], $limit: Int!) {
      boards(ids: $boardIds) {
        items_page(limit: $limit) {
          items {
            id
            name
            url
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

function renderWeeklyReportHtml({
  dueSoonDays,
  generatedAt,
  overdueTasks,
  dueSoonTasks,
  waitingTasks,
  workloadRows,
  missingInfoClients,
}) {
  const generatedAtText = new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem",
  }).format(generatedAt);

  return `<!doctype html>
<html lang="he" dir="rtl">
<body style="font-family:Arial,sans-serif;color:#202124;direction:rtl;text-align:right">
  <h2>${escapeHtml(env("MAKE_WEEKLY_REPORT_TITLE", "דוח ניהולי שבועי"))}</h2>
  <p>נוצר בתאריך ${escapeHtml(generatedAtText)}.</p>

  ${taskTable("משימות באיחור", overdueTasks, "לא נמצאו משימות פתוחות באיחור.")}
  ${taskTable(
    `משימות לתאריך יעד ב-${dueSoonDays} הימים הקרובים`,
    dueSoonTasks,
    `לא נמצאו משימות פתוחות לתאריך יעד ב-${dueSoonDays} הימים הקרובים.`,
  )}
  ${taskTable("משימות שממתינות ללקוח", waitingTasks, "אין משימות שממתינות לקלט מהלקוח.")}
  ${workloadTable(workloadRows)}
  ${missingInfoTable(missingInfoClients)}
</body>
</html>`;
}

function taskTable(title, tasks, emptyText) {
  return `<h3>${escapeHtml(title)}</h3>
  <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
    <thead>
      <tr>
        <th>משימה</th><th>לקוח</th><th>שירות</th><th>תקופה</th><th>אחראי</th><th>תאריך יעד</th><th>סטטוס</th>
      </tr>
    </thead>
    <tbody>${tasks.length ? tasks.map(taskRow).join("") : emptyRow(emptyText, 7)}</tbody>
  </table>`;
}

function taskRow(task) {
  return `<tr>
    <td><a href="${escapeHtml(task.url || mondayItemUrl(task.id))}">${escapeHtml(task.name)}</a></td>
    <td>${escapeHtml(getLinkedItemNames(getColumn(task, taskColumns.linkedClient)).join(", ") || getColumnText(task, taskColumns.linkedClient))}</td>
    <td>${escapeHtml(getColumnText(task, taskColumns.serviceType))}</td>
    <td>${escapeHtml(getColumnText(task, taskColumns.reportingPeriod))}</td>
    <td>${escapeHtml(getTaskOwner(task))}</td>
    <td>${escapeHtml(getColumnDate(task, taskColumns.dueDate))}</td>
    <td>${escapeHtml(getColumnText(task, taskColumns.status))}</td>
  </tr>`;
}

function workloadTable(rows) {
  return `<h3>עומס לפי אחראי</h3>
  <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
    <thead>
      <tr>
        <th>אחראי</th><th>משימות פתוחות</th><th>באיחור</th><th>ממתינות ללקוח</th><th>תאריך יעד קרוב</th>
      </tr>
    </thead>
    <tbody>${rows.length ? rows.map(workloadRow).join("") : emptyRow("לא נמצא עומס פתוח לרואי החשבון.", 5)}</tbody>
  </table>`;
}

function workloadRow(row) {
  return `<tr>
    <td>${escapeHtml(row.owner)}</td>
    <td>${row.open}</td>
    <td>${row.overdue}</td>
    <td>${row.waiting}</td>
    <td>${escapeHtml(row.nearestDueDate || "")}</td>
  </tr>`;
}

function missingInfoTable(clients) {
  return `<h3>תיקי לקוח עם מידע חסר</h3>
  <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
    <thead>
      <tr><th>לקוח</th><th>אימייל</th><th>סטטוס קליטה</th><th>מידע חסר</th></tr>
    </thead>
    <tbody>${clients.length ? clients.map(missingInfoRow).join("") : emptyRow("אין תיקי לקוח שחסומים כרגע בגלל מידע חסר.", 4)}</tbody>
  </table>`;
}

function missingInfoRow(client) {
  return `<tr>
    <td><a href="${escapeHtml(client.url || mondayItemUrl(client.id))}">${escapeHtml(client.name)}</a></td>
    <td>${escapeHtml(getColumnText(client, clientColumns.email))}</td>
    <td>${escapeHtml(getColumnText(client, clientColumns.onboardingStatus))}</td>
    <td>${escapeHtml(getColumnLongText(client, clientColumns.missingInformation))}</td>
  </tr>`;
}

function workloadByOwner(tasks) {
  const today = localDate();
  const grouped = new Map();

  for (const task of tasks) {
    const owner = getTaskOwner(task) || "לא שובץ";
    const dueDate = getColumnDate(task, taskColumns.dueDate);
    const status = getColumnText(task, taskColumns.status);
    const row = grouped.get(owner) || {
      owner,
      open: 0,
      overdue: 0,
      waiting: 0,
      nearestDueDate: "",
    };

    row.open += 1;
    if (dueDate && dueDate < today) row.overdue += 1;
    if (status === waitingForClientLabel) row.waiting += 1;
    if (dueDate && (!row.nearestDueDate || dueDate < row.nearestDueDate)) {
      row.nearestDueDate = dueDate;
    }
    grouped.set(owner, row);
  }

  return [...grouped.values()].sort(
    (a, b) => b.open - a.open || a.owner.localeCompare(b.owner, "he"),
  );
}

function getTaskOwner(task) {
  return (
    getColumnText(task, taskColumns.demoOwnerStaff) ||
    getLinkedItemNames(getColumn(task, taskColumns.demoOwnerStaff)).join(", ") ||
    getColumnText(task, taskColumns.ownerPeople)
  );
}

function getColumnDate(item, columnId) {
  const parsed = parseColumnValue(getColumn(item, columnId));
  return parsed?.date || getColumnText(item, columnId);
}

function getColumnLongText(item, columnId) {
  const column = getColumn(item, columnId);
  const parsed = parseColumnValue(column);
  return parsed?.text || column?.text || "";
}

function getColumnText(item, columnId) {
  return getColumn(item, columnId)?.text || "";
}

function getLinkedItemNames(column) {
  return (column?.linked_items || []).map((item) => item.name).filter(Boolean);
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

function isDoneStatus(status) {
  return status === doneTaskLabel || ["Done", "בוצע", "הושלם"].includes(status);
}

function emptyRow(text, colspan) {
  return `<tr><td colspan="${colspan}">${escapeHtml(text)}</td></tr>`;
}

function mondayItemUrl(itemId) {
  return `https://view.monday.com/items/${encodeURIComponent(itemId)}`;
}

function localDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
