#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadDotEnv();

const transport = process.env.MAKE_MCP_TRANSPORT || "sse";
const explicitUrl = process.env.MAKE_MCP_URL;
const mcpUrl = explicitUrl || buildMakeMcpUrl(transport);

const child = spawn("npx", ["-y", "mcp-remote", mcpUrl], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

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
  if (!maxToolNameLength) {
    return value;
  }

  const url = new URL(value);
  url.searchParams.set("maxToolNameLength", maxToolNameLength);
  return url.toString();
}

function normalizeZone(value) {
  return value.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function loadDotEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

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
