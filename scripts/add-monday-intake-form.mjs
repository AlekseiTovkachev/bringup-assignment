#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

loadDotEnv();

const FORMAT = getArgValue("--format") || "markdown";
const FORM_TOKEN_PLACEHOLDER = "$FORM_TOKEN_FROM_CREATE_FORM";

const workspaceId = getArgValue("--workspace-id") || process.env.MONDAY_WORKSPACE_ID;
const destinationName =
  getArgValue("--destination-name") ||
  env("MONDAY_INTAKE_FORM_BOARD_NAME", "קליטת לקוחות מהטופס");
const destinationFolderId =
  getArgValue("--folder-id") || env("MONDAY_INTAKE_FORM_FOLDER_ID", "");
const destinationFolderName =
  getArgValue("--folder-name") || env("MONDAY_INTAKE_FORM_FOLDER_NAME", "");
const boardKind = env("MONDAY_BOARD_KIND", "public");
const formTitle = env("MONDAY_INTAKE_FORM_TITLE", "טופס קליטת לקוח חדש");
const formDescription = env(
  "MONDAY_INTAKE_FORM_DESCRIPTION",
  "נא למלא את הפרטים כדי לפתוח תיק לקוח ראשוני. הצוות יחזור אליכם לאחר בדיקת המידע.",
);
const boardOwnerIds = csvEnv("MONDAY_INTAKE_FORM_OWNER_IDS");
const boardSubscriberIds = csvEnv("MONDAY_INTAKE_FORM_SUBSCRIBER_IDS");

const questionSpecs = [
  {
    key: "client-name",
    title: "שם לקוח / עסק",
    type: "Name",
    required: true,
  },
  {
    key: "legal-tax-id",
    title: "ח.פ / עוסק מורשה / מספר מזהה",
    type: "ShortText",
    required: true,
    description: "יש להזין ספרות בלבד ככל האפשר.",
  },
  {
    key: "entity-type",
    title: "סוג ישות",
    type: "SingleSelect",
    required: true,
    options: [
      { label: "יחיד / עצמאי" },
      { label: "חברה בע״מ" },
      { label: "שותפות" },
      { label: "עמותה" },
      { label: "אחר" },
    ],
    settings: {
      display: "Dropdown",
      optionsOrder: "Custom",
    },
  },
  {
    key: "primary-contact-name",
    title: "איש קשר ראשי",
    type: "ShortText",
    required: true,
  },
  {
    key: "email",
    title: "אימייל",
    type: "Email",
    required: true,
  },
  {
    key: "phone",
    title: "טלפון",
    type: "Phone",
    required: true,
  },
  {
    key: "service-types",
    title: "סוגי שירות מבוקשים",
    type: "MultiSelect",
    required: true,
    options: [
      { label: "הנהלת חשבונות" },
      { label: "שכר" },
      { label: "דיווח חודשי" },
      { label: "דיווח מע״מ" },
      { label: "ניכויים" },
      { label: "דוח שנתי" },
    ],
    settings: {
      display: "Vertical",
      optionsOrder: "Custom",
    },
  },
  {
    key: "intake-notes",
    title: "הערות או מידע נוסף",
    type: "LongText",
    required: false,
  },
  {
    key: "consent-confirmed",
    title: "אני מאשר/ת שהפרטים שמסרתי נכונים ושצוות ברינגאפ ייצור איתי קשר",
    type: "Boolean",
    required: true,
    settings: {
      checkedByDefault: false,
    },
  },
];

main();

function main() {
  const payload = buildPayload();

  if (FORMAT === "json") {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (FORMAT === "mcp-json") {
    console.log(JSON.stringify(toMcpCalls(payload), null, 2));
    return;
  }

  if (FORMAT !== "markdown") {
    throw new Error('Unsupported --format. Use "markdown", "json", or "mcp-json".');
  }

  printMarkdown(payload);
}

function buildPayload() {
  return {
    createForm: {
      destination_workspace_id: workspaceIdOrPlaceholder(),
      destination_name: destinationName,
      board_kind: boardKind,
      ...(destinationFolderId ? { destination_folder_id: destinationFolderId } : {}),
      ...(destinationFolderName ? { destination_folder_name: destinationFolderName } : {}),
      ...(boardOwnerIds.length ? { board_owner_ids: boardOwnerIds } : {}),
      ...(boardSubscriberIds.length ? { board_subscriber_ids: boardSubscriberIds } : {}),
    },
    header: {
      action: "updateFormHeader",
      formToken: FORM_TOKEN_PLACEHOLDER,
      form: {
        title: formTitle,
        description: formDescription,
      },
    },
    appearance: {
      action: "updateAppearance",
      formToken: FORM_TOKEN_PLACEHOLDER,
      form: {
        accessibility: {
          language: "he",
          logoAltText: "ברינגאפ",
        },
        appearance: {
          layout: {
            direction: "Rtl",
            alignment: "Right",
            format: "Classic",
          },
          primaryColor: "#0f766e",
          submitButton: {
            text: "שליחת פרטים",
          },
          text: {
            font: "Arial",
            size: "Medium",
          },
          showProgressBar: true,
          hideBranding: false,
        },
      },
    },
    features: {
      action: "updateFeatures",
      formToken: FORM_TOKEN_PLACEHOLDER,
      form: {
        features: {
          monday: {
            allow_create_item: true,
            includeNameQuestion: false,
            syncQuestionAndColumnsTitles: true,
          },
          preSubmissionView: {
            enabled: true,
            title: formTitle,
            description: formDescription,
            startButton: {
              text: "התחלת מילוי",
            },
          },
          afterSubmissionView: {
            title: "הפרטים התקבלו",
            description: "תודה. צוות ברינגאפ יבדוק את הפרטים ויצור איתכם קשר.",
            allowEditSubmission: false,
            allowResubmit: false,
            allowViewSubmission: false,
            showSuccessImage: true,
          },
          draftSubmission: {
            enabled: true,
          },
          reCaptchaChallenge: true,
          requireLogin: {
            enabled: false,
          },
        },
      },
    },
    questions: questionSpecs.map(({ key, ...question }) => ({
      key,
      action: "create",
      formToken: FORM_TOKEN_PLACEHOLDER,
      question,
    })),
    activation: {
      action: "activate",
      formToken: FORM_TOKEN_PLACEHOLDER,
    },
  };
}

function toMcpCalls(payload) {
  return [
    {
      tool: "monday_com.create_form",
      arguments: payload.createForm,
    },
    {
      tool: "monday_com.update_form",
      arguments: payload.header,
    },
    {
      tool: "monday_com.update_form",
      arguments: payload.appearance,
    },
    {
      tool: "monday_com.update_form",
      arguments: payload.features,
    },
    ...payload.questions.map(({ key, ...argumentsPayload }) => ({
      key,
      tool: "monday_com.form_questions_editor",
      arguments: argumentsPayload,
    })),
    {
      tool: "monday_com.update_form",
      arguments: payload.activation,
    },
  ];
}

function printMarkdown(payload) {
  console.log("# monday.com intake form MCP payloads\n");
  console.log(
    "Use these with the Monday MCP form tools. The form API creates a backing board for responses; after creation, either use that board as the intake queue or map the response columns to the Clients board process.\n",
  );
  console.log("## 1. Create form");
  console.log("Tool: `monday_com.create_form`\n");
  console.log("```json");
  console.log(JSON.stringify(payload.createForm, null, 2));
  console.log("```\n");
  console.log(`Save the returned form token as \`${FORM_TOKEN_PLACEHOLDER}\` for the next calls.\n`);

  console.log("## 2. Configure form");
  for (const section of [payload.header, payload.appearance, payload.features]) {
    console.log("Tool: `monday_com.update_form`\n");
    console.log("```json");
    console.log(JSON.stringify(section, null, 2));
    console.log("```\n");
  }

  console.log("## 3. Create questions");
  for (const { key, ...question } of payload.questions) {
    console.log(`### ${key}`);
    console.log("Tool: `monday_com.form_questions_editor`\n");
    console.log("```json");
    console.log(JSON.stringify(question, null, 2));
    console.log("```\n");
  }

  console.log("## 4. Activate form");
  console.log("Tool: `monday_com.update_form`\n");
  console.log("```json");
  console.log(JSON.stringify(payload.activation, null, 2));
  console.log("```\n");
}

function workspaceIdOrPlaceholder() {
  if (workspaceId) return String(workspaceId);

  return "$MONDAY_WORKSPACE_ID";
}

function csvEnv(name) {
  return env(name, "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
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
