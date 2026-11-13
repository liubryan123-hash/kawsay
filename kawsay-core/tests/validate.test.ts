import { describe, expect, it } from "vitest";
import { flatten, validateCases, validateRules } from "../src/core/validate";
import type { FieldDef, Rule } from "../src/core/types";
import rulesJson from "../fixtures/rules.json";
import fieldsJson from "../fixtures/fields.json";
import casesJson from "../fixtures/cases.json";

const rules = rulesJson as Rule[];
const fields = fieldsJson as FieldDef[];
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const errorsOf = (mutate: (rs: Rule[]) => void, strict = true) => {
  const rs = clone(rules);
  mutate(rs);
  return validateRules(rs, { fields, strict }).errors.join("\n");
};

describe("validateRules", () => {
  it("accepts the fixture rule set in strict mode", () => {
    const report = validateRules(rules, { fields, strict: true });
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([expect.stringMatching(/^T-APT-01: onMissing "skip":/)]);
  });
  it("rejects structural problems", () => {
    expect(validateRules({}).errors).toEqual(["rules must be an array"]);
    expect(errorsOf((rs) => (rs[0].id = rs[1].id))).toMatch(/duplicate id/);
    expect(errorsOf((rs) => ((rs[0] as { level: string }).level = "urgent"))).toMatch(/invalid level/);
    expect(errorsOf((rs) => ((rs[0].condition as { op: string }).op = "approx"))).toMatch(/unknown operator/);
    expect(errorsOf((rs) => ((rs[0].condition as { field: string }).field = "demo.nope"))).toMatch(/not in the field catalogue/);
    expect(errorsOf((rs) => ((rs[0].condition as { value: unknown }).value = "yes"))).toMatch(/does not match boolean field/);
    expect(errorsOf((rs) => (rs[0].condition = { field: "demo.sign_a", op: "gte", value: 1 }))).toMatch(/non-numeric field/);
    expect(errorsOf((rs) => (rs[0].condition = { field: "demo.score", op: "between", value: [6, 5] }))).toMatch(/low <= high/);
    expect(errorsOf((rs) => (rs[0].condition = { all: [] }))).toMatch(/non-empty array/);
  });
  it("requires exactly one abstention rule", () => {
    expect(errorsOf((rs) => rs.splice(rs.findIndex((r) => r.id === "T-DATA-01"), 1))).toMatch(/found 0/);
    expect(errorsOf((rs) => delete rs.find((r) => r.id === "T-DATA-02")!.condition)).toMatch(/found 2/);
    expect(errorsOf((rs) => delete rs.find((r) => r.id === "T-FU-01")!.condition)).toMatch(/only the abstention rule/);
  });
  it("blocks pending clinical content and incomplete cross-review in strict mode only", () => {
    const pending = (rs: Rule[]) => {
      rs[0].action = "PENDING: text from the clinicians";
      rs[0].review.by = ["Only One"];
    };
    expect(errorsOf(pending, true)).toMatch(/still pending clinical content[\s\S]*cross-review incomplete/);
    const rs = clone(rules);
    pending(rs);
    const lax = validateRules(rs, { fields });
    expect(lax.errors).toEqual([]);
    expect(lax.warnings).toHaveLength(3); // two pending items + the standing "skip" notice
  });
  it("flags onMissing: skip for clinical confirmation, more strongly on an emergency rule", () => {
    const rs = clone(rules);
    rs.find((r) => r.id === "T-EM-01")!.onMissing = "skip";
    const { errors, warnings } = validateRules(rs, { fields, strict: true });
    expect(errors).toEqual([]);
    expect(warnings.join("\n")).toMatch(/T-EM-01: onMissing "skip" on an EMERGENCY rule/);
  });
  it("always rejects a rule with no source", () => {
    expect(errorsOf((rs) => (rs[0].source.section = ""), false)).toMatch(/missing "source.section"/);
  });
});

describe("validateCases", () => {
  it("flattens nested inputs", () => {
    expect(flatten({ a: { b: 1, c: { d: true } } })).toEqual([["a.b", 1], ["a.c.d", true]]);
  });
  it("accepts the fixture cases and warns about fields a case leaves out", () => {
    const report = validateCases(casesJson, { fields });
    expect(report.errors).toEqual([]);
    expect(report.warnings.find((w) => w.startsWith("C02"))).toContain("demo.score");
  });
  it("rejects inputs the app cannot ask for, wrong types and inconsistent references", () => {
    const cs = clone(casesJson) as unknown as { id: string; set: string; input: { demo: Record<string, unknown> }; reference: Record<string, string> }[];
    cs[0].input.demo.unlisted = 1;
    cs[1].input.demo.sign_a = "yes";
    cs[2].reference = { level: "emergency", category: "self-care" };
    cs[3].reference = {};
    cs[4].set = "other";
    const errors = validateCases(cs, { fields }).errors.join("\n");
    expect(errors).toMatch(/C01: input "demo.unlisted" is not in the field catalogue/);
    expect(errors).toMatch(/C02: input "demo.sign_a" should be boolean/);
    expect(errors).toMatch(/C03: reference level "emergency" and category "self-care" disagree/);
    expect(errors).toMatch(/C04: reference needs "level" or "category"/);
    expect(errors).toMatch(/C05: "set" must be/);
  });
});
