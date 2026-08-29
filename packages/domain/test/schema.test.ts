import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CheckRunStatusSchema,
  OfficialContentBundleSchema,
} from "../src/schema";

const contractPath = fileURLToPath(
  new URL("../../../contracts/official-templates.v1.1.json", import.meta.url),
);

describe("V1.1 executable schemas", () => {
  it("accepts the supplied official content contract", () => {
    const contract: unknown = JSON.parse(readFileSync(contractPath, "utf8"));

    const parsed = OfficialContentBundleSchema.parse(contract);

    expect(parsed.productId).toBe("biewangle");
    expect(parsed.officialContentVersion).toBe(1);
    expect(parsed.templates).toHaveLength(13);
  });

  it.each(["planned", "reopened", "staleCandidate", "deleted"])(
    "rejects %s as a CheckRun core status",
    (invalidStatus) => {
      expect(CheckRunStatusSchema.safeParse(invalidStatus).success).toBe(false);
    },
  );

  it.each([
    "inProgress",
    "completed",
    "endedWithUnresolved",
    "discarded",
  ])("accepts %s as a CheckRun core status", (status) => {
    expect(CheckRunStatusSchema.safeParse(status).success).toBe(true);
  });
});
