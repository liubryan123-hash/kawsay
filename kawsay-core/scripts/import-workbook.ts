// Converts the clinicians' workbook into fields.json, rules.json and cases.json, then validates them.
// Usage: npm run import-workbook -- [--file data/KAWSAY_clinical_content.xlsx] [--dir data] [--strict]
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateCases, validateRules } from "../src/core/validate";
import { readWorkbook } from "./workbook";

const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const file = arg("--file", "data/KAWSAY_clinical_content.xlsx");
const dir = arg("--dir", "data");
const strict = args.includes("--strict");

const data = await readWorkbook(file);
const save = (name: string, value: unknown) => writeFileSync(join(dir, name), JSON.stringify(value, null, 2) + "\n");
save("fields.json", data.fields);
save("rules.json", data.rules);
save("cases.json", data.cases);
console.log(`Read ${file}: ${data.fields.length} fields, ${data.rules.length} rules, ${data.cases.length} cases -> ${dir}/`);

const sections: [string, string[]][] = [["Reading notes", data.notes]];
const rules = validateRules(data.rules, { fields: data.fields, strict });
const cases = validateCases(data.cases, { fields: data.fields });
sections.push([`Rules: errors (${strict ? "strict" : "draft"} mode)`, rules.errors], ["Rules: warnings", rules.warnings]);
sections.push(["Cases: errors", cases.errors], ["Cases: warnings (data each case leaves out)", cases.warnings]);
for (const [title, items] of sections) {
  console.log(`\n${title}: ${items.length}`);
  items.forEach((i) => console.log(`  ${i}`));
}

const blocking = rules.errors.length + cases.errors.length;
console.log(blocking === 0 ? "\nREADY: the data can be loaded into the app." : `\nNOT READY: ${blocking} error(s) to resolve with the clinicians.`);
process.exit(blocking === 0 ? 0 : 1);
