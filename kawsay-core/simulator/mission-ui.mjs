import { VITALS, displayTime } from './domain.mjs';
import { missionAt, missionSignals, missionRecord, baseline, assessRecord, packet, NEWS_SOURCE, NEWS_CHART } from './mission.mjs';
const mEsc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function newsBadge(result) {
  if(result.total===null) return '<span class="pill">NEWS2 sin calcular: datos o contexto pendientes</span>';
  const severity=result.total>=7?'high':result.total>=5||result.any3?'medium':'low';
  return `<span class="pill score-${severity}">NEWS2 ${result.total}${result.any3?' · parámetro con 3 puntos':''}</span>`;
}
export function assessmentHTML(record) {
  const a=assessRecord(record), e=a.engine;
  return `<section class="card"><h3>Cálculo y ensayo del motor</h3>${newsBadge(a.news)}<p>${a.news.total===null?`Pendientes: ${mEsc(a.news.missing.join(', '))}. Entradas no utilizables: ${mEsc(a.news.invalid.join(', ')||'ninguna')}.`:'Escala 1 · seis parámetros y oxígeno suplementario · puntaje técnico, sin validación espacial.'}</p>${a.news.parts?`<details><summary>Desglose del puntaje</summary><pre>${mEsc(JSON.stringify(a.news.parts,null,2))}</pre></details>`:''}<p>Ensayo del motor: <strong>${mEsc(e.level.toUpperCase())}</strong> · ${mEsc(e.ruleId)}.</p><p>${mEsc(e.action)}</p><p class="muted">Reglas de demostración sin firma clínica. Este resultado no es una clasificación aprobada. Un puntaje bajo no descarta enfermedad.</p>${e.missingFields.length?`<p>Datos que bloquean el ensayo: ${mEsc(e.missingFields.join(', '))}.</p>`:''}<details><summary>Trazabilidad del motor</summary><pre>${mEsc(JSON.stringify(e.trace,null,2))}</pre></details><p><a href="${NEWS_SOURCE}" target="_blank" rel="noopener">Fuente NEWS2: Royal College of Physicians</a> · <a href="${NEWS_CHART}" target="_blank" rel="noopener">Tabla oficial</a></p></section>`;
}
function controls(day,hour) {
  return `<div class="mission-controls"><label>Día de misión (índice de la guía)<select id="mission-day">${Array.from({length:30},(_,n)=>`<option value="${n}" ${n===day?'selected':''}>Día ${n} · jornada ${n+1}/30</option>`).join('')}</select></label><label>Hora de misión en Perú<select id="mission-hour">${Array.from({length:24},(_,n)=>`<option value="${n}" ${n===hour?'selected':''}>${String(n).padStart(2,'0')}:00</option>`).join('')}</select></label></div><p class="muted">Cronología ficticia: 1–30 de octubre de 2026, hora de Perú. El selector usa índices 0–29 del generador para reproducir los escenarios de la guía.</p>`;
}
function signalHTML(signals) { return signals.length?signals.map(s=>`<article class="alert-card"><strong>${mEsc(s.id)}</strong><p>${mEsc(s.text)}</p><small>${mEsc(s.source)}</small></article>`).join(''):'<p>No se activaron los indicadores descriptivos de esta demostración. No equivale a ausencia de enfermedad.</p>'; }
function overview(data,day,hour) {
  return `<section class="card"><h2>Tripulación · día ${day}</h2>${controls(day,hour)}<div class="crew-grid">${data.crew.map(p=>{
    const s=missionSignals(data,p.id,day,hour);
    return `<article class="crew-card"><p class="eyebrow">TRIPULANTE ${p.id} · ${mEsc(p.module)}</p><h3>${mEsc(p.name)}</h3>${newsBadge(s.assessment.news)}<p>FC ${s.record.vitals.hr} lpm · SpO₂ ${s.record.vitals.spo2} %</p><p>CO₂ del módulo: ${s.environment.co2_mmHg} mmHg</p><p>Aptitud EVA: <strong>no determinada</strong></p><p>${s.signals.length} indicadores descriptivos · ${s.assessment.engine.reason==='rule_matched'?'criterio de ensayo activado':'clasificación clínica pendiente'}</p><button data-action="mission-detail" data-crew="${p.id}">Ver evolución de ${p.id}</button></article>`;
  }).join('')}</div><p class="muted">Los colores corresponden al puntaje NEWS2, no a una declaración de salud normal. No se autoriza EVA automáticamente.</p></section>`;
}
function chart(data,crew,day,hour,key,label,unit) {
  const end=day*24+hour,start=end-168;
  const rows=data.vitals.filter(v=>v.astro===crew&&v.day*24+v.hour>start&&v.day*24+v.hour<=end);
  const b=day>=6?baseline(data,crew,key):null;
  const vals=rows.map(r=>r[key]);
  let lo=Math.min(...vals,...(b?[b.low]:[])),hi=Math.max(...vals,...(b?[b.high]:[]));
  const padding=(hi-lo)*.12||1;lo-=padding;hi+=padding;
  const x=i=>45+(i/Math.max(1,rows.length-1))*570,y=v=>165-(v-lo)/(hi-lo)*140;
  const pts=rows.map((r,i)=>`${x(i).toFixed(2)},${y(r[key]).toFixed(2)}`).join(' ');
  return `<figure class="chart"><figcaption><strong>${label}</strong> (${unit})</figcaption><svg viewBox="0 0 650 205" role="img" aria-label="${label}: ${rows.length} tomas horarias y línea base de días 0 a 6"><line x1="45" x2="615" y1="165" y2="165" stroke="#8ba3b0"/>${b?`<rect x="45" y="${y(b.high)}" width="570" height="${y(b.low)-y(b.high)}" fill="#dce3e7"/><line x1="45" x2="615" y1="${y(b.mean)}" y2="${y(b.mean)}" stroke="#718c9a" stroke-dasharray="4 4"/>`:''}<polyline fill="none" stroke="#087c91" stroke-width="2" points="${pts}"/><text x="3" y="30">${hi.toFixed(1)}</text><text x="3" y="165">${lo.toFixed(1)}</text><text x="45" y="192">D${rows[0].day} ${rows[0].hour}:00</text><text x="530" y="192">D${day} ${hour}:00</text></svg><p class="muted">${b?`Franja gris: promedio ±2 DE de los primeros 7 días (${b.mean.toFixed(1)} ± ${(2*b.sd).toFixed(1)}). No es un rango clínico de normalidad.`:'Línea base pendiente: aún no se completan los primeros 7 días.'}</p></figure>`;
}
function detail(data,crew,day,hour) {
  const s=missionSignals(data,crew,day,hour),p=data.crew.find(c=>c.id===crew),d=s.record.daily;
  return `<section class="card"><p class="eyebrow">PERFIL DE MISIÓN · TRIPULANTE ${crew}</p><h2>${mEsc(p.name)} · evolución de siete días</h2>${controls(day,hour)}<p>${p.age} años · módulo ${mEsc(p.module)} · Perfil ficticio. Antecedentes y objetivos individuales pendientes.</p><button data-action="mission-visor">Mostrar esta toma en el casco</button><div class="chart-grid">${[['hr','Frecuencia cardiaca','lpm'],['rr','Frecuencia respiratoria','rpm'],['spo2','Saturación','%'],['temp','Temperatura','°C']].map(([k,l,u])=>chart(data,crew,day,hour,k,l,u)).join('')}</div><h3>Check-in del día ${day}</h3><p>Sueño ${d.sleep_h} h · KSS ${d.kss}/9 · PVT simulado: ${d.pvt_lapses} lapsos, mediana ${d.pvt_median_ms} ms · ${d.feeling==='fine'?'Refiere sentirse bien':'Refiere no sentirse bien'}.</p><p>Síntomas diarios: ${mEsc(d.symptoms.join(', ')||'ninguno reportado')}. El dataset no documenta una hora de inicio.</p>${signalHTML(s.signals)}</section>${assessmentHTML(s.record)}`;
}
export function renderPacket(data,state,crew,day,hour,mode) {
  const end=mode==='mission'?missionAt(day,hour):new Date().toISOString();
  const p=packet(data,state,crew,end,mode);
  return `<section class="card"><p class="eyebrow">PANTALLA 5</p><h2>Earth Packet · Tripulante ${crew}</h2><label>Origen del paquete<select id="packet-mode"><option value="mission" ${mode==='mission'?'selected':''}>Serie de misión de 30 días</option><option value="local" ${mode==='local'?'selected':''}>Registros y acciones de este navegador</option></select></label>${mode==='mission'?controls(day,hour):'<p>Ventana móvil: últimas 24 horas respecto al momento de abrir esta vista.</p>'}<p>Desde ${displayTime(p.window.startExclusive)} (exclusivo) hasta ${displayTime(p.window.endInclusive)} (inclusive), Perú.</p><div class="metrics"><div class="metric"><small>NEWS2 máximo</small><strong>${p.news2.max??'—'}</strong></div><div class="metric"><small>Tomas con puntaje / incompletas</small><strong>${p.news2.complete} / ${p.news2.incomplete}</strong></div><div class="metric"><small>Check-ins incluidos</small><strong>${p.checkIns.length}</strong></div></div><p>${p.notices.length} indicadores de ensayo · ${p.alerts.length} solicitudes de apoyo · ${p.actions.length} acciones registradas.</p><p class="pill">En cola — se enviará cuando el enlace con Tierra esté disponible</p><p class="muted">Estado de cola representado; transporte todavía sin implementar. Descargar no confirma envío ni recepción. Reglas de ensayo pendientes de validación clínica.</p><div class="actions"><button class="primary" data-action="packet-json">Descargar JSON</button><button data-action="packet-csv">Descargar CSV</button></div><details><summary>Ver check-ins y acciones</summary><pre>${mEsc(JSON.stringify({checkIns:p.checkIns,actions:p.actions},null,2))}</pre></details><details><summary>Ver indicadores y solicitudes</summary><pre>${mEsc(JSON.stringify({notices:p.notices,alerts:p.alerts},null,2))}</pre></details><p>El paquete conserva unidades a través de las claves y del catálogo del proyecto; la exportación JSON incluye contexto y trazabilidad. CSV conserva secciones y detalle JSON por evento.</p></section>`;
}
export function renderMission(view,data,state,crew,day,hour,mode) {
  return view==='tripulacion'?overview(data,day,hour):view==='detalle'?detail(data,crew,day,hour):renderPacket(data,state,crew,day,hour,mode);
}
