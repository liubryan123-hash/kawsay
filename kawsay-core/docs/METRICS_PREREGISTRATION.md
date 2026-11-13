# Evaluation metrics: definitions fixed before running the cases

Status: **DRAFT, not signed.** To be agreed and dated by the team before any case is
run through the engine. After signing, these definitions do not change.

## Cases

- External: the published vignettes of Semigran et al. (BMJ 2015;351:h3480), subject
  to the licence check. Planned: 45. Fallback fixed in the Execution Plan: 10 external
  cases run by hand plus the 15 space cases.
- Space: 15 cases written, dated and externally reviewed before any code is written.

## Categories

KAWSAY levels are compared with the reference in three categories, as fixed in the
Execution Plan: emergency = emergent; priority or scheduled = non-emergent;
follow-up = self-care. `insufficient` is an **abstention**.

A case is **correct** when the app's category equals the reference category. An
abstention is correct only when the reference is also `insufficient`.

## Metrics

Let N be the number of cases, A the number of app abstentions, C the number of correct
cases, E the number of cases whose reference is emergent, and E_hit those of E that the
app classified as emergency.

| Metric | Formula | Role |
| --- | --- | --- |
| Triage accuracy | C / N | Primary. Abstentions count against the app |
| Triage accuracy, answered cases | correct among answered / (N − A) | Secondary, always shown next to the primary |
| Emergency sensitivity | E_hit / E | Primary. An abstention on an emergency is a miss |
| Abstention rate | A / N | Primary |
| Cohen's kappa | (p_o − p_e) / (1 − p_e), unweighted | Primary: all N cases, abstention as its own category |
| Cohen's kappa, answered cases | same formula | Secondary: cases where neither side abstains, three categories |
| Exact five-level agreement | cases with identical level / space cases | Secondary, space cases only |

- p_o = C / N. p_e = Σ over categories of (reference share × app share).
- Proportions are reported with counts and 95% Wilson score intervals.
- Every metric is reported for all cases, for the external set and for the space set.
- Kappa is reported as "n/a" when it is undefined (p_e = 1).

## Comparison values

Semigran et al. report appropriate triage advice in 57% (95% CI 52% to 61%) of
standardized patient evaluations and in 80% (75% to 86%) of emergent cases
(abstract of the paper). The Execution Plan cites 58%; the value shown in the app must
be confirmed against the paper by Milagros.

Limits of the comparison, to be stated wherever the numbers are shown:

- Those figures are averages over 23 symptom checkers, counted over the evaluations
  where a checker gave triage advice. They are compared with KAWSAY's result on the
  external set only.
- The vignettes describe terrestrial care. KAWSAY's rules cover a closed list of
  conditions, so abstentions on vignettes outside that list are expected and are
  reported, not hidden.

## Integrity

- The result is reported as obtained.
- After the first full run, only programming errors may be corrected. Each correction
  is recorded with the case that exposed it. Rules, thresholds and references are not
  edited to change a metric.
- The SHA-256 of `rules.json` and `cases.json` printed by `npm run evaluate` is
  recorded here at freeze time.

## Open points to close before signing

1. Confirm primary versus secondary definitions above (abstentions counted against
   the app).
2. The plan lists a fifth metric, "critical actions done before the reply arrives".
   It has no definition yet. Define it or remove it from the submission text.
3. Confirm the comparison value (57% or 58%).

| | Name | Date |
| --- | --- | --- |
| Clinician 1 | | |
| Clinician 2 | | |
| Engineering | | |

Frozen `rules.json` SHA-256:

Frozen `cases.json` SHA-256:
