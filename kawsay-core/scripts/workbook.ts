// Reads the clinicians' Excel workbook (sheets Fields, Rules, Cases) into the JSON
// structures the engine uses. It copies content as written; it never fills in or
// corrects clinical values. Anything it cannot read is reported in `notes`.
import ExcelJS from "exceljs";
import { LEVELS, REF_CATEGORIES } from "../src/core/types";
import type { FieldDef } from "../src/core/types";

export interface WorkbookData {
  fields: FieldDef[];
  rules: Record<string, unknown>[];
  cases: Record<string, unknown>[];
  /** Problems found while reading (unreadable cells, unknown columns). */
  notes: string[];
}

type Row = Record<string, unknown>;

/** Plain value of a cell: handles rich text, hyperlinks, formulas and dates. */
function plain(v: unknown): unknown {
  if (v === null || v === undefined) return undefined;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; text?: unknown; result?: unknown };
    if (Array.isArray(o.richText)) return o.richText.map((t) => t.text).join("");
    if (o.result !== undefined) return plain(o.result);
    if (o.text !== undefined) return plain(o.text);
    return undefined;
  }
  if (typeof v === "string") return v.trim() === "" ? undefined : v.trim();
  return v;
}

const text = (v: unknown): string => (v === undefined ? "" : String(v));

/** Rows of a sheet as objects keyed by row 1. Row 2 holds hints and is skipped, as are EXAMPLE rows. */
function rows(wb: ExcelJS.Workbook, name: string, notes: string[]): Row[] {
  const ws = wb.getWorksheet(name);
  if (!ws) {
    notes.push(`Sheet "${name}" not found`);
    return [];
  }
  const keys: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => (keys[col] = text(plain(cell.value))));
  const out: Row[] = [];
  for (let r = 3; r <= ws.rowCount; r++) {
    const row: Row = {};
    keys.forEach((key, col) => {
      const value = plain(ws.getRow(r).getCell(col).value);
      if (key && value !== undefined) row[key] = value;
    });
    const id = text(row.id ?? row.path);
    if (id === "" || /^EXAMPLE/i.test(id)) continue;
    out.push(row);
  }
  return out;
}

function yesNo(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  const s = text(v).toLowerCase();
  if (["yes", "y", "si", "sí", "true", "1"].includes(s)) return true;
  if (["no", "n", "false", "0"].includes(s)) return false;
  return undefined;
}

function number(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  const n = Number(text(v).replace(",", "."));
  return text(v) !== "" && Number.isFinite(n) ? n : undefined;
}

/** Converts a cell to the type of its field. Returns the raw value when it cannot, so validation reports it. */
function typed(field: FieldDef, v: unknown): unknown {
  if (field.type === "boolean") return yesNo(v) ?? v;
  if (field.type === "number") return number(v) ?? v;
  return text(v);
}

export async function readWorkbook(path: string): Promise<WorkbookData> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const notes: string[] = [];

  const fields: FieldDef[] = rows(wb, "Fields", notes).map((r) => {
    const f: Row = { path: text(r.path), label: text(r.label), type: text(r.type).toLowerCase(), group: text(r.group) };
    if (r.unit !== undefined) f.unit = text(r.unit);
    if (r.options !== undefined) f.options = text(r.options).split(",").map((o) => o.trim()).filter(Boolean);
    for (const key of ["min", "max", "step"]) if (number(r[key]) !== undefined) f[key] = number(r[key]);
    if (r.default !== undefined) f.default = typed(f as unknown as FieldDef, r.default);
    return f as unknown as FieldDef;
  });
  const byPath = new Map(fields.map((f) => [f.path, f]));

  const rules = rows(wb, "Rules", notes).map((r) => {
    const id = text(r.id);
    const rule: Row = { id, group: text(r.group), level: text(r.level).toLowerCase(), order: number(r.order) };
    if (r.condition_json !== undefined) {
      try {
        rule.condition = JSON.parse(text(r.condition_json));
      } catch {
        notes.push(`${id}: condition_json is not valid JSON`);
        rule.condition = text(r.condition_json);
      }
    } else if (rule.level !== "insufficient") {
      notes.push(`${id}: condition not encoded yet (${text(r.condition_in_words) || "no description"})`);
    }
    if (r.onMissing !== undefined) rule.onMissing = text(r.onMissing).toLowerCase();
    rule.action = text(r.action);
    rule.alertText = text(r.alertText);
    rule.source = { ref: text(r.source_ref), section: text(r.source_section) };
    rule.review = { by: [text(r.reviewed_by_1), text(r.reviewed_by_2)].filter(Boolean), date: text(r.review_date) };
    return rule;
  });

  const meta = new Set(["id", "set", "title", "reference", "source_or_author", "dated", "external_reviewer"]);
  const cases = rows(wb, "Cases", notes).map((r) => {
    const id = text(r.id);
    const input: Row = {};
    for (const [key, value] of Object.entries(r)) {
      if (meta.has(key)) continue;
      const field = byPath.get(key);
      if (!field) {
        notes.push(`${id}: column "${key}" is not in the Fields sheet; value ignored`);
        continue;
      }
      const parts = key.split(".");
      let node = input;
      for (const p of parts.slice(0, -1)) node = (node[p] ??= {}) as Row;
      node[parts[parts.length - 1]] = typed(field, value);
    }
    const ref = text(r.reference).toLowerCase();
    const reference: Row = (LEVELS as readonly string[]).includes(ref)
      ? { level: ref }
      : (REF_CATEGORIES as readonly string[]).includes(ref)
        ? { category: ref }
        : {};
    const c: Row = { id, set: text(r.set).toLowerCase() };
    if (r.title !== undefined) c.title = text(r.title);
    c.input = input;
    c.reference = reference;
    const provenance: Row = {};
    if (r.source_or_author !== undefined) provenance.source = text(r.source_or_author);
    if (r.dated !== undefined) provenance.dated = text(r.dated);
    if (r.external_reviewer !== undefined) provenance.externalReviewer = text(r.external_reviewer);
    if (Object.keys(provenance).length > 0) c.provenance = provenance;
    return c;
  });

  return { fields, rules, cases, notes };
}
