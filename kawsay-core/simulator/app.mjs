import { CREW, REST, ACTIVITY, VITALS, SYMPTOMS, KEY, limaInput, displayTime, parseEntry, sensorRecord, loadState, saveState, latestVitals, newAlert, transitionAlert } from './domain.mjs';
import { missionRecord, assessRecord, missionAt, packet, packetCsv } from './mission.mjs';
import { renderMission, assessmentHTML } from './mission-ui.mjs';

const root = document.getElementById('app');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option = (value, label = value) => `<option value="${esc(value)}">${esc(label)}</option>`;
let state, storageError = '', active = 'tripulacion', crew = 'A', pending = null, feedback = '', timer = null, tick = 0;
let missionDay=20, missionHour=23, packetMode='mission', visorOrigin='local';
try { state = loadState(localStorage); } catch (error) { storageError = 'No se pudo leer el almacenamiento. No se guardarán cambios: ' + error.message; state = { version: 1, synthetic: true, records: [], reviews: [], alerts: [] }; }
function commit(next) {
  if (storageError) throw new Error(storageError);
  saveState(localStorage, next); // Actualizar la vista solo después de guardar correctamente.
  state = next;
}
function crewSelect(id, current = crew) { return `<select id="${id}" name="${id === 'form-crew' ? 'crew' : id}">${CREW.map(c => `<option value="${c}" ${c === current ? 'selected' : ''}>Tripulante ${c}</option>`).join('')}</select>`; }
function select(name, label, options) { return `<label>${label}<select name="${name}">${option('', 'Sin evaluar')}${options.map(o => option(o)).join('')}</select></label>`; }
function metricList(record) { return VITALS.map(([key, label, unit]) => `<div class="metric"><small>${label}</small><strong>${record?.vitals[key] === undefined ? '—' : esc(record.vitals[key])}<span>${record?.vitals[key] === undefined ? 'Sin medir' : unit}</span></strong></div>`).join(''); }
function answerList(record) {
  return `<dl><dt>Sueño, últimas 24 h</dt><dd>${record.answers.sleep === undefined ? 'Sin evaluar' : esc(record.answers.sleep) + ' h'}</dd><dt>Descanso</dt><dd>${esc(record.answers.rest || 'Sin evaluar')}</dd><dt>Dificultad en actividades</dt><dd>${esc(record.answers.activity || 'Sin evaluar')}</dd>${SYMPTOMS.map((label,n) => `<dt>${label}</dt><dd>${record.answers['symptom'+n] === undefined ? 'Sin evaluar' : record.answers['symptom'+n] ? 'Presente' : 'Ausente'}</dd>`).join('')}</dl>`;
}
function baseRegistration() {
  if (pending) return `<section class="card"><p class="eyebrow">ANTES DE GUARDAR</p><h2>Confirma tu registro</h2><p>Tripulante ${pending.crew} · ${displayTime(pending.observedAt)} · Perú</p><div class="metrics">${metricList(pending)}</div>${answerList(pending)}<h3>Tu reporte</h3><p class="pre">${esc(pending.note || 'Sin comentario')}</p><p class="muted">Las respuestas pendientes permanecen sin evaluar. El registro quedará pendiente de revisión médica.</p><div class="actions"><button data-action="edit">Volver a editar</button><button class="primary" data-action="confirm">Confirmar y guardar</button></div></section>`;
  return `<div class="two"><section class="card"><p class="eyebrow">INGRESO MANUAL</p><h2>Cuéntanos cómo te encuentras</h2><form id="entry-form" novalidate><div class="fields"><label>Tripulante${crewSelect('form-crew')}</label><label>Fecha y hora en Perú<input name="time" type="datetime-local" value="${limaInput()}" required></label></div><h3>Mediciones disponibles</h3><p class="muted">Escribe el número. La unidad aparece junto al campo. Deja sin medir lo que no tengas.</p><div class="fields">${VITALS.map(([key,label,unit]) => `<label>${label} (${unit})<input name="${key}" inputmode="decimal" placeholder="Sin medir" autocomplete="off"></label>`).join('')}</div><h3>Sueño y actividad</h3><div class="fields"><label>¿Cuántas horas dormiste en las últimas 24 horas?<input name="sleep" inputmode="decimal" placeholder="Sin evaluar"></label>${select('rest','¿Qué tan reparador fue tu último descanso?',REST)}${select('activity','Comparado con tu nivel habitual, ¿cuánta dificultad tienes hoy para realizar tus actividades?',ACTIVITY)}</div><h3>Molestias actuales</h3><div class="fields">${SYMPTOMS.map((label,n) => `<label>${label}<select name="symptom${n}">${option('','Sin evaluar')}${option('present','Presente')}${option('absent','Ausente')}</select></label>`).join('')}</div><label>¿Qué más deseas comunicar al personal de salud?<textarea name="note" maxlength="1000" rows="3" placeholder="Describe cuándo empezó, cómo ha cambiado o qué necesitas. Solo información ficticia."></textarea></label><p class="muted">Preguntas de demostración; no son una escala clínica validada.</p><button class="primary" type="submit">Revisar antes de guardar</button></form></section><aside><section class="card"><p class="eyebrow">SENSOR SIMULADO</p><h2>Generar una toma</h2><p>Crea una medición ficticia para el tripulante seleccionado arriba. No asigna respuestas a las preguntas personales.</p><button data-action="sensor">Recibir una toma simulada</button><button data-action="stream">${timer ? 'Pausar flujo' : 'Iniciar flujo cada 5 s'}</button><p class="muted">${timer ? 'Flujo activo' : 'Flujo pausado'} · máximo 60 tomas por sesión. El flujo se pausa al cambiar de vista.</p></section><section class="card"><h3>Recorrido de la demo</h3><ol><li>Registra información o simula una toma.</li><li>Consulta el visor del tripulante.</li><li>Revisa el historial en el panel médico.</li><li>Ensaya una solicitud de apoyo.</li></ol><p class="muted">Las vistas comparten datos en este navegador. El servidor de nave y la red todavía están simulados.</p></section></aside></div>`;
}
let savedDraft = null;
const draftsByCrew = new Map();
function registration() {
  if(pending) return baseRegistration()+assessmentHTML(pending);
  const context=`<h3>Contexto para NEWS2 · escala 1</h3><p class="muted">Solo demostración con tripulantes adultos ficticios. No aplicar automáticamente a objetivos individuales de oxígeno. Si falta contexto, no se calcula el puntaje completo.</p><div class="fields"><label>¿Está alerta y sin confusión de inicio reciente?<select name="newsAlert">${option('','Sin evaluar')}${option('yes','Sí')}${option('no','No')}</select></label><label>¿Recibe oxígeno suplementario?<select name="newsOxygen">${option('','Sin evaluar')}${option('yes','Sí')}${option('no','No')}</select></label><label>Escala de saturación aplicable al caso ficticio<select name="newsScale">${option('','Sin confirmar / otra escala')}${option('1','Escala 1 confirmada para esta simulación')}</select></label></div>`;
  return baseRegistration().replace('<h3>Sueño y actividad</h3>',context+'<h3>Sueño y actividad</h3>');
}
function baseVisor() {
  const r = visorOrigin==='mission'?missionRecord(missionData,crew,missionDay,missionHour):latestVitals(state.records, crew);
  const latestReport = visorOrigin==='mission'?r:state.records.filter(x => x.crew === crew && x.source === 'manual').sort((a,b) => Date.parse(b.observedAt)-Date.parse(a.observedAt))[0];
  const alerts = state.alerts.filter(a => a.crew === crew && !a.closedAt);
  const age = r ? Math.max(0, Math.floor((Date.now()-Date.parse(r.observedAt))/60000)) : null;
  return `<section class="helmet"><div class="hud-head"><div><p class="eyebrow">VISTA DEL ASTRONAUTA · CASCO SIMULADO</p><h2>Tripulante ${crew}</h2></div><span class="pill">${r ? 'Última toma guardada' : 'Esperando mediciones'}</span></div><div class="metrics">${metricList(r)}</div><p>${r ? `${displayTime(r.observedAt)} · Perú · Hace ${age} min · ${r.source === 'manual' ? 'Ingreso manual' : 'Sensor simulado'}` : 'Aún no hay mediciones para este tripulante.'}</p><p class="hud-note">${age !== null && age >= 2 ? 'La toma tiene 2 minutos o más: no representa una transmisión en vivo. ' : ''}Estos valores no determinan por sí solos tu estado de salud. Interpretación clínica pendiente.</p><div class="hud-bottom"><div><h3>Tu último reporte</h3><p>${esc(latestReport?.note || 'No hay un comentario registrado.')}</p><p>${latestReport ? 'Descanso: ' + esc(latestReport.answers.rest || 'Sin evaluar') : ''}</p></div><div><h3>Apoyo de un compañero</h3><label>Compañero asignado<select id="buddy">${CREW.filter(c=>c!==crew).map(c=>option(c,'Tripulante '+c)).join('')}</select></label><button class="danger" data-action="help">Solicitar ayuda · simulacro</button><p>Activa un aviso manual en el panel médico y en la bandeja del compañero.</p></div></div></section><section class="card"><h2>Estado de tus solicitudes</h2>${alerts.length ? alerts.map(a=>`<p><strong>Solicitud ${esc(a.id.slice(0,8))}</strong> · Medicina: ${a.medicalAckAt ? 'recepción confirmada' : 'sin confirmación'} · Compañero ${a.buddy}: ${a.buddyAckAt ? 'recepción confirmada' : 'sin confirmación'}</p>`).join('') : '<p>No hay solicitudes abiertas. Esto no constituye una evaluación de salud.</p>'}</section>`;
}
function recordCard(r) {
  const reviews = state.reviews.filter(x=>x.recordId===r.id);
  return `<details class="record"><summary><span>${displayTime(r.observedAt)} · ${r.source === 'manual' ? 'Reporte del usuario' : 'Sensor simulado'}</span><span class="pill">${reviews.length ? 'Revisión registrada' : 'Pendiente de revisión'}</span></summary><p class="muted">Tripulante ${r.crew} · Recepción: ${displayTime(r.receivedAt)} · ID ${esc(r.id)}</p><div class="metrics">${metricList(r)}</div>${answerList(r)}<p class="pre">${esc(r.note || 'Sin comentario')}</p>${reviews.map(v=>`<blockquote><strong>Revisión médica simulada · ${displayTime(v.at)}</strong><p class="pre">${esc(v.note)}</p></blockquote>`).join('')}<form class="review-form" data-record="${esc(r.id)}"><label>Observación del personal de salud<textarea name="review" rows="2" maxlength="1000" required placeholder="Describe la revisión o el seguimiento propuesto para el caso ficticio."></textarea></label><button type="submit">Registrar revisión</button></form></details>`;
}
function medical() {
  const records = state.records.filter(r=>r.crew===crew).sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt));
  const pendingCount = records.filter(r=>!state.reviews.some(v=>v.recordId===r.id)).length;
  return `<div class="two"><section class="card"><p class="eyebrow">PERFIL · TRIPULANTE ${crew}</p><h2>Historial y reportes</h2><p>${records.length} registros · ${pendingCount} pendientes de revisión</p><p class="muted">Perfil ficticio. Antecedentes, objetivos individuales y tratamientos: no registrados. Revisar un registro no cierra una alerta ni equivale a dar un diagnóstico.</p><label>Mostrar<select id="record-filter"><option value="all">Todos los registros</option><option value="pending">Pendientes de revisión</option><option value="manual">Reportes del usuario</option></select></label><div id="history">${records.length ? records.map(recordCard).join('') : '<p>No hay registros de este tripulante.</p>'}</div></section><aside><section class="card"><h2>Bandeja médica de apoyo</h2><p>Solicitudes de todos los tripulantes. La recepción debe confirmarse de forma explícita en este simulador.</p>${alertCards('medical')}</section></aside></div>`;
}
function alertCards(mode) {
  const alerts = state.alerts.filter(a => mode==='medical' || a.buddy===crew).slice().reverse();
  return alerts.length ? alerts.map(a=>`<article class="alert-card"><strong>Tripulante ${a.crew} solicita apoyo</strong><p>${displayTime(a.createdAt)} · Compañero asignado: ${a.buddy}</p><p>${esc(a.message)}</p><p>Medicina: ${a.medicalAckAt ? 'confirmado' : 'pendiente'} · Compañero: ${a.buddyAckAt ? 'confirmado' : 'pendiente'}</p>${a.closedAt ? `<p class="pill">Simulacro cerrado · ${displayTime(a.closedAt)}</p>` : `<button data-action="ack" data-id="${esc(a.id)}" data-role="${mode}" ${a[mode==='medical'?'medicalAckAt':'buddyAckAt'] ? 'disabled' : ''}>Confirmar recepción ${mode==='medical'?'médica':'del compañero'}</button>${mode==='medical' ? `<button data-action="close-alert" data-id="${esc(a.id)}" ${!a.medicalAckAt || !a.buddyAckAt ? 'disabled' : ''}>Cerrar simulacro</button>` : ''}`}</article>`).join('') : '<p>No hay solicitudes en esta bandeja.</p>';
}
function baseAudit() {
  return `<section class="card"><p class="eyebrow">PARA LA REUNIÓN</p><h2>Alcance real del simulador</h2><table><thead><tr><th>Componente</th><th>Estado</th></tr></thead><tbody><tr><td>Registro, visor, perfiles e historial</td><td>Conectados en este navegador</td></tr><tr><td>Revisión médica y alertas de apoyo</td><td>Flujo manual simulado y persistente</td></tr><tr><td>Sensor</td><td>Generador ficticio; sin equipo conectado</td></tr><tr><td>Servidor compartido, SQL y red protegida</td><td>Pendientes; no hay sincronización entre equipos</td></tr><tr><td>Roles y permisos</td><td>Vistas de demostración; sin autenticación</td></tr><tr><td>Interpretación y recomendaciones clínicas</td><td>Pendientes de integración y validación</td></tr><tr><td>Aviso a un compañero cercano</td><td>Asignación manual; sin geolocalización ni envío real</td></tr></tbody></table><p>El motor anterior sigue disponible en la demo técnica independiente. Este simulador no le atribuye interpretación clínica a sus reglas abstractas.</p><h3>Datos actuales</h3><p>${state.records.length} registros · ${state.reviews.length} revisiones · ${state.alerts.length} solicitudes</p><button data-action="export">Exportar paquete JSON de la simulación</button><p class="muted">La exportación no es todavía el EarthPacket definitivo. Es un respaldo de los eventos de demostración.</p></section>`;
}
function visor() {
  const html=baseVisor();
  return visorOrigin==='mission'?html.replace('Sensor simulado','Serie de misión (toma horaria)').replace(/Hace \d+ min/,'Cronología de misión'):html;
}
function audit() {
  return baseAudit().replace('La exportación no es todavía el EarthPacket definitivo. Es un respaldo de los eventos de demostración.','Esta exportación respalda toda la simulación. Earth Packet genera el resumen individual de las últimas 24 horas.');
}
function render() {
  const tabs=[['tripulacion','Tripulación'],['detalle','Evolución'],['registro','Registro'],['visor','Visor del casco'],['medico','Panel médico'],['apoyo','Compañero de apoyo'],['packet','Earth Packet'],['auditoria','Avance y límites']];
  let view;
  if(['tripulacion','detalle','packet'].includes(active)) view=renderMission(active,missionData,state,crew,missionDay,missionHour,packetMode);
  else if(active==='registro') view=registration();
  else if(active==='visor') view=`<label>Origen del visor<select id="visor-origin"><option value="local" ${visorOrigin==='local'?'selected':''}>Última toma registrada en este navegador</option><option value="mission" ${visorOrigin==='mission'?'selected':''}>Misión · día ${missionDay}, ${missionHour}:00</option></select></label>`+visor();
  else if(active==='medico') { const latest=state.records.filter(r=>r.crew===crew&&r.source==='manual').sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt))[0];view=medical()+(latest?assessmentHTML(latest):''); }
  else if(active==='apoyo') view=`<section class="card"><h2>Apoyo · Tripulante ${crew}</h2><p>Solo se muestra quién solicita ayuda, cuándo y el mensaje de apoyo. El historial clínico no se incluye en esta bandeja.</p>${alertCards('buddy')}</section>`;
  else view=audit()+`<section class="card"><h3>Actualización de integración</h3><p>Los cuatro JSON ya alimentan Tripulación, Evolución y Earth Packet. NEWS2 escala 1 reutiliza una tabla contrastada con RCP; el ensayo usa el motor TypeScript existente. Las reglas de demostración y la adaptación a misión están pendientes de aprobación clínica.</p><p>Earth Packet incluye resumen de 24 h y exportaciones CSV/JSON. La cola es representada; no existe transporte a Tierra. PVT interactivo, evaluación de casos clínicos reales, servidor SQL, publicación y QA visual integral siguen pendientes.</p></section>`;
  root.innerHTML=`<header><div><p class="eyebrow">KUNTUR X · ENTORNO LOCAL DE DEMOSTRACIÓN</p><h1>KAWSAY <span>Salud de la tripulación</span></h1></div><label>Perfil activo${crewSelect('active-crew')}</label></header><div class="simulation-note">SIMULACIÓN · Solo datos ficticios · Hora de Perú (UTC−05:00) · Almacenamiento en este navegador</div><nav aria-label="Vistas del simulador">${tabs.map(([id,label])=>`<button data-tab="${id}" aria-pressed="${active===id}">${label}</button>`).join('')}</nav><main>${storageError?`<div class="error" role="alert">${esc(storageError)}</div>`:''}<div id="feedback" role="status">${esc(feedback)}</div>${view}</main><footer>Prototipo de interacción · Las vistas de rol no restringen el acceso · Una pestaña para editar · Español como idioma base</footer>`;
  if (!pending && savedDraft && active==='registro') {
    for (const [name,value] of Object.entries(savedDraft)) { const el = document.getElementById('entry-form').elements.namedItem(name); if (el) el.value = value; }
  }
}
function captureDraft() {
  const f=document.getElementById('entry-form');
  if(f) {
    // The crew selector may already show the next profile during a change event.
    // Attribute the values still on screen to the previous active profile.
    savedDraft={...Object.fromEntries(new FormData(f)),crew};
    draftsByCrew.set(crew,savedDraft);
  }
}
function switchCrew(next) {
  if(!CREW.includes(next)) throw new Error('Tripulante desconocido.');
  captureDraft();stopStream();crew=next;
  savedDraft=draftsByCrew.get(crew)??null;
  pending=null;feedback='';
}
function stopStream() { if(timer) clearInterval(timer); timer=null; }
function receiveSensor() {
  if (tick >= 60) { stopStream(); throw new Error('Se completaron las 60 tomas de esta sesión.'); }
  const r = sensorRecord(crew, new Date(), crypto.randomUUID(), tick);
  commit({...state, records:[...state.records,r]}); tick++;
  feedback = 'Toma ficticia recibida para el tripulante '+crew+'. Pendiente de revisión médica.';
}
root.addEventListener('submit', event => {
  event.preventDefault();
  try {
    if(event.target.id==='entry-form') { stopStream(); captureDraft(); pending=parseEntry(savedDraft); feedback=''; }
    else if(event.target.matches('.review-form')) {
      const note=String(new FormData(event.target).get('review') || '').trim();
      if(!note || note.length>1000) throw new Error('Escribe una observación de 1 a 1000 caracteres.');
      commit({...state,reviews:[...state.reviews,{id:crypto.randomUUID(),recordId:event.target.dataset.record,note,at:new Date().toISOString()}]});
      feedback='Revisión médica simulada registrada.';
    }
    render();
  } catch(error) { document.getElementById('feedback').textContent=error.message; }
});
root.addEventListener('change', event => {
  if(event.target.id==='mission-day') {missionDay=Number(event.target.value);render();return;}
  if(event.target.id==='mission-hour') {missionHour=Number(event.target.value);render();return;}
  if(event.target.id==='packet-mode') {packetMode=event.target.value;render();return;}
  if(event.target.id==='visor-origin') {visorOrigin=event.target.value;render();return;}
  if(event.target.id==='active-crew' || event.target.id==='form-crew') { switchCrew(event.target.value); render(); }
  else if(event.target.id==='record-filter') {
    const mode=event.target.value;
    const records=state.records.filter(r=>r.crew===crew && (mode!=='manual'||r.source==='manual') && (mode!=='pending'||!state.reviews.some(v=>v.recordId===r.id))).sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt));
    document.getElementById('history').innerHTML=records.length ? records.map(recordCard).join('') : '<p>No hay registros con este filtro.</p>';
  }
});
root.addEventListener('click', event => {
  const b=event.target.closest('button'); if(!b || b.type==='submit' && !b.dataset.action && !b.dataset.tab) return;
  try {
    if(b.dataset.tab) { captureDraft(); stopStream(); active=b.dataset.tab; feedback=''; render(); return; }
    switch(b.dataset.action) {
      case 'mission-detail': switchCrew(b.dataset.crew);active='detalle';break;
      case 'mission-visor': visorOrigin='mission';active='visor';break;
      case 'packet-json': case 'packet-csv': {
        const end=packetMode==='mission'?missionAt(missionDay,missionHour):new Date().toISOString();
        const p=packet(missionData,state,crew,end,packetMode);
        const csv=b.dataset.action==='packet-csv';
        const blob=new Blob([csv?packetCsv(p):JSON.stringify(p,null,2)],{type:csv?'text/csv;charset=utf-8':'application/json'});
        const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`kawsay-earth-packet-${crew}.${csv?'csv':'json'}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
        feedback='Paquete descargable preparado; no se ha transmitido a Tierra.';break;
      }
      case 'edit': pending=null; break;
      case 'confirm': {
        if(!pending) return;
        if(pending.crew!==crew) throw new Error('El registro pertenece a otro tripulante. Revisa el perfil antes de guardar.');
        const record={...pending,receivedAt:new Date().toISOString()};
        commit({...state,records:[...state.records,record]}); crew=record.crew;pending=null;savedDraft=null;draftsByCrew.delete(crew);feedback='Registro guardado. Pendiente de revisión médica.'; break;
      }
      case 'sensor': captureDraft(); receiveSensor(); break;
      case 'stream': captureDraft(); if(timer) stopStream(); else { receiveSensor(); timer=setInterval(()=>{try{receiveSensor();render();}catch(error){stopStream();feedback=error.message;render();}},5000); } break;
      case 'help': {
        const open=state.alerts.find(a=>a.crew===crew&&!a.closedAt);
        if(open) throw new Error('Ya tienes una solicitud abierta. Consulta su estado antes de crear otra.');
        const alert=newAlert(crew,document.getElementById('buddy').value);
        commit({...state,alerts:[...state.alerts,alert]});feedback='Solicitud registrada en las bandejas simuladas. Aún no hay confirmación de recepción.';break;
      }
      case 'ack': case 'close-alert': {
        const action=b.dataset.action==='ack'?b.dataset.role:'close';
        const alert=state.alerts.find(a=>a.id===b.dataset.id);
        if(!alert) throw new Error('Solicitud no encontrada.');
        const updated=transitionAlert(alert,action);
        commit({...state,alerts:state.alerts.map(a=>a.id===alert.id?updated:a)});feedback='Estado del simulacro actualizado.';break;
      }
      case 'export': {
        const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),...state},null,2)],{type:'application/json'});
        const url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download='kawsay-simulacion.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);feedback='Paquete JSON preparado para descargar.';break;
      }
      default: return;
    }
    render();
  } catch(error) { feedback=error.message;document.getElementById('feedback').textContent=feedback; }
});
window.addEventListener('storage',event=>{if(event.key===KEY||event.key===null){stopStream();storageError='El almacenamiento cambió en otra pestaña. Recarga esta página antes de seguir editando.';render();}});
window.addEventListener('beforeunload',stopStream);
render();
