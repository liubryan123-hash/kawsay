import type { Category, Level } from "./types";

/**
 * Mapping fixed in the Execution Plan (section 2, "Cómo lo validamos"):
 * emergency = emergent; priority or scheduled = non-emergent; follow-up = self-care.
 * "insufficient" is an abstention.
 */
export function levelToCategory(level: Level): Category {
  if (level === "emergency") return "emergent";
  if (level === "priority" || level === "scheduled") return "non-emergent";
  if (level === "follow-up") return "self-care";
  return "abstain";
}

export interface Pair {
  ref: string;
  app: string;
}

/**
 * Cohen's kappa (unweighted) for two raters over the same items.
 * po = observed agreement; pe = agreement expected by chance from the marginals;
 * kappa = (po - pe) / (1 - pe). Returns null when it is undefined (no items, or pe = 1).
 */
export function cohenKappa(pairs: Pair[]): number | null {
  const n = pairs.length;
  if (n === 0) return null;
  const refCount = new Map<string, number>();
  const appCount = new Map<string, number>();
  let agree = 0;
  for (const p of pairs) {
    refCount.set(p.ref, (refCount.get(p.ref) ?? 0) + 1);
    appCount.set(p.app, (appCount.get(p.app) ?? 0) + 1);
    if (p.ref === p.app) agree += 1;
  }
  let pe = 0;
  for (const [cat, r] of refCount) pe += (r / n) * ((appCount.get(cat) ?? 0) / n);
  if (1 - pe < 1e-12) return null;
  return (agree / n - pe) / (1 - pe);
}

/** Wilson score interval for a proportion k/n (95% by default). Null when n = 0. */
export function wilson(k: number, n: number, z = 1.96): [number, number] | null {
  if (n === 0) return null;
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

export interface Proportion {
  k: number;
  n: number;
  /** k / n, or null when n = 0. */
  value: number | null;
  ci95: [number, number] | null;
}

export function proportion(k: number, n: number): Proportion {
  return { k, n, value: n === 0 ? null : k / n, ci95: wilson(k, n) };
}

export interface Metrics {
  n: number;
  /** Primary. Correct / all cases. An abstention is correct only if the reference also abstains. */
  accuracy: Proportion;
  /** Secondary. Correct / cases where the app gave a level. */
  accuracyAnswered: Proportion;
  /** Reference-emergent cases classified as emergent / all reference-emergent cases. An abstention is a miss. */
  emergencySensitivity: Proportion;
  /** App abstentions / all cases. */
  abstentionRate: Proportion;
  /** Primary. Kappa over all cases, with abstention as its own category. */
  kappa: number | null;
  /** Secondary. Kappa over the cases where neither the reference nor the app abstains (three categories). */
  kappaAnswered: number | null;
}

export function computeMetrics(rows: { ref: Category; app: Category }[]): Metrics {
  const n = rows.length;
  const answered = rows.filter((r) => r.app !== "abstain");
  const emergent = rows.filter((r) => r.ref === "emergent");
  const hit = (r: { ref: Category; app: Category }) => r.ref === r.app;
  return {
    n,
    accuracy: proportion(rows.filter(hit).length, n),
    accuracyAnswered: proportion(answered.filter(hit).length, answered.length),
    emergencySensitivity: proportion(emergent.filter(hit).length, emergent.length),
    abstentionRate: proportion(n - answered.length, n),
    kappa: cohenKappa(rows),
    kappaAnswered: cohenKappa(rows.filter((r) => r.ref !== "abstain" && r.app !== "abstain")),
  };
}
