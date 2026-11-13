import { describe, expect, it } from "vitest";
import { evalCondition, evaluate, getField, sortRules } from "../src/core/engine";
import type { Rule } from "../src/core/types";
import rulesJson from "../fixtures/rules.json";

const rules = rulesJson as Rule[];
const full = { sign_a: false, sign_b: false, sign_c: false, score: 0, reading: 1, sensor_ok: true };
const run = (demo: Record<string, unknown>) => evaluate(rules, { demo });

describe("getField", () => {
  it("reads nested paths and returns undefined for absent steps", () => {
    expect(getField({ a: { b: 3 } }, "a.b")).toBe(3);
    expect(getField({ a: { b: 3 } }, "a.c")).toBeUndefined();
    expect(getField({ a: null }, "a.b")).toBeUndefined();
    expect(getField({}, "constructor")).toBeUndefined();
  });
});

describe("evalCondition (three-valued logic)", () => {
  const leaf = (field: string) => ({ field, op: "eq" as const, value: true });
  it("all: false wins over unknown; unknown wins over true", () => {
    expect(evalCondition({ all: [leaf("x"), leaf("y")] }, { x: false }).tri).toBe("false");
    expect(evalCondition({ all: [leaf("x"), leaf("y")] }, { x: true })).toEqual({ tri: "unknown", missing: ["y"] });
    expect(evalCondition({ all: [leaf("x"), leaf("y")] }, { x: true, y: true }).tri).toBe("true");
  });
  it("any: true wins over unknown; unknown wins over false", () => {
    expect(evalCondition({ any: [leaf("x"), leaf("y")] }, { x: true }).tri).toBe("true");
    expect(evalCondition({ any: [leaf("x"), leaf("y")] }, { x: false })).toEqual({ tri: "unknown", missing: ["y"] });
    expect(evalCondition({ any: [leaf("x"), leaf("y")] }, { x: false, y: false }).tri).toBe("false");
  });
  it("not: flips known values and keeps unknown", () => {
    expect(evalCondition({ not: leaf("x") }, { x: true }).tri).toBe("false");
    expect(evalCondition({ not: leaf("x") }, { x: false }).tri).toBe("true");
    expect(evalCondition({ not: leaf("x") }, {}).tri).toBe("unknown");
  });
  it("operators", () => {
    const t = (op: string, value: unknown, x: unknown) => evalCondition({ field: "x", op, value } as never, { x }).tri;
    expect(t("gt", 3, 3)).toBe("false");
    expect(t("gte", 3, 3)).toBe("true");
    expect(t("lt", 3, 2)).toBe("true");
    expect(t("lte", 3, 4)).toBe("false");
    expect(t("between", [5, 6], 5)).toBe("true");
    expect(t("between", [5, 6], 6)).toBe("true");
    expect(t("between", [5, 6], 7)).toBe("false");
    expect(t("in", ["a", "b"], "b")).toBe("true");
    expect(t("in", ["a", "b"], "c")).toBe("false");
    expect(t("neq", 1, 2)).toBe("true");
    expect(t("present", undefined, 0)).toBe("true");
    expect(t("present", undefined, null)).toBe("false");
  });
  it("treats null, NaN and non-numeric values in numeric comparisons as missing", () => {
    for (const x of [null, undefined, Number.NaN, "8"]) {
      expect(evalCondition({ field: "x", op: "gte", value: 7 }, { x })).toEqual({ tri: "unknown", missing: ["x"] });
    }
  });
});

describe("evaluate", () => {
  it("orders rules by severity, then order, then id, regardless of file order", () => {
    expect(sortRules(rules).map((r) => r.id)).toEqual([
      "T-EM-01", "T-EM-02", "T-PR-01", "T-SC-01", "T-APT-01", "T-FU-01", "T-DATA-02", "T-DATA-01",
    ]);
  });

  it("first matching rule wins: the most severe one", () => {
    const r = run({ ...full, score: 8, sign_a: true, sign_c: true });
    expect(r).toMatchObject({ level: "emergency", ruleId: "T-EM-01", reason: "rule_matched", missingFields: [] });
    expect(r.action).toContain("T-EM-01");
    expect(r.source.ref).toBeTruthy();
  });

  it("returns each level with its rule, action and source", () => {
    expect(run({ ...full, score: 5 })).toMatchObject({ level: "priority", ruleId: "T-PR-01" });
    expect(run({ ...full, sign_b: true, reading: 4 })).toMatchObject({ level: "scheduled", ruleId: "T-SC-01" });
    expect(run({ ...full, sign_c: true })).toMatchObject({ level: "follow-up", ruleId: "T-FU-01" });
    expect(run({ ...full, sensor_ok: false })).toMatchObject({ level: "insufficient", ruleId: "T-DATA-02", reason: "rule_matched" });
  });

  it("abstains when a more severe rule cannot be evaluated", () => {
    const { score: _omit, ...noScore } = full;
    const r = run({ ...noScore, sign_c: true });
    expect(r).toMatchObject({
      level: "insufficient",
      ruleId: "T-DATA-01",
      reason: "missing_data",
      missingFields: ["demo.score"],
      blockedBy: ["T-EM-01", "T-PR-01"],
      provisional: { ruleId: "T-FU-01", level: "follow-up" },
    });
  });

  it("does not abstain when the unknown rule is at the same level as the match", () => {
    const { score: _omit, ...noScore } = full;
    expect(run({ ...noScore, sign_a: true })).toMatchObject({ level: "emergency", ruleId: "T-EM-02", reason: "rule_matched" });
  });

  it("a rule marked onMissing: skip never blocks a result", () => {
    const r = run({ ...full, sign_c: true });
    expect(r).toMatchObject({ level: "follow-up", ruleId: "T-FU-01" });
    expect(r.trace.find((t) => t.ruleId === "T-APT-01")).toMatchObject({ result: "unknown", skipped: true });
    expect(r.skipped).toEqual(["T-APT-01"]);
    expect(run({ ...full, score: 8 }).skipped).toEqual([]); // decided before reaching the skipped rule
    expect(run({ ...full, sign_c: true, optional: 2 })).toMatchObject({ level: "scheduled", ruleId: "T-APT-01" });
  });

  it("abstains when no rule matches, and says why", () => {
    expect(run(full)).toMatchObject({ level: "insufficient", ruleId: "T-DATA-01", reason: "no_rule_matched", missingFields: [] });
    expect(evaluate(rules, {})).toMatchObject({ level: "insufficient", reason: "missing_data" });
  });

  it("with no match, the level is the same whether or not data were missing; only the reason differs", () => {
    const { reading: _omit, ...noReading } = full;
    const partial = run({ ...noReading, sign_b: true }); // T-SC-01 unknown, everything else false
    expect(partial).toMatchObject({ level: "insufficient", reason: "missing_data", missingFields: ["demo.reading"], blockedBy: ["T-SC-01"] });
    expect(run(full)).toMatchObject({ level: "insufficient", reason: "no_rule_matched" });
  });

  it("records a trace of every rule evaluated up to the decision", () => {
    const r = run({ ...full, score: 5 });
    expect(r.trace).toEqual([
      { ruleId: "T-EM-01", level: "emergency", result: "false" },
      { ruleId: "T-EM-02", level: "emergency", result: "false" },
      { ruleId: "T-PR-01", level: "priority", result: "true" },
    ]);
  });

  it("is deterministic and does not mutate its inputs", () => {
    const before = JSON.stringify(rules);
    const input = { demo: { ...full, score: 6 } };
    expect(evaluate(rules, input)).toEqual(evaluate([...rules].reverse(), input));
    expect(JSON.stringify(rules)).toBe(before);
  });

  it("throws if the rule set has no abstention rule", () => {
    expect(() => evaluate(rules.filter((r) => r.id !== "T-DATA-01"), {})).toThrow(/abstention rule/);
  });
});
