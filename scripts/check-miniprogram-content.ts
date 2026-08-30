import { readFileSync } from "node:fs";
import {
  compileMiniprogramContentFile,
  resolveMiniprogramContentPaths,
} from "./miniprogram-content-io";

const { sourcePath, outputPath } = resolveMiniprogramContentPaths();
const expected = compileMiniprogramContentFile(sourcePath);
let actual = "";
try {
  actual = readFileSync(outputPath, "utf8");
} catch {
  // Missing generated content is the same trust failure as stale content.
}

if (actual !== expected) {
  process.stderr.write(
    `微信官方模板派生资产发生漂移：${outputPath}\n请运行 pnpm content:generate 后重新检查。\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(`微信官方模板派生资产与 Markdown 主源一致：${outputPath}\n`);
}
