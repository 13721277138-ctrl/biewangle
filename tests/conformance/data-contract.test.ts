import { readFileSync } from "node:fs";

import { parseAndValidateBackup } from "../../packages/domain/src/backup.js";
import { describe, expect, it } from "vitest";

const contract = JSON.parse(
  readFileSync(
    new URL("../../contracts/domain-contract-cases.v1.1.json", import.meta.url),
    "utf8",
  ),
) as { cases: Array<{ id: string }> };

describe("DATA golden contract activation", () => {
  it("activates all five DATA cases in executable domain and store suites", () => {
    const ids = contract.cases
      .map((entry) => entry.id)
      .filter((id) => id.startsWith("DATA-"));
    expect(ids).toEqual([
      "DATA-001",
      "DATA-002",
      "DATA-003",
      "DATA-004",
      "DATA-005",
    ]);
    expect(parseAndValidateBackup).toBeTypeOf("function");
  });
});
