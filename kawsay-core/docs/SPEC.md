# Data formats and engine behaviour

Three JSON files drive the engine and both screens. The clinicians own their content;
the code never contains a clinical threshold or text.

## 1. `fields.json`: the closed input catalogue

One entry per item the app can ask for. The form on screen 4 is generated from it, and
rules and cases may only use fields listed here.

```json
{ "path": "symptoms.chest_pain", "label": "Chest pain", "type": "boolean", "group": "Symptoms", "default": false }
{ "path": "news2.total", "label": "NEWS2 total score", "type": "number", "group": "Vital signs (NEWS2)", "min": 0, "max": 20, "step": 1 }
```

- `type`: `boolean`, `number` or `enum` (with `options`).
- `default`: value pre-selected in the form. Without it a boolean starts as
  "Not assessed" and a number starts blank.
- `min` / `max`: plausibility bounds for data entry. They are not clinical thresholds.

## 2. `rules.json`: the 20 rules

```json
{
  "id": "NEWS-01",
  "group": "news2",
  "level": "emergency | priority | scheduled | follow-up | insufficient",
  "order": 10,
  "condition": { "field": "news2.total", "op": "gte", "value": 7 },
  "onMissing": "abstain",
  "action": "Immediate action, in English, written by the clinicians",
  "alertText": "Short alert text, in English",
  "source": { "ref": "Document", "section": "Exact section, table or page" },
  "review": { "by": ["Claudia Pinto", "Milagros Villegas"], "date": "2026-11-13" }
}
```

- Operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `between` (inclusive `[low, high]`),
  `in` (list), `present`.
- Combinators: `{ "all": [...] }`, `{ "any": [...] }`, `{ "not": ... }`, nestable.
- `order` breaks ties inside one level (lower first).
- Exactly one rule has no `condition` and level `insufficient`: the abstention rule
  (DATA-01). Its `action` and `source` are shown whenever the engine abstains.
- `onMissing` says what happens when the rule cannot be evaluated because an input is
  missing: `abstain` (default, the datum is critical) or `skip` (the datum is not
  critical for triage; the rule counts as not matched).

## 3. `cases.json`: evaluation cases

```json
{
  "id": "SPC-01",
  "set": "external | space",
  "title": "Short title",
  "input": { "symptoms": { "rash": true }, "news2": { "total": 0 } },
  "reference": { "level": "follow-up" },
  "provenance": { "author": "...", "dated": "YYYY-MM-DD", "externalReviewer": "..." }
}
```

- External (Semigran 2015) cases give `reference.category`: `emergent`, `non-emergent`
  or `self-care`. Space cases give `reference.level`.
- A field left out of `input` is missing data for the engine. `npm run check-data`
  lists, per case, every catalogue field the case does not provide.

## 4. Engine behaviour

1. Rules are sorted by level (emergency, priority, scheduled, follow-up, insufficient),
   then `order`, then `id`.
2. Each condition evaluates to **true**, **false** or **unknown** (an input it needs is
   absent). `all` is false if any part is false; `any` is true if any part is true;
   otherwise an unknown part makes the condition unknown.
3. The first rule that is true wins, with one exception: if a **strictly more severe**
   rule was unknown (and not marked `skip`), the engine returns `insufficient` and
   lists the missing fields. Missing data can therefore never produce a less urgent
   result than complete data might.
4. If no rule is true, the engine returns `insufficient` (`reason: "missing_data"` when
   some rule was unknown, `"no_rule_matched"` otherwise).

Output:

```json
{
  "level": "insufficient",
  "ruleId": "DATA-01",
  "action": "...", "alertText": "...", "source": { "ref": "...", "section": "..." },
  "reason": "rule_matched | missing_data | no_rule_matched",
  "missingFields": ["news2.total"],
  "blockedBy": ["NEWS-01", "NEWS-02"],
  "skipped": ["APT-01"],
  "provisional": { "ruleId": "ISS-01", "level": "follow-up" },
  "trace": [{ "ruleId": "NEWS-01", "level": "emergency", "result": "unknown", "missing": ["news2.total"] }]
}
```

`skipped` lists the rules that could not be evaluated and were marked `onMissing: "skip"`.
They never block a result, so they are shown on screen 4 under "Not checked", and
`check-data` prints a notice for every rule that uses `skip` (stronger on an emergency rule).

## 5. Decisions that need clinical sign-off

These are engineering proposals. The plan does not define them.

| # | Decision | Proposal implemented | Effect |
| --- | --- | --- | --- |
| 1 | Missing data in a more severe rule | Abstain (point 3 above) | More abstentions, no under-triage from missing data |
| 2 | Which rules use `onMissing: "skip"` | None by default | Readiness and environment rules will force abstention in a triage event unless marked `skip` or their data are always supplied |
| 3 | No rule matches with complete data | Abstain with `no_rule_matched` | Counts as an abstention in the metrics |
| 4 | SpO2 flagged as low perfusion (DATA-02) | Ordinary rule; level chosen by the clinicians | The engine does not discount NEWS2 automatically |
| 5 | Latency scenarios 6 / 24 / 44 min | Read as round-trip delays; milestones at 0, L/2 and L | Label on screen: "Round-trip delay" |

## 6. Screens

**Screen 4, Event / Triage.** Form generated from `fields.json` → "Assess now" → result
card in this order: level, immediate action, data needed (when abstaining), latency
clock, then rule, source and trace notes. The clock shows the countdown to the earliest
possible reply and the three milestones with clock times, which also serves as the
plan's fallback (fixed text for 0, L/2, L).

**Screen 6, Evaluation.** Runs all cases in the browser, offline. Shows the four
metrics with counts and 95% Wilson intervals, a filter by case set, a
"Discrepancies only" filter, and one row per case with reference, app output, rule and
result. Published comparison values appear only for the external set.

## 7. Outside the MVP

Not implemented and not planned for the hackathon: weighted kappa, automatic
de-rating of NEWS2 on unreliable SpO2, rule editing in the app, any machine learning.
The plan's fifth metric ("critical actions done before the reply arrives") is not
implemented because the plan does not define how to measure it.
