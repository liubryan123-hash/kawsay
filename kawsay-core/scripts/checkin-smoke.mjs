// Dependency-free behavioural checks for Node 24. Full React tests remain in Vitest.
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { stripTypeScriptTypes } from "node:module";

const temp = await mkdtemp(join(tmpdir(), "kawsay-checkin-"));
try {
  for (const name of ["catalog", "model", "storage"]) {
    const source = await readFile(new URL("../src/checkin/" + name + ".ts", import.meta.url), "utf8");
    const js = stripTypeScriptTypes(source).replace(/from "(\.\/[a-z]+)"/g, 'from "$1.mjs"');
    await writeFile(join(temp, name + ".mjs"), js);
  }
  const { emptyDraft, prepareCheckIn, isCheckIn, answerLabel } = await import(pathToFileURL(join(temp, "model.mjs")));
  const { appendCheckIn, readCheckIns, STORAGE_KEY } = await import(pathToFileURL(join(temp, "storage.mjs")));
  const time = new Date("2026-11-13T15:00:00Z");
  const draft = { ...emptyDraft(time), crewId: "DEMO-01", values: { "vitals.spo2": "97", "symptoms.fatigue": "absent" } };
  const { record, errors } = prepareCheckIn(draft, time, "smoke-1");
  assert.deepEqual(errors, []);
  assert.equal(record.answers["symptoms.fatigue"], false);
  assert.equal(record.answers["symptoms.dyspnea"], undefined);
  assert.equal(answerLabel("symptoms.dyspnea", undefined), "Sin evaluar");
  assert.equal(answerLabel("vitals.spo2", undefined), "Sin medir");
  assert.equal(isCheckIn(record), true);
  assert.equal(isCheckIn({ ...record, synthetic: false }), false);
  assert.equal(isCheckIn({ ...record, answers: { "vitals.spo2": 150 } }), false);
  assert.equal(isCheckIn({ ...record, answers: { "symptoms.fatigue": "false" } }), false);
  for (const values of [{ "vitals.spo2": "101" }, { "vitals.spo2": "abc" }, { "symptoms.fatigue": "maybe" }, { "context.activity": "En reposo" }, {}]) {
    assert.equal(prepareCheckIn({ ...draft, values }, time, "invalid").record, undefined);
  }
  const future = new Date(time.getTime() + 60_000).toISOString();
  assert.equal(prepareCheckIn({ ...draft, observedAt: future }, time, "future").record, undefined);
  const decimal = prepareCheckIn({ ...draft, values: { "vitals.temperature": "36,5" } }, time, "decimal");
  assert.equal(decimal.record.answers["vitals.temperature"], 36.5);
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  appendCheckIn(storage, record);
  assert.deepEqual(readCheckIns(storage), [record]);
  assert.throws(() => appendCheckIn(storage, record), /ya está guardado/);
  const second = { ...record, id: "smoke-2", crewId: "DEMO-02" };
  appendCheckIn(storage, second);
  assert.deepEqual(readCheckIns(storage).map((r) => r.id), ["smoke-2", "smoke-1"]);
  const failedWrite = { getItem: storage.getItem, setItem: () => { throw new Error("quota"); } };
  assert.throws(() => appendCheckIn(failedWrite, { ...record, id: "smoke-3" }), /No se pudo guardar/);
  assert.equal(readCheckIns(storage).length, 2);
  memory.set(STORAGE_KEY, "broken");
  assert.throws(() => appendCheckIn(storage, second), /No pudimos leer/);
  assert.equal(memory.get(STORAGE_KEY), "broken");
  console.log("PASS: typed answers, missing vs negative, invalid input, dates, recovery, duplicates, quota and corrupt-history protection.");
} finally {
  await rm(temp, { recursive: true, force: true });
}
