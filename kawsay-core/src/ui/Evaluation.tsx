"use client";
// Screen 6 - Evaluation: every case, its reference, the app's answer and the metrics.
import { useMemo, useState } from "react";
import { runEvaluation } from "../core/evaluation";
import type { Metrics, Proportion } from "../core/metrics";
import type { CaseSet, Rule, TestCase } from "../core/types";
import { LEVEL_LABEL } from "./EventTriage";

export interface Benchmarks {
  /** Citation shown next to the comparison values. */
  source: string;
  triageAccuracy?: number;
  emergencySensitivity?: number;
}

export interface EvaluationProps {
  rules: Rule[];
  cases: TestCase[];
  /** Published comparison values for the external cases. Omit until the source is verified. */
  benchmarks?: Benchmarks;
}

const pct = (x: number | null | undefined) => (x === null || x === undefined ? "n/a" : `${(x * 100).toFixed(1)}%`);
const num = (x: number | null) => (x === null ? "n/a" : x.toFixed(2));
const SET_LABEL: Record<CaseSet, string> = { external: "External", space: "Space" };

function Tile({ title, p, benchmark, note }: { title: string; p: Proportion; benchmark?: number; note?: string }) {
  return (
    <div className="kw-tile">
      <p className="kw-tile-title">{title}</p>
      <p className="kw-tile-value">{pct(p.value)}</p>
      <p className="kw-tile-detail">
        {p.k} of {p.n}
        {p.ci95 ? ` (95% CI ${pct(p.ci95[0])} to ${pct(p.ci95[1])})` : ""}
      </p>
      {benchmark !== undefined && <p className="kw-tile-detail">Published symptom checkers: {pct(benchmark)}</p>}
      {note && <p className="kw-tile-detail">{note}</p>}
    </div>
  );
}

export function Evaluation({ rules, cases, benchmarks }: EvaluationProps) {
  const result = useMemo(() => runEvaluation(rules, cases), [rules, cases]);
  const [set, setSet] = useState<"all" | CaseSet>("all");
  const [onlyDiff, setOnlyDiff] = useState(false);

  const metrics: Metrics | undefined = set === "all" ? result.total : result.bySet[set];
  const rows = result.rows.filter((r) => (set === "all" || r.set === set) && (!onlyDiff || !r.agree));
  const showBenchmark = benchmarks !== undefined && set === "external";

  return (
    <section className="kw-screen" aria-labelledby="kw-eval-title">
      <h1 id="kw-eval-title">Evaluation</h1>
      <p className="kw-note">
        Results are reported as obtained. Rules are never changed to improve a metric; only programming errors are corrected.
      </p>

      <div className="kw-filters">
        <label htmlFor="kw-set">Cases</label>
        <select id="kw-set" value={set} onChange={(e) => setSet(e.target.value as "all" | CaseSet)}>
          <option value="all">All ({result.rows.length})</option>
          {(Object.keys(result.bySet) as CaseSet[]).map((s) => (
            <option key={s} value={s}>{SET_LABEL[s]} ({result.bySet[s]!.n})</option>
          ))}
        </select>
        <label>
          <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} /> Discrepancies only
        </label>
      </div>

      {metrics ? (
        <div className="kw-tiles">
          <Tile
            title="Triage accuracy"
            p={metrics.accuracy}
            benchmark={showBenchmark ? benchmarks?.triageAccuracy : undefined}
            note={`Answered cases only: ${pct(metrics.accuracyAnswered.value)} (${metrics.accuracyAnswered.k} of ${metrics.accuracyAnswered.n})`}
          />
          <Tile
            title="Emergency sensitivity"
            p={metrics.emergencySensitivity}
            benchmark={showBenchmark ? benchmarks?.emergencySensitivity : undefined}
            note="Emergencies classified as emergency; an abstention counts as a miss"
          />
          <div className="kw-tile">
            <p className="kw-tile-title">Cohen's kappa</p>
            <p className="kw-tile-value">{num(metrics.kappa)}</p>
            <p className="kw-tile-detail">All cases, abstention as its own category</p>
            <p className="kw-tile-detail">Answered cases only: {num(metrics.kappaAnswered)}</p>
          </div>
          <Tile title="Abstentions" p={metrics.abstentionRate} note='Cases answered with "insufficient data"' />
        </div>
      ) : (
        <p>No cases in this set.</p>
      )}
      {showBenchmark && <p className="kw-hint">Comparison values: {benchmarks!.source}.</p>}
      {benchmarks !== undefined && set !== "external" && (
        <p className="kw-hint">Published comparison values apply to the external cases only. Select "External" to see them.</p>
      )}
      {set !== "external" && result.exactLevel.n > 0 && (
        <p className="kw-hint">
          Exact agreement on the five KAWSAY levels (cases with a level reference): {pct(result.exactLevel.value)} ({result.exactLevel.k} of {result.exactLevel.n}).
        </p>
      )}

      <div className="kw-table-wrap">
      <table className="kw-table">
        <caption>
          {rows.length} case{rows.length === 1 ? "" : "s"} shown
        </caption>
        <thead>
          <tr>
            <th scope="col">Case</th>
            <th scope="col">Set</th>
            <th scope="col">Reference</th>
            <th scope="col">KAWSAY</th>
            <th scope="col">Rule</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.agree ? undefined : "kw-diff"}>
              <th scope="row">
                {r.id}
                {r.title ? <span className="kw-case-title"> {r.title}</span> : null}
              </th>
              <td>{SET_LABEL[r.set]}</td>
              <td>{r.refLevel ? `${LEVEL_LABEL[r.refLevel]} (${r.refCategory})` : r.refCategory}</td>
              <td>
                {LEVEL_LABEL[r.appLevel]} ({r.appCategory})
                {r.missingFields.length > 0 ? <span className="kw-case-title"> missing: {r.missingFields.join(", ")}</span> : null}
              </td>
              <td>{r.ruleId}</td>
              <td>{r.agree ? "Match" : r.appCategory === "abstain" ? "Abstained" : "Mismatch"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </section>
  );
}
