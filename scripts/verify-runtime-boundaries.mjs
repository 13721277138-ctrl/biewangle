#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TEXT_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".jsx",
  ".json",
  ".mjs",
  ".svg",
  ".ts",
  ".tsx",
  ".webmanifest",
]);

const STANDARD_NAMESPACE_URLS = new Set([
  "http://www.w3.org/1999/xlink",
  "http://www.w3.org/2000/svg",
  "http://www.w3.org/XML/1998/namespace",
]);

const TRACKING_OR_AD_PATTERNS = [
  ["remote-analytics-or-ad-sdk", /google-analytics|googletagmanager|googlesyndication|doubleclick\.(?:net|com)|adsbygoogle/i],
  ["remote-analytics-or-ad-sdk", /\b(?:gtag|fbq)\s*\(/i],
  ["remote-analytics-or-ad-sdk", /mixpanel|amplitude|segment\.com|plausible|umami|hotjar|clarity\.ms/i],
  ["remote-error-tracking", /sentry|datadog(?:-rum)?|newrelic|bugsnag/i],
];

const UNSAFE_HTML_PATTERNS = [
  /dangerouslySetInnerHTML/,
  /\.(?:innerHTML|outerHTML)\s*=/,
  /document\.write(?:ln)?\s*\(/,
  /\beval\s*\(/,
  /new\s+Function\s*\(/,
];

const SECRET_PATTERNS = [
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\b(?:sk|rk|pk)-(?:live|prod|test)?[-_]?[A-Za-z0-9_-]{20,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|private[_-]?key)\s*[:=]\s*["'][^"'\n]{16,}["']/i,
];

function parseArguments(argv) {
  const rootIndex = argv.indexOf("--root");
  if (rootIndex === -1) {
    return { root: process.cwd() };
  }

  const value = argv[rootIndex + 1];
  if (!value) {
    throw new Error("--root requires a directory path");
  }

  return { root: resolve(value) };
}

function walk(target) {
  if (!existsSync(target)) {
    return [];
  }

  const stats = statSync(target);
  if (stats.isFile()) {
    return TEXT_EXTENSIONS.has(extname(target)) ? [target] : [];
  }

  return readdirSync(target, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .flatMap((entry) => walk(resolve(target, entry.name)));
}

function lineFor(content, offset) {
  return content.slice(0, offset).split("\n").length;
}

function addMatches(issues, file, content, code, pattern, message) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const matcher = new RegExp(pattern.source, flags);

  for (const match of content.matchAll(matcher)) {
    issues.push({
      code,
      file,
      line: lineFor(content, match.index ?? 0),
      message,
    });
  }
}

function scanRemoteUrls(issues, file, content) {
  const matcher = /https?:\/\/[^\s"'<>`)]+/g;
  for (const match of content.matchAll(matcher)) {
    const url = match[0].replace(/[;,]+$/, "");
    if (STANDARD_NAMESPACE_URLS.has(url)) {
      continue;
    }

    issues.push({
      code: "remote-runtime-dependency",
      file,
      line: lineFor(content, match.index ?? 0),
      message: `runtime references remote URL ${url}`,
    });
  }
}

function scanFile({ absolutePath, displayPath, authored, builtSurface }, issues) {
  const content = readFileSync(absolutePath, "utf8");

  if (authored || builtSurface) {
    scanRemoteUrls(issues, displayPath, content);
  }

  for (const [code, pattern] of TRACKING_OR_AD_PATTERNS) {
    addMatches(issues, displayPath, content, code, pattern, "forbidden tracking, advertising, or remote error SDK marker");
  }

  for (const pattern of SECRET_PATTERNS) {
    addMatches(issues, displayPath, content, "embedded-secret", pattern, "possible embedded runtime credential");
  }

  if (authored && /\.[cm]?[jt]sx?$/.test(absolutePath)) {
    for (const pattern of UNSAFE_HTML_PATTERNS) {
      addMatches(issues, displayPath, content, "unsafe-html-sink", pattern, "unsafe HTML or dynamic-code sink in authored runtime");
    }
  }
}

export function verifyRuntimeBoundaries(projectRoot) {
  const root = resolve(projectRoot);
  const authoredTargets = [resolve(root, "pwa/index.html"), resolve(root, "pwa/src"), resolve(root, "pwa/public")];
  const builtRoot = resolve(root, "pwa/dist");
  const authoredFiles = [...new Set(authoredTargets.flatMap(walk))];
  const builtFiles = walk(builtRoot);
  const issues = [];

  if (authoredFiles.length === 0) {
    issues.push({ code: "missing-runtime-source", file: "pwa", line: 1, message: "no authored PWA runtime files found" });
  }
  if (!existsSync(resolve(builtRoot, "index.html"))) {
    issues.push({ code: "missing-production-build", file: "pwa/dist/index.html", line: 1, message: "run the production build before verification" });
  }

  for (const absolutePath of authoredFiles) {
    scanFile(
      {
        absolutePath,
        displayPath: relative(root, absolutePath),
        authored: true,
        builtSurface: false,
      },
      issues,
    );
  }

  for (const absolutePath of builtFiles) {
    const extension = extname(absolutePath);
    scanFile(
      {
        absolutePath,
        displayPath: relative(root, absolutePath),
        authored: false,
        builtSurface: new Set([".css", ".html", ".svg", ".webmanifest"]).has(extension),
      },
      issues,
    );
  }

  const uniqueIssues = [...new Map(issues.map((issue) => [`${issue.code}:${issue.file}:${issue.line}`, issue])).values()];
  return { authoredFiles: authoredFiles.length, builtFiles: builtFiles.length, issues: uniqueIssues };
}

function main() {
  const { root } = parseArguments(process.argv.slice(2));
  const result = verifyRuntimeBoundaries(root);

  if (result.issues.length > 0) {
    for (const issue of result.issues) {
      process.stderr.write(`[${issue.code}] ${issue.file}:${issue.line} ${issue.message}\n`);
    }
    process.stderr.write(`runtime-boundary: FAIL (${result.issues.length} issue(s))\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `runtime-boundary: PASS (${result.authoredFiles} authored files, ${result.builtFiles} production files)\n`,
  );
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main();
}
