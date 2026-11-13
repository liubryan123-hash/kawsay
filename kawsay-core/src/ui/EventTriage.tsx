"use client";
// Screen 4 - Event / Triage: symptoms and signs -> level or "insufficient data",
// immediate action, supporting rule and source, and the latency clock.
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { evaluate } from "../core/engine";
import { formatClock, latencyState, ROUND_TRIP_MIN } from "../core/latency";
import type { EngineResult, FieldDef, Level, Rule } from "../core/types";

export const LEVEL_LABEL: Record<Level, string> = {
  emergency: "EMERGENCY",
  priority: "PRIORITY",
  scheduled: "SCHEDULED",
  "follow-up": "FOLLOW-UP",
  insufficient: "INSUFFICIENT DATA",
};

export interface TriageEvent {
  /** Epoch milliseconds when the assessment was made. */
  at: number;
  input: Record<string, unknown>;
  result: EngineResult;
}

export interface EventTriageProps {
  fields: FieldDef[];
  rules: Rule[];
  /** Round-trip latency pre-selected in the clock, in minutes. */
  defaultRoundTripMin?: (typeof ROUND_TRIP_MIN)[number];
  /** Called with every assessment, e.g. to store it for the Earth Packet (screen 5). */
  onResult?: (event: TriageEvent) => void;
  /** Clock source, replaceable in tests. */
  now?: () => number;
}

type FormValues = Record<string, string>;

function initialValues(fields: FieldDef[]): FormValues {
  const values: FormValues = {};
  for (const f of fields) {
    if (f.type === "boolean") values[f.path] = f.default === true ? "yes" : f.default === false ? "no" : "na";
    else values[f.path] = f.default === undefined ? "" : String(f.default);
  }
  return values;
}

/** Turns the form into the nested input the engine expects. Blank or "not assessed" fields are left out. */
export function buildInput(fields: FieldDef[], values: FormValues): { input: Record<string, unknown>; errors: string[] } {
  const input: Record<string, unknown> = {};
  const errors: string[] = [];
  for (const f of fields) {
    const raw = (values[f.path] ?? "").trim();
    let value: unknown;
    if (f.type === "boolean") {
      if (raw === "na" || raw === "") continue;
      value = raw === "yes";
    } else if (f.type === "number") {
      if (raw === "") continue;
      const n = Number(raw.replace(",", "."));
      if (!Number.isFinite(n)) {
        errors.push(`${f.label}: enter a number`);
        continue;
      }
      if ((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) {
        errors.push(`${f.label}: value outside the accepted entry range (${f.min ?? "-"} to ${f.max ?? "-"})`);
        continue;
      }
      value = n;
    } else {
      if (raw === "") continue;
      value = raw;
    }
    const keys = f.path.split(".");
    let node = input;
    for (const key of keys.slice(0, -1)) node = (node[key] ??= {}) as Record<string, unknown>;
    node[keys[keys.length - 1]] = value;
  }
  return { input, errors };
}

const clockTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function EventTriage({ fields, rules, defaultRoundTripMin = 24, onResult, now = Date.now }: EventTriageProps) {
  const [values, setValues] = useState<FormValues>(() => initialValues(fields));
  const [errors, setErrors] = useState<string[]>([]);
  const [event, setEvent] = useState<TriageEvent | null>(null);
  const [roundTrip, setRoundTrip] = useState<number>(defaultRoundTripMin);
  const [tick, setTick] = useState<number>(() => now());

  const groups = useMemo(() => Array.from(new Set(fields.map((f) => f.group))), [fields]);
  const labelOf = useMemo(() => new Map(fields.map((f) => [f.path, f.label])), [fields]);

  useEffect(() => {
    if (!event) return;
    const id = setInterval(() => setTick(now()), 1000);
    return () => clearInterval(id);
  }, [event, now]);

  const set = (path: string, value: string) => setValues((v) => ({ ...v, [path]: value }));

  function assess(e: FormEvent) {
    e.preventDefault();
    const built = buildInput(fields, values);
    setErrors(built.errors);
    if (built.errors.length > 0) return;
    const at = now();
    const next: TriageEvent = { at, input: built.input, result: evaluate(rules, built.input) };
    setTick(at);
    setEvent(next);
    onResult?.(next);
  }

  function clear() {
    setValues(initialValues(fields));
    setErrors([]);
    setEvent(null);
  }

  const result = event?.result;
  const latency = event ? latencyState(event.at, Math.max(tick, event.at), roundTrip) : null;

  return (
    <section className="kw-screen" aria-labelledby="kw-triage-title">
      <h1 id="kw-triage-title">Event / Triage</h1>
      <p className="kw-note">Decision support only. Not a diagnosis and not a certified medical device.</p>

      <form onSubmit={assess} noValidate>
        {groups.map((group) => (
          <fieldset key={group} className="kw-group">
            <legend>{group}</legend>
            {fields.filter((f) => f.group === group).map((f) =>
              f.type === "boolean" ? (
                <div key={f.path} className="kw-field" role="radiogroup" aria-label={f.label}>
                  <span className="kw-label">{f.label}</span>
                  <span className="kw-choices">
                    {([["no", "No"], ["yes", "Yes"], ["na", "Not assessed"]] as const).map(([opt, text]) => (
                      <label key={opt}>
                        <input type="radio" name={f.path} value={opt} checked={values[f.path] === opt} onChange={() => set(f.path, opt)} />
                        {text}
                      </label>
                    ))}
                  </span>
                </div>
              ) : (
                <div key={f.path} className="kw-field">
                  <label className="kw-label" htmlFor={`kw-${f.path}`}>
                    {f.label}
                    {f.unit ? ` (${f.unit})` : ""}
                  </label>
                  {f.type === "number" ? (
                    <input
                      id={`kw-${f.path}`}
                      type="number"
                      inputMode="decimal"
                      min={f.min}
                      max={f.max}
                      step={f.step ?? "any"}
                      placeholder="Not measured"
                      value={values[f.path]}
                      onChange={(e) => set(f.path, e.target.value)}
                    />
                  ) : (
                    <select id={`kw-${f.path}`} value={values[f.path]} onChange={(e) => set(f.path, e.target.value)}>
                      <option value="">Not assessed</option>
                      {(f.options ?? []).map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  )}
                </div>
              ),
            )}
          </fieldset>
        ))}
        <p className="kw-hint">Leave a measurement blank, or choose "Not assessed", when you do not have the data.</p>
        {errors.length > 0 && (
          <ul className="kw-errors" role="alert">
            {errors.map((msg) => <li key={msg}>{msg}</li>)}
          </ul>
        )}
        <div className="kw-actions">
          <button type="submit" className="kw-primary">Assess now</button>
          <button type="button" onClick={clear}>Clear</button>
        </div>
      </form>

      {event && result && latency && (
        <div className={`kw-result kw-level-${result.level}`} role="status" aria-live="polite">
          <p className="kw-badge">{LEVEL_LABEL[result.level]}</p>

          <h2>Do this now</h2>
          <p className="kw-action">{result.action}</p>

          {result.level === "insufficient" && result.missingFields.length > 0 && (
            <>
              <h3>Data needed for a recommendation</h3>
              <ul className="kw-missing">
                {result.missingFields.map((path) => <li key={path}>{labelOf.get(path) ?? path}</li>)}
              </ul>
            </>
          )}
          {result.reason === "no_rule_matched" && (
            <p className="kw-hint">No rule applies to the data entered, so KAWSAY cannot make a recommendation.</p>
          )}

          <h3>Time to Earth</h3>
          <div className="kw-clock">
            <label htmlFor="kw-roundtrip">Round-trip delay</label>
            <select id="kw-roundtrip" value={roundTrip} onChange={(e) => setRoundTrip(Number(e.target.value))}>
              {ROUND_TRIP_MIN.map((m) => <option key={m} value={m}>{m} min</option>)}
            </select>
            <p className="kw-countdown">
              {latency.phase === "reply_possible" ? (
                <>A reply from Earth is now possible.</>
              ) : (
                <>
                  Earliest possible reply in <strong>{formatClock(latency.msToReply)}</strong>
                </>
              )}
            </p>
            <progress value={latency.progress} max={1} aria-label="Round trip progress" />
            <ol className="kw-milestones">
              {latency.milestones.map((m) => (
                <li key={m.label} className={m.reached ? "kw-reached" : undefined}>
                  <span>{m.label}</span> <time>{clockTime(event.at + m.atMs)}</time> (+{Math.round(m.atMs / 60_000)} min)
                  {m.reached ? " - done" : ""}
                </li>
              ))}
            </ol>
            <p className="kw-hint">Earliest reply assumes Earth answers the moment the report arrives.</p>
          </div>

          <h3>Why</h3>
          <dl className="kw-why">
            <dt>Rule</dt>
            <dd>{result.ruleId}: {result.alertText}</dd>
            <dt>Source</dt>
            <dd>{result.source.ref}, {result.source.section}</dd>
            {result.blockedBy.length > 0 && (
              <>
                <dt>Could not be evaluated</dt>
                <dd>{result.blockedBy.join(", ")}</dd>
              </>
            )}
            {result.skipped.length > 0 && (
              <>
                <dt>Not checked</dt>
                <dd>{result.skipped.join(", ")} (non-critical data not entered)</dd>
              </>
            )}
            {result.provisional && (
              <>
                <dt>Note</dt>
                <dd>
                  Rule {result.provisional.ruleId} matched, but a more urgent rule could not be ruled out with the data entered.
                </dd>
              </>
            )}
            <dt>Assessed at</dt>
            <dd>{clockTime(event.at)}</dd>
          </dl>
        </div>
      )}
    </section>
  );
}
