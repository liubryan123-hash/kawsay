# KAWSAY · Reunión de integración de las 22:30

13 de noviembre de 2026 · hora de Perú · Preparación de Liu Bryan Cayllahua Huaringa.

## Objetivo de salida

Cerrar un recorrido principal, asignar responsables y fijar un punto de integración. No presentar como terminados el producto completo, la validación clínica ni el servidor compartido.

## Primera decisión: elegibilidad del trabajo previo

La aclaración oficial del GO Team de NASA Space Apps indica que el trabajo del proyecto debe comenzar el sábado 14 de noviembre de 2026 a las 09:00, hora local del evento, y que adelantarlo puede conducir a descalificación. Antes permite elegir reto, revisar recursos, investigar y formar equipo. Esto es más restrictivo que asumir que basta declarar el código previo.

Fuentes consultadas:

- Paula-GO-Team, respuesta del 5 de noviembre de 2026: https://github.com/nasa/spaceapps/discussions/1827
- Madison-GO-Team, aclaración del 13 de noviembre de 2026: https://github.com/nasa/spaceapps/discussions/2009

El prototipo y los commits previos al inicio deben conservar su fecha e historial reales. No afirmar que declararlos autoriza su reutilización ni presentarlos como desarrollo realizado durante el evento. La primera tarea del equipo es consultar a los organizadores, describiendo el trabajo ya realizado, y obtener indicación expresa sobre cómo proceder. No se ha enviado esa consulta en nombre del equipo. La orientación anterior del asistente sobre que la declaración era suficiente queda corregida.

Hasta aclararlo, el recorrido de abajo sirve como inventario interno del trabajo existente; no implica autorización para usarlo como entrega elegible ni para seguir implementándolo antes del inicio.

## Qué mostrar en 7 minutos

Abrir `kawsay-core/demo/kawsay-simulador.html` actualizado. El archivo anterior `kawsay-screens-preview.html` es otra demo y no muestra este recorrido.

| Tiempo | Acción | Qué explica Bryan |
|---|---|---|
| 0–1 min | Tripulación, día 19 y luego día 20 | Los cuatro JSON alimentan la interfaz; el puntaje sale de la toma seleccionada |
| 1–2 min | Evolución de A, día 20 | Gráficos de 7 días, línea base estadística, desglose NEWS2 y fuentes |
| 2–3 min | Earth Packet, misión, A, día 20, hora 23 | Resumen de 24 h, máximo real calculable y descargas CSV/JSON |
| 3–4 min | Registro de A: SpO₂ 97%, un síntoma ausente y comentario ficticio | Faltantes distintos de negativos, revisión antes de guardar |
| 4–5 min | Panel médico: desplegar registro y guardar una observación | Revisión vinculada a ese registro y separada del diagnóstico |
| 5–6 min | Casco: origen Local; solicitar apoyo a B | Solicitud manual y estado pendiente de recepción |
| 6–7 min | Confirmar medicina, cambiar a B y confirmar compañero; cerrar desde medicina | Dos confirmaciones distintas; Earth Packet Local incluye acciones |

Si el caso de Ana muestra 5–6 o 7–8 en lugar de 5 y 7 exactos, explicar la contribución adicional de PAS en algunas tomas. No alterar datos para ajustar el guion.

## Estado y evidencia

| Pieza | Estado |
|---|---|
| Generador y 4 JSON de 30 días | Implementados y probados |
| Resumen, gráficos, registro, casco, revisión y apoyo | Conectados en un navegador |
| NEWS2 escala 1 y motor existente | Cálculo/ensayo técnico; reglas D-* sin firma clínica |
| Earth Packet | 24 h, CSV/JSON, unidades y acciones; cola representada sin transporte |
| Regresión del núcleo, TypeScript y generador | CI previo aprobado, commit 328c3b0 |
| Recorrido DOM | CI previo aprobado; se amplió para probar aislamiento de borradores por tripulante |
| Auditoría de esta preparación | 18 pruebas locales aprobadas y CI completo aprobado para 3f3f11c, incluido recorrido DOM ampliado: https://github.com/liubryan123-hash/kawsay/actions/runs/43550498514 |
| Inspección visual y prueba manual de descarga/recarga | Pendientes en el navegador del usuario |
| PR #1 | Abierto; GitHub informa dirty/mergeable=false, aunque la base sigue siendo 6d5bc63 y la rama deriva de ella; revisar con Rodrigo/Yeremi antes de fusionar |

Errores corregidos en esta preparación: (1) borradores independientes A–D al cambiar de perfil, sin reasignar respuestas a otro tripulante; (2) criterios del ensayo manual incluidos en Earth Packet Local. Se añadieron comprobaciones de regresión.

## Decisiones que deben salir de la reunión

| Decisión | Propuesta concreta para discutir | Quién debe cerrarla |
|---|---|---|
| Funcionalidad principal | Registro → evolución → revisión → apoyo → reporte; priorizar un recorrido estable | Todo el equipo |
| Interfaz final | Rodrigo elige qué parte integrar a su panel; este simulador sirve como referencia funcional | Bryan y Rodrigo |
| Contrato | A–D; valores numéricos/unidades; UTC interno y America/Lima visible; faltantes explícitos | Bryan, Rodrigo y responsable del motor |
| Contenido clínico | Revisar preguntas, fuentes, acciones y criterios; no convertir las D-* en aprobadas sin revisión | Claudia y Milagros |
| Aptitud EVA | Definir datos necesarios y cómo tratar alteraciones de días previos; por ahora «no determinada» | Equipo clínico |
| Trabajo previo e IA | Declarar archivos, tareas, herramientas y revisión; confirmar condiciones oficiales con organizadores | Coordinación y equipo |
| Integración del PR | Revisar discrepancia del estado de fusión; mantener cambios propios y ajenos | Bryan y responsable del repositorio |
| Siguiente corte | Hora, responsable por archivo y definición comprobable de terminado | Todo el equipo |

El reparto comentado en WhatsApp —Bryan/Rodrigo programación; Milagros/Claudia investigación y guion; Yeremi visuales— se registra como propuesta reciente para confirmar, no como reasignación unilateral.

## Lo que no debemos prometer

- Las pruebas del software no equivalen a 60 casos clínicos evaluados ni a validación clínica.
- El promedio ±2 DE describe el dataset; no define automáticamente salud normal.
- El sensor, los roles, la red y el envío de avisos son simulados.
- La confirmación en una bandeja no prueba entrega real a un dispositivo.
- No hay todavía API/SQL multiusuario, PVT interactivo ni diagnóstico automático.
- El código previo y la ayuda de IA deben declararse; no inventar porcentajes ni ocultar aportes.

## Agenda acordable: 22:30–00:00

| Bloque | Minutos |
|---|---:|
| Avance verificable de cada integrante | 10 |
| Demo del recorrido y observaciones | 15 |
| Integración técnica | 20 |
| Contenido clínico, fuentes y pendientes | 20 |
| Alcance de mañana y responsables | 15 |
| Registro de acuerdos y siguiente corte | 10 |

## Acta para completar durante la llamada

- Funcionalidad principal elegida: **pendiente**.
- Rama/interfaz que usaremos: **pendiente**.
- Contrato de entrada/salida confirmado por: **pendiente**.
- Reglas/fuentes clínicas aceptadas y quién revisó: **pendiente**.
- Responsable y fecha de cada pendiente: **pendiente**.
- Condición verificable para la próxima demo: **pendiente**.
- Próximo corte de integración: **pendiente**.

No se enviaron mensajes al grupo ni se aceptaron decisiones en nombre de sus integrantes.
