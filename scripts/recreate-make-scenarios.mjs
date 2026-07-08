#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");

loadDotEnv();

const engagement = runJsonScript("scripts/create-make-engagement-letter-scenario.mjs", [], {
  MAKE_SCENARIO_TRANSPORT: "api",
});
const engagementScenarioId = scenarioIdFrom(engagement, "engagement-letter scenario");
writeEnvValues({ MAKE_ENGAGEMENT_LETTER_SCENARIO_ID: engagementScenarioId });

runJsonScript("scripts/update-make-engagement-letter-gmail.mjs", [], {
  MAKE_SCENARIO_TRANSPORT: "api",
  MAKE_ENGAGEMENT_LETTER_SCENARIO_ID: String(engagementScenarioId),
});

const weekly = runJsonScript("scripts/upsert-make-weekly-report-scenario.mjs", [], {
  MAKE_SCENARIO_TRANSPORT: "api",
  MAKE_WEEKLY_REPORT_SCENARIO_ID: "0",
});
const weeklyScenarioId = scenarioIdFrom(weekly, "weekly report scenario");
writeEnvValues({ MAKE_WEEKLY_REPORT_SCENARIO_ID: weeklyScenarioId });

console.log(`Recreated Make scenarios:
MAKE_ENGAGEMENT_LETTER_SCENARIO_ID=${engagementScenarioId}
MAKE_WEEKLY_REPORT_SCENARIO_ID=${weeklyScenarioId}`);

function runJsonScript(scriptPath, args, extraEnv) {
  const child = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ...extraEnv,
    },
  });

  if (child.stdout) process.stdout.write(child.stdout);
  if (child.stderr) process.stderr.write(child.stderr);

  if (child.status !== 0) {
    process.exit(child.status || 1);
  }

  try {
    return JSON.parse(child.stdout);
  } catch (error) {
    throw new Error(`Could not parse JSON output from ${scriptPath}: ${error.message}`);
  }
}

function scenarioIdFrom(result, label) {
  const id = result?.scenario?.id;
  if (!id) throw new Error(`Make did not return an id for ${label}.`);
  return String(id);
}

function loadDotEnv() {
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

function writeEnvValues(values) {
  const existingContents = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const lines = existingContents ? existingContents.split(/\r?\n/) : [];
  const seen = new Set();

  const updatedLines = lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (!match || !Object.prototype.hasOwnProperty.call(values, match[1])) return line;

    seen.add(match[1]);
    return `${match[1]}=${values[match[1]]}`;
  });

  for (const [key, value] of Object.entries(values)) {
    if (!seen.has(key)) updatedLines.push(`${key}=${value}`);
    process.env[key] = String(value);
  }

  writeFileSync(envPath, `${trimTrailingEmptyLines(updatedLines).join("\n")}\n`);
}

function trimTrailingEmptyLines(lines) {
  const trimmed = [...lines];
  while (trimmed.length && trimmed[trimmed.length - 1] === "") trimmed.pop();
  return trimmed;
}

function unquote(value) {
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value[value.length - 1] === quote) {
    return value.slice(1, -1);
  }

  return value;
}
