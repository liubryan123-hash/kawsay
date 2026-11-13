import { CASE_SETS, LEVELS, OPS, REF_CATEGORIES } from "./types";
import type { FieldDef, Level, RefCategory } from "./types";
import { levelToCategory } from "./metrics";

export interface Report {
  errors: string[];
  warnings: string[];
}

export interface RuleOptions {
  /** Field catalogue. When given, every field used by a rule must exist in it with a compatible type. */
  fields?: FieldDef[];
  /** Release mode: pending texts and incomplete cross-review are errors instead of warnings. */
  strict?: boolean;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isScalar = (x: unknown): boolean => ["string", "number", "boolean"].includes(typeof x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const filled = (x: unknown): x is string => typeof x === "string" && x.trim().length > 0;
const isPending = (x: unknown): boolean => typeof x === "string" && /^\s*(PENDING|TODO|<)/i.test(x);
const NUMERIC = ["gt", "gte", "lt", "lte", "between"];

function checkCondition(c: unknown, where: string, fields: Map<string, FieldDef> | null, errors: string[]): void {
  if (!isObj(c)) {
    errors.push(`${where}: condition must be an object`);
    return;
  }
  for (const key of ["all", "any"] as const) {
    if (key in c) {
      const parts = c[key];
      if (!Array.isArray(parts) || parts.length === 0) errors.push(`${where}: "${key}" must be a non-empty array`);
      else parts.forEach((p, i) => checkCondition(p, `${where}.${key}[${i}]`, fields, errors));
      return;
    }
  }
  if ("not" in c) return checkCondition(c.not, `${where}.not`, fields, errors);

  const { field, op, value } = c;
  if (!filled(field)) return void errors.push(`${where}: missing "field"`);
  if (typeof op !== "string" || !(OPS as readonly string[]).includes(op)) {
    return void errors.push(`${where}: unknown operator "${String(op)}"`);
  }
  if (op === "between") {
    if (!Array.isArray(value) || value.length !== 2 || !value.every(isNum) || value[0] > value[1]) {
      errors.push(`${where}: "between" needs [low, high] with low <= high`);
    }
  } else if (op === "in") {
    if (!Array.isArray(value) || value.length === 0 || !value.every(isScalar)) {
      errors.push(`${where}: "in" needs a non-empty list of values`);
    }
  } else if (NUMERIC.includes(op)) {
    if (!isNum(value)) errors.push(`${where}: "${op}" needs a number`);
  } else if (op !== "present" && !isScalar(value)) {
    errors.push(`${where}: "${op}" needs a value`);
  }

  if (!fields) return;
  const def = fields.get(field);
  if (!def) return void errors.push(`${where}: field "${field}" is not in the field catalogue`);
  if (NUMERIC.includes(op) && def.type !== "number") {
    errors.push(`${where}: "${op}" used on non-numeric field "${field}"`);
  }
  if (op === "eq" || op === "neq" || op === "in") {
    const values = op === "in" && Array.isArray(value) ? value : [value];
    const want = def.type === "enum" ? "string" : def.type;
    for (const v of values) {
      if (typeof v !== want) errors.push(`${where}: value ${JSON.stringify(v)} does not match ${def.type} field "${field}"`);
      else if (def.type === "enum" && !(def.options ?? []).includes(v as string)) {
        errors.push(`${where}: "${String(v)}" is not an option of "${field}"`);
      }
    }
  }
}

/** Checks the structure and traceability of a rule set before it is loaded into the engine. */
export function validateRules(rules: unknown, opts: RuleOptions = {}): Report {
  const errors: string[] = [];
  const warnings: string[] = [];
  const soft = opts.strict ? errors : warnings;
  if (!Array.isArray(rules)) return { errors: ["rules must be an array"], warnings };

  const fields = opts.fields ? new Map(opts.fields.map((f) => [f.path, f])) : null;
  const seen = new Set<string>();
  let fallbacks = 0;

  rules.forEach((r, i) => {
    if (!isObj(r)) return void errors.push(`rule[${i}]: must be an object`);
    const id = filled(r.id) ? r.id : `rule[${i}]`;
    if (!filled(r.id)) errors.push(`${id}: missing "id"`);
    else if (seen.has(r.id)) errors.push(`${id}: duplicate id`);
    else seen.add(r.id);

    if (!filled(r.group)) errors.push(`${id}: missing "group"`);
    if (!(LEVELS as readonly string[]).includes(r.level as string)) errors.push(`${id}: invalid level "${String(r.level)}"`);
    if (!isNum(r.order)) errors.push(`${id}: "order" must be a number`);
    if (r.onMissing !== undefined && r.onMissing !== "abstain" && r.onMissing !== "skip") {
      errors.push(`${id}: "onMissing" must be "abstain" or "skip"`);
    }

    if (r.onMissing === "skip") {
      warnings.push(
        `${id}: onMissing "skip"${r.level === "emergency" ? " on an EMERGENCY rule" : ""}: missing data will not block a less urgent result; confirm with the clinicians`,
      );
    }

    if (r.condition === undefined) {
      if (r.level === "insufficient") fallbacks += 1;
      else errors.push(`${id}: only the abstention rule (level "insufficient") may omit "condition"`);
    } else {
      checkCondition(r.condition, `${id}.condition`, fields, errors);
    }

    const source = isObj(r.source) ? r.source : {};
    const texts: [string, unknown][] = [
      ["action", r.action],
      ["alertText", r.alertText],
      ["source.ref", source.ref],
      ["source.section", source.section],
    ];
    for (const [name, text] of texts) {
      if (!filled(text)) errors.push(`${id}: missing "${name}"`);
      else if (isPending(text)) soft.push(`${id}: "${name}" is still pending clinical content`);
    }

    const review = isObj(r.review) ? r.review : {};
    const by = Array.isArray(review.by) ? review.by.filter(filled) : [];
    if (by.length < 2) soft.push(`${id}: cross-review incomplete (both clinicians must be listed in review.by)`);
    if (!filled(review.date) || !/^\d{4}-\d{2}-\d{2}$/.test(review.date)) soft.push(`${id}: review.date must be YYYY-MM-DD`);
  });

  if (fallbacks !== 1) errors.push(`expected exactly 1 abstention rule (level "insufficient" without condition), found ${fallbacks}`);
  return { errors, warnings };
}

/** Lists every leaf of a nested input as [dot path, value]. */
export function flatten(input: unknown, prefix = ""): [string, unknown][] {
  if (!isObj(input)) return prefix ? [[prefix, input]] : [];
  return Object.entries(input).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
}

/**
 * Checks the evaluation cases against the field catalogue: every value a case
 * provides must be something the app can ask for, and the report warns about
 * catalogue fields a case leaves out (the engine will treat them as missing).
 */
export function validateCases(cases: unknown, opts: { fields: FieldDef[] }): Report {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!Array.isArray(cases)) return { errors: ["cases must be an array"], warnings };
  const fields = new Map(opts.fields.map((f) => [f.path, f]));
  const seen = new Set<string>();

  cases.forEach((c, i) => {
    if (!isObj(c)) return void errors.push(`case[${i}]: must be an object`);
    const id = filled(c.id) ? c.id : `case[${i}]`;
    if (!filled(c.id)) errors.push(`${id}: missing "id"`);
    else if (seen.has(c.id)) errors.push(`${id}: duplicate id`);
    else seen.add(c.id);
    if (!(CASE_SETS as readonly string[]).includes(c.set as string)) errors.push(`${id}: "set" must be "external" or "space"`);

    const ref = isObj(c.reference) ? c.reference : {};
    const level = ref.level as Level | undefined;
    const category = ref.category as RefCategory | undefined;
    if (level === undefined && category === undefined) errors.push(`${id}: reference needs "level" or "category"`);
    if (level !== undefined && !(LEVELS as readonly string[]).includes(level)) errors.push(`${id}: invalid reference level "${level}"`);
    if (category !== undefined && !(REF_CATEGORIES as readonly string[]).includes(category)) {
      errors.push(`${id}: invalid reference category "${category}"`);
    }
    if (level !== undefined && category !== undefined && (LEVELS as readonly string[]).includes(level) && levelToCategory(level) !== category) {
      errors.push(`${id}: reference level "${level}" and category "${category}" disagree`);
    }

    if (!isObj(c.input)) return void errors.push(`${id}: "input" must be an object`);
    const given = new Set<string>();
    for (const [path, value] of flatten(c.input)) {
      if (value === null || value === undefined) continue;
      const def = fields.get(path);
      if (!def) {
        errors.push(`${id}: input "${path}" is not in the field catalogue (the app cannot ask for it)`);
        continue;
      }
      given.add(path);
      const want = def.type === "enum" ? "string" : def.type;
      if (typeof value !== want) errors.push(`${id}: input "${path}" should be ${def.type}`);
      else if (def.type === "enum" && !(def.options ?? []).includes(value as string)) {
        errors.push(`${id}: "${String(value)}" is not an option of "${path}"`);
      }
    }
    const absent = opts.fields.filter((f) => !given.has(f.path)).map((f) => f.path);
    if (absent.length > 0) warnings.push(`${id}: not provided (treated as missing): ${absent.join(", ")}`);
  });

  return { errors, warnings };
}
