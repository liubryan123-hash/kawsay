# KAWSAY – Earth-independent crew health decision support

> Trabajo previo al inicio oficial: elegibilidad pendiente de aclaración con los
> organizadores. El GO Team advierte que empezar el proyecto antes del 14 de
> noviembre a las 09:00 locales puede causar descalificación. Declarar este código
> no garantiza que pueda usarse en el concurso. Véase [la nota de reunión](docs/REUNION_2230.md#primera-decisión-elegibilidad-del-trabajo-previo)
> y [la aclaración oficial](https://github.com/nasa/spaceapps/discussions/1827).

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

The repository includes a reproducible synthetic-data pipeline, a standalone Spanish
mission simulator, the rule engine and the abstract-fixture triage/evaluation preview.

## Simulador integrado en español

Desde `kawsay-core`, ejecutar `npm run demo:simulador` y abrir
`demo/kawsay-simulador.html` en el navegador. No requiere instalar paquetes ni conexión
para generar el HTML: usa Node.js 24. También se puede servir con
`npm run serve:simulador` en `http://127.0.0.1:4173`.

Incluye resumen A–D, selector de día/hora, gráficos de siete días, registro, casco,
revisión médica, apoyo y Earth Packet de 24 h con CSV/JSON. Consume los cuatro JSON
del generador. Calcula NEWS2 escala 1 cuando hay contexto completo y reutiliza el
motor existente con reglas de ensayo pendientes de firma clínica. Comparte estado
en un solo navegador; servidor multiusuario y transporte a Tierra siguen pendientes.
Implementación y auditoría vigentes: [docs/AVANCE_INTEGRADO.md](docs/AVANCE_INTEGRADO.md).
Pruebas independientes: `npm run test:simulador`.

Con dependencias instaladas (`npm ci`), `npm run test:simulador-ui` comprueba el
recorrido DOM; `npm test` y `npm run typecheck` verifican el núcleo existente.

## Equipo, fuentes y entrega final

Aporte de integración y datos: Liu Bryan Cayllahua Huaringa. El roster completo y
los roles deben confirmarse por el equipo antes del envío: no se sustituyen por nombres
supuestos. [Fuentes y estado de revisión](docs/REFERENCES.md).

App pública y video: enlaces pendientes de publicación/verificación. No se afirma
haber completado el benchmark clínico de 60 casos. El inglés para jurado sigue
pendiente; el idioma base de este prototipo es español por decisión del usuario.

## Check-in anterior

A recording-only check-in with simulated crew IDs, measurements and draft functional
questions is available in the development preview. It includes explicit missing data,
confirmation, local history and JSON export. See [local check-in instructions](kawsay-core/docs/LOCAL_CHECKIN.md).
Clinical interpretation of these new inputs is pending; the existing triage demo still
uses abstract fixtures.

## Current status

The engine, metrics, case runner and screens 4 and 6 are implemented with abstract,
non-clinical test fixtures. The mission simulator adds scale-1 NEWS2 arithmetic and
unreviewed demonstration criteria; it does not contain a signed clinical rule set.
No clinical benchmark result exists until reviewed cases are run. Technical tests
do not constitute clinical validation. See docs/AVANCE_INTEGRADO.md for remaining work.
