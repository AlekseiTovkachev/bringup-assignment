#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadDotEnv();

const createMode = process.argv.includes("--create");
const scenarioId = createMode ? 0 : Number(requiredEnv("MAKE_ENGAGEMENT_LETTER_SCENARIO_ID"));
const makeTeamId = Number(env("MAKE_TEAM_ID", "0"));
const makeFolderId = Number(env("MAKE_FOLDER_ID", "0"));
const templateId = requiredEnv("GOOGLE_DRIVE_ENGAGEMENT_TEMPLATE_ID");
const googleConnectionId = Number(requiredEnv("MAKE_GOOGLE_CONNECTION_ID"));
const mondayConnectionId = Number(requiredEnv("MAKE_MONDAY_CONNECTION_ID"));
const clientsBoardId = requiredEnv("MONDAY_CLIENTS_BOARD_ID");
const outputFolderId = env("GOOGLE_DRIVE_ENGAGEMENT_OUTPUT_FOLDER_ID", "/");
const scenarioName = env("MAKE_ENGAGEMENT_LETTER_SCENARIO_NAME", "BringUp - Engagement Letter Hub");
const triggerMode = env("MAKE_ENGAGEMENT_LETTER_TRIGGER", "webhook");
const webhookHookId = Number(env("MAKE_ENGAGEMENT_LETTER_WEBHOOK_HOOK_ID", "0"));
const webhookItemId = env(
  "MAKE_ENGAGEMENT_LETTER_WEBHOOK_ITEM_ID_TEMPLATE",
  "{{ifempty(1.itemId; 1.event.pulseId)}}",
);
const clientItemIdExpression = triggerMode === "webhook" ? "{{2.id}}" : "{{1.id}}";
const generatedDocumentName = env(
  "MAKE_ENGAGEMENT_LETTER_DOCUMENT_NAME_TEMPLATE",
  'Engagement Letter - {{2.name}} - {{formatDate(now; "YYYY-MM-DD")}}',
);
const generatedDocumentUrl = env(
  "MAKE_ENGAGEMENT_LETTER_DOCUMENT_URL_TEMPLATE",
  "{{4.webViewLink}}",
);

const labels = {
  onboardingFileOpened: env("AUTOMATION_LABEL_ONBOARDING_FILE_OPENED", "File Opened"),
  engagementCreated: env("AUTOMATION_LABEL_ENGAGEMENT_CREATED", "Created"),
  engagementSent: env("AUTOMATION_LABEL_ENGAGEMENT_SENT", "Sent"),
};

const columns = {
  onboardingStatus: env("MONDAY_CLIENT_ONBOARDING_STATUS_COLUMN_ID", "onboarding_status"),
  legalTaxId: env("MONDAY_CLIENT_LEGAL_TAX_ID_COLUMN_ID", "legal_tax_id"),
  entityType: env("MONDAY_CLIENT_ENTITY_TYPE_COLUMN_ID", "entity_type"),
  primaryContact: env("MONDAY_CLIENT_PRIMARY_CONTACT_NAME_COLUMN_ID", "primary_contact_name"),
  email: env("MONDAY_CLIENT_EMAIL_COLUMN_ID", "email"),
  phone: env("MONDAY_CLIENT_PHONE_COLUMN_ID", "phone"),
  assignedAccountant: env("MONDAY_CLIENT_ASSIGNED_ACCOUNTANT_COLUMN_ID", "assigned_accountant"),
  serviceTypes: env("MONDAY_CLIENT_SERVICE_TYPES_COLUMN_ID", "service_types"),
  engagementStatus: env(
    "MONDAY_CLIENT_ENGAGEMENT_LETTER_STATUS_COLUMN_ID",
    "engagement_letter_status",
  ),
  engagementLink: env("MONDAY_CLIENT_ENGAGEMENT_LETTER_LINK_COLUMN_ID", "engagement_letter_link"),
  lastClientUpdate: env("MONDAY_CLIENT_LAST_UPDATE_COLUMN_ID", "last_client_update"),
};

if (createMode && (!makeTeamId || !makeFolderId)) {
  fail("Missing MAKE_TEAM_ID or MAKE_FOLDER_ID for scenario creation.");
}

const currentScenario = createMode
  ? {
      scheduling: defaultScheduling(),
      blueprint: buildBaseBlueprint(),
    }
  : await getScenario(scenarioId);
const blueprint = currentScenario.blueprint;

if (triggerMode === "webhook") {
  normalizeWebhookTrigger(blueprint);
} else if (triggerMode !== "schedule") {
  fail('MAKE_ENGAGEMENT_LETTER_TRIGGER must be either "webhook" or "schedule".');
}

const router = blueprint.flow?.find((module) => module.module === "builtin:BasicRouter");

if (!router?.routes?.[0]?.flow?.length) {
  fail("Could not find the first router route in the engagement-letter scenario.");
}

const createRouteFilter =
  triggerMode === "webhook" ? fileOpenedFilter() : router.routes[0].flow[0].filter || fileOpenedFilter();
const sentRouteFilter =
  triggerMode === "webhook"
    ? createdReadyToSendFilter()
    : router.routes[1]?.flow?.[0]?.filter || createdReadyToSendFilter();

router.routes[0].flow = [
  withFilter(googleDocsFromTemplateModule(4), createRouteFilter),
  mondayCreatedColumnValuesModule(5),
  mondayCreateUpdateModule(
    6,
    env(
      "AUTOMATION_MESSAGE_ENGAGEMENT_CREATED_UPDATE",
      "Generated a real Google Docs engagement letter from the bilingual template and marked it Created.",
    ),
    1280,
    -160,
  ),
];

if (router.routes[1]?.flow) {
  router.routes[1].flow = [
    withFilter(mondaySentColumnValuesModule(7), sentRouteFilter),
    mondayCreateUpdateModule(
      8,
      env(
        "AUTOMATION_MESSAGE_ENGAGEMENT_READY_TO_SEND_UPDATE",
        "Engagement letter link exists and status was Created, so Make marked it Sent. Add Gmail delivery before activating this route for production use.",
      ),
      1280,
      160,
    ),
  ];
}

const result = createMode
  ? await callMakeTool("scenarios_create", {
      teamId: makeTeamId,
      folderId: makeFolderId,
      confirmed: true,
      scheduling: defaultScheduling(),
      blueprint,
    })
  : await callMakeTool("scenarios_update", {
      scenarioId,
      name: scenarioName,
      confirmed: true,
      scheduling: defaultScheduling(currentScenario.scheduling),
      blueprint,
    });

console.log(JSON.stringify(result, null, 2));

function googleDocsFromTemplateModule(id) {
  return {
    id,
    module: "google-docs:createADocumentFromTemplate",
    version: 1,
    parameters: {
      __IMTCONN__: googleConnectionId,
    },
    mapper: {
      select: "map",
      document: templateId,
      name: generatedDocumentName,
      destination: "drive",
      folderId: outputFolderId,
      requests: [
        tag("client_name", "{{2.name}}"),
        tag("legal_tax_id", `{{2.mappable_column_values.${columns.legalTaxId}.text}}`),
        tag("entity_type", `{{2.mappable_column_values.${columns.entityType}.text}}`),
        tag(
          "primary_contact_name",
          `{{2.mappable_column_values.${columns.primaryContact}.text}}`,
        ),
        tag("client_email", `{{2.mappable_column_values.${columns.email}.email}}`),
        tag("client_phone", `{{2.mappable_column_values.${columns.phone}.text}}`),
        tag(
          "assigned_accountant",
          `{{2.mappable_column_values.${columns.assignedAccountant}.text}}`,
        ),
        tag("service_types", `{{2.mappable_column_values.${columns.serviceTypes}.text}}`),
        tag("generated_date", '{{formatDate(now; "YYYY-MM-DD")}}'),
        tag("firm_representative_name", "BringUp Accounting Firm"),
      ],
    },
    metadata: {
      designer: {
        x: 960,
        y: -160,
      },
      restore: {
        parameters: {
          __IMTCONN__: {
            data: { scoped: "true", connection: "google" },
            label: "My Google connection",
          },
        },
        mapper: {
          select: { mode: "chose", label: "By Mapping" },
          destination: { mode: "chose", label: "My Drive" },
        },
      },
    },
  };
}

function buildBaseBlueprint() {
  return {
    name: scenarioName,
    flow: [
      mondayWatchClientsModule(1),
      mondayGetItemModule(2),
      {
        id: 3,
        module: "builtin:BasicRouter",
        version: 1,
        mapper: null,
        metadata: {
          designer: {
            x: 640,
            y: 0,
          },
        },
        routes: [
          {
            flow: [
              withFilter(googleDocsFromTemplateModule(4), fileOpenedFilter()),
              mondayCreatedColumnValuesModule(5),
              mondayCreateUpdateModule(
                6,
                env(
                  "AUTOMATION_MESSAGE_ENGAGEMENT_CREATED_UPDATE",
                  "Generated a real Google Docs engagement letter from the bilingual template and marked it Created.",
                ),
                1280,
                -160,
              ),
            ],
          },
          {
            flow: [
              withFilter(mondaySentColumnValuesModule(7), createdReadyToSendFilter()),
              mondayCreateUpdateModule(
                8,
                env(
                  "AUTOMATION_MESSAGE_ENGAGEMENT_READY_TO_SEND_UPDATE",
                  "Engagement letter link exists and status was Created, so Make marked it Sent. Add Gmail delivery before activating this route for production use.",
                ),
                1280,
                160,
              ),
            ],
          },
        ],
      },
    ],
    metadata: {
      instant: triggerMode === "webhook",
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
    },
  };
}

function defaultScheduling(existingScheduling = null) {
  if (triggerMode === "webhook") {
    return null;
  }

  return (
    existingScheduling || {
      type: "indefinitely",
      interval: Number(env("MAKE_ENGAGEMENT_LETTER_INTERVAL_SECONDS", "900")),
    }
  );
}

function normalizeWebhookTrigger(blueprint) {
  if (!webhookHookId) {
    fail("Missing MAKE_ENGAGEMENT_LETTER_WEBHOOK_HOOK_ID for webhook trigger mode.");
  }

  if (!Array.isArray(blueprint.flow) || blueprint.flow.length < 3) {
    fail("Engagement-letter blueprint must contain trigger, item lookup, and router modules.");
  }

  blueprint.flow[0] = webhookTriggerModule(1);
  blueprint.flow[1] = mondayGetItemModule(2);
  blueprint.metadata = {
    ...blueprint.metadata,
    instant: true,
  };
}

function webhookTriggerModule(id) {
  return {
    id,
    module: "gateway:CustomWebHook",
    version: 1,
    parameters: {
      hook: webhookHookId,
    },
    mapper: {},
    metadata: {
      designer: { x: 0, y: 0 },
      restore: {
        parameters: {
          hook: {
            data: { editable: "true" },
            label: env("MAKE_ENGAGEMENT_LETTER_WEBHOOK_NAME", "BringUp engagement letter hook"),
          },
        },
      },
      parameters: [
        { name: "hook", type: "hook:gateway-webhook", label: "Webhook", required: true },
      ],
      interface: [
        { name: "itemId", type: "number", label: "Item ID" },
        { name: "action", type: "text", label: "Action" },
        {
          name: "event",
          type: "collection",
          label: "monday Event",
          spec: [
            { name: "pulseId", type: "number", label: "Pulse ID" },
            { name: "columnId", type: "text", label: "Column ID" },
            {
              name: "value",
              type: "collection",
              label: "Value",
              spec: [
                {
                  name: "label",
                  type: "collection",
                  label: "Label",
                  spec: [{ name: "text", type: "text", label: "Text" }],
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

function mondayWatchClientsModule(id) {
  return {
    id,
    module: "monday:WatchBoardItemsV2",
    version: 2,
    parameters: {
      limit: Number(env("MAKE_MONDAY_WATCH_LIMIT", "100")),
      boardId: clientsBoardId,
      watchType: "updated",
      __IMTCONN__: mondayConnectionId,
      showParentID: false,
      showSubitemsID: false,
      filterToGetColumnValues: [],
      disableOutputInterfaceCaching: false,
    },
    mapper: {},
    metadata: {
      designer: { x: 0, y: 0 },
      restore: {
        parameters: {
          boardId: {
            mode: "chose",
            label: env("AUTOMATION_NAME_CLIENTS_BOARD", "Clients"),
          },
          watchType: { label: "New and Updated Items" },
          __IMTCONN__: {
            data: { scoped: "true", connection: "monday" },
            label: env("MAKE_MONDAY_CONNECTION_LABEL", "Monday connection"),
          },
        },
      },
      parameters: [
        { name: "__IMTCONN__", type: "account:monday", label: "Connection", required: true },
        { name: "boardId", type: "select", label: "Board ID", required: true },
        { name: "watchType", type: "select", label: "Watch" },
      ],
    },
  };
}

function mondayGetItemModule(id) {
  return {
    id,
    module: "monday:GetItemV2",
    version: 2,
    parameters: {
      __IMTCONN__: mondayConnectionId,
    },
    mapper: {
      id: triggerMode === "webhook" ? webhookItemId : "{{1.id}}",
      boardId: clientsBoardId,
      showSubitems: true,
      showParentItem: true,
      disableOutputInterfaceCaching: false,
    },
    metadata: {
      designer: { x: 320, y: 0 },
      parameters: [
        { name: "__IMTCONN__", type: "account:monday", label: "Connection", required: true },
      ],
    },
  };
}

function mondayCreatedColumnValuesModule(id) {
  return mondayChangeMultipleColumnValuesModule(
    id,
    [
      statusColumnValue(columns.engagementStatus, labels.engagementCreated),
      linkColumnValue(columns.engagementLink, generatedDocumentUrl, "Engagement letter draft"),
      dateColumnValue(columns.lastClientUpdate),
    ],
    1280,
    -160,
  );
}

function mondaySentColumnValuesModule(id) {
  return mondayChangeMultipleColumnValuesModule(
    id,
    [
      statusColumnValue(columns.engagementStatus, labels.engagementSent),
      dateColumnValue(columns.lastClientUpdate),
    ],
    960,
    160,
  );
}

function mondayChangeMultipleColumnValuesModule(id, columnValuesToChange, x, y) {
  return {
    id,
    module: "monday:ChangeMultipleColumnValuesV2",
    version: 2,
    parameters: {
      __IMTCONN__: mondayConnectionId,
    },
    mapper: {
      boardId: clientsBoardId,
      itemId: clientItemIdExpression,
      columnValuesToChange,
      create_labels_if_missing: false,
    },
    metadata: {
      designer: { x, y },
      parameters: [
        { name: "__IMTCONN__", type: "account:monday", label: "Connection", required: true },
      ],
    },
  };
}

function statusColumnValue(columnId, label) {
  return {
    columnId,
    columnValue: {
      selectType: "label2index",
      label,
    },
  };
}

function linkColumnValue(columnId, url, text) {
  return {
    columnId,
    columnValue: {
      url,
      text,
    },
  };
}

function dateColumnValue(columnId) {
  return {
    columnId,
    columnValue: {
      date: '{{formatDate(now; "YYYY-MM-DD")}}',
      includeTime: false,
    },
  };
}

function mondayCreateUpdateModule(id, body, x, y) {
  return {
    id,
    module: "monday:CreateUpdateV2",
    version: 2,
    parameters: {
      __IMTCONN__: mondayConnectionId,
    },
    mapper: {
      body,
      itemId: clientItemIdExpression,
    },
    metadata: {
      designer: { x, y },
      parameters: [
        { name: "__IMTCONN__", type: "account:monday", label: "Connection", required: true },
      ],
    },
  };
}

function withFilter(module, filter) {
  return {
    ...module,
    filter,
  };
}

function fileOpenedFilter() {
  if (triggerMode === "webhook") {
    return {
      name: "Generate engagement letter hook",
      conditions: [
        [
          {
            a: "{{1.event.columnId}}",
            b: columns.onboardingStatus,
            o: "text:equal",
          },
          {
            a: "{{1.event.value.label.text}}",
            b: labels.onboardingFileOpened,
            o: "text:equal",
          },
        ],
      ],
    };
  }

  return {
    name: "File opened and letter not created",
    conditions: [
      [
        {
          a: `{{2.mappable_column_values.${columns.onboardingStatus}.text}}`,
          b: labels.onboardingFileOpened,
          o: "text:equal",
        },
        {
          a: `{{2.mappable_column_values.${columns.engagementStatus}.text}}`,
          b: labels.engagementCreated,
          o: "text:notEqual",
        },
        {
          a: `{{2.mappable_column_values.${columns.engagementStatus}.text}}`,
          b: labels.engagementSent,
          o: "text:notEqual",
        },
      ],
    ],
  };
}

function createdReadyToSendFilter() {
  if (triggerMode === "webhook") {
    return {
      name: env("MAKE_ENGAGEMENT_LETTER_SEND_FILTER_NAME", "Send engagement letter hook"),
      conditions: [
        [
          {
            a: "{{1.event.columnId}}",
            b: columns.engagementStatus,
            o: "text:equal",
          },
          {
            a: "{{1.event.value.label.text}}",
            b: labels.engagementCreated,
            o: "text:equal",
          },
        ],
      ],
    };
  }

  return {
    name: "Created letter ready to send",
    conditions: [
      [
        {
          a: `{{2.mappable_column_values.${columns.engagementStatus}.text}}`,
          b: labels.engagementCreated,
          o: "text:equal",
        },
        {
          a: `{{2.mappable_column_values.${columns.email}.email}}`,
          o: "text:exist",
        },
        {
          a: `{{2.mappable_column_values.${columns.engagementLink}.url}}`,
          o: "text:exist",
        },
      ],
    ],
  };
}

function tag(text, replaceText) {
  return { text, replaceText };
}

async function getScenario(id) {
  const result = await callMakeTool("scenarios_get", { scenarioId: id });
  const text = result.content?.find((part) => part.type === "text")?.text;
  if (!text) {
    fail("Make MCP did not return scenario content.");
  }

  return JSON.parse(text);
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
    fail(`Timed out while updating Make scenario.\n${stderr}`);
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
        name: "bringup-assignment-make-engagement-updater",
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

  if (toolName === "scenarios_get") {
    const body = await makeApiRequest(
      `/scenarios/${toolArgs.scenarioId}/blueprint`,
      { method: "GET" },
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(body.response),
        },
      ],
    };
  }

  if (toolName === "scenarios_update") {
    const body = {
      name: toolArgs.name,
      blueprint: JSON.stringify(toolArgs.blueprint),
    };
    if (toolArgs.scheduling) {
      body.scheduling = JSON.stringify(toolArgs.scheduling);
    }

    return makeApiRequest(`/scenarios/${toolArgs.scenarioId}?confirmed=true`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  if (toolName === "scenarios_create") {
    const body = {
      teamId: toolArgs.teamId,
      folderId: toolArgs.folderId,
      blueprint: JSON.stringify(toolArgs.blueprint),
    };
    if (toolArgs.scheduling) {
      body.scheduling = JSON.stringify(toolArgs.scheduling);
    }

    return makeApiRequest("/scenarios?confirmed=true", {
      method: "POST",
      body: JSON.stringify(body),
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

function escapeGraphQLString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
