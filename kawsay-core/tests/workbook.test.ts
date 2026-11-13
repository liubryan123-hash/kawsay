import { describe, expect, it } from "vitest";
import { readWorkbook } from "../scripts/workbook";
import { validateCases, validateRules } from "../src/core/validate";
import { runEvaluation } from "../src/core/evaluation";
import type { Rule, TestCase } from "../src/core/types";
import rulesJson from "../fixtures/rules.json";
import fieldsJson from "../fixtures/fields.json";
import casesJson from "../fixtures/cases.json";

describe("readWorkbook", () => {
  it("reads the fixture workbook back into exactly the fixture JSON", async () => {
    const data = await readWorkbook("fixtures/workbook.xlsx");
    expect(data.notes).toEqual([]);
    expect(data.fields).toEqual(fieldsJson);
    expect(data.rules).toEqual(rulesJson);
    expect(data.cases).toEqual(casesJson);
  });

  it("gives the same evaluation result as the JSON files", async () => {
    const data = await readWorkbook("fixtures/workbook.xlsx");
    const fromWorkbook = runEvaluation(data.rules as unknown as Rule[], data.cases as unknown as TestCase[]);
    expect(fromWorkbook).toEqual(runEvaluation(rulesJson as Rule[], casesJson as TestCase[]));
  });

  it("reads the clinicians' template: 20 rules, example rows ignored, pending content blocked", async () => {
    const data = await readWorkbook("data/KAWSAY_clinical_content.xlsx");
    expect(data.rules).toHaveLength(20);
    expect(data.rules.map((r) => r.id)).not.toContain("EXAMPLE-00");
    expect(data.cases).toEqual([]);
    expect(data.notes.filter((n) => n.includes("condition not encoded yet")).map((n) => n.split(":")[0])).toEqual([
      "NEWS-04", "RF-07", "APT-01",
    ]);
    const report = validateRules(data.rules, { fields: data.fields, strict: true });
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.errors.join("\n")).toMatch(/NEWS-01: invalid level/);
    expect(report.errors.join("\n")).not.toMatch(/ISS-01: invalid level/); // level given in the plan
    expect(validateCases(data.cases, { fields: data.fields }).errors).toEqual([]);
  });
});
