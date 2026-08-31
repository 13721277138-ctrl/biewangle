#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Script, createContext } from "node:vm";

export const REQUIRED_ROUTES = Object.freeze([
  "pages/home/home",
  "pages/run/run",
  "pages/plans/plans",
  "pages/history/history",
  "pages/data/data",
  "pages/templates/templates",
  "pages/template-detail/template-detail",
  "pages/template-edit/template-edit",
  "pages/search/search",
  "pages/more-runs/more-runs",
  "pages/history-detail/history-detail",
]);

const PAGE_EXTENSIONS = Object.freeze(["js", "json", "wxml", "wxss"]);
const TEXT_EXTENSIONS = new Set([".js", ".json", ".wxml", ".wxss"]);
const MAX_MAIN_PACKAGE_BYTES = 2 * 1024 * 1024;

function walk(target) {
  if (!existsSync(target)) return [];
  const stats = statSync(target);
  if (stats.isFile()) return [target];
  return readdirSync(target, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .flatMap((entry) => walk(resolve(target, entry.name)));
}

function issue(code, file, message) {
  return { code, file, message };
}

function readJson(file, displayPath, issues) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    issues.push(issue("invalid-json", displayPath, error.message || "JSON parse failed"));
    return undefined;
  }
}

function compileJavaScript(file, displayPath, issues) {
  try {
    return new Script(readFileSync(file, "utf8"), { filename: displayPath });
  } catch (error) {
    issues.push(issue("invalid-javascript", displayPath, error.message || "JavaScript parse failed"));
    return undefined;
  }
}

function handlerNames(wxml) {
  const names = new Set();
  const matcher = /(?:bind|catch)[a-zA-Z]+\s*=\s*["']([A-Za-z_$][\w$]*)["']/gu;
  for (const match of wxml.matchAll(matcher)) {
    if (match[1]) names.add(match[1]);
  }
  return names;
}

function pageDefinesHandler(javaScript, handler) {
  const escaped = handler.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b(?:async\\s+)?${escaped}\\s*\\(`, "u").test(javaScript);
}

function scanRuntimeFile(content, displayPath, issues) {
  const checks = [
    ["forbidden-web-view", /<web-view\b/iu, "native V1 must not embed a web-view"],
    [
      "forbidden-network-api",
      /\bwx\.(?:request|uploadFile|downloadFile|connectSocket)\s*\(/u,
      "V1 runtime must not make network requests",
    ],
    [
      "forbidden-cloud-api",
      /\b(?:wx\.cloud|cloudfunctions?|wx-server-sdk)\b/iu,
      "V1 runtime must not depend on cloud services",
    ],
    [
      "forbidden-account-api",
      /\bwx\.(?:login|getUserProfile|getUserInfo)\s*\(/u,
      "V1 must not create an account or identity dependency",
    ],
    [
      "forbidden-tracking-sdk",
      /google-analytics|googletagmanager|mixpanel|amplitude|segment\.com|sentry|datadog|hotjar|clarity\.ms/iu,
      "tracking, advertising, and remote error SDKs are forbidden",
    ],
    [
      "embedded-secret",
      /\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|(?:api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*["'][^"'\n]{16,}["'])\b/iu,
      "possible embedded runtime credential",
    ],
  ];
  for (const [code, pattern, message] of checks) {
    if (pattern.test(content)) issues.push(issue(code, displayPath, message));
  }
}

function loadOfficialBundle(file, displayPath, issues) {
  const script = compileJavaScript(file, displayPath, issues);
  if (!script) return undefined;
  try {
    const sandbox = { module: { exports: {} }, exports: {} };
    const context = createContext(sandbox);
    script.runInContext(context, { timeout: 1000 });
    return sandbox.module.exports;
  } catch (error) {
    issues.push(issue("invalid-official-bundle", displayPath, error.message || "bundle execution failed"));
    return undefined;
  }
}

export function verifyMiniprogram(projectRoot, options = {}) {
  const root = resolve(projectRoot);
  const miniprogramRoot = resolve(root, "miniprogram");
  const expectedRoutes = options.expectedRoutes || REQUIRED_ROUTES;
  const issues = [];
  const warnings = [];

  if (!existsSync(miniprogramRoot)) {
    return {
      appId: "",
      officialTemplateCount: 0,
      packageBytes: 0,
      pageCount: 0,
      issues: [issue("missing-miniprogram-root", "miniprogram", "miniprogram directory is missing")],
      warnings,
    };
  }

  const projectConfigPath = resolve(miniprogramRoot, "project.config.json");
  const appConfigPath = resolve(miniprogramRoot, "app.json");
  const projectConfig = existsSync(projectConfigPath)
    ? readJson(projectConfigPath, "miniprogram/project.config.json", issues)
    : undefined;
  const appConfig = existsSync(appConfigPath)
    ? readJson(appConfigPath, "miniprogram/app.json", issues)
    : undefined;
  if (!projectConfig) {
    issues.push(issue("missing-project-config", "miniprogram/project.config.json", "project config is required"));
  } else {
    if (projectConfig.compileType !== "miniprogram") {
      issues.push(issue("invalid-compile-type", "miniprogram/project.config.json", "compileType must be miniprogram"));
    }
    if (projectConfig.miniprogramRoot !== "./") {
      issues.push(issue("invalid-miniprogram-root", "miniprogram/project.config.json", "miniprogramRoot must be ./"));
    }
    if (projectConfig.appid === "touristappid") {
      warnings.push("project.config.json still uses touristappid; a real AppID is required for preview, trial, and submission.");
    }
  }

  const routes = appConfig && Array.isArray(appConfig.pages) ? appConfig.pages : [];
  if (JSON.stringify(routes) !== JSON.stringify(expectedRoutes)) {
    issues.push(issue(
      "route-contract",
      "miniprogram/app.json",
      `expected ${expectedRoutes.length} routes in frozen order, received ${routes.length}`,
    ));
  }

  for (const route of expectedRoutes) {
    for (const extension of PAGE_EXTENSIONS) {
      const artifact = resolve(miniprogramRoot, `${route}.${extension}`);
      if (!existsSync(artifact)) {
        issues.push(issue("missing-page-artifact", `miniprogram/${route}.${extension}`, "page artifact is required"));
      }
    }
    const jsPath = resolve(miniprogramRoot, `${route}.js`);
    const wxmlPath = resolve(miniprogramRoot, `${route}.wxml`);
    if (existsSync(jsPath) && existsSync(wxmlPath)) {
      const javaScript = readFileSync(jsPath, "utf8");
      const wxml = readFileSync(wxmlPath, "utf8");
      for (const handler of handlerNames(wxml)) {
        if (!pageDefinesHandler(javaScript, handler)) {
          issues.push(issue(
            "missing-page-handler",
            `miniprogram/${route}.wxml`,
            `WXML references ${handler}, but ${route}.js does not define it`,
          ));
        }
      }
      if (/open-type\s*=\s*["']share["']/u.test(wxml) && !pageDefinesHandler(javaScript, "onShareAppMessage")) {
        issues.push(issue(
          "missing-share-handler",
          `miniprogram/${route}.js`,
          "page exposes native share but does not define onShareAppMessage",
        ));
      }
    }
  }

  const files = walk(miniprogramRoot).filter((file) => !file.endsWith("project.private.config.json"));
  let packageBytes = 0;
  for (const file of files) {
    packageBytes += statSync(file).size;
    const displayPath = relative(root, file);
    if (extname(file) === ".json") readJson(file, displayPath, issues);
    if (extname(file) === ".js") compileJavaScript(file, displayPath, issues);
    if (TEXT_EXTENSIONS.has(extname(file))) {
      scanRuntimeFile(readFileSync(file, "utf8"), displayPath, issues);
    }
  }
  if (packageBytes > MAX_MAIN_PACKAGE_BYTES) {
    issues.push(issue(
      "main-package-size",
      "miniprogram",
      `main package is ${packageBytes} bytes, above ${MAX_MAIN_PACKAGE_BYTES}`,
    ));
  }

  const bundlePath = resolve(miniprogramRoot, "generated/official-templates.js");
  const bundle = existsSync(bundlePath)
    ? loadOfficialBundle(bundlePath, "miniprogram/generated/official-templates.js", issues)
    : undefined;
  const officialTemplates = bundle && Array.isArray(bundle.templates) ? bundle.templates : [];
  if (officialTemplates.length !== 13) {
    issues.push(issue(
      "official-template-count",
      "miniprogram/generated/official-templates.js",
      `expected exactly 13 official templates, received ${officialTemplates.length}`,
    ));
  }
  const templateIds = officialTemplates.map((template) => template && template.templateId);
  if (new Set(templateIds).size !== templateIds.length || templateIds.some((id) => typeof id !== "string" || !id.startsWith("official."))) {
    issues.push(issue(
      "official-template-identities",
      "miniprogram/generated/official-templates.js",
      "official template IDs must be unique official.* values",
    ));
  }

  const uniqueIssues = [...new Map(
    issues.map((candidate) => [`${candidate.code}:${candidate.file}:${candidate.message}`, candidate]),
  ).values()];
  return {
    appId: projectConfig && typeof projectConfig.appid === "string" ? projectConfig.appid : "",
    officialTemplateCount: officialTemplates.length,
    packageBytes,
    pageCount: routes.length,
    issues: uniqueIssues,
    warnings,
  };
}

function main() {
  const result = verifyMiniprogram(process.cwd());
  for (const warning of result.warnings) {
    process.stderr.write(`miniprogram: WARN ${warning}\n`);
  }
  if (result.issues.length > 0) {
    for (const candidate of result.issues) {
      process.stderr.write(`[${candidate.code}] ${candidate.file}: ${candidate.message}\n`);
    }
    process.stderr.write(`miniprogram: FAIL (${result.issues.length} issue(s))\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `miniprogram: PASS (${result.pageCount} pages, ${result.officialTemplateCount} official templates, ${result.packageBytes} bytes, appid=${result.appId})\n`,
  );
}

if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  main();
}
