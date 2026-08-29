import { describe, expect, it } from "vitest";
import { PRODUCT_CONFIG } from "../src/config";

describe("adjustable product parameters", () => {
  it("keeps every frozen initial value in one immutable registry", () => {
    expect(PRODUCT_CONFIG).toEqual({
      REOPEN_WINDOW_HOURS: 2,
      STALE_AFTER_HOURS: 24,
      PERSONALIZATION_MIN_REPEAT: 3,
      HOME_RECENT_USE_DAYS: 30,
    });
    expect(Object.isFrozen(PRODUCT_CONFIG)).toBe(true);
  });
});
