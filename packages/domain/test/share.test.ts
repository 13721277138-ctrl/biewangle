import { describe, expect, it } from "vitest";

import { buildSharePreview } from "../src/share.js";
import { startRun, toggleConfirmed } from "../src/run.js";
import { NOW, ONE_HOUR_LATER, officialTemplate } from "./fixtures.js";

describe("privacy-safe share projection", () => {
  it("[SHARE-001] excludes one-time notes from a checklist preview by default", () => {
    const template = officialTemplate("official.daily_out");
    const run = startRun(template, NOW, { checkRunId: "run-share-note" });
    const withPrivateNote = {
      ...run,
      items: run.items.map((item, index) =>
        index === 0 ? { ...item, oneTimeNote: "护照号 123456" } : item,
      ),
    };

    const preview = buildSharePreview(withPrivateNote, { kind: "checklist" });

    expect(preview.text).not.toContain("护照号 123456");
    expect(preview.included).toEqual(["title", "groups", "itemTitles"]);
    expect(preview.excluded).toContain("oneTimeNote");
  });

  it("[SHARE-002] does not silently include run states in normal checklist sharing", () => {
    const template = officialTemplate("official.daily_out");
    const run = startRun(template, NOW, { checkRunId: "run-share-state" });
    const confirmed = toggleConfirmed(run, run.items[0]!.runItemId, ONE_HOUR_LATER);

    const checklist = buildSharePreview(confirmed, { kind: "checklist" });
    const explicitResult = buildSharePreview(confirmed, { kind: "runResult" });

    expect(checklist.text).not.toContain("已确认");
    expect(checklist.text).not.toContain("未确认");
    expect(checklist.excluded).toContain("itemState");
    expect(explicitResult.text).toContain("已确认");
    expect(explicitResult.included).toContain("itemState");
    expect(explicitResult.excluded).toContain("oneTimeNote");
  });

  it("includes notes only after the explicit result-sharing option is visible in the preview", () => {
    const template = officialTemplate("official.daily_out");
    const run = startRun(template, NOW, { checkRunId: "run-explicit-note" });
    const withNote = {
      ...run,
      items: run.items.map((item, index) =>
        index === 0 ? { ...item, oneTimeNote: "带一把备用钥匙" } : item,
      ),
    };

    const preview = buildSharePreview(withNote, {
      kind: "runResult",
      includeOneTimeNotes: true,
    });

    expect(preview.text).toContain("带一把备用钥匙");
    expect(preview.included).toContain("oneTimeNote");
  });
});
