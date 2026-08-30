import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const outputDirectory = resolve(repositoryRoot, "evidence/pwa/screenshots");
const baseURL = process.env.BIEWANGLE_BASE_URL ?? "http://127.0.0.1:4173";

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  locale: "zh-CN",
  timezoneId: "Asia/Shanghai",
  reducedMotion: "reduce",
});
const page = await context.newPage();

const captures = [
  {
    route: "/",
    viewport: { width: 390, height: 844 },
    filename: "home-390x844.png",
  },
  {
    route: "/templates",
    viewport: { width: 1440, height: 900 },
    filename: "templates-1440x900.png",
  },
  {
    route: "/data",
    viewport: { width: 1440, height: 900 },
    filename: "data-1440x900.png",
  },
];

for (const capture of captures) {
  await page.setViewportSize(capture.viewport);
  await page.goto(`${baseURL}${capture.route}`, { waitUntil: "networkidle" });
  await page.screenshot({
    path: resolve(outputDirectory, capture.filename),
    fullPage: false,
  });
}

await context.close();
await browser.close();

for (const capture of captures) {
  process.stdout.write(`${resolve(outputDirectory, capture.filename)}\n`);
}
