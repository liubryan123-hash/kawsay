"use client";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { CHECKIN_FIELDS, CREW_IDS, GROUPS } from "../checkin/catalog";
import { answerLabel, emptyDraft, prepareCheckIn } from "../checkin/model";
import type { CheckIn as CheckInRecord } from "../checkin/model";
import { appendCheckIn, readCheckIns } from "../checkin/storage";
import type { CheckInStorage } from "../checkin/storage";
import type { FieldDef } from "../core/types";

const dateLabel = (iso: string) => new Date(iso).toLocaleString("es-PE");
const errorText = (error: unknown) => error instanceof Error ? error.message : "No se pudo acceder al almacenamiento local.";

function Answers({ record }: { record: CheckInRecord }) {
  return <dl className="kw-answers">{CHECKIN_FIELDS.map((field) =>
    <div key={field.path}><dt>{field.label}</dt><dd>{answerLabel(field.path, record.answers[field.path])}</dd></div>,
  )}</dl>;
}

function InputField({ field, value, onChange }: { field: FieldDef; value: string; onChange: (value: string) => void }) {
  if (field.type === "boolean") return (
    <div className="kw-field" role="radiogroup" aria-label={field.label}>
      <span className="kw-label">{field.label}</span>
      <span className="kw-choices">{[
        ["present", "Presente"], ["absent", "Ausente"], ["unassessed", "Sin evaluar"],
      ].map(([key, label]) => <label key={key}>
        <input type="radio" name={field.path} value={key} checked={(value || "unassessed") === key} onChange={() => onChange(key)} />
        {label}
      </label>)}</span>
    </div>
  );
  return <div className="kw-field">
    <label className="kw-label" htmlFor={field.path}>{field.label}{field.unit ? " (" + field.unit + ")" : ""}</label>
    {field.type === "enum" ? (
      <select id={field.path} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sin evaluar</option>
        {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    ) : (
      <input id={field.path} type="text" inputMode="decimal" placeholder="Sin medir" value={value} onChange={(e) => onChange(e.target.value)} />
    )}
  </div>;
}

/** Recording-only prototype. Deliberately does not invoke the triage engine. */
export function CheckIn({ storage }: { storage?: CheckInStorage }) {
  const reviewTitle = useRef<HTMLHeadingElement>(null);
  const [draft, setDraft] = useState(() => emptyDraft());
  const [pending, setPending] = useState<CheckInRecord | null>(null);
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [storageError, setStorageError] = useState("");
  const [notice, setNotice] = useState("");
  const getStorage = () => storage ?? window.localStorage;

  useEffect(() => {
    try { setRecords(readCheckIns(storage ?? window.localStorage)); setStorageError(""); }
    catch (error) { setStorageError(errorText(error)); }
  }, [storage]);

  useEffect(() => { if (pending) reviewTitle.current?.focus(); }, [pending]);

  function review(event: FormEvent) {
    event.preventDefault();
    setNotice("");
    const prepared = prepareCheckIn(draft);
    setErrors(prepared.errors);
    if (prepared.record) setPending(prepared.record);
  }

  function save() {
    if (!pending) return;
    try {
      // Record actual save time, which can be later than the review step.
      const record = { ...pending, recordedAt: new Date().toISOString() };
      const next = appendCheckIn(getStorage(), record);
      setRecords(next);
      setStorageError("");
      setPending(null);
      setDraft(emptyDraft());
      setNotice("Registro guardado en este navegador. Puedes consultarlo en el historial.");
    } catch (error) { setStorageError(errorText(error)); }
  }

  return <section className="kw-screen" lang="es" aria-labelledby="kw-checkin-title">
    <h1 id="kw-checkin-title">Mi revisión</h1>
    <p className="kw-note"><strong>DEMO · Solo datos simulados.</strong> Este formulario registra información; no calcula un diagnóstico ni una prioridad clínica.</p>
    <p className="kw-hint">Los registros se guardan en este navegador, sin cifrado de la aplicación. No introduzcas datos personales ni clínicos reales. No hay envío a Tierra.</p>
    {notice && <p role="status" className="kw-notice">{notice}</p>}
    {storageError && <p role="alert" className="kw-errors">{storageError}</p>}
    {errors.length > 0 && <ul role="alert" className="kw-errors">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}

    {!pending ? <form onSubmit={review} noValidate>
      <h2>1. Identificación y contexto</h2>
      <div className="kw-field">
        <label htmlFor="checkin-crew">Tripulante simulado</label>
        <select id="checkin-crew" value={draft.crewId} onChange={(e) => setDraft({ ...draft, crewId: e.target.value })}>
          <option value="">Seleccionar</option>
          {CREW_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </div>
      <div className="kw-field">
        <label htmlFor="checkin-time">Fecha y hora de las mediciones y molestias actuales</label>
        <input id="checkin-time" type="datetime-local" value={draft.observedAt} onChange={(e) => setDraft({ ...draft, observedAt: e.target.value })} />
      </div>
      <p className="kw-hint">Hora local de este equipo. Registra las mediciones de un mismo momento; deja en blanco las que no tengas.</p>
      <h2>2. Mediciones y respuestas</h2>
      <p className="kw-hint">Las molestias y los cambios se refieren al momento indicado. El sueño se refiere a las últimas 24 horas. Estas preguntas son un borrador de registro, no una escala validada.</p>
      {GROUPS.map((group) => <fieldset className="kw-group" key={group}>
        <legend>{group}</legend>
        {CHECKIN_FIELDS.filter((f) => f.group === group).map((field) => <InputField
          key={field.path} field={field} value={draft.values[field.path] ?? ""}
          onChange={(value) => setDraft((previous) => ({ ...previous, values: { ...previous.values, [field.path]: value } }))}
        />)}
      </fieldset>)}
      <div className="kw-actions"><button className="kw-primary" type="submit">Revisar respuestas</button></div>
    </form> : <section aria-labelledby="checkin-review-title">
      <h2 id="checkin-review-title" ref={reviewTitle} tabIndex={-1}>3. Confirma tus respuestas</h2>
      <p><strong>{pending.crewId}</strong> · {dateLabel(pending.observedAt)}</p>
      <Answers record={pending} />
      <p className="kw-hint">Los campos sin evaluar o sin medir permanecerán pendientes. Guardarlos no significa que tu estado de salud sea normal.</p>
      <div className="kw-actions">
        <button type="button" onClick={() => { setPending(null); setErrors([]); }}>Volver a editar</button>
        <button type="button" className="kw-primary" onClick={save}>Confirmar y guardar</button>
      </div>
    </section>}

    <section className="kw-history" aria-labelledby="checkin-history-title">
      <h2 id="checkin-history-title">Historial local ({records.length})</h2>
      <p className="kw-hint">Permanece al recargar en el mismo navegador y dirección. Borrar los datos del navegador elimina los registros; exporta una copia si la necesitas.</p>
      {records.length === 0 ? <p>No hay registros disponibles.</p> : <>
        <a download="kawsay-checkins-simulados.json" href={"data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ schemaVersion: 1, synthetic: true, records }, null, 2))}>Exportar historial JSON</a>
        {records.map((record) => <details className="kw-group" key={record.id}>
          <summary>{record.crewId} · {dateLabel(record.observedAt)}</summary>
          <p className="kw-hint">Guardado: {dateLabel(record.recordedAt)} · {record.catalogVersion}</p>
          <Answers record={record} />
        </details>)}
      </>}
    </section>
  </section>;
}
