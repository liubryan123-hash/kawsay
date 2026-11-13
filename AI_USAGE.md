# AI usage log

Every use of an AI tool by any team member is recorded here, with the tool and what it was used for.

| Date | Tool | Used for | Human check |
| --- | --- | --- | --- |
| 2026-11-12 | Claude (Anthropic), model Claude Fable 5.2 | Review of the Execution Plan; proposal of the JSON formats for rules, fields and cases | Yeremi Camacho |
| 2026-11-12 | Claude (Anthropic), model Claude Fable 5.2 | Drafting of the TypeScript rule engine, data validators, metrics, case runner, screens 4 and 6, unit tests and technical documentation in `kawsay-core/` | Yeremi Camacho (pending: read and run before use) |
| 2026-11-12 | Claude (Anthropic), model Claude Fable 5.2 | Clinicians' Excel workbook layout (empty of clinical content) and its importer; task list taken from the Execution Plan; first draft of the submission form text | Yeremi Camacho (pending) |
| 2026-11-12 | ChatGPT (OpenAI) | External code review of the engine and metrics fragments (one round; outcome in `kawsay-core/docs/REVIEW_LOG.md`) | Yeremi Camacho |

| 2026-11-13 | ChatGPT / Codex (OpenAI) | Recording-only functional check-in, typed data catalogue, browser persistence, confirmation/history UI, tests and local demo workflow | Pending team review via pull request; no clinical rules or recommendations added |

Notes for the submission form:

- No clinical rule, threshold, action text or source was written by an AI tool. The
  clinical content comes from the team's clinicians and the cited sources.
- No AI-generated images or video are part of this repository so far.
- The contents of `kawsay-core/` were drafted on Thursday 12 November 2026, before the
  hackathon start. They are pre-existing work and must be listed as such in the project's references.
