import { isCheckIn } from "./model";
import type { CheckIn } from "./model";

export const STORAGE_KEY = "kawsay.checkins.v1";
export type CheckInStorage = Pick<Storage, "getItem" | "setItem">;
export class CheckInStorageError extends Error {}

// Callers surface these errors; a failed read must never become an empty history.
export function readCheckIns(storage: CheckInStorage): CheckIn[] {
  try {
    const text = storage.getItem(STORAGE_KEY);
    if (text === null) return [];
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed) || !parsed.every(isCheckIn) ||
        new Set(parsed.map((r) => r.id)).size !== parsed.length) throw new Error("Invalid history");
    return parsed;
  } catch {
    throw new CheckInStorageError("No pudimos leer el historial local. No se sobrescribirá. Revisa el almacenamiento del navegador.");
  }
}
export function appendCheckIn(storage: CheckInStorage, record: CheckIn): CheckIn[] {
  if (!isCheckIn(record)) throw new CheckInStorageError("El registro no es válido.");
  const records = readCheckIns(storage);
  if (records.some((r) => r.id === record.id)) throw new CheckInStorageError("Este registro ya está guardado.");
  const next = [record, ...records];
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    throw new CheckInStorageError("No se pudo guardar. El navegador puede tener el almacenamiento bloqueado o lleno. Tus respuestas siguen disponibles para reintentar.");
  }
}
