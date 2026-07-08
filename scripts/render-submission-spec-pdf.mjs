#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(new URL("..", import.meta.url).pathname);
const input = resolve(root, "docs/submission-spec-he.html");
const output = resolve(root, "docs/submission-spec-he.pdf");
const profileDir = resolve(root, "tmp/chrome-pdf-profile");
const mermaidConfig = resolve(root, "tmp/mermaid-puppeteer-config.json");
const mermaidFiles = [
  "onboarding",
  "engagement-letter",
  "ongoing-task",
  "client-portal",
].map((name) => ({
  name,
  input: resolve(root, `docs/submission-spec-he-assets/${name}.mmd`),
  output: resolve(root, `docs/submission-spec-he-assets/${name}.svg`),
}));

const chromeCandidates = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

const chrome = chromeCandidates.find((candidate) => existsSync(candidate));

if (!chrome) {
  console.error("לא נמצא דפדפן Chrome או Chromium להפקת PDF.");
  process.exit(1);
}

if (!existsSync(input)) {
  console.error(`קובץ המקור לא נמצא: ${input}`);
  process.exit(1);
}

mkdirSync(dirname(output), { recursive: true });
mkdirSync(profileDir, { recursive: true });
mkdirSync(dirname(mermaidConfig), { recursive: true });
rmSync(output, { force: true });

writeFileSync(
  mermaidConfig,
  JSON.stringify(
    {
      executablePath: chrome,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-background-networking",
        "--disable-component-update",
      ],
    },
    null,
    2,
  ),
);

for (const diagram of mermaidFiles) {
  if (!existsSync(diagram.input)) {
    console.error(`קובץ Mermaid לא נמצא: ${diagram.input}`);
    process.exit(1);
  }

  const mermaidResult = spawnSync(
    "npx",
    [
      "-y",
      "@mermaid-js/mermaid-cli",
      "-i",
      diagram.input,
      "-o",
      diagram.output,
      "-p",
      mermaidConfig,
      "--backgroundColor",
      "transparent",
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 120_000,
    },
  );

  if (mermaidResult.status !== 0) {
    if (mermaidResult.stderr) {
      console.error(mermaidResult.stderr.trim());
    }
    if (mermaidResult.stdout) {
      console.error(mermaidResult.stdout.trim());
    }
    process.exit(mermaidResult.status ?? 1);
  }
}

const args = [
  "--headless=new",
  "--disable-gpu",
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-extensions",
  "--disable-sync",
  "--no-first-run",
  "--no-default-browser-check",
  "--no-pdf-header-footer",
  `--user-data-dir=${profileDir}`,
  "--print-to-pdf-no-header",
  `--print-to-pdf=${output}`,
  pathToFileURL(input).href,
];

const result = spawnSync(chrome, args, {
  cwd: root,
  encoding: "utf8",
  timeout: 30_000,
});

const outputExists = existsSync(output);
const outputSize = outputExists ? statSync(output).size : 0;
const rendered = outputSize >= 10_000;

if (result.status !== 0 && !rendered) {
  if (result.stderr) {
    console.error(result.stderr.trim());
  }
  if (result.stdout) {
    console.error(result.stdout.trim());
  }
  process.exit(result.status ?? 1);
}

if (!rendered) {
  console.error(`קובץ ה-PDF קטן מדי ולכן כנראה לא הופק כראוי: ${output}`);
  process.exit(1);
}

console.log(`נוצר PDF: ${output}`);
