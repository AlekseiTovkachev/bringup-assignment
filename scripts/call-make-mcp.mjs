#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadDotEnv();

const [, , toolName, rawArgs = "{}"] = process.argv;
if (!toolName) {
  fail("Usage: node scripts/call-make-mcp.mjs <tool-name> [json-arguments]");
}

let toolArgs;
try {
  toolArgs = JSON.parse(rawArgs);
} catch (error) {
  fail(`Invalid JSON arguments: ${error.message}`);
}

const transport = process.env.MAKE_MCP_TRANSPORT || "sse";
const explicitUrl = process.env.MAKE_MCP_URL;
const mcpUrl = explicitUrl || buildMakeMcpUrl(transport);
const timeoutMs = Number(process.env.MAKE_MCP_CALL_TIMEOUT_MS || 90000);

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
  fail(`Timed out after ${timeoutMs}ms while calling Make MCP tool ${toolName}.\n${stderr}`);
}, timeoutMs);

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

child.on("error", (error) => fail(error.message));

try {
  await request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "bringup-assignment-make-caller",
      version: "1.0.0",
    },
  });
  notify("notifications/initialized", {});

  const result = await request("tools/call", {
    name: toolName,
    arguments: toolArgs,
  });

  clearTimeout(timeout);
  child.kill("SIGTERM");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  child.kill("SIGTERM");
  fail(`${error.message}\n${stderr}`);
}

function request(method, params) {
  const id = nextId++;
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

function buildMakeMcpUrl(selectedTransport) {
  const token = process.env.MAKE_MCP_TOKEN;

  if (!token) {
    const oauthUrl =
      selectedTransport === "stream"
        ? "https://mcp.make.com/stream"
        : selectedTransport === "stateless"
          ? "https://mcp.make.com"
          : "https://mcp.make.com/sse";

    return withOptionalToolNameLimit(oauthUrl);
  }

  const zone = normalizeZone(process.env.MAKE_ZONE || "us1.make.com");
  return withOptionalToolNameLimit(
    `https://${zone}/mcp/u/${encodeURIComponent(token)}/${selectedTransport}`,
  );
}

function withOptionalToolNameLimit(value) {
  const maxToolNameLength = process.env.MAKE_MCP_MAX_TOOL_NAME_LENGTH;
  if (!maxToolNameLength) return value;

  const url = new URL(value);
  url.searchParams.set("maxToolNameLength", maxToolNameLength);
  return url.toString();
}

function normalizeZone(value) {
  return value.replace(/^https?:\/\//, "").replace(/\/+$/, "");
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

function fail(message) {
  console.error(message);
  process.exit(1);
}
