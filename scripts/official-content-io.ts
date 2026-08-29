import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileOfficialTemplates } from "./compile-official-templates";

export interface OfficialContentPaths {
  sourcePath: string;
  outputPath: string;
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export function resolveOfficialContentPaths(): OfficialContentPaths {
  return {
    sourcePath: resolve(
      argumentValue("--source") ??
        "docs/02_别忘了_官方模板内容库_V1.1.md",
    ),
    outputPath: resolve(
      argumentValue("--output") ??
        "shared-content/official-templates.v1.1.json",
    ),
  };
}

export function compileOfficialContentFile(sourcePath: string): string {
  const markdown = readFileSync(sourcePath, "utf8");
  return `${JSON.stringify(compileOfficialTemplates(markdown), null, 2)}\n`;
}
