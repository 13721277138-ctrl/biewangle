import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileOfficialTemplates } from "./compile-official-templates";

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export function resolveMiniprogramContentPaths(): {
  sourcePath: string;
  outputPath: string;
} {
  return {
    sourcePath: resolve(
      argumentValue("--source") ?? "docs/02_别忘了_官方模板内容库_V1.1.md",
    ),
    outputPath: resolve(
      argumentValue("--output") ?? "miniprogram/generated/official-templates.js",
    ),
  };
}

export function compileMiniprogramContentFile(sourcePath: string): string {
  const markdown = readFileSync(sourcePath, "utf8");
  const bundle = compileOfficialTemplates(markdown);
  return `// Generated from the frozen V1.1 Markdown source. Do not edit.\nmodule.exports = ${JSON.stringify(bundle, null, 2)};\n`;
}
