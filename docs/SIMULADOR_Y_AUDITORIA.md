# Simulador local y auditoría preliminar del avance

> Estado histórico del primer simulador. La actualización vigente, con datos de misión, NEWS2 y Earth Packet, está en [AVANCE_INTEGRADO.md](AVANCE_INTEGRADO.md).

Fecha de la sesión: 13 de noviembre de 2026, Perú. Responsable del aporte: Liu Bryan Cayllahua Huaringa. Documento técnico de avance; no es validación clínica ni auditoría formal de seguridad.

## Qué se implementó

Un simulador autónomo en español con cinco vistas conectadas por un único estado local:

1. **Registro:** tripulante A–D, hora de Perú, mediciones opcionales, sueño, descanso, dificultad funcional, síntomas y reporte libre. Revisión y confirmación antes de guardar.
2. **Visor del casco:** última toma de ese tripulante, procedencia, fecha y antigüedad, último comentario y solicitud manual de ayuda.
3. **Panel médico:** historial individual, filtros de pendientes y reportes manuales, detalle de respuestas y registro de revisión. Bandeja médica de solicitudes de todos los tripulantes.
4. **Compañero de apoyo:** solicitudes dirigidas al compañero seleccionado y confirmación explícita de recepción, sin mostrar su historial clínico en esa vista.
5. **Avance y límites:** estado real de los componentes y exportación JSON de la simulación.

Las vistas de rol son una representación de interacción, no permisos de seguridad: cualquier usuario de la demo puede cambiar de vista. No introducir información real.

## Abrir y ejecutar

Archivo generado: `kawsay-core/demo/kawsay-simulador.html`. Se abre por doble clic; contiene CSS y JavaScript, sin CDN, imports remotos ni instalación de dependencias.

Para regenerar desde `kawsay-core`:

```sh
node scripts/build-simulator.mjs
node --test simulator/domain.test.mjs
```

También se dispone de `npm run demo:simulador`, `npm run test:simulador` y `npm run serve:simulador`. Este último sirve el simulador en `http://127.0.0.1:4173`; no se deben ejecutar simultáneamente dos servidores sobre ese puerto.

El almacenamiento es localStorage bajo `kawsay.simulador.v1`. La demo anterior usa otra clave y conserva su información; no hay migración automática de los IDs DEMO-01…04. Este simulador usa A–D, en concordancia con el generador. En archivos `file://`, la persistencia depende del navegador; para un origen estable se recomienda el servidor local.

## Guion de demostración para la reunión

- Elegir A y registrar `97%` de saturación y un comentario ficticio. Comprobar que la revisión muestra `97 %` y mantiene el resto sin medir/evaluar.
- Confirmar y abrir el visor. Verificar que muestra la toma y su origen manual, sin declarar estado de salud normal.
- Abrir el panel médico de A, desplegar el registro y guardar una observación. Comprobar el cambio de pendiente a revisión registrada.
- Volver al registro, generar una toma de sensor para B y verificar que su historial queda separado del de A. Las respuestas personales no se completan automáticamente.
- En el visor de A, elegir B como compañero y solicitar ayuda de simulacro. La solicitud aparece pendiente de confirmación.
- En el panel médico, confirmar recepción médica. En Compañero de apoyo, seleccionar B y confirmar recepción del compañero. Volver al panel médico y cerrar el simulacro.
- Recargar y verificar conservación del historial. Exportar el paquete JSON desde Avance y límites.

El botón de sensor puede iniciar una toma cada cinco segundos, con máximo de 60 tomas por sesión de página. Cambiar de vista o de tripulante pausa el flujo. Los valores no representan una población clínica ni una validación espacial.

## Contrato de integración implementado en el simulador

| Campo | Regla |
|---|---|
| `crew` | A, B, C o D |
| `observedAt` | Momento de medición, instante ISO en UTC |
| `receivedAt` | Momento de guardado/recepción simulada, independiente de la medición |
| `timeZone` | America/Lima; entrada y presentación en UTC−05:00 |
| `source` | manual o sensor-simulado |
| `synthetic` | true |
| `vitals` | Valores numéricos; claves hr, rr, spo2, temp, sbp, dbp |
| `answers` | Respuestas funcionales y síntomas explícitamente evaluados |
| `note` | Reporte libre ficticio, hasta 1000 caracteres |

Las unidades se definen en el catálogo. La saturación admite `97` o `97%` como entrada, pero se guarda como número 97. No se admiten valores no finitos ni números malformados. Los límites del formulario son límites técnicos de entrada, no umbrales clínicos; algunos deberán ajustarse al contexto tras revisión profesional.

Los valores pendientes se omiten. Un síntoma ausente se guarda como `false`, presente como `true`. Las preguntas de descanso y actividad conservan categorías descriptivas, no booleanos. «No realicé actividades» es distinto de «Ninguna dificultad». El catálogo de preguntas es provisional y no es una escala validada.

El visor muestra una única toma, con sus valores faltantes, sin combinar signos vitales de momentos diferentes. No convierte valores numéricos en una conclusión clínica.

Las revisiones se vinculan por `recordId` y conservan observación y fecha. Las solicitudes de apoyo conservan emisor, compañero asignado, creación, confirmación médica, confirmación del compañero y cierre. Confirmar una bandeja no confirma la otra; el cierre exige ambas. No hay envío de red, geolocalización ni garantía de entrega real.

## Evidencia técnica de esta entrega

- Nueve pruebas independientes con el ejecutor nativo de Node: normalización numérica, datos faltantes, fechas y zona horaria, entradas inválidas, selección de la toma del visor, persistencia/revisión/ciclo de ayuda, almacenamiento dañado, sensores y sintaxis del HTML generado.
- JavaScript del módulo de interfaz comprobado con `node --check`.
- Build autónomo generado localmente y pruebas aprobadas. No se necesita npm para estos checks.
- La demo anterior tuvo un CI aprobado con 61 pruebas; el generador tuvo cuatro pruebas aprobadas. Esas comprobaciones anteriores no equivalen a probar las interacciones visuales de este nuevo simulador.
- Pendiente de ejecutar el guion visual completo en el navegador del usuario. La sesión de automatización previa bloqueó archivos locales y conexiones de loopback; no se declara QA visual completado.

## Auditoría preliminar por componente

| Área | Evidencia actual | Brecha para V1 integrada |
|---|---|---|
| Recolección manual | Registro confirmado, faltantes explícitos, reporte libre | Revisión de preguntas y validación clínica |
| Sensores | Generación ficticia de tomas | Adaptador de dispositivos, calidad/calibración y timestamps del origen |
| Generador de 30 días | Cuatro JSON y pruebas ya aportados | Adaptador al contrato del nuevo simulador; no se cargan esas series automáticamente |
| Perfil e historial | Separación A–D y procedencia/tiempos | Antecedentes, objetivos individuales y contexto clínico |
| Motor | Motor previo separado con fixtures abstractos | Integrar reglas revisadas con trazabilidad de evidencia |
| Revisión médica | Observaciones vinculadas al registro | Identidad del revisor, prioridad y seguimiento clínico |
| Apoyo | Circuito manual simulado y confirmaciones por destinatario | Red real, reintentos, permisos y protocolo operativo |
| Datos | localStorage validado y exportación; fallo de escritura no se presenta como éxito | API, SQL, copias de seguridad y sincronización |
| Acceso | Vistas de roles | Autenticación y autorización real por paciente/rol |
| UI/UX | Español, categorías comprensibles, visor de contraste alto | Prueba visual, accesibilidad con usuarios y lectura en condiciones de misión |
| EarthPacket | Exportación de eventos de simulación | Definir y construir el entregable formal de la guía |
| Entorno de trabajo | Copia de trabajo en Documents/Codex | Trasladar o clonar en Escritorio/proyect nasa mediante el instalador preparado |

## Ruta siguiente sin sobreingeniería

1. Recorrer el guion con el equipo y ajustar preguntas, vocabulario y necesidades del personal médico.
2. Estabilizar el contrato: adaptar IDs y nombres del generador/motor, versionar el catálogo y definir calidad de medición.
3. Implementar una API local con SQL y autenticación; hacer que las mismas vistas consuman esa API en lugar del almacenamiento del navegador.
4. Integrar el motor con reglas sustentadas y revisadas, mostrando criterios evaluados, pendientes y fuentes.
5. Completar EarthPacket y README final conforme a la guía. Añadir envío/reintentos de alertas cuando exista red compartida.

LLM, grafos, entrenamiento de modelos y hardware real quedan para etapas posteriores a demostrar este recorrido básico.

## Estado de publicación

Este documento y el nuevo simulador forman un avance local adicional. El PR #1 ya existente corresponde a la entrega previa; estos archivos requieren un nuevo commit para quedar incluidos en GitHub. El HTML se puede regenerar desde las fuentes.
