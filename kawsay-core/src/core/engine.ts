import { LEVELS } from "./types";
import type { Condition, EngineResult, Leaf, Level, Rule, TraceEntry, Tri } from "./types";

/** 0 = most severe. */
export function severity(level: Level): number {
  return LEVELS.indexOf(level);
}

/** Reads a dot path from a nested object. Returns undefined when any step is absent. */
export function getField(input: unknown, path: string): unknown {
  let cur: unknown = input;
  for (const key of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    if (!Object.prototype.hasOwnProperty.call(cur, key)) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

interface Eval {
  tri: Tri;
  /** Fields whose absence made the result unknown. Empty unless tri is "unknown". */
  missing: string[];
}

const uniq = (xs: string[]): string[] => Array.from(new Set(xs));

function evalLeaf(leaf: Leaf, input: unknown): Eval {
  const v = getField(input, leaf.field);
  const absent = v === undefined || v === null || (typeof v === "number" && !Number.isFinite(v));
  if (leaf.op === "present") return { tri: absent ? "false" : "true", missing: [] };
  if (absent) return { tri: "unknown", missing: [leaf.field] };

  const known = (b: boolean): Eval => ({ tri: b ? "true" : "false", missing: [] });
  if (leaf.op === "eq") return known(v === leaf.value);
  if (leaf.op === "neq") return known(v !== leaf.value);
  if (leaf.op === "in") return known(Array.isArray(leaf.value) && leaf.value.includes(v as never));

  // Numeric comparisons. A non-numeric value is unusable data, so it counts as missing.
  if (typeof v !== "number") return { tri: "unknown", missing: [leaf.field] };
  if (leaf.op === "between") {
    const [lo, hi] = leaf.value as number[];
    return known(v >= lo && v <= hi);
  }
  const t = leaf.value as number;
  if (leaf.op === "gt") return known(v > t);
  if (leaf.op === "gte") return known(v >= t);
  if (leaf.op === "lt") return known(v < t);
  return known(v <= t); // lte
}

/**
 * Three-valued (Kleene) evaluation: a condition is true, false or unknown.
 * "all" is false if any part is false; "any" is true if any part is true;
 * otherwise an unknown part makes the whole condition unknown.
 */
export function evalCondition(c: Condition, input: unknown): Eval {
  if ("all" in c || "any" in c) {
    const isAll = "all" in c;
    const parts = (isAll ? c.all : c.any).map((p) => evalCondition(p, input));
    const decisive: Tri = isAll ? "false" : "true";
    if (parts.some((p) => p.tri === decisive)) return { tri: decisive, missing: [] };
    const unknown = parts.filter((p) => p.tri === "unknown");
    if (unknown.length > 0) return { tri: "unknown", missing: uniq(unknown.flatMap((p) => p.missing)) };
    return { tri: isAll ? "true" : "false", missing: [] };
  }
  if ("not" in c) {
    const r = evalCondition(c.not, input);
    if (r.tri === "unknown") return r;
    return { tri: r.tri === "true" ? "false" : "true", missing: [] };
  }
  return evalLeaf(c, input);
}

/** Most severe level first; then "order"; then id, so the order is always deterministic. */
export function sortRules(rules: Rule[]): Rule[] {
  return [...rules].sort(
    (a, b) => severity(a.level) - severity(b.level) || a.order - b.order || a.id.localeCompare(b.id),
  );
}

/**
 * Evaluates the rules from most to least severe; the first rule that matches wins.
 *
 * Abstention: if a rule matches while a strictly more severe rule could not be
 * evaluated because of missing input, the engine returns "insufficient" instead,
 * so that missing data can never produce a less urgent result than the data
 * might support. It also abstains when no rule matches at all.
 *
 * Expects a rule set that passed validateRules (exactly one rule without
 * condition, level "insufficient": the abstention rule).
 */
export function evaluate(rules: Rule[], input: unknown): EngineResult {
  const sorted = sortRules(rules);
  const fallback = sorted.find((r) => r.level === "insufficient" && r.condition === undefined);
  if (!fallback) throw new Error("Rule set has no abstention rule (level 'insufficient' without condition).");

  const trace: TraceEntry[] = [];
  const pending: { ruleId: string; level: Level; missing: string[] }[] = [];
  const skippedIds: string[] = [];

  const abstain = (
    reason: "missing_data" | "no_rule_matched",
    blockers: typeof pending,
    provisional?: Rule,
  ): EngineResult => ({
    level: "insufficient",
    ruleId: fallback.id,
    action: fallback.action,
    alertText: fallback.alertText,
    source: fallback.source,
    reason,
    missingFields: uniq(blockers.flatMap((b) => b.missing)),
    blockedBy: blockers.map((b) => b.ruleId),
    skipped: skippedIds,
    ...(provisional ? { provisional: { ruleId: provisional.id, level: provisional.level } } : {}),
    trace,
  });

  for (const rule of sorted) {
    if (rule === fallback || rule.condition === undefined) continue;
    const r = evalCondition(rule.condition, input);

    if (r.tri === "unknown") {
      const skipped = rule.onMissing === "skip";
      trace.push({ ruleId: rule.id, level: rule.level, result: "unknown", missing: r.missing, ...(skipped ? { skipped } : {}) });
      if (skipped) skippedIds.push(rule.id);
      else pending.push({ ruleId: rule.id, level: rule.level, missing: r.missing });
      continue;
    }

    trace.push({ ruleId: rule.id, level: rule.level, result: r.tri });
    if (r.tri === "false") continue;

    const blockers = pending.filter((p) => severity(p.level) < severity(rule.level));
    if (blockers.length > 0) return abstain("missing_data", blockers, rule);
    return {
      level: rule.level,
      ruleId: rule.id,
      action: rule.action,
      alertText: rule.alertText,
      source: rule.source,
      reason: "rule_matched",
      missingFields: [],
      blockedBy: [],
      skipped: skippedIds,
      trace,
    };
  }

  return pending.length > 0 ? abstain("missing_data", pending) : abstain("no_rule_matched", []);
}
