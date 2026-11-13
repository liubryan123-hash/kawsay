# External review log

## Round 1 - 2026-11-12 - engine.ts and metrics.ts (reviewer: ChatGPT)

| # | Observation | Classification | Outcome |
| --- | --- | --- | --- |
| 1 | End-of-walk abstention fires when pending rules are less severe than rules already false | Not applicable | With no match the level is `insufficient` either way; pending rules only set `reason` and `missingFields`. Covered by a new test |
| 2 | `onMissing: "skip"` leaves little trace of the risk | Useful improvement | Result now lists `skipped` rules; screen 4 shows them; `check-data` prints a notice per `skip` rule, stronger on emergency rules |
| 3 | `emergent` vs `emergency` naming could zero the sensitivity denominator | Not applicable | Level `emergency` maps to category `emergent` by the plan's fixed mapping (`levelToCategory`, not in the reviewed fragment). Covered by a new test |
| 4 | Population of `kappaAnswered` unclear | Useful improvement | Same population, now one explicit filter (neither side abstains), with a test |
| 5 | Primary accuracy treats abstentions correctly | No action | - |

No confirmed errors. No clinical content was changed.

Open risk kept for the clinicians: which rules may use `onMissing: "skip"`.
