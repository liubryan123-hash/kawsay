import { describe, expect, it } from "vitest";
import { cohenKappa, computeMetrics, levelToCategory, wilson } from "../src/core/metrics";
import { runEvaluation } from "../src/core/evaluation";
import type { Rule, TestCase } from "../src/core/types";
import rulesJson from "../fixtures/rules.json";
import casesJson from "../fixtures/cases.json";

const pairs = (ref: string, app: string, n: number) => Array.from({ length: n }, () => ({ ref, app }));

describe("levelToCategory (mapping fixed in the Execution Plan)", () => {
  it("maps the five levels", () => {
    expect(levelToCategory("emergency")).toBe("emergent");
    expect(levelToCategory("priority")).toBe("non-emergent");
    expect(levelToCategory("scheduled")).toBe("non-emergent");
    expect(levelToCategory("follow-up")).toBe("self-care");
    expect(levelToCategory("insufficient")).toBe("abstain");
  });
});

describe("cohenKappa", () => {
  it("matches the textbook 2x2 example (20, 5, 10, 15 -> po 0.70, pe 0.50, kappa 0.40)", () => {
    const data = [...pairs("yes", "yes", 20), ...pairs("yes", "no", 5), ...pairs("no", "yes", 10), ...pairs("no", "no", 15)];
    expect(cohenKappa(data)).toBeCloseTo(0.4, 10);
  });
  it("is 1 for perfect agreement and 0 for chance-level agreement", () => {
    expect(cohenKappa([...pairs("a", "a", 3), ...pairs("b", "b", 2)])).toBeCloseTo(1, 10);
    expect(cohenKappa([...pairs("a", "a", 1), ...pairs("a", "b", 1), ...pairs("b", "a", 1), ...pairs("b", "b", 1)])).toBeCloseTo(0, 10);
  });
  it("is null when undefined", () => {
    expect(cohenKappa([])).toBeNull();
    expect(cohenKappa(pairs("a", "a", 4))).toBeNull();
  });
});

describe("wilson", () => {
  it("matches a hand calculation for 8/10", () => {
    const [lo, hi] = wilson(8, 10)!;
    expect(lo).toBeCloseTo(0.4902, 4);
    expect(hi).toBeCloseTo(0.9433, 4);
  });
  it("handles the edges", () => {
    expect(wilson(0, 0)).toBeNull();
    expect(wilson(0, 5)![0]).toBe(0);
    expect(wilson(5, 5)![1]).toBe(1);
  });
});

describe("computeMetrics", () => {
  it("counts emergencies through the fixed mapping (level 'emergency' = category 'emergent')", () => {
    const rows = ["emergency", "emergency", "priority"].map((app) => ({ ref: levelToCategory("emergency"), app: levelToCategory(app as never) }));
    expect(computeMetrics(rows).emergencySensitivity).toMatchObject({ k: 2, n: 3 });
  });
  it("kappaAnswered uses only cases where neither side abstains", () => {
    const rows = [
      { ref: "emergent", app: "emergent" }, { ref: "self-care", app: "self-care" },
      { ref: "abstain", app: "emergent" }, { ref: "emergent", app: "abstain" },
    ] as const;
    expect(computeMetrics([...rows]).kappaAnswered).toBeCloseTo(1, 10);
    expect(computeMetrics([...rows]).kappa).toBeLessThan(1);
  });
  it("returns nulls, not zeros, when a denominator is empty", () => {
    const m = computeMetrics([]);
    expect(m.accuracy.value).toBeNull();
    expect(m.emergencySensitivity.value).toBeNull();
    expect(m.kappa).toBeNull();
  });
});

// Expected values below were worked out by hand from the 12 fixture cases:
// (ref, app) = C01 E,E | C02 E,E | C03 E,N | C04 N,N | C05 N,N | C06 S,S | C07 S,A
//              C08 S,S | C09 A,A | C10 N,E | C11 N,A | C12 E,E
describe("runEvaluation on the fixture cases", () => {
  const result = runEvaluation(rulesJson as Rule[], casesJson as TestCase[]);

  it("produces the expected app output for each case", () => {
    expect(result.rows.map((r) => [r.id, r.appLevel, r.ruleId, r.agree])).toEqual([
      ["C01", "emergency", "T-EM-01", true],
      ["C02", "emergency", "T-EM-02", true],
      ["C03", "priority", "T-PR-01", false],
      ["C04", "priority", "T-PR-01", true],
      ["C05", "scheduled", "T-SC-01", true],
      ["C06", "follow-up", "T-FU-01", true],
      ["C07", "insufficient", "T-DATA-01", false],
      ["C08", "follow-up", "T-FU-01", true],
      ["C09", "insufficient", "T-DATA-02", true],
      ["C10", "emergency", "T-EM-01", false],
      ["C11", "insufficient", "T-DATA-01", false],
      ["C12", "emergency", "T-EM-02", true],
    ]);
    expect(result.rows[6]).toMatchObject({ reason: "missing_data", missingFields: ["demo.score"] });
    expect(result.rows[10]).toMatchObject({ reason: "no_rule_matched" });
  });

  it("computes the overall metrics", () => {
    const m = result.total;
    expect(m.n).toBe(12);
    expect(m.accuracy).toMatchObject({ k: 8, n: 12 });
    expect(m.accuracy.value).toBeCloseTo(8 / 12, 10);
    expect(m.accuracyAnswered).toMatchObject({ k: 7, n: 9 });
    expect(m.emergencySensitivity).toMatchObject({ k: 3, n: 4 });
    expect(m.abstentionRate).toMatchObject({ k: 3, n: 12 });
    expect(m.kappa).toBeCloseTo(59 / 107, 10); // po 96/144, pe 37/144
    expect(m.kappaAnswered).toBeCloseTo(34 / 52, 10); // po 63/81, pe 29/81
  });

  it("computes the metrics per case set and the exact-level agreement", () => {
    expect(result.bySet.external!.accuracy).toMatchObject({ k: 5, n: 7 });
    expect(result.bySet.external!.emergencySensitivity).toMatchObject({ k: 2, n: 3 });
    expect(result.bySet.external!.abstentionRate).toMatchObject({ k: 1, n: 7 });
    expect(result.bySet.space!.accuracy).toMatchObject({ k: 3, n: 5 });
    expect(result.exactLevel).toMatchObject({ k: 3, n: 5 });
  });
});
