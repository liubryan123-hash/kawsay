# KAWSAY core: rule engine, triage screen, evaluation screen and metrics

Part of **KAWSAY – Earth-independent crew health decision support** (team KUNTUR X,
NASA Space Apps Challenge 2026). Owner of this part: Yeremi Camacho.

KAWSAY is a decision-support tool. It is not a diagnostic system and not a certified
medical device. All crew data in the project are synthetic and labelled as simulated.

## What is here

| Path | Content |
| --- | --- |
| `src/core/engine.ts` | Rule engine: most severe rule first, first match wins, abstention on missing data |
| `src/core/validate.ts` | Checks for `rules.json`, `fields.json` and `cases.json` before they reach the app |
| `src/core/metrics.ts` | Triage accuracy, emergency sensitivity, Cohen's kappa, abstention rate |
| `src/core/evaluation.ts` | Automatic case runner (reference vs app output) |
| `src/core/latency.ts` | Latency clock for the 6 / 24 / 44 minute scenarios |
| `src/ui/EventTriage.tsx` | Screen 4, Event / Triage |
| `src/ui/Evaluation.tsx` | Screen 6, Evaluation |
| `data/*.template.json` | The 20 rule slots and the field catalogue from the Execution Plan, with clinical content marked `PENDING` |
| `data/KAWSAY_clinical_content.xlsx` | Workbook the clinicians fill in (sheets Rules, Fields, Cases); no JSON editing |
| `scripts/workbook.ts`, `scripts/import-workbook.ts` | Convert that workbook to `fields.json`, `rules.json`, `cases.json` and validate them |
| `fixtures/` | Abstract, non-clinical data used only by the tests and the preview |
| `docs/SPEC.md` | Data formats and engine behaviour |
| `docs/METRICS_PREREGISTRATION.md` | Metric definitions to be signed before the cases are run |

The core has no runtime dependencies and makes no network calls, so it works offline.

## Recording check-in

The preview also opens a Spanish recording-only check-in (simulated data), with
confirmation, browser-local history and JSON export. Run `npm run demo` and
`npm run serve-demo`, then open http://127.0.0.1:4173. See
[LOCAL_CHECKIN.md](docs/LOCAL_CHECKIN.md) for the data contract and limitations.
It does not invoke the triage engine or introduce clinical thresholds.

## Use

```bash
npm install
npm test                 # 55 unit and screen tests
npm run typecheck
npm run import-workbook                     # Excel -> data/*.json, then lists what is missing
npm run check-data -- --dir data            # draft mode: pending content is a warning
npm run check-data -- --dir data --strict   # release mode: pending content is an error
npm run evaluate -- --dir data              # runs all cases, prints metrics and discrepancies
npm run demo             # builds demo/kawsay-screens-preview.html (fixtures only)
```

`check-data` and `evaluate` read `fields.json`, `rules.json` and `cases.json` from the
folder given with `--dir`. `import-workbook` creates those three files from the Excel
workbook. The workbook itself is regenerated with `python3 scripts/make_workbook.py`
(needs openpyxl); the importer uses the dev dependency `exceljs` (MIT licence).

## Integration in the Next.js app

Copy `src/core` and `src/ui` into the app and import the JSON data:

```tsx
import { EventTriage } from "@/ui/EventTriage";
import { Evaluation } from "@/ui/Evaluation";
import "@/ui/kawsay.css"; // neutral styles; replace with the app's design
import rules from "@/data/rules.json";
import fields from "@/data/fields.json";
import cases from "@/data/cases.json";
import benchmarks from "@/data/benchmarks.json";

<EventTriage fields={fields} rules={rules} onResult={(event) => saveForEarthPacket(event)} />
<Evaluation rules={rules} cases={cases} benchmarks={benchmarks} />
```

- `onResult` delivers `{ at, input, result }` for each assessment, so screen 5
  (Earth Packet) can store and export it.
- The engine reads NEWS2 values (`news2.total`, `news2.max_param_score`) as inputs.
  It does not compute NEWS2; that comes from the data pipeline.
- Both components are client components and need no server.

## Integrity rule

The evaluation result is reported as obtained. Only programming errors are corrected;
rules are never edited to raise a metric. `npm run evaluate` prints the SHA-256 of
`rules.json` and `cases.json` so the frozen versions can be recorded with the results.

## Status and limits

- Engine, validators, metrics, case runner and both screens are implemented and tested
  with abstract fixtures.
- The clinical content (levels, actions, alert texts, sources with section, some
  thresholds) is not in this repository yet. `check-data --strict` lists what is missing.
- The abstention policy and the metric definitions are proposals until the clinicians
  sign them (see `docs/`).
- Prior work and AI assistance are declared in `AI_USAGE.md` at the repository root.
- `docs/TEST_REPORT.txt` lists every automated test and its result.
