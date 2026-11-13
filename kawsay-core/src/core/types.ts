// KAWSAY core types. Decision support only: not a diagnostic system.

/** Triage levels, ordered from most to least severe (Execution Plan, section 2). */
export const LEVELS = ["emergency", "priority", "scheduled", "follow-up", "insufficient"] as const;
export type Level = (typeof LEVELS)[number];

export const OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "between", "in", "present"] as const;
export type Op = (typeof OPS)[number];

export type Scalar = string | number | boolean;

/** A single comparison on one input field, addressed by dot path (e.g. "symptoms.chest_pain"). */
export interface Leaf {
  field: string;
  op: Op;
  value?: Scalar | Scalar[];
}

export type Condition = Leaf | { all: Condition[] } | { any: Condition[] } | { not: Condition };

export interface Source {
  /** Document: guideline, standard or paper chosen by the clinicians. */
  ref: string;
  /** Exact section, table or page inside that document. */
  section: string;
}

export interface Rule {
  id: string;
  group: string;
  level: Level;
  /** Tie-breaker inside one level: lower runs first. */
  order: number;
  /** Omitted only for the single abstention rule (level "insufficient"). */
  condition?: Condition;
  /**
   * What to do when this rule cannot be evaluated because an input is missing.
   * "abstain" (default): the datum is critical, so a less severe result is blocked.
   * "skip": the datum is not critical for triage, so the rule is treated as not matched.
   * Set by the clinicians, never by the engineers.
   */
  onMissing?: "abstain" | "skip";
  /** Immediate action shown to the crew (English, written by the clinicians). */
  action: string;
  /** Short alert text (English, written by the clinicians). */
  alertText: string;
  source: Source;
  /** Cross-review record: both clinicians must have read the rule. */
  review: { by: string[]; date: string };
}

export type Tri = "true" | "false" | "unknown";

export interface TraceEntry {
  ruleId: string;
  level: Level;
  result: Tri;
  /** True when the rule was unknown but marked onMissing: "skip". */
  skipped?: boolean;
  missing?: string[];
}

export type Reason = "rule_matched" | "missing_data" | "no_rule_matched";

export interface EngineResult {
  level: Level;
  ruleId: string;
  action: string;
  alertText: string;
  source: Source;
  reason: Reason;
  /** Input fields that prevented a confident result. */
  missingFields: string[];
  /** Rules that could not be evaluated and blocked a less severe result. */
  blockedBy: string[];
  /** Rules not evaluated for lack of data and marked onMissing: "skip" (they did not block the result). */
  skipped: string[];
  /** A less severe rule that did match but was blocked by missing data. */
  provisional?: { ruleId: string; level: Level };
  /** Every rule evaluated, in order, with its outcome. */
  trace: TraceEntry[];
}

export type FieldType = "boolean" | "number" | "enum";

/** One entry of the closed input catalogue used by the form, the rules and the cases. */
export interface FieldDef {
  path: string;
  label: string;
  type: FieldType;
  /** Form section, e.g. "Symptoms" or "Vital signs". */
  group: string;
  unit?: string;
  options?: string[];
  /** Pre-selected value in the form. Omit to start as "not assessed" / blank. */
  default?: Scalar;
  /** Plausibility bounds for data entry only. They are not clinical thresholds. */
  min?: number;
  max?: number;
  step?: number;
}

export const REF_CATEGORIES = ["emergent", "non-emergent", "self-care"] as const;
export type RefCategory = (typeof REF_CATEGORIES)[number];
export type Category = RefCategory | "abstain";

export const CASE_SETS = ["external", "space"] as const;
export type CaseSet = (typeof CASE_SETS)[number];

export interface TestCase {
  id: string;
  /** "external": published vignettes (Semigran 2015). "space": the team's own cases. */
  set: CaseSet;
  title?: string;
  input: Record<string, unknown>;
  /** Reference answer: a KAWSAY level, a three-way category, or both. */
  reference: { level?: Level; category?: RefCategory };
  provenance?: Record<string, unknown>;
}
