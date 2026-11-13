// Automatic case runner: runs every case through the engine and prints the metrics.
// Usage: npm run evaluate -- [--dir data] [--out evaluation-results.json]
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runEvaluation } from "../src/core/evaluation";
import { validateCases, validateRules } from "../src/core/validate";
import type { Metrics } from "../src/core/metrics";
import type { FieldDef, Rule, TestCase } from "../src/core/types";

const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const dir = arg("--dir", "data");
const out = arg("--out", "evaluation-results.json");
const read = (name: string) => readFileSync(join(dir, name), "utf8");
const sha = (text: string) => createHash("sha256").update(text).digest("hex");

const rulesText = read("rules.json");
const casesText = read("cases.json");
const fields = JSON.parse(read("fields.json")) as FieldDef[];
const rules = JSON.parse(rulesText) as Rule[];
const cases = JSON.parse(casesText) as TestCase[];

const problems = [...validateRules(rules, { fields, strict: true }).errors, ...validateCases(cases, { fields }).errors];
if (problems.length > 0) {
  console.error("Data is not valid; nothing was evaluated:");
  problems.forEach((p) => console.error(`  ${p}`));
  process.exit(1);
}

const result = runEvaluation(rules, cases);
const pct = (x: number | null) => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`);
const line = (name: string, m: Metrics) =>
  console.log(
    `${name.padEnd(9)} n=${String(m.n).padEnd(3)} accuracy ${pct(m.accuracy.value)} (${m.accuracy.k}/${m.accuracy.n})` +
      ` | answered-only ${pct(m.accuracyAnswered.value)} (${m.accuracyAnswered.k}/${m.accuracyAnswered.n})` +
      ` | emergency sensitivity ${pct(m.emergencySensitivity.value)} (${m.emergencySensitivity.k}/${m.emergencySensitivity.n})` +
      ` | kappa ${m.kappa === null ? "n/a" : m.kappa.toFixed(3)} (answered-only ${m.kappaAnswered === null ? "n/a" : m.kappaAnswered.toFixed(3)})` +
      ` | abstentions ${pct(m.abstentionRate.value)} (${m.abstentionRate.k}/${m.abstentionRate.n})`,
  );

console.log(`rules.json sha256 ${sha(rulesText)}`);
console.log(`cases.json sha256 ${sha(casesText)}\n`);
line("ALL", result.total);
for (const [set, m] of Object.entries(result.bySet)) line(set, m);
console.log(`\nExact five-level agreement (cases with a level reference): ${pct(result.exactLevel.value)} (${result.exactLevel.k}/${result.exactLevel.n})`);

const diffs = result.rows.filter((r) => !r.agree);
console.log(`\nDiscrepancies (${diffs.length}):`);
for (const r of diffs) {
  const missing = r.missingFields.length > 0 ? ` missing: ${r.missingFields.join(", ")}` : "";
  console.log(`  ${r.id.padEnd(8)} reference ${(r.refLevel ?? r.refCategory).padEnd(13)} app ${r.appLevel.padEnd(13)} rule ${r.ruleId} (${r.reason})${missing}`);
}

writeFileSync(out, JSON.stringify({ rulesSha256: sha(rulesText), casesSha256: sha(casesText), ...result }, null, 2));
console.log(`\nFull results written to ${out}`);
