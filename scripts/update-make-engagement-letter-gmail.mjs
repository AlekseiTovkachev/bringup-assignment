#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadDotEnv();

const scenarioId = Number(requiredEnv("MAKE_ENGAGEMENT_LETTER_SCENARIO_ID"));
const gmailConnectionId = Number(requiredEnv("MAKE_GMAIL_CONNECTION_ID"));
const mondayConnectionId = Number(requiredEnv("MAKE_MONDAY_CONNECTION_ID"));
const clientsBoardId = requiredEnv("MONDAY_CLIENTS_BOARD_ID");
const scenarioName = env("MAKE_ENGAGEMENT_LETTER_SCENARIO_NAME", "BringUp - Engagement Letter Hub");
const triggerMode = env("MAKE_ENGAGEMENT_LETTER_TRIGGER", "webhook");
const clientItemIdExpression = triggerMode === "webhook" ? "{{2.id}}" : "{{1.id}}";

const labels = {
  engagementCreated: env("AUTOMATION_LABEL_ENGAGEMENT_CREATED", "Created"),
  engagementSent: env("AUTOMATION_LABEL_ENGAGEMENT_SENT", "Sent"),
};

const columns = {
  email: env("MONDAY_CLIENT_EMAIL_COLUMN_ID", "email"),
  primaryContact: env("MONDAY_CLIENT_PRIMARY_CONTACT_NAME_COLUMN_ID", "primary_contact_name"),
  engagementStatus: env(
    "MONDAY_CLIENT_ENGAGEMENT_LETTER_STATUS_COLUMN_ID",
    "engagement_letter_status",
  ),
  engagementLink: env("MONDAY_CLIENT_ENGAGEMENT_LETTER_LINK_COLUMN_ID", "engagement_letter_link"),
  lastClientUpdate: env("MONDAY_CLIENT_LAST_UPDATE_COLUMN_ID", "last_client_update"),
};

const emailSubject = env(
  "MAKE_ENGAGEMENT_LETTER_EMAIL_SUBJECT_TEMPLATE",
  "Your engagement letter from BringUp Accounting Firm",
);
const emailHtml = env(
  "MAKE_ENGAGEMENT_LETTER_EMAIL_HTML_TEMPLATE",
  `<p>Dear {{2.mappable_column_values.${columns.primaryContact}.text}},</p>
<p>Your engagement letter is ready for review.</p>
<p><a href="{{2.mappable_column_values.${columns.engagementLink}.url}}">Open the engagement letter</a></p>
<p>Please review it and reply to this email if you have any questions.</p>
<p>Best regards,<br>BringUp Accounting Firm</p>`,
);
const gmailFrom = env("MAKE_GMAIL_FROM", "");
const gmailConnectionLabel = env("MAKE_GMAIL_CONNECTION_LABEL", "Gmail connection");

const currentScenario = await getScenario(scenarioId);
const blueprint = currentScenario.blueprint;
const router = blueprint.flow?.find((module) => module.module === "builtin:BasicRouter");

if (triggerMode !== "webhook" && triggerMode !== "schedule") {
  fail('MAKE_ENGAGEMENT_LETTER_TRIGGER must be either "webhook" or "schedule".');
}

if (!router?.routes?.[1]) {
  fail("Could not find the second router route in the engagement-letter scenario.");
}

const sentRouteFilter =
  triggerMode === "webhook"
    ? createdReadyToSendFilter()
    : router.routes[1].flow?.[0]?.filter || createdReadyToSendFilter();

router.routes[1].flow = [
  withFilter(gmailSendModule(7), sentRouteFilter),
  mondaySentColumnValuesModule(8),
  mondayCreateUpdateModule(
    9,
    env(
      "AUTOMATION_MESSAGE_ENGAGEMENT_SENT_UPDATE",
      "Sent the engagement-letter email through Gmail and marked it Sent.",
    ),
    1280,
    160,
  ),
];

const result = await callMakeTool("scenarios_update", {
  scenarioId,
  name: scenarioName,
  confirmed: true,
  scheduling: currentScenario.scheduling,
  blueprint,
});

console.log(JSON.stringify(result, null, 2));

function gmailSendModule(id) {
  return {
    id,
    module: "google-email:sendAnEmail",
    version: 4,
    parameters: {
      __IMTCONN__: gmailConnectionId,
    },
    mapper: {
      to: [`{{2.mappable_column_values.${columns.email}.email}}`],
      subject: emailSubject,
      bodyType: "rawHtml",
      content: emailHtml,
      ...(gmailFrom ? { from: gmailFrom } : {}),
    },
    metadata: {
      designer: { x: 960, y: 160 },
      restore: {
        parameters: {
          __IMTCONN__: {
            data: { scoped: "true", connection: "google-email" },
            label: gmailConnectionLabel,
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

function mondaySentColumnValuesModule(id) {
  return mondayChangeMultipleColumnValuesModule(
    id,
    [
      statusColumnValue(columns.engagementStatus, labels.engagementSent),
      dateColumnValue(columns.lastClientUpdate),
    ],
    1280,
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
    name: env("MAKE_ENGAGEMENT_LETTER_SEND_FILTER_NAME", "Created letter ready to send"),
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
        name: "bringup-assignment-make-gmail-updater",
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
