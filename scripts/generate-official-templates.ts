import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  compileOfficialContentFile,
  resolveOfficialContentPaths,
} from "./official-content-io";

const { sourcePath, outputPath } = resolveOfficialContentPaths();
const serialized = compileOfficialContentFile(sourcePath);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, serialized, "utf8");
process.stdout.write(`已生成官方模板：${outputPath}\n`);
