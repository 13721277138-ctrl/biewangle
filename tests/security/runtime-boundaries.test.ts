import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const temporaryRoots: string[] = [];
const scanner = resolve("scripts/verify-runtime-boundaries.mjs");

function makeProject(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "biewangle-boundary-"));
  temporaryRoots.push(root);

  for (const [relativePath, content] of Object.entries(files)) {
    const target = join(root, relativePath);
    mkdirSync(resolve(target, ".."), { recursive: true });
    writeFileSync(target, content, "utf8");
  }

  return root;
}

function runScanner(root: string) {
  return spawnSync(process.execPath, [scanner, "--root", root], {
    cwd: resolve("."),
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("runtime boundary scanner", () => {
  it("accepts a self-contained offline runtime and standard SVG namespaces", () => {
    const root = makeProject({
      "pwa/index.html": '<main id="root"></main><script type="module" src="/src/main.tsx"></script>',
      "pwa/src/main.tsx": 'document.querySelector("#root")?.setAttribute("data-ready", "true");',
      "pwa/public/icon.svg": '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/></svg>',
      "pwa/dist/index.html": '<link rel="stylesheet" href="/assets/index.css"><main id="root"></main>',
      "pwa/dist/assets/index.css": "body { font-family: system-ui, sans-serif; }",
    });

    const result = runScanner(root);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("runtime-boundary: PASS");
  });

  it("rejects remote runtime dependencies, unsafe HTML sinks and embedded secrets", () => {
    const root = makeProject({
      "pwa/index.html": '<script src="https://cdn.example.com/runtime.js"></script>',
      "pwa/src/view.tsx": "export const View = () => <div dangerouslySetInnerHTML={{ __html: '<b>bad</b>' }} />;",
      "pwa/src/config.ts": 'export const apiKey = "sk-live-abcdefghijklmnopqrstuvwxyz123456";',
    });

    const result = runScanner(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("remote-runtime-dependency");
    expect(result.stderr).toContain("unsafe-html-sink");
    expect(result.stderr).toContain("embedded-secret");
  });
});
