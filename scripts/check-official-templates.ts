import { readFileSync } from "node:fs";
import {
  compileOfficialContentFile,
  resolveOfficialContentPaths,
} from "./official-content-io";

const { sourcePath, outputPath } = resolveOfficialContentPaths();
const expected = compileOfficialContentFile(sourcePath);
let actual = "";
try {
  actual = readFileSync(outputPath, "utf8");
} catch {
  // A missing derivative is the same trust failure as a stale derivative.
}

if (actual !== expected) {
  process.stderr.write(
    `官方模板派生资产发生漂移：${outputPath}\n请运行 pnpm content:generate 后重新检查。\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(`官方模板派生资产与 Markdown 主源一致：${outputPath}\n`);
}
