import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);

function instantiatePage(definition: Record<string, any>) {
  const page = Object.assign({}, definition, {
    data: structuredClone(definition.data),
  });
  page.setData = (patch: Record<string, unknown>) => {
    Object.assign(page.data, patch);
  };
  return page;
}

function loadPage(relativePath: string, app: Record<string, unknown>) {
  const modulePath = require.resolve(relativePath);
  delete require.cache[modulePath];
  let definition: Record<string, any> | undefined;
  vi.stubGlobal("getApp", () => app);
  vi.stubGlobal("Page", (candidate: Record<string, any>) => {
    definition = candidate;
  });
  vi.stubGlobal("wx", {});
  require(modulePath);
  return instantiatePage(definition!);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("native WeChat navigation lifecycle", () => {
  it("releases the home start lock when the source page is shown again", async () => {
    const page = loadPage("../../miniprogram/pages/home/home.js", {
      ready: Promise.resolve(),
      service: {
        getSnapshot: () => ({ checkRuns: [], plannedChecks: [] }),
        getTemplateLibrary: () => ({ official: [], personal: [] }),
      },
    });
    page.data.busy = true;

    await page.onShow();

    expect(page.data.busy).toBe(false);
  });

  it("releases the search start lock when returning from a run", async () => {
    const page = loadPage("../../miniprogram/pages/search/search.js", {
      ready: Promise.resolve(),
      service: {},
    });
    page.data.busy = true;

    await page.onShow();

    expect(page.data.busy).toBe(false);
  });
});
