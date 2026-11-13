# KAWSAY – Earth-independent crew health decision support

Team KUNTUR X (Lima, Peru) · NASA Space Apps Challenge 2026 ·
Challenge: *Create Health Monitoring Software for Astronauts on Space Missions*

KAWSAY helps a space crew make first health decisions when an answer from Earth is
minutes away and evacuation is not possible. It is a decision-support tool. It is not
a diagnostic system and not a certified medical device. All crew data in this project
are synthetic and labelled as simulated.

## Repository

| Path | Content |
| --- | --- |
| `kawsay-core/` | Rule engine, triage screen (Event / Triage), evaluation screen, metrics, automated tests and the clinicians' workbook. Start with `kawsay-core/README.md` |
| `AI_USAGE.md` | Log of every use of AI tools, and the declaration of pre-existing work |

The app shell, the synthetic-data pipeline and the remaining screens are added during
the hackathon.

## Current status

The engine, the metrics, the case runner and screens 4 and 6 are implemented and pass
their automated tests using abstract, non-clinical test data. The clinical content
(rules, thresholds, action texts, sources and evaluation cases) is written and reviewed
by the team's physicians and is not in the repository yet. No evaluation result exists
until the real cases are run; results will be reported as obtained.
