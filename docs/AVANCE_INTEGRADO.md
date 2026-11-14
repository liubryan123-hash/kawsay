# Avance integrado y entrega para revisión

Sesión del 13 de noviembre de 2026, hora de Perú. Aporte de Liu Bryan Cayllahua Huaringa. Esta es la actualización vigente del informe de implementación; `SIMULADOR_Y_AUDITORIA.md` describe el estado previo.

## Resultado

Preparación de la reunión: [REUNION_2230.md](REUNION_2230.md) incluye guion, auditoría y decisiones a cerrar. Se corrigió el aislamiento de borradores al cambiar de tripulante y la inclusión de criterios manuales en Earth Packet Local; el conjunto local pasa ahora 18 pruebas y se amplió el recorrido DOM de regresión.

El simulador consume los cuatro JSON del generador e integra ocho vistas: Tripulación, Evolución, Registro, Visor del casco, Panel médico, Compañero de apoyo, Earth Packet y Avance y límites. Todo se incluye en un HTML autónomo, generado con Node 24, sin dependencias npm para el build básico.

### Datos y seguimiento

- Tripulación muestra A–D, última toma del día/hora seleccionado, NEWS2 calculado, CO₂ horario del módulo e indicadores descriptivos.
- Evolución muestra cuatro gráficos horarios de los últimos siete días y la franja estadística promedio ±2 DE. No la llama rango clínico normal. Antes de completar los siete primeros días no muestra la línea base.
- Se usa la cronología ficticia 1–30 de octubre de 2026, zona America/Lima. Los índices del selector son 0–29, como en el generador. No es la fecha real de una misión.
- La serie histórica y los registros actuales permanecen diferenciados. El visor permite elegir origen; no se mezclan mediciones de distintos momentos.
- Los reportes locales conservan confirmación, revisión médica y circuito manual de apoyo del simulador anterior.

### NEWS2 y motor

Se implementó el cálculo de NEWS2 escala 1 con la tabla del Royal College of Physicians. Requiere FC, FR, SpO₂, PAS, temperatura, estado de alerta/confusión nueva, oxígeno suplementario y confirmación de escala 1. Falta de datos/contexto, fracciones ambiguas o selección de otra escala producen puntaje sin calcular. La selección de escala 2 y la adaptación a objetivos individuales no están implementadas.

El build reutiliza `src/core/engine.ts` mediante la eliminación de tipos de Node 24; no crea un segundo motor con lógica distinta. El motor recibe el registro manual o la toma del dataset y conserva su política de datos desconocidos.

Las reglas `D-*` son ensayos técnicos sin firmas clínicas. Incluyen puntuación NEWS2 y el escenario de dolor de pecho descrito por la guía; la fuente clínica específica del protocolo de dolor de pecho sigue pendiente. Las acciones indican que falta aprobación del equipo, en lugar de inventar tratamiento. El resultado se presenta como ensayo, no como triaje clínico aprobado. La ausencia de reglas activadas no se transforma en autocuidado.

Hallazgo de integración: los valores de Ana del día 19 producen 5–6 y los del día 20 producen 7–8 según la presión sistólica de la toma. La guía cambia otros signos pero conserva ruido en PAS, que puede aportar un punto adicional. No se modificaron los datos ni las reglas para forzar una cifra del guion.

### Historias de la guía

| Historia | Disponible | Límite |
|---|---|---|
| Ana, días 18–20 | Serie, gráficos, NEWS2 y ensayo del motor | Adaptación operativa a misión pendiente de revisión clínica |
| Ben, días 10–14 | Sueño, KSS y PVT simulado, indicador descriptivo | No autoriza ni deniega EVA automáticamente |
| Ben, día 15 | EVA programada y acceso al historial previo | La guía no define política de arrastre del deterioro previo |
| Carla, día 22 | CO₂ horario 3,6 y síntoma diario | No se inventa promedio móvil ni hora de inicio del síntoma |
| Diego, día 25 | Discordancia descriptiva con FC/FR >+2 DE | El umbral descriptivo no es un diagnóstico validado |
| Dolor de pecho manual | El dato llega al motor y activa D-CHEST | Protocolo y fuente clínica específica pendientes |

## Earth Packet

La pantalla 5 genera un paquete por tripulante con ventana de 24 h `(inicio, fin]`, dos modos de origen y exportaciones JSON/CSV:

- **Misión:** usa el día/hora seleccionado; contiene tomas horarias, NEWS2 máximo calculable, check-ins diarios relacionados, indicadores y fuentes de los ensayos.
- **Local:** usa las últimas 24 h actuales; incluye registros manuales/simulados, check-ins, revisiones y solicitudes/confirmaciones de apoyo. Las acciones se filtran por su propia fecha, aunque el evento se haya creado antes de la ventana.
- Ambos modos conservan faltantes; si no hay puntajes completos, el máximo es `null`, nunca cero inventado.
- El JSON contiene unidades, procedencia, contexto, ventana y versión. El CSV conserva secciones de resumen, mediciones, check-ins, indicadores, alertas y acciones, con celdas escapadas y protección frente a prefijos de fórmulas.
- Estado visible: «En cola — se enviará cuando el enlace con Tierra esté disponible». `transmitted: false` y `transportImplemented: false`: es una representación de cola, no un transporte real ni una confirmación de envío.

Las revisiones locales actuales no se insertan artificialmente en la cronología histórica. Por eso un paquete histórico puede tener cero acciones médicas locales; se puede demostrar su inclusión con el modo Local.

## Verificación

Comandos desde `kawsay-core`:

```sh
node scripts/build-simulator.mjs
node --test simulator/domain.test.mjs simulator/mission.test.mjs
node --check simulator/app.mjs
```

Son 17 pruebas de dominio/render/build: nueve previas y ocho de integración. Incluyen bordes NEWS2, abstención por datos pendientes, las cuatro historias calculadas desde JSON, ventana de 24 h, máximo real, filtrado por tripulante, revisión y ciclo de ayuda. El smoke de DOM `npm run test:simulador-ui` usa jsdom y recorre misión → gráficos → paquete → ingreso manual → revisión → casco → apoyo → paquete local. Requiere las dependencias del núcleo; está incorporado al CI.

La prueba de DOM no equivale a inspección visual, prueba de accesibilidad ni validación clínica. La verificación visual en el navegador del usuario y la prueba en modo avión/celular siguen pendientes. La sesión local tiene restricciones de conexión y de apertura automatizada de archivos; no se las presenta como checks aprobados.

## Guion de presentación

1. Abrir Tripulación; seleccionar día 19 y luego día 20. Mostrar el cálculo de Ana y el desglose en Evolución.
2. Seleccionar Ben, día 12: revisar sueño/KSS/PVT; pasar a día 15 y explicar por qué aún no se declara aptitud EVA.
3. Seleccionar Carla, día 22, hora 11: ver CO₂; Diego, día 25: mostrar discrepancia descriptiva.
4. Abrir Earth Packet de Ana en día 20, hora 23 y descargar ambos formatos.
5. Registrar un reporte ficticio, confirmar, consultar casco y guardar revisión médica.
6. Activar ayuda de simulacro; confirmar medicina y compañero; cerrar. Exportar Earth Packet Local para mostrar las acciones.

## Cumplimiento de prioridades

| Prioridad | Resultado |
|---|---|
| Consumir cuatro JSON y seleccionar tripulante/día | Implementado |
| Resumen de tripulación y evolución con gráficos | Implementado; aptitud no determinada |
| Earth Packet de 24 h, CSV/JSON y cola visible | Implementado; transporte no implementado |
| Cálculo NEWS2 y conexión al motor existente | Implementado como ensayo técnico |
| Reglas clínicas y acciones firmadas | Requieren cierre del equipo médico |
| Recorrido técnico integrado | Pruebas locales y smoke DOM en CI; inspección visual pendiente |
| Documentación y publicación del aporte | Fuentes, README e informe preparados; registrar el commit/CI al publicar |

## Pendientes de equipo y siguientes etapas

Se necesita confirmar fuentes, textos de acción, firmas de reglas, preguntas, objetivos individuales y política EVA. La guía menciona 60 casos y seis integrantes, mientras la conversación describe cinco: deben reconciliarse los entregables y el roster, sin inventar nombres ni resultados.

PVT interactivo, KSS como instrumento con sus textos revisados, aplicación PWA probada en modo avión, traducción al inglés para jurado, app/video publicados y los 60 casos clínicos no se declaran completados. El usuario ha elegido español como base del producto; la versión inglesa se mantiene como entregable de presentación a acordar.

Servidor multiusuario, SQL, autenticación, protección de red, dispositivos reales, LLM y grafos quedan fuera de esta entrega local. La carpeta de trabajo continúa en Documents/Codex; Escritorio/proyect nasa todavía requiere preparación por el usuario.
