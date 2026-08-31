import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { verifyMiniprogram } from "../../scripts/verify-miniprogram.mjs";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("native WeChat static project verifier", () => {
  it("accepts the complete offline-native V1 project and reports its release facts", () => {
    const result = verifyMiniprogram(resolve("."));
    const projectConfig = JSON.parse(
      readFileSync(resolve("miniprogram/project.config.json"), "utf8"),
    ) as { appid: string };

    expect(result.issues).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result).toMatchObject({
      appId: projectConfig.appid,
      officialTemplateCount: 13,
      pageCount: 11,
    });
    expect(result.appId).toMatch(/^wx[0-9a-f]{16}$/u);
    expect(result.appId).not.toBe("touristappid");
    expect(result.packageBytes).toBeGreaterThan(0);
    expect(result.packageBytes).toBeLessThanOrEqual(2 * 1024 * 1024);
  });

  it("rejects unstable font weights and an uncentered native button foundation", () => {
    const root = mkdtempSync(join(tmpdir(), "biewangle-miniprogram-visual-verifier-"));
    temporaryRoots.push(root);
    const project = join(root, "miniprogram");
    const pageDirectory = join(project, "pages", "unsafe");
    const generatedDirectory = join(project, "generated");
    mkdirSync(pageDirectory, { recursive: true });
    mkdirSync(generatedDirectory, { recursive: true });
    writeFileSync(join(project, "project.config.json"), JSON.stringify({
      appid: "wx325ab0bf02863343",
      compileType: "miniprogram",
      miniprogramRoot: "./",
    }));
    writeFileSync(join(project, "app.json"), JSON.stringify({ pages: ["pages/unsafe/unsafe"] }));
    writeFileSync(join(project, "app.js"), "App({ onLaunch() {} });\n");
    writeFileSync(
      join(project, "app.wxss"),
      "page {}\nbutton { min-height: 70rpx; font-weight: 650; }\n",
    );
    writeFileSync(join(pageDirectory, "unsafe.js"), "Page({});\n");
    writeFileSync(join(pageDirectory, "unsafe.json"), "{}\n");
    writeFileSync(join(pageDirectory, "unsafe.wxml"), "<view>unsafe visual fixture</view>\n");
    writeFileSync(join(pageDirectory, "unsafe.wxss"), ".x { font-weight: 760; }\n");
    writeFileSync(
      join(generatedDirectory, "official-templates.js"),
      "module.exports = { templates: [] };\n",
    );

    const result = verifyMiniprogram(root, { expectedRoutes: ["pages/unsafe/unsafe"] });

    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "nonstandard-font-weight",
      "button-foundation",
    ]));
  });

  it("rejects web-view, network APIs and a WXML handler missing from its page", () => {
    const root = mkdtempSync(join(tmpdir(), "biewangle-miniprogram-verifier-"));
    temporaryRoots.push(root);
    const project = join(root, "miniprogram");
    const pageDirectory = join(project, "pages", "unsafe");
    const generatedDirectory = join(project, "generated");
    mkdirSync(pageDirectory, { recursive: true });
    mkdirSync(generatedDirectory, { recursive: true });
    writeFileSync(join(project, "project.config.json"), JSON.stringify({
      appid: "touristappid",
      compileType: "miniprogram",
      miniprogramRoot: "./",
    }));
    writeFileSync(join(project, "app.json"), JSON.stringify({ pages: ["pages/unsafe/unsafe"] }));
    writeFileSync(join(project, "app.js"), "App({ onLaunch() {} });\n");
    writeFileSync(join(project, "app.wxss"), "page {}\n");
    writeFileSync(join(pageDirectory, "unsafe.js"), "Page({ load() { wx.request({ url: 'https://example.com' }); } });\n");
    writeFileSync(join(pageDirectory, "unsafe.json"), "{}\n");
    writeFileSync(join(pageDirectory, "unsafe.wxml"), "<web-view src=\"https://example.com\"></web-view><button bindtap=\"missing\">x</button>\n");
    writeFileSync(join(pageDirectory, "unsafe.wxss"), ".x {}\n");
    writeFileSync(join(generatedDirectory, "official-templates.js"), "module.exports = { templates: [] };\n");

    const result = verifyMiniprogram(root, { expectedRoutes: ["pages/unsafe/unsafe"] });
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "forbidden-web-view",
      "forbidden-network-api",
      "missing-page-handler",
      "official-template-count",
    ]));
  });
});
