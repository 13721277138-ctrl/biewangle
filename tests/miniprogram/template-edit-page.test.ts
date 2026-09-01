import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const pageModulePath = require.resolve("../../miniprogram/pages/template-edit/template-edit.js");

function instantiatePage(definition: Record<string, any>) {
  const page = Object.assign({}, definition, {
    data: structuredClone(definition.data),
  });
  page.setData = (patch: Record<string, unknown>) => {
    Object.assign(page.data, patch);
  };
  return page;
}

afterEach(() => {
  delete require.cache[pageModulePath];
  vi.unstubAllGlobals();
});

describe("native WeChat personal-template editor presentation", () => {
  it("shows Chinese option labels while preserving the stored icon and color tokens", async () => {
    vi.stubGlobal("getApp", () => ({
      ready: Promise.resolve(),
      service: {
        getTemplate: () => ({
          title: "周末准备",
          icon: "bag",
          themeColor: "ocean",
          groups: [{
            groupId: "personal",
            title: "检查项",
            items: [{ itemId: "item.one", title: "水杯", importance: "normal" }],
          }],
        }),
      },
    }));
    vi.stubGlobal("wx", {});
    let definition: Record<string, any> | undefined;
    vi.stubGlobal("Page", (candidate: Record<string, any>) => {
      definition = candidate;
    });
    require(pageModulePath);
    const page = instantiatePage(definition!);
    page.onLoad({ source: "official.daily_out" });

    await page.onShow();

    expect(page.data).toMatchObject({
      icon: "bag",
      iconLabel: "行李",
      themeColor: "ocean",
      themeColorLabel: "海蓝",
    });

    page.selectIcon({ detail: { value: "2" } });
    page.selectColor({ detail: { value: "3" } });

    expect(page.data).toMatchObject({
      icon: "home",
      iconLabel: "居家",
      themeColor: "plum",
      themeColorLabel: "梅紫",
    });
  });
});
