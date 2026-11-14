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

Integration update: ChatGPT / Codex assisted with the 30-day JSON consumer,
mission charts, scale-1 NEWS2 arithmetic checked against RCP, an adapter reusing
the existing engine, Earth Packet CSV/JSON, technical tests and documentation.
Demonstration rules D-* are unreviewed and explicitly labelled as technical trials,
not approved clinical recommendations. Clinical action protocols, mission thresholds and sign-off remain
pending. No clinical validation results or team identities were invented.

Actualización del simulador: ChatGPT / Codex ayudó a implementar las vistas locales
en español (registro, casco, revisión médica y apoyo), el contrato simulado, las
pruebas técnicas y el informe de avance. Las preguntas funcionales son propuestas
de interfaz pendientes de revisión del equipo; no constituyen una escala validada.
Los valores generados son ficticios y no activan reglas clínicas. Revisión humana pendiente.

- The initial engine used abstract fixtures. Later AI-assisted code translated the
  guide's scenarios and the cited RCP scoring table into unreviewed demonstration
  criteria and NEWS2 arithmetic. These are not signed clinician-authored rules;
  clinical action text and approval still require the team's clinicians.
- No AI-generated images or video are part of this repository so far.
- The initial engine, metrics and screens 4/6 were drafted on Thursday 12 November
  2026 before the hackathon start and must be declared as pre-existing work. The
  check-in, generator and integrated simulator were added in the subsequent session
  recorded above; do not classify those additions as the original pre-existing core.
