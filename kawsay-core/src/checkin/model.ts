import { CATALOG_VERSION, CHECKIN_FIELDS, CREW_IDS } from "./catalog";
import type { Scalar } from "../core/types";

export interface CheckIn {
  schemaVersion: 1;
  catalogVersion: typeof CATALOG_VERSION;
  synthetic: true;
  id: string;
  crewId: string;
  observedAt: string;
  recordedAt: string;
  answers: Record<string, Scalar>;
}
export interface Draft {
  crewId: string;
  observedAt: string;
  values: Record<string, string>;
}
export function emptyDraft(now = new Date()): Draft {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  return { crewId: "", observedAt: local, values: {} };
}

export function parseAnswers(values: Record<string, unknown>): { answers: Record<string, Scalar>; errors: string[] } {
  const answers: Record<string, Scalar> = {};
  const errors: string[] = [];
  for (const field of CHECKIN_FIELDS) {
    const raw = values[field.path];
    if (raw === undefined || raw === "" || raw === "unassessed") continue;
    if (field.type === "boolean") {
      if (raw === "present") answers[field.path] = true;
      else if (raw === "absent") answers[field.path] = false;
      else errors.push(field.label + ": selecciona una opción válida.");
    } else if (field.type === "enum") {
      if (typeof raw === "string" && field.options?.includes(raw)) answers[field.path] = raw;
      else errors.push(field.label + ": selecciona una opción válida.");
    } else {
      const normalized = typeof raw === "string" ? raw.trim().replace(",", ".") : "";
      const value = Number(normalized);
      if (!normalized || !Number.isFinite(value) ||
          (field.min !== undefined && value < field.min) ||
          (field.max !== undefined && value > field.max)) {
        errors.push(field.label + ": introduce un valor válido" + (field.unit ? " en " + field.unit : "") + ".");
      } else answers[field.path] = value;
    }
  }
  return { answers, errors };
}

export function prepareCheckIn(draft: Draft, now = new Date(), id = crypto.randomUUID()):
  { record?: CheckIn; errors: string[] } {
  const { answers, errors } = parseAnswers(draft.values);
  const observed = new Date(draft.observedAt);
  if (!(CREW_IDS as readonly string[]).includes(draft.crewId)) errors.push("Selecciona un tripulante simulado.");
  if (!draft.observedAt || !Number.isFinite(observed.getTime()) || observed.getTime() > now.getTime()) {
    errors.push("Indica una fecha y hora válidas que no estén en el futuro.");
  }
  if (!CHECKIN_FIELDS.some((f) => f.group !== "Contexto" && answers[f.path] !== undefined)) {
    errors.push("Completa al menos una medición o respuesta funcional.");
  }
  if (errors.length) return { errors };
  return { errors, record: {
    schemaVersion: 1, catalogVersion: CATALOG_VERSION, synthetic: true,
    id, crewId: draft.crewId, observedAt: observed.toISOString(),
    recordedAt: now.toISOString(), answers,
  } };
}

export function answerLabel(path: string, value: Scalar | undefined): string {
  const field = CHECKIN_FIELDS.find((f) => f.path === path);
  if (value === undefined) return field?.type === "number" ? "Sin medir" : "Sin evaluar";
  if (typeof value === "boolean") return value ? "Presente" : "Ausente";
  return String(value) + (field?.unit ? " " + field.unit : "");
}

function isObj(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Local storage is untrusted. Refuse incompatible records rather than silently discarding them.
export function isCheckIn(value: unknown): value is CheckIn {
  if (!isObj(value) || value.schemaVersion !== 1 || value.catalogVersion !== CATALOG_VERSION ||
      value.synthetic !== true || typeof value.id !== "string" || !value.id ||
      !(CREW_IDS as readonly unknown[]).includes(value.crewId) ||
      typeof value.observedAt !== "string" || typeof value.recordedAt !== "string" ||
      !Number.isFinite(Date.parse(value.observedAt)) || !Number.isFinite(Date.parse(value.recordedAt)) ||
      Date.parse(value.observedAt) > Date.parse(value.recordedAt) || !isObj(value.answers)) return false;
  const raw: Record<string, string> = {};
  for (const [path, answer] of Object.entries(value.answers)) {
    const field = CHECKIN_FIELDS.find((f) => f.path === path);
    if (!field) return false;
    if (field.type === "boolean") {
      if (typeof answer !== "boolean") return false;
      raw[path] = answer ? "present" : "absent";
    } else {
      if (field.type === "number" ? typeof answer !== "number" : typeof answer !== "string") return false;
      raw[path] = String(answer);
    }
  }
  const parsed = parseAnswers(raw);
  return parsed.errors.length === 0 &&
    CHECKIN_FIELDS.some((f) => f.group !== "Contexto" && parsed.answers[f.path] !== undefined);
}
