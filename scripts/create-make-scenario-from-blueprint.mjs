#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

loadDotEnv();

const blueprintPath = process.argv[2];
const nameOverride = getArgValue("--name");
const teamId = Number(getArgValue("--team-id") || requiredEnv("MAKE_TEAM_ID"));
const folderId = Number(getArgValue("--folder-id") || requiredEnv("MAKE_FOLDER_ID"));
const interval = getArgValue("--interval");

if (!blueprintPath) {
  console.error(
    "Usage: node scripts/create-make-scenario-from-blueprint.mjs <blueprint.json> [--name=<name>] [--interval=<seconds>]",
  );
  process.exit(1);
}

const blueprint = JSON.parse(readFileSync(resolve(blueprintPath), "utf8"));
if (nameOverride) {
  blueprint.name = nameOverride;
}

const result = await callMakeTool("scenarios_create", {
  teamId,
  folderId,
  confirmed: true,
  scheduling: schedulingFromArgs(),
  blueprint,
});

console.log(JSON.stringify(result, null, 2));

async function callMakeTool(toolName, toolArgs) {
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
    console.error(`Timed out while creating Make scenario.\n${stderr}`);
    process.exit(1);
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
        name: "bringup-assignment-make-creator",
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
    console.error(`${error.message}\n${stderr}`);
    process.exit(1);
  }
}

function getArgValue(name) {
  const inlineValue = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inlineValue) return inlineValue.slice(name.length + 1);

  const index = process.argv.indexOf(name);
  if (index !== -1) return process.argv[index + 1];

  return "";
}

function schedulingFromArgs() {
  if (!interval) return { type: "on-demand" };

  const intervalSeconds = Number(interval);
  if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
    console.error("--interval must be a positive number of seconds.");
    process.exit(1);
  }

  return {
    type: "indefinitely",
    interval: intervalSeconds,
  };
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }

  return value;
}

function buildMakeMcpUrl(selectedTransport) {
  const explicitUrl = process.env.MAKE_MCP_URL;
  if (explicitUrl) return explicitUrl;

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
    url.searchParams.set(
      "maxToolNameLength",
      process.env.MAKE_MCP_MAX_TOOL_NAME_LENGTH,
    );
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

function unquote(value) {
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value[value.length - 1] === quote) {
    return value.slice(1, -1);
  }

  return value;
}
