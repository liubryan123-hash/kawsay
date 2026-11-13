import { evaluate } from "./engine";
import { computeMetrics, levelToCategory, proportion } from "./metrics";
import type { Metrics, Proportion } from "./metrics";
import type { Category, CaseSet, Level, Reason, Rule, TestCase } from "./types";

export interface EvalRow {
  id: string;
  set: CaseSet;
  title?: string;
  refLevel?: Level;
  refCategory: Category;
  appLevel: Level;
  appCategory: Category;
  ruleId: string;
  reason: Reason;
  missingFields: string[];
  /** Agreement on the three-way category (or both abstain). */
  agree: boolean;
}

export interface EvaluationResult {
  rows: EvalRow[];
  total: Metrics;
  bySet: Partial<Record<CaseSet, Metrics>>;
  /** Exact agreement on the five KAWSAY levels, only for cases whose reference gives a level. */
  exactLevel: Proportion;
}

/** Runs every case through the engine and compares it with its reference. Nothing is tuned here. */
export function runEvaluation(rules: Rule[], cases: TestCase[]): EvaluationResult {
  const rows: EvalRow[] = cases.map((c) => {
    const out = evaluate(rules, c.input);
    const refCategory: Category = c.reference.category ?? levelToCategory(c.reference.level as Level);
    const appCategory = levelToCategory(out.level);
    return {
      id: c.id,
      set: c.set,
      title: c.title,
      refLevel: c.reference.level,
      refCategory,
      appLevel: out.level,
      appCategory,
      ruleId: out.ruleId,
      reason: out.reason,
      missingFields: out.missingFields,
      agree: refCategory === appCategory,
    };
  });

  const toPairs = (rs: EvalRow[]) => rs.map((r) => ({ ref: r.refCategory, app: r.appCategory }));
  const bySet: Partial<Record<CaseSet, Metrics>> = {};
  for (const set of ["external", "space"] as const) {
    const subset = rows.filter((r) => r.set === set);
    if (subset.length > 0) bySet[set] = computeMetrics(toPairs(subset));
  }
  const withLevel = rows.filter((r) => r.refLevel !== undefined);

  return {
    rows,
    total: computeMetrics(toPairs(rows)),
    bySet,
    exactLevel: proportion(withLevel.filter((r) => r.refLevel === r.appLevel).length, withLevel.length),
  };
}
