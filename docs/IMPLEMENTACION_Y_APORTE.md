# Implementación y aporte de KAWSAY

**Responsable del aporte:** Liu Bryan Cayllahua Huaringa  
**Equipo:** KUNTUR X  
**Fecha:** 13 de noviembre de 2026  
**Pull request:** https://github.com/alexandersoliscama-coder/kawsay/pull/1

## Resultado del avance

Se implementaron dos componentes complementarios: un check-in para recoger y
conservar datos simulados, y un generador reproducible que proporciona las series
de cuatro astronautas durante 30 días. El aporte prepara la recolección y el
suministro de datos para la V1. La conexión de estos datos al motor clínico y la
pantalla Earth Packet siguen pendientes.

## Check-in y persistencia

La pestaña Mi revisión permite seleccionar DEMO-01 a DEMO-04, indicar fecha y hora,
registrar signos vitales y responder preguntas sobre sueño, actividad y molestias.
El usuario revisa el registro y confirma antes de guardarlo.

Los síntomas empiezan sin evaluar. Una respuesta ausente se conserva como false;
un campo sin evaluar se omite. Las mediciones pendientes se presentan como sin
medir. Estos estados evitan confundir falta de información con ausencia de un
hallazgo. Las preguntas funcionales son un borrador de registro, no una escala
clínica validada.

El registro incluye identificador, versión del esquema y catálogo, indicador
synthetic, tripulante, momento de observación, momento de guardado y respuestas
tipadas. El historial se recupera al recargar y permite exportar JSON. Las
lecturas dañadas no se sobrescriben; los errores de guardado mantienen el
registro disponible para reintentar.

Archivos principales:
- kawsay-core/src/checkin/catalog.ts
- kawsay-core/src/checkin/model.ts
- kawsay-core/src/checkin/storage.ts
- kawsay-core/src/ui/CheckIn.tsx
- kawsay-core/docs/LOCAL_CHECKIN.md

## Generador y escenarios

El generador data-gen/generate.py utiliza Python y su biblioteca estándar. La
semilla predeterminada es 42. No requiere instalar NumPy ni pandas.

| Archivo | Registros | Unidad de observación |
| --- | ---: | --- |
| app/public/data/crew.json | 4 | Astronauta |
| app/public/data/vitals.json | 2880 | Astronauta y hora |
| app/public/data/daily.json | 120 | Astronauta y día |
| app/public/data/environment.json | 1440 | Módulo y hora |

Cada fila está identificada como sintética. Los escenarios proceden de la guía
de trabajo del equipo; no representan mediciones reales de astronautas.

- Ana: cambios guionados de signos vitales en los días 18, 19 y 20.
- Ben: sueño y desempeño alterados los días 10 a 14; EVA programada el día 15.
- Carla: CO2 del módulo Hab en 3,6 mmHg durante las horas 10 a 13 del día 22,
  con cefalea registrada en la observación diaria.
- Diego: aumento guionado de FC y FR el día 25, manteniendo feeling igual a fine.

Los escenarios contienen datos, no clasificaciones clínicas impuestas por el
generador. Los valores guionados son exactos; la variación se aplica al fondo.
Se calcula la media y desviación estándar muestral con los días 0 a 6. Los
puntajes z describen distancia respecto a esa base. Si la desviación es cero,
el resultado correspondiente es null.

## Decisiones de integración

Los días almacenados son 0 a 29: la interfaz debe mostrar day + 1. Los días de
los escenarios siguen los índices del código de la guía. La resolución de los
signos vitales y ambiente es horaria; la del check-in sintético es diaria.

El check-in utiliza DEMO-01 a DEMO-04 y el generador A a D. Se propone mapearlos
en ese orden, pero todavía no se ha implementado esa relación. Las respuestas
planas del check-in y las columnas de los JSON deben transformarse explícitamente
al formato anidado que espera el motor.

El generador entrega co2_mmHg por hora. El adaptador debe definir y comprobar
la correspondencia con el promedio de una hora que requieren las reglas.
No debe presentar una lectura instantánea como promedio.

La guía no fija resultados alterados de Ben el día 15 ni una política para
arrastrar el deterioro de días previos. No se ha inventado una decisión de aptitud
para esa fecha.

## Ejecución local

Desde la raíz del repositorio:

```powershell
python data-gen/generate.py
python -m unittest discover -s data-gen -v
cd kawsay-core
npm ci
npm test
npm run typecheck
npm run demo
npm run serve-demo
```

Abrir http://127.0.0.1:4173 en el navegador. Usar la misma dirección y el mismo
navegador para recuperar el historial. El servidor se detiene con Ctrl+C.
La compilación necesita las dependencias instaladas; no debe afirmarse que se
comprobó todo el flujo en modo avión.

## Verificación realizada

El check-in y el núcleo existente pasaron 61 pruebas en GitHub Actions, además
de revisión TypeScript, validación estricta de fixtures y compilación:
https://github.com/liubryan123-hash/kawsay/actions/runs/43484044117

El generador pasó cuatro pruebas locales: cardinalidad y unicidad; reproducción
por semilla; correspondencia de escenarios; y línea base con serialización JSON
finita. El script se ejecutó y creó los cuatro archivos.

Estas comprobaciones son técnicas. No acreditan seguridad clínica ni validación
en vuelo. Los 61 tests corresponden al commit 5278cd4; las pruebas del generador
se ejecutan por separado.

## Aporte frente a la guía y trabajo restante

| Entregable de la guía | Aporte realizado | Estado |
| --- | --- | --- |
| Generador de cuatro astronautas | Script, escenarios y cuatro JSON | Implementado |
| Datos disponibles en app/public/data | Archivos generados y contrato documentado | Implementado |
| Aplicación leyendo las series | Requiere adaptador e integración con frontend | Pendiente |
| Recolección funcional | Check-in con confirmación e historial | Implementado |
| Earth Packet | Resumen de últimas 24 h, acciones y exportación CSV/JSON | Pendiente |
| README final | Instrucciones técnicas disponibles; faltan enlaces finales | Parcial |

Antes de integrar el contenido clínico nuevo, el equipo debe resolver diferencias
entre recursos: alcance de reglas, modos de evaluación, manejo de abstenciones y
resultado cuando ninguna regla coincide. Los borradores con fuentes no se
consideran reglas aprobadas automáticamente.

## Límites y siguientes pasos

La persistencia actual usa localStorage y está dirigida a datos simulados en
una pestaña. No incluye autenticación, cifrado de aplicación ni coordinación
entre escritores simultáneos. Borrar los datos del navegador elimina el historial.

El siguiente paso es implementar el adaptador de datos y verificarlo con una
historia completa. Después corresponde Earth Packet. SQL, sensores reales,
LLM y grafos permanecen como ampliaciones posteriores.

## Recursos de trabajo

- Guía de trabajo KUNTUR X, capítulo 6, entregables de Liu Bryan.
- Recursos compartidos: https://drive.google.com/drive/folders/1HRCXQ3JU-hBuAfjHESTLR0s639T9ovcF
- Protocolo y sustento médico: recursos del equipo pendientes de conciliación
  con el comportamiento del motor actual.
