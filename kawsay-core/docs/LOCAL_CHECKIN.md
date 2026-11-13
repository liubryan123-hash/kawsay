# Local check-in — recording prototype

This contribution covers collection and persistence only. It does not run triage,
compute NEWS2, infer a diagnosis, or implement a validated functional scale.
The existing Event / Triage and Evaluation tabs retain their abstract fixtures.

## Try it

From `kawsay-core`:

```sh
npm ci
npm test
npm run typecheck
npm run demo
npm run serve-demo
```

Open http://127.0.0.1:4173 in the same browser for subsequent visits.
Stop the server with Ctrl+C. The demo is built into one HTML file; serving it gives
browser storage a stable origin. Direct `file://` storage is browser-dependent.

1. Select DEMO-01 through DEMO-04.
2. Enter a measurement or a functional/symptom response; other fields may stay pending.
3. Review the snapshot, including missing fields. Return to edit if needed.
4. Confirm and save; expand the history record.
5. Reload and inspect the same record. Export the JSON as a portable copy.

Only synthetic data: this prototype stores unencrypted browser data, without
authentication, multi-device coordination, retention management or clinical deployment
controls. Clearing site data removes the history. No data are transmitted.

## Data contract

- `schemaVersion: 1`, `catalogVersion: checkin-v1`, `synthetic: true`.
- Generated record ID and closed simulated crew ID.
- `observedAt`: local input converted to ISO UTC; all current measurements/symptoms
  in one record refer to this moment. Sleep hours cover the preceding 24 hours.
- `recordedAt`: actual save time, separately from observation.
- `answers`: flat dictionary using stable dot-path IDs and typed values.
- Boolean absence is `false`; an unassessed value is omitted, never silently false.
- No raw vital is labelled normal or abnormal. Numeric checks cover format and
  structural bounds only (e.g. percentages); they are not clinical alert thresholds.

Catalogue and questions are in `src/checkin/catalog.ts`. Fields whose meaning is
already shared use existing paths such as `symptoms.dyspnea`. New paths are not
automatically added to the triage catalogue or rules. Integration with the clinical
pipeline requires an explicit mapping, clinical review and tests.

## Persistence

`src/checkin/storage.ts` provides a small adapter using `getItem` and `setItem`.
The UI supplies localStorage. SQL/IndexedDB can be introduced behind a new adapter
without placing storage logic in the clinical engine.

Reads validate every record and reject corrupt/incompatible history. Writes re-read
history before appending, reject duplicate IDs, and surface quota/access failures.
A damaged history is not overwritten; failed writes leave the review available for
retry. This prototype targets one browser tab; simultaneous writers need a
transactional store in a later version.

## Checks

`tests/checkin.test.tsx` covers confirmation, missing vs negative answers,
remount/recovery, invalid inputs, editing, failed-save retry and corrupted history.
`npm run test:checkin-smoke` checks the model and storage with Node 24 only,
without npm dependencies. It supplements, not replaces, the React/type checks.
