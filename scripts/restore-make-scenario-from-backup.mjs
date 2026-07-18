#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadDotEnv();

const scenarioId = Number(process.argv[2] || requiredEnv("MAKE_ENGAGEMENT_LETTER_SCENARIO_ID"));
const backupPath = process.argv[3];

if (!scenarioId || !backupPath) {
  console.error("Usage: node scripts/restore-make-scenario-from-backup.mjs <scenario-id> <backup.json>");
  process.exit(1);
}

const backup = JSON.parse(readFileSync(resolve(backupPath), "utf8"));
const blueprint = backup.blueprint || backup.response?.blueprint || backup.response || backup;
const scheduling = backup.scheduling || backup.response?.scheduling;
const name = backup.name || backup.response?.name || blueprint.name || "Restored Make scenario";

sanitizeBlueprintForSave(blueprint);

const body = {
  name,
  blueprint: JSON.stringify(blueprint),
};

if (scheduling) {
  body.scheduling = JSON.stringify(scheduling);
}

const result = await makeRequest(`/scenarios/${scenarioId}?confirmed=true`, {
  method: "PATCH",
  body: JSON.stringify(body),
});

console.log(JSON.stringify(result, null, 2));

async function makeRequest(pathname, init) {
  const response = await fetch(`${makeApiBaseUrl()}${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${requiredEnv("MAKE_API_TOKEN")}`,
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok || body?.code === "ERROR") {
    fail(`Make API ${response.status}: ${text}`);
  }

  return body;
}

function sanitizeBlueprintForSave(blueprint) {
  delete blueprint.interface;
  delete blueprint.scheduling;
}

function makeApiBaseUrl() {
  const zone = (process.env.MAKE_ZONE || "us1.make.com")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

  return `https://${zone}/api/v2`;
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) fail(`Missing required env var: ${name}`);
  return value;
}

function fail(message) {
  console.error(message);
  process.exit(1);
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

function unquote(value) {
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value[value.length - 1] === quote) {
    return value.slice(1, -1);
  }

  return value;
}
