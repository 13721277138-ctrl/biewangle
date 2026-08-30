import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  compileMiniprogramContentFile,
  resolveMiniprogramContentPaths,
} from "./miniprogram-content-io";

const { sourcePath, outputPath } = resolveMiniprogramContentPaths();
const serialized = compileMiniprogramContentFile(sourcePath);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, serialized, "utf8");
process.stdout.write(`已生成微信官方模板：${outputPath}\n`);
