import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";

const rootPath = fileURLToPath(new URL("../../", import.meta.url));
const sourcePath = join(
  rootPath,
  "docs/02_别忘了_官方模板内容库_V1.1.md",
);
const contractPath = join(
  rootPath,
  "contracts/official-templates.v1.1.json",
);
const tempDirectories: string[] = [];
const require = createRequire(import.meta.url);

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function runScript(scriptName: string, outputPath: string) {
  return spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      join(rootPath, "scripts", scriptName),
      "--source",
      sourcePath,
      "--output",
      outputPath,
    ],
    { cwd: rootPath, encoding: "utf8" },
  );
}

describe("official content command-line workflow", () => {
  it("generates the reviewed contract into a requested output path", () => {
    const directory = mkdtempSync(join(tmpdir(), "biewangle-content-"));
    tempDirectories.push(directory);
    const outputPath = join(directory, "official.json");

    const result = runScript("generate-official-templates.ts", outputPath);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(readFileSync(outputPath, "utf8")).toBe(
      readFileSync(contractPath, "utf8"),
    );
  });

  it("fails the check command when the committed derivative drifts", () => {
    const directory = mkdtempSync(join(tmpdir(), "biewangle-content-"));
    tempDirectories.push(directory);
    const outputPath = join(directory, "official.json");
    writeFileSync(outputPath, "{}\n", "utf8");

    const result = runScript("check-official-templates.ts", outputPath);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("官方模板派生资产发生漂移");
    expect(readFileSync(outputPath, "utf8")).toBe("{}\n");
  });

  it("generates a CommonJS content module for the native mini program", () => {
    const directory = mkdtempSync(join(tmpdir(), "biewangle-content-"));
    tempDirectories.push(directory);
    const outputPath = join(directory, "official.cjs");

    const result = runScript("generate-miniprogram-content.ts", outputPath);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(require(outputPath)).toEqual(JSON.parse(readFileSync(contractPath, "utf8")));
  });

  it("fails the native content check when its committed module drifts", () => {
    const directory = mkdtempSync(join(tmpdir(), "biewangle-content-"));
    tempDirectories.push(directory);
    const outputPath = join(directory, "official.cjs");
    writeFileSync(outputPath, "module.exports = {};\n", "utf8");

    const result = runScript("check-miniprogram-content.ts", outputPath);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("微信官方模板派生资产发生漂移");
  });
});
