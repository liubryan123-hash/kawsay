// Validates the field catalogue, the rule set and the cases before they reach the app.
// Usage: npm run check-data -- [--dir data] [--strict]
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateCases, validateRules } from "../src/core/validate";
import type { FieldDef } from "../src/core/types";

const args = process.argv.slice(2);
const dir = args.includes("--dir") ? args[args.indexOf("--dir") + 1] : "data";
const strict = args.includes("--strict");
const load = (name: string) => {
  const path = join(dir, name);
  if (!existsSync(path)) {
    console.error(`Missing ${path}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf8"));
};

const fields = load("fields.json") as FieldDef[];
let failed = false;
const show = (title: string, report: { errors: string[]; warnings: string[] }) => {
  console.log(`\n${title}: ${report.errors.length} error(s), ${report.warnings.length} warning(s)`);
  report.errors.forEach((e) => console.log(`  ERROR    ${e}`));
  report.warnings.forEach((w) => console.log(`  warning  ${w}`));
  if (report.errors.length > 0) failed = true;
};

show(`Rules (${strict ? "strict" : "draft"} mode)`, validateRules(load("rules.json"), { fields, strict }));
if (existsSync(join(dir, "cases.json"))) show("Cases", validateCases(load("cases.json"), { fields }));
else console.log(`\nCases: ${join(dir, "cases.json")} not found, skipped`);
process.exit(failed ? 1 : 0);
