import { describe, expect, it } from "vitest";

import { normalizeRouterBasename } from "./base-path.js";

describe("deployment base path", () => {
  it("keeps root deployments unprefixed", () => {
    expect(normalizeRouterBasename("/")).toBeUndefined();
  });

  it("normalizes a GitHub Pages project path for BrowserRouter", () => {
    expect(normalizeRouterBasename("/biewangle/")).toBe("/biewangle");
    expect(normalizeRouterBasename("biewangle")).toBe("/biewangle");
  });
});
