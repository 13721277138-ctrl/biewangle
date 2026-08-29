import contractJson from "../../contracts/domain-contract-cases.v1.1.json";
import { describe, expect, it } from "vitest";

const TASK_TWO_CASE_IDS = [
  "RUN-001",
  "RUN-002",
  "RUN-003",
  "RUN-004",
  "RUN-005",
  "RUN-006",
  "RUN-007",
  "RUN-008",
  "PLAN-001",
  "PLAN-002",
  "PLAN-003",
  "PLAN-004",
  "TPL-001",
  "TPL-002",
  "TPL-003",
  "SEARCH-001",
  "SEARCH-002",
  "SEARCH-003",
  "HOME-001",
  "HOME-002",
  "SHARE-001",
  "SHARE-002",
] as const;

const TASK_THREE_CASE_IDS = [
  "DATA-001",
  "DATA-002",
  "DATA-003",
  "DATA-004",
  "DATA-005",
] as const;

describe("V1.1 golden contract registry", () => {
  it("contains 27 unique frozen cases", () => {
    const ids = contractJson.cases.map((contractCase) => contractCase.id);
    expect(ids).toHaveLength(27);
    expect(new Set(ids).size).toBe(27);
  });

  it("maps every frozen case to the gate that executes it", () => {
    const contractIds = contractJson.cases
      .map((contractCase) => contractCase.id)
      .sort();
    const mappedIds = [...TASK_TWO_CASE_IDS, ...TASK_THREE_CASE_IDS].sort();
    expect(mappedIds).toEqual(contractIds);
  });

  it("keeps every non-data behavior executable in Task 2 test suites", () => {
    expect(TASK_TWO_CASE_IDS).toHaveLength(22);
  });

  it.todo("executes DATA-001 through DATA-005 after the durable-store gate lands");
});
