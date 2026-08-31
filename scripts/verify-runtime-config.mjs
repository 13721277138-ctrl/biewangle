import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const rootUrl = new URL("../", import.meta.url);
const packageJson = JSON.parse(
  await readFile(new URL("package.json", rootUrl), "utf8"),
);

let nodeVersionPin = "";
try {
  nodeVersionPin = await readFile(new URL(".nvmrc", rootUrl), "utf8");
} catch (error) {
  if (error?.code === "ENOENT") {
    assert.fail("Expected .nvmrc to pin the Cloud and local runtime to Node.js 24");
  }
  throw error;
}

assert.equal(nodeVersionPin.trim(), "24", ".nvmrc must pin Node.js 24");
assert.equal(
  packageJson.engines?.node,
  ">=24 <25",
  "package.json must reject non-24 Node.js majors",
);
assert.equal(
  packageJson.packageManager,
  "pnpm@11.19.0",
  "package.json must pin pnpm 11.19.0",
);

console.log("Runtime configuration check passed: Node.js 24 / pnpm 11.19.0");
