#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

loadDotEnv();

const outDir = path.join(process.cwd(), "tmp", "make", "blueprints");
fs.mkdirSync(outDir, { recursive: true });

const MONDAY_CONNECTION_ID = Number(process.env.MAKE_MONDAY_CONNECTION_ID || 8818692);
const CLIENTS_BOARD_ID = requiredEnv("MONDAY_CLIENTS_BOARD_ID");
const TASKS_BOARD_ID = requiredEnv("MONDAY_ONGOING_TASKS_BOARD_ID");

const columns = {
  onboardingStatus: env("MONDAY_CLIENT_ONBOARDING_STATUS_COLUMN_ID", "onboarding_status"),
  email: env("MONDAY_CLIENT_EMAIL_COLUMN_ID", "email"),
  engagementStatus: env(
    "MONDAY_CLIENT_ENGAGEMENT_LETTER_STATUS_COLUMN_ID",
    "engagement_letter_status",
  ),
  engagementLink: env("MONDAY_CLIENT_ENGAGEMENT_LETTER_LINK_COLUMN_ID", "engagement_letter_link"),
  missingInformation: env("MONDAY_CLIENT_MISSING_INFORMATION_COLUMN_ID", "missing_information"),
  serviceTypes: env("MONDAY_CLIENT_SERVICE_TYPES_COLUMN_ID", "service_types"),
  responseDetails: env("MONDAY_CLIENT_RESPONSE_DETAILS_COLUMN_ID", "client_response_details"),
  lastClientUpdate: env("MONDAY_CLIENT_LAST_UPDATE_COLUMN_ID", "last_client_update"),
};

const engagementBlueprint = {
  name: "BringUp - Engagement Letter Hub",
  flow: [
    mondayWatchClients(1, CLIENTS_BOARD_ID),
    mondayGetItem(2, CLIENTS_BOARD_ID, "{{1.id}}", 320),
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
            withFilter(
              mondayGraphQL(4, createEngagementMutation(), 960, -160),
              "File opened and letter not created",
              [
                [
                  {
                    a: `{{2.mappable_column_values.${columns.onboardingStatus}.text}}`,
                    o: "text:equal",
                    b: "File Opened",
                  },
                  {
                    a: `{{2.mappable_column_values.${columns.engagementStatus}.text}}`,
                    o: "text:notEqual",
                    b: "Created",
                  },
                  {
                    a: `{{2.mappable_column_values.${columns.engagementStatus}.text}}`,
                    o: "text:notEqual",
                    b: "Sent",
                  },
                ],
              ],
            ),
            mondayCreateUpdate(
              5,
              "{{1.id}}",
              "Generated engagement letter draft and marked it Created. Replace the demo link with the real Google Docs module once the Google connection/template is added.",
              1280,
              -160,
            ),
          ],
        },
        {
          flow: [
            withFilter(
              mondayGraphQL(6, sentEngagementMutation(), 960, 160),
              "Created letter ready to send",
              [
                [
                  {
                    a: `{{2.mappable_column_values.${columns.engagementStatus}.text}}`,
                    o: "text:equal",
                    b: "Created",
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
            ),
            mondayCreateUpdate(
              7,
              "{{1.id}}",
              "Engagement letter link exists and status was Created, so Make marked it Sent. Add Gmail module after connecting Gmail for real delivery.",
              1280,
              160,
            ),
          ],
        },
      ],
    },
  ],
  metadata: metadata(false),
};

const weeklyReportBlueprint = {
  name: "BringUp - Weekly Management Report",
  flow: [
    mondayListBoardItems(1, TASKS_BOARD_ID, 0, -160),
    mondayListBoardItems(2, CLIENTS_BOARD_ID, 0, 160),
    mondayCreateUpdate(
      3,
      "{{2[1].id}}",
      "Weekly management report placeholder: review open tasks, overdue tasks, waiting-for-client items, and missing-information client files. Add Gmail once connected.",
      320,
      0,
    ),
  ],
  metadata: metadata(false),
};

writeBlueprint("engagement-letter-hub.json", engagementBlueprint);
writeBlueprint("weekly-management-report.json", weeklyReportBlueprint);

console.log(`Wrote Make blueprints to ${outDir}`);

function mondayWatchClients(id, boardId) {
  return {
    id,
    module: "monday:WatchBoardItemsV2",
    version: 2,
    parameters: {
      limit: 100,
      boardId,
      watchType: "updated",
      __IMTCONN__: MONDAY_CONNECTION_ID,
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
          boardId: { mode: "chose", label: "Demo -Clients  ::  public" },
          watchType: { label: "New and Updated Items" },
          __IMTCONN__: {
            data: { scoped: "true", connection: "monday" },
            label: "Monday BringUp connection",
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

function mondayGetItem(id, boardId, itemId, x) {
  return {
    id,
    module: "monday:GetItemV2",
    version: 2,
    parameters: {
      __IMTCONN__: MONDAY_CONNECTION_ID,
    },
    mapper: {
      id: itemId,
      boardId,
      showSubitems: true,
      showParentItem: true,
      disableOutputInterfaceCaching: false,
    },
    metadata: {
      designer: { x, y: 0 },
      parameters: [
        { name: "__IMTCONN__", type: "account:monday", label: "Connection", required: true },
      ],
    },
  };
}

function mondayGraphQL(id, query, x, y) {
  return {
    id,
    module: "monday:ExecuteGraphQLQueryV2",
    version: 2,
    parameters: {
      __IMTCONN__: MONDAY_CONNECTION_ID,
    },
    mapper: {
      query,
    },
    metadata: {
      designer: { x, y },
      parameters: [
        { name: "__IMTCONN__", type: "account:monday", label: "Connection", required: true },
      ],
    },
  };
}

function mondayCreateUpdate(id, itemId, body, x, y) {
  return {
    id,
    module: "monday:CreateUpdateV2",
    version: 2,
    parameters: {
      __IMTCONN__: MONDAY_CONNECTION_ID,
    },
    mapper: {
      itemId,
      body,
    },
    metadata: {
      designer: { x, y },
      parameters: [
        { name: "__IMTCONN__", type: "account:monday", label: "Connection", required: true },
      ],
    },
  };
}

function mondayListBoardItems(id, boardId, x, y) {
  return {
    id,
    module: "monday:ListBoardItemsV2",
    version: 2,
    parameters: {
      __IMTCONN__: MONDAY_CONNECTION_ID,
    },
    mapper: {
      boardId,
      limit: 100,
    },
    metadata: {
      designer: { x, y },
      parameters: [
        { name: "__IMTCONN__", type: "account:monday", label: "Connection", required: true },
      ],
    },
  };
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

function createEngagementMutation() {
  return `mutation {
  change_multiple_column_values(
    board_id: ${CLIENTS_BOARD_ID},
    item_id: {{1.id}},
    column_values: "{\\"${columns.engagementStatus}\\": {\\"label\\": \\"Created\\"}, \\"${columns.engagementLink}\\": {\\"url\\": \\"https://docs.example.com/engagement-letter-{{1.id}}\\", \\"text\\": \\"Engagement letter draft\\"}, \\"${columns.lastClientUpdate}\\": {\\"date\\": \\"{{formatDate(now; \\"YYYY-MM-DD\\")}}\\"}}"
  ) {
    id
  }
}`;
}

function sentEngagementMutation() {
  return `mutation {
  change_multiple_column_values(
    board_id: ${CLIENTS_BOARD_ID},
    item_id: {{1.id}},
    column_values: "{\\"${columns.engagementStatus}\\": {\\"label\\": \\"Sent\\"}, \\"${columns.lastClientUpdate}\\": {\\"date\\": \\"{{formatDate(now; \\"YYYY-MM-DD\\")}}\\"}}"
  ) {
    id
  }
}`;
}

function metadata(instant) {
  return {
    instant,
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

function writeBlueprint(name, blueprint) {
  fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(blueprint, null, 2)}\n`);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

function env(name, fallback) {
  return process.env[name] || fallback;
}

function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}
