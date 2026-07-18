#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

loadDotEnv();

const dryRun = process.argv.includes("--dry-run");
const scenarioId = Number(env("MAKE_WEEKLY_REPORT_SCENARIO_ID", "0"));
const makeTeamId = Number(requiredEnv("MAKE_TEAM_ID"));
const makeFolderId = Number(requiredEnv("MAKE_FOLDER_ID"));
const scenarioName = env("MAKE_WEEKLY_REPORT_SCENARIO_NAME", "ברינגאפ - דוח ניהולי שבועי");
const mondayConnectionId = Number(requiredEnv("MAKE_MONDAY_CONNECTION_ID"));
const gmailConnectionId = Number(requiredEnv("MAKE_GMAIL_CONNECTION_ID"));
const recipientEmail = dryRun
  ? env("MAKE_WEEKLY_REPORT_RECIPIENT_EMAIL", "manager@example.com")
  : requiredEnv("MAKE_WEEKLY_REPORT_RECIPIENT_EMAIL");
const tasksBoardId = requiredEnv("MONDAY_ONGOING_TASKS_BOARD_ID");
const clientsBoardId = requiredEnv("MONDAY_CLIENTS_BOARD_ID");
const reportApiUrl = env(
  "MAKE_WEEKLY_REPORT_API_URL",
  "https://bringup-assignment.vercel.app/api/weekly-report",
);

const labels = {
  taskDone: env("AUTOMATION_LABEL_TASK_DONE", "בוצע"),
  taskWaitingForClient: env("AUTOMATION_LABEL_TASK_WAITING_FOR_CLIENT", "ממתין ללקוח"),
};

const columns = {
  taskLinkedClient: env("MONDAY_TASK_LINKED_CLIENT_COLUMN_ID", "linked_client_file"),
  taskServiceType: env("MONDAY_TASK_SERVICE_TYPE_COLUMN_ID", "service_type"),
  taskReportingPeriod: env("MONDAY_TASK_REPORTING_PERIOD_COLUMN_ID", "reporting_period"),
  taskOwnerPeople: env("MONDAY_TASK_OWNER_COLUMN_ID", "owner"),
  taskDemoOwnerStaff: env("MONDAY_TASK_DEMO_OWNER_STAFF_COLUMN_ID", "demo_owner_staff"),
  taskDueDate: env("MONDAY_TASK_DUE_DATE_COLUMN_ID", "due_date"),
  taskStatus: env("MONDAY_TASK_STATUS_COLUMN_ID", "task_status"),
  taskClientRequest: env("MONDAY_TASK_CLIENT_REQUEST_COLUMN_ID", "client_request"),
  clientEmail: env("MONDAY_CLIENT_EMAIL_COLUMN_ID", "email"),
  clientMissingInformation: env(
    "MONDAY_CLIENT_MISSING_INFORMATION_COLUMN_ID",
    "missing_information",
  ),
  clientOnboardingStatus: env("MONDAY_CLIENT_ONBOARDING_STATUS_COLUMN_ID", "onboarding_status"),
};

const names = {
  tasksBoard: env("AUTOMATION_NAME_TASKS_BOARD", "משימות שוטפות"),
  clientsBoard: env("AUTOMATION_NAME_CLIENTS_BOARD", "לקוחות"),
};

const scheduling = {
  type: "weekly",
  interval: Number(env("MAKE_WEEKLY_REPORT_INTERVAL_WEEKS", "1")),
  days: [Number(env("MAKE_WEEKLY_REPORT_DAY", "1"))],
  time: env("MAKE_WEEKLY_REPORT_TIME", "09:00"),
};
const dueSoonDays = Number(env("MAKE_WEEKLY_REPORT_DUE_SOON_DAYS", "7"));

const blueprint = buildBlueprint();

if (dryRun) {
  const outPath = resolve("tmp", "make", "blueprints", "weekly-management-report.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(blueprint, null, 2)}\n`);
  console.log(`Wrote ${outPath}`);
  process.exit(0);
}

const result = scenarioId
  ? await callMakeTool("scenarios_update", {
      scenarioId,
      name: scenarioName,
      confirmed: true,
      scheduling,
      blueprint,
    })
  : await callMakeTool("scenarios_create", {
      teamId: makeTeamId,
      folderId: makeFolderId,
      confirmed: true,
      scheduling,
      blueprint,
    });

console.log(JSON.stringify(result, null, 2));

function buildBlueprint() {
  if (env("MAKE_WEEKLY_REPORT_USE_HTTP", "true") !== "false") {
    return buildHttpReportBlueprint();
  }

  return buildMondayAggregatorBlueprint();
}

function buildHttpReportBlueprint() {
  return {
    name: scenarioName,
    flow: [httpGetWeeklyReportModule(1, 0, 0), gmailSendHttpReportModule(2, 360, 0)],
    metadata: scenarioMetadata(),
  };
}

function buildMondayAggregatorBlueprint() {
  return {
    name: scenarioName,
    flow: [
      mondayListBoardItems(1, tasksBoardId, 0, -360, taskColumns()),
      withFilter(
        textAggregator(2, 1, taskRowTemplate(), 320, -360),
        "משימות פתוחות באיחור",
        overdueTaskConditions(1),
      ),
      mondayListBoardItems(3, tasksBoardId, 0, -120, taskColumns()),
      withFilter(
        textAggregator(4, 3, taskRowTemplate(3), 320, 20),
        `משימות לתאריך יעד ב-${dueSoonDays} הימים הקרובים`,
        dueSoonTaskConditions(3),
      ),
      mondayListBoardItems(5, tasksBoardId, 0, 120, taskColumns()),
      withFilter(
        textAggregator(6, 5, taskRowTemplate(5), 320, 120),
        "משימות שממתינות ללקוח",
        waitingForClientConditions(5),
      ),
      mondayListBoardItems(7, tasksBoardId, 0, 360, taskColumns()),
      textAggregator(8, 7, ownerWorkloadRowTemplate(7), 320, 360),
      mondayListBoardItems(9, clientsBoardId, 0, 600, [
        columns.clientEmail,
        columns.clientMissingInformation,
        columns.clientOnboardingStatus,
      ]),
      textAggregator(10, 9, clientRowTemplate(9), 320, 600),
      gmailSendModule(11, 720, 120),
    ],
    metadata: scenarioMetadata(),
  };
}

function scenarioMetadata() {
  return {
    instant: false,
    version: 1,
    designer: { orphans: [] },
    scenario: {
      dlq: false,
      slots: null,
      dataloss: false,
      maxErrors: 3,
      autoCommit: true,
      roundtrips: 1,
      sequential: false,
      confidential: false,
      freshVariables: false,
      autoCommitTriggerLast: true,
    },
  };
}

function httpGetWeeklyReportModule(id, x, y) {
  return {
    id,
    module: "http:MakeRequest",
    version: 4,
    parameters: {
      tlsType: "",
      authenticationType: "noAuth",
    },
    mapper: {
      url: reportHtmlUrl(),
      method: "get",
      shareCookies: false,
      parseResponse: false,
      allowRedirects: true,
      stopOnHttpError: true,
      requestCompressedContent: true,
    },
    metadata: {
      designer: { x, y },
      restore: {
        parameters: {
          tlsType: { label: "Empty" },
          authenticationType: {
            label: "No authenticationUse when no credentials are required for the request.",
          },
        },
        expect: {
          method: { mode: "chose", label: "GET" },
          headers: { mode: "chose" },
          contentType: { label: "Empty" },
          shareCookies: { mode: "chose" },
          parseResponse: { mode: "chose" },
          allowRedirects: { mode: "chose" },
          queryParameters: { mode: "chose" },
          stopOnHttpError: { mode: "chose" },
          requestCompressedContent: { mode: "chose" },
        },
      },
      parameters: [
        {
          name: "authenticationType",
          type: "select",
          label: "Authentication type",
          required: true,
          validate: { enum: ["noAuth", "apiKey", "basicAuth", "oAuth"] },
        },
        {
          name: "tlsType",
          type: "select",
          label: "Transport layer security (TLS)",
          validate: { enum: ["mTls", "tls"] },
        },
        {
          name: "proxyKeychain",
          type: "keychain:proxy",
          label: "Proxy",
        },
      ],
    },
  };
}

function gmailSendHttpReportModule(id, x, y) {
  return {
    id,
    module: "google-email:sendAnEmail",
    version: 4,
    parameters: {
      __IMTCONN__: gmailConnectionId,
    },
    mapper: {
      to: [recipientEmail],
      subject: env(
        "MAKE_WEEKLY_REPORT_EMAIL_SUBJECT_TEMPLATE",
        'דוח ניהולי שבועי - {{formatDate(now; "YYYY-MM-DD")}}',
      ),
      bodyType: "rawHtml",
      content: "{{1.data}}",
      ...(env("MAKE_GMAIL_FROM", "") ? { from: env("MAKE_GMAIL_FROM", "") } : {}),
    },
    metadata: {
      designer: { x, y },
      restore: {
        parameters: {
          __IMTCONN__: {
            data: { scoped: "true", connection: "google-email" },
            label: env("MAKE_GMAIL_CONNECTION_LABEL", "Gmail connection"),
          },
        },
        mapper: {
          bodyType: { mode: "chose", label: "Raw HTML" },
        },
      },
      parameters: [
        { name: "__IMTCONN__", type: "account:google-email", label: "Connection", required: true },
      ],
    },
  };
}

function reportHtmlUrl() {
  const url = new URL(reportApiUrl);
  url.searchParams.set("format", "html");
  const secret = env("MAKE_WEEKLY_REPORT_API_SECRET", "");
  if (secret) url.searchParams.set("secret", secret);
  return url.toString();
}

function taskColumns() {
  return [
    columns.taskLinkedClient,
    columns.taskServiceType,
    columns.taskReportingPeriod,
    columns.taskOwnerPeople,
    columns.taskDemoOwnerStaff,
    columns.taskDueDate,
    columns.taskStatus,
    columns.taskClientRequest,
  ].filter(Boolean);
}

function mondayListBoardItems(id, boardId, x, y, filterToGetColumnValues) {
  return {
    id,
    module: "monday:ListBoardItemsV2",
    version: 2,
    parameters: {
      __IMTCONN__: mondayConnectionId,
    },
    mapper: {
      boardId,
      showParentID: false,
      showSubitemsID: false,
      newestFirst: true,
      disableOutputInterfaceCaching: false,
      limit: Number(env("MAKE_WEEKLY_REPORT_ITEM_LIMIT", "100")),
      filterToGetColumnValues,
    },
    metadata: {
      designer: { x, y },
      restore: {
        parameters: {
          __IMTCONN__: {
            data: { scoped: "true", connection: "monday" },
            label: env("MAKE_MONDAY_CONNECTION_LABEL", "Monday connection"),
          },
        },
        mapper: {
          boardId: { mode: "chose", label: boardId === tasksBoardId ? names.tasksBoard : names.clientsBoard },
        },
      },
      parameters: [
        { name: "__IMTCONN__", type: "account:monday", label: "Connection", required: true },
      ],
    },
  };
}

function textAggregator(id, feeder, value, x, y) {
  return {
    id,
    module: "util:TextAggregator",
    version: 1,
    parameters: {
      feeder,
      rowSeparator: "other",
      otherRowSeparator: "",
    },
    mapper: {
      value,
    },
    metadata: {
      designer: { x, y },
      restore: {
        parameters: {
          feeder: { label: `Module ${feeder}` },
          rowSeparator: { label: "Other" },
        },
      },
    },
  };
}

function gmailSendModule(id, x, y) {
  return {
    id,
    module: "google-email:sendAnEmail",
    version: 4,
    parameters: {
      __IMTCONN__: gmailConnectionId,
    },
    mapper: {
      to: [recipientEmail],
      subject: env(
        "MAKE_WEEKLY_REPORT_EMAIL_SUBJECT_TEMPLATE",
        'דוח ניהולי שבועי - {{formatDate(now; "YYYY-MM-DD")}}',
      ),
      bodyType: "rawHtml",
      content: weeklyReportHtml(),
      ...(env("MAKE_GMAIL_FROM", "") ? { from: env("MAKE_GMAIL_FROM", "") } : {}),
    },
    metadata: {
      designer: { x, y },
      restore: {
        parameters: {
          __IMTCONN__: {
            data: { scoped: "true", connection: "google-email" },
            label: env("MAKE_GMAIL_CONNECTION_LABEL", "Gmail connection"),
          },
        },
        mapper: {
          bodyType: { mode: "chose", label: "Raw HTML" },
        },
      },
      parameters: [
        { name: "__IMTCONN__", type: "account:google-email", label: "Connection", required: true },
      ],
    },
  };
}

function taskRowTemplate(sourceId = 1) {
  return `<tr>
  <td><a href="https://view.monday.com/items/{{${sourceId}.id}}">{{${sourceId}.name}}</a></td>
  <td>{{${sourceId}.mappable_column_values.${columns.taskLinkedClient}.text}}</td>
  <td>{{${sourceId}.mappable_column_values.${columns.taskServiceType}.text}}</td>
  <td>{{${sourceId}.mappable_column_values.${columns.taskReportingPeriod}.text}}</td>
  <td>${taskOwnerExpression(sourceId)}</td>
  <td>{{${sourceId}.mappable_column_values.${columns.taskDueDate}.text}}</td>
  <td>{{${sourceId}.mappable_column_values.${columns.taskStatus}.text}}</td>
</tr>`;
}

function ownerWorkloadRowTemplate(sourceId) {
  return `<tr>
  <td>${taskOwnerExpression(sourceId)}</td>
  <td><a href="https://view.monday.com/items/{{${sourceId}.id}}">{{${sourceId}.name}}</a></td>
  <td>{{${sourceId}.mappable_column_values.${columns.taskLinkedClient}.text}}</td>
  <td>{{${sourceId}.mappable_column_values.${columns.taskServiceType}.text}}</td>
  <td>{{${sourceId}.mappable_column_values.${columns.taskDueDate}.text}}</td>
  <td>{{${sourceId}.mappable_column_values.${columns.taskStatus}.text}}</td>
</tr>`;
}

function clientRowTemplate(sourceId) {
  return `<tr>
  <td><a href="https://view.monday.com/items/{{${sourceId}.id}}">{{${sourceId}.name}}</a></td>
  <td>{{${sourceId}.mappable_column_values.${columns.clientEmail}.email}}</td>
  <td>{{${sourceId}.mappable_column_values.${columns.clientOnboardingStatus}.text}}</td>
  <td>${missingInformationExpression(sourceId)}</td>
</tr>`;
}

function weeklyReportHtml() {
  const emptyOverdueTasks = `<tr><td colspan="7">לא נמצאו משימות פתוחות באיחור.</td></tr>`;
  const emptyDueSoonTasks = `<tr><td colspan="7">לא נמצאו משימות פתוחות לתאריך יעד ב-${dueSoonDays} הימים הקרובים.</td></tr>`;
  const emptyWaitingTasks = `<tr><td colspan="7">אין משימות שממתינות לקלט מהלקוח.</td></tr>`;
  const emptyWorkload = `<tr><td colspan="6">לא נמצא עומס פתוח לרואי החשבון.</td></tr>`;
  const emptyMissingInfo = `<tr><td colspan="4">אין תיקי לקוח שחסומים כרגע בגלל מידע חסר.</td></tr>`;

  return `<!doctype html>
<html lang="he" dir="rtl">
<body style="font-family:Arial,sans-serif;color:#202124;direction:rtl;text-align:right">
  <h2>${escapeHtml(env("MAKE_WEEKLY_REPORT_TITLE", "דוח ניהולי שבועי"))}</h2>
  <p>נוצר בתאריך {{formatDate(now; "YYYY-MM-DD HH:mm")}}.</p>

  <h3>משימות באיחור</h3>
  <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
    <thead>
      <tr>
        <th>משימה</th><th>לקוח</th><th>שירות</th><th>תקופה</th><th>אחראי</th><th>תאריך יעד</th><th>סטטוס</th>
      </tr>
    </thead>
    <tbody>{{ifempty(2.text; '${emptyOverdueTasks}')}}</tbody>
  </table>

  <h3>משימות לתאריך יעד ב-${dueSoonDays} הימים הקרובים</h3>
  <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
    <thead>
      <tr>
        <th>משימה</th><th>לקוח</th><th>שירות</th><th>תקופה</th><th>אחראי</th><th>תאריך יעד</th><th>סטטוס</th>
      </tr>
    </thead>
    <tbody>{{ifempty(4.text; '${emptyDueSoonTasks}')}}</tbody>
  </table>

  <h3>משימות שממתינות ללקוח</h3>
  <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
    <thead>
      <tr>
        <th>משימה</th><th>לקוח</th><th>שירות</th><th>תקופה</th><th>אחראי</th><th>תאריך יעד</th><th>סטטוס</th>
      </tr>
    </thead>
    <tbody>{{ifempty(6.text; '${emptyWaitingTasks}')}}</tbody>
  </table>

  <h3>עומס לפי אחראי</h3>
  <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
    <thead>
      <tr>
        <th>אחראי</th><th>משימה</th><th>לקוח</th><th>שירות</th><th>תאריך יעד</th><th>סטטוס</th>
      </tr>
    </thead>
    <tbody>{{ifempty(8.text; '${emptyWorkload}')}}</tbody>
  </table>

  <h3>תיקי לקוח עם מידע חסר</h3>
  <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
    <thead>
      <tr><th>לקוח</th><th>אימייל</th><th>סטטוס קליטה</th><th>מידע חסר</th></tr>
    </thead>
    <tbody>{{ifempty(10.text; '${emptyMissingInfo}')}}</tbody>
  </table>
</body>
</html>`;
}

function openTaskConditions(sourceId) {
  return [
    [
      {
        a: `{{${sourceId}.mappable_column_values.${columns.taskStatus}.text}}`,
        b: labels.taskDone,
        o: "text:notEqual",
      },
    ],
  ];
}

function overdueTaskConditions(sourceId) {
  return [
    [
      ...openTaskConditions(sourceId)[0],
      {
        a: `{{${sourceId}.mappable_column_values.${columns.taskDueDate}.text}}`,
        b: "{{formatDate(now; \"YYYY-MM-DD\")}}",
        o: "date:less",
      },
    ],
  ];
}

function dueSoonTaskConditions(sourceId) {
  return [
    [
      ...openTaskConditions(sourceId)[0],
      {
        a: `{{${sourceId}.mappable_column_values.${columns.taskDueDate}.text}}`,
        b: "{{formatDate(now; \"YYYY-MM-DD\")}}",
        o: "date:greaterOrEqual",
      },
      {
        a: `{{${sourceId}.mappable_column_values.${columns.taskDueDate}.text}}`,
        b: `{{formatDate(addDays(now; ${dueSoonDays}); "YYYY-MM-DD")}}`,
        o: "date:lessOrEqual",
      },
    ],
  ];
}

function waitingForClientConditions(sourceId) {
  return [
    [
      {
        a: `{{${sourceId}.mappable_column_values.${columns.taskStatus}.text}}`,
        b: labels.taskWaitingForClient,
        o: "text:equal",
      },
    ],
  ];
}

function missingInformationConditions(sourceId) {
  return [
    [
      {
        a: `{{${sourceId}.mappable_column_values.${columns.clientMissingInformation}.text}}`,
        o: "text:exist",
      },
    ],
    [
      {
        a: `{{${sourceId}.mappable_column_values.${columns.clientMissingInformation}.value}}`,
        o: "text:exist",
      },
    ],
    [
      {
        a: `{{${sourceId}.mappable_column_values.${columns.clientMissingInformation}}}`,
        o: "text:exist",
      },
    ],
  ];
}

function taskOwnerExpression(sourceId) {
  const peopleOwner = `${sourceId}.mappable_column_values.${columns.taskOwnerPeople}.text`;

  if (!columns.taskDemoOwnerStaff) {
    return `{{${peopleOwner}}}`;
  }

  const demoOwner = `${sourceId}.mappable_column_values.${columns.taskDemoOwnerStaff}.text`;
  return `{{ifempty(${demoOwner}; ${peopleOwner})}}`;
}

function missingInformationExpression(sourceId) {
  const missingInfo = `${sourceId}.mappable_column_values.${columns.clientMissingInformation}`;
  return `{{ifempty(${missingInfo}.text; ifempty(${missingInfo}.value; ${missingInfo}))}}`;
}

function withFilter(module, name, conditions) {
  return {
    ...module,
    filter: {
      name,
      conditions,
    },
  };
}

async function callMakeTool(toolName, toolArgs) {
  if (process.env.MAKE_SCENARIO_TRANSPORT === "api") {
    return callMakeApiTool(toolName, toolArgs);
  }

  const mcpUrl = buildMakeMcpUrl(process.env.MAKE_MCP_TRANSPORT || "sse");
  const child = spawn("npx", ["-y", "mcp-remote", mcpUrl], {
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });

  const pending = new Map();
  let nextId = 1;
  let stdoutBuffer = "";
  let stderr = "";

  const timeout = setTimeout(() => {
    child.kill("SIGTERM");
    fail(`Timed out while creating Make scenario.\n${stderr}`);
  }, Number(process.env.MAKE_MCP_CALL_TIMEOUT_MS || 90000));

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    let newlineIndex = stdoutBuffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = stdoutBuffer.slice(0, newlineIndex).trim();
      stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
      newlineIndex = stdoutBuffer.indexOf("\n");
      if (!line) continue;

      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }

      if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      }
    }
  });

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const request = (method, params) => {
    const id = nextId++;
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
  };

  try {
    await request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "bringup-assignment-make-weekly-report-upserter",
        version: "1.0.0",
      },
    });
    child.stdin.write(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) +
        "\n",
    );
    const output = await request("tools/call", {
      name: toolName,
      arguments: toolArgs,
    });
    clearTimeout(timeout);
    child.kill("SIGTERM");
    return output;
  } catch (error) {
    child.kill("SIGTERM");
    fail(`${error.message}\n${stderr}`);
  }
}

async function callMakeApiTool(toolName, toolArgs) {
  if (!process.env.MAKE_API_TOKEN) {
    fail("Missing MAKE_API_TOKEN for MAKE_SCENARIO_TRANSPORT=api.");
  }

  if (toolName === "scenarios_update") {
    return makeApiRequest(`/scenarios/${toolArgs.scenarioId}?confirmed=true`, {
      method: "PATCH",
      body: JSON.stringify({
        name: toolArgs.name,
        scheduling: JSON.stringify(toolArgs.scheduling),
        blueprint: JSON.stringify(toolArgs.blueprint),
      }),
    });
  }

  if (toolName === "scenarios_create") {
    return makeApiRequest("/scenarios?confirmed=true", {
      method: "POST",
      body: JSON.stringify({
        teamId: toolArgs.teamId,
        folderId: toolArgs.folderId,
        scheduling: JSON.stringify(toolArgs.scheduling),
        blueprint: JSON.stringify(toolArgs.blueprint),
      }),
    });
  }

  fail(`Unsupported Make API tool: ${toolName}`);
}

async function makeApiRequest(pathname, init) {
  const response = await fetch(`${makeApiBaseUrl()}${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${process.env.MAKE_API_TOKEN}`,
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || body?.code === "ERROR") {
    fail(`Make API ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

function makeApiBaseUrl() {
  const zone = (process.env.MAKE_ZONE || "us1.make.com")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

  return `https://${zone}/api/v2`;
}

function buildMakeMcpUrl(selectedTransport) {
  if (process.env.MAKE_MCP_URL) {
    return process.env.MAKE_MCP_URL;
  }

  const token = process.env.MAKE_MCP_TOKEN;
  if (!token) {
    if (selectedTransport === "stream") return "https://mcp.make.com/stream";
    if (selectedTransport === "stateless") return "https://mcp.make.com";
    return "https://mcp.make.com/sse";
  }

  const zone = (process.env.MAKE_ZONE || "us1.make.com")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  const url = new URL(`https://${zone}/mcp/u/${encodeURIComponent(token)}/${selectedTransport}`);
  if (process.env.MAKE_MCP_MAX_TOOL_NAME_LENGTH) {
    url.searchParams.set("maxToolNameLength", process.env.MAKE_MCP_MAX_TOOL_NAME_LENGTH);
  }
  return url.toString();
}

function loadDotEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    process.env[key] = unquote(rawValue);
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    fail(`Missing required env var: ${name}`);
  }
  return value;
}

function env(name, fallback) {
  return process.env[name] || fallback;
}

function unquote(value) {
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value[value.length - 1] === quote) {
    return value.slice(1, -1);
  }

  return value;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
