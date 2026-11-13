import type { FieldDef } from "../core/types";

// Recording catalogue only: these questions are not a validated instrument or clinical rules.
export const CATALOG_VERSION = "checkin-v1";
export const CREW_IDS = ["DEMO-01", "DEMO-02", "DEMO-03", "DEMO-04"] as const;
export const CHECKIN_FIELDS: FieldDef[] = [
  { path: "context.activity", label: "¿Qué estabas haciendo?", type: "enum", group: "Contexto", options: ["En reposo", "Actividad habitual", "Ejercicio"] },
  { path: "vitals.heart_rate", label: "Frecuencia cardiaca", type: "number", group: "Mediciones", unit: "lpm", min: 0 },
  { path: "vitals.respiratory_rate", label: "Frecuencia respiratoria", type: "number", group: "Mediciones", unit: "rpm", min: 0 },
  { path: "vitals.spo2", label: "Saturación de oxígeno (SpO₂)", type: "number", group: "Mediciones", unit: "%", min: 0, max: 100 },
  { path: "vitals.temperature", label: "Temperatura", type: "number", group: "Mediciones", unit: "°C" },
  { path: "vitals.systolic", label: "Presión arterial sistólica", type: "number", group: "Mediciones", unit: "mmHg", min: 0 },
  { path: "vitals.diastolic", label: "Presión arterial diastólica", type: "number", group: "Mediciones", unit: "mmHg", min: 0 },
  { path: "readiness.sleep_hours", label: "Horas de sueño en las últimas 24 horas", type: "number", group: "Sueño y actividad", unit: "h", min: 0, max: 24 },
  { path: "functional.sleep_unrestful", label: "¿Tu descanso fue insuficiente para ti?", type: "boolean", group: "Sueño y actividad" },
  { path: "functional.activity_changed", label: "¿Tus actividades habituales te cuestan más que antes?", type: "boolean", group: "Sueño y actividad" },
  { path: "symptoms.fatigue", label: "Fatiga o cansancio", type: "boolean", group: "Molestias actuales" },
  { path: "symptoms.dyspnea", label: "Dificultad para respirar", type: "boolean", group: "Molestias actuales" },
  { path: "symptoms.chest_pain", label: "Dolor en el pecho", type: "boolean", group: "Molestias actuales" },
  { path: "symptoms.headache", label: "Dolor de cabeza", type: "boolean", group: "Molestias actuales" },
];
export const GROUPS = Array.from(new Set(CHECKIN_FIELDS.map((f) => f.group)));
