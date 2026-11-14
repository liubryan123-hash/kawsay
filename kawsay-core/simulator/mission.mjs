import { evaluate } from './engine-adapter.mjs';
export const NEWS_SOURCE = 'https://www.rcp.ac.uk/resources/national-early-warning-score-news-2/';
export const NEWS_CHART = 'https://www.rcp.ac.uk/media/eczf5mvm/news2-chart-3_news-observation-chart_2022_0_0.pdf';
export const GUIDE_SOURCE = 'Guía de trabajo KUNTUR X, capítulos 1, 5 y 6; interpretación de misión pendiente de revisión del equipo';
export function news2(v, context = {}) {
  const missing = [];
  for (const key of ['hr','rr','spo2','sbp','temp']) {
    if (typeof v?.[key] !== 'number' || !Number.isFinite(v[key])) missing.push(key);
  }
  for (const key of ['alert','onOxygen']) if (typeof context[key] !== 'boolean') missing.push(key);
  if (context.scale !== 1) missing.push('escala1_confirmada');
  const invalid = ['hr','rr','spo2','sbp'].filter(k=>v?.[k] !== undefined && (!Number.isInteger(v[k]) || v[k]<0 || (k==='spo2'&&v[k]>100)));
  if (v?.temp !== undefined && (v.temp<20 || v.temp>45 || Math.abs(v.temp*10-Math.round(v.temp*10))>1e-7)) invalid.push('temp');
  if(missing.length || invalid.length) return {total:null,parts:null,any3:null,missing,invalid,source:NEWS_SOURCE};
  const parts = {
    rr:v.rr<=8?3:v.rr<=11?1:v.rr<=20?0:v.rr<=24?2:3,
    spo2:v.spo2<=91?3:v.spo2<=93?2:v.spo2<=95?1:0,
    oxygen:context.onOxygen?2:0,
    sbp:v.sbp<=90?3:v.sbp<=100?2:v.sbp<=110?1:v.sbp<=219?0:3,
    hr:v.hr<=40?3:v.hr<=50?1:v.hr<=90?0:v.hr<=110?1:v.hr<=130?2:3,
    consciousness:context.alert?0:3,
    temp:v.temp<=35?3:v.temp<=36?1:v.temp<=38?0:v.temp<=39?1:2,
  };
  return {total:Object.values(parts).reduce((a,b)=>a+b,0),parts,any3:Object.values(parts).includes(3),missing:[],invalid:[],source:NEWS_SOURCE};
}
const review = {by:[],date:''};
const draft = (id,level,condition,source) => ({id,group:'demonstration',order:10,level,condition,action:'Protocolo de actuación pendiente de aprobación del equipo clínico.',alertText:'Ensayo técnico; no es una recomendación clínica aprobada.',source,review});
const draftRules = [
  draft('D-CHEST','emergency',{field:'symptoms.chest_pain',op:'eq',value:true},{ref:GUIDE_SOURCE,section:'Escenario de dolor de pecho; fuente clínica específica pendiente'}),
  draft('D-NEWS-HIGH','emergency',{field:'news2.total',op:'gte',value:7},{ref:NEWS_SOURCE,section:'Chart 2: aggregate score ≥7; adaptación a misión pendiente'}),
  draft('D-NEWS-MED','priority',{field:'news2.total',op:'gte',value:5},{ref:NEWS_SOURCE,section:'Chart 2: aggregate score 5–6; adaptación a misión pendiente'}),
  draft('D-NEWS-SINGLE','priority',{field:'news2.any3',op:'eq',value:true},{ref:NEWS_SOURCE,section:'Chart 2: single parameter score 3; adaptación a misión pendiente'}),
  {id:'D-PENDING',group:'demonstration',order:99,level:'insufficient',action:'Revisión clínica pendiente; no se asigna autocuidado por defecto.',alertText:'Sin clasificación clínica aprobada.',source:{ref:GUIDE_SOURCE,section:'Contrato de demostración'},review},
];
export function assessRecord(record) {
  const score = news2(record?.vitals,record?.newsContext);
  const input={news2:{},symptoms:{}};
  if(score.total!==null) {input.news2.total=score.total;input.news2.any3=score.any3;}
  if(typeof record?.answers?.symptom2==='boolean') input.symptoms.chest_pain=record.answers.symptom2;
  else if(record?.daily && Array.isArray(record.daily.symptoms)) input.symptoms.chest_pain=record.daily.symptoms.includes('chest_pain');
  return {news:score,engine:evaluate(draftRules,input),clinicalReview:'pending',rulesVersion:'draft-demo-1'};
}
export function missionAt(day,hour) { return new Date(Date.parse('2026-10-01T00:00:00-05:00')+(day*24+hour)*3600000).toISOString(); }
export function validateMission(data) {
  const expected={crew:4,vitals:2880,daily:120,environment:1440};
  for(const [key,count] of Object.entries(expected)) if(!Array.isArray(data[key])||data[key].length!==count) throw new Error('Dataset incompleto: '+key);
  const ids=new Set(data.crew.map(c=>c.id));
  if(ids.size!==4||!['A','B','C','D'].every(id=>ids.has(id))) throw new Error('Tripulación inválida.');
  for(const [key,fields] of [['vitals',['astro','day','hour']],['daily',['astro','day']],['environment',['module','day','hour']]]) {
    const keys=new Set();
    for(const r of data[key]) {
      const id=fields.map(k=>r[k]).join('/');
      if(keys.has(id)||r.synthetic!==true||!Number.isInteger(r.day)||r.day<0||r.day>29) throw new Error('Fila duplicada o inválida: '+key);
      keys.add(id);
      if(key!=='environment'&&!ids.has(r.astro)) throw new Error('Tripulante desconocido.');
      if(key!=='daily'&&(!Number.isInteger(r.hour)||r.hour<0||r.hour>23)) throw new Error('Hora de misión inválida.');
      if(key==='vitals') {
        if(news2(r,{alert:r.alert,onOxygen:r.on_oxygen,scale:1}).total===null) throw new Error('Mediciones o contexto de misión inválidos.');
        for(const k of ['hr_z','rr_z','spo2_z','temp_z']) if(r[k]!==null&&!Number.isFinite(r[k])) throw new Error('Línea base inválida.');
      }
      if(key==='daily'&&(!Array.isArray(r.symptoms)||!r.symptoms.every(s=>typeof s==='string')||!['fine','not fine'].includes(r.feeling)||!Number.isFinite(r.sleep_h)||r.sleep_h<0||r.sleep_h>24||!Number.isInteger(r.kss)||r.kss<1||r.kss>9||!Number.isInteger(r.pvt_lapses)||r.pvt_lapses<0||!Number.isFinite(r.pvt_median_ms)||typeof r.eva_scheduled!=='boolean')) throw new Error('Check-in diario inválido.');
      if(key==='environment'&&(!['Lab','Hab'].includes(r.module)||!Number.isFinite(r.co2_mmHg)||r.co2_mmHg<0)) throw new Error('Ambiente inválido.');
    }
  }
  return true;
}
export function missionRecord(data,crew,day,hour) {
  const v=data.vitals.find(r=>r.astro===crew&&r.day===day&&r.hour===hour);
  const d=data.daily.find(r=>r.astro===crew&&r.day===day);
  if(!v||!d) throw new Error('No existe esa toma de misión.');
  const answers={sleep:d.sleep_h};
  // Daily symptoms are day-resolution data, never assumed to be hourly measurements.
  return {id:`mission-${crew}-${day}-${hour}`,crew,observedAt:missionAt(day,hour),receivedAt:missionAt(day,hour),source:'dataset-mision',synthetic:true,timeZone:'America/Lima',
    vitals:Object.fromEntries(['hr','rr','spo2','sbp','temp'].map(k=>[k,v[k]])),
    newsContext:{alert:v.alert,onOxygen:v.on_oxygen,scale:1},answers,
    note:`Check-in del día: ${d.feeling==='fine'?'refiere sentirse bien':'refiere no sentirse bien'}. Síntomas diarios: ${d.symptoms.join(', ')||'ninguno reportado'}. Sin hora de inicio documentada.`,daily:d};
}
export function baseline(data,crew,key) {
  const values=data.vitals.filter(v=>v.astro===crew&&v.day<7).map(v=>v[key]);
  const mean=values.reduce((a,b)=>a+b,0)/values.length;
  const sd=Math.sqrt(values.reduce((sum,v)=>sum+(v-mean)**2,0)/(values.length-1));
  return {mean,sd,low:mean-2*sd,high:mean+2*sd};
}
export function missionSignals(data,crew,day,hour) {
  const record=missionRecord(data,crew,day,hour), d=record.daily;
  const person=data.crew.find(p=>p.id===crew);
  const env=data.environment.find(e=>e.module===person.module&&e.day===day&&e.hour===hour);
  const signals=[];
  if(d.sleep_h<6&&d.kss>=7) signals.push({id:'S-SLEEP',text:`Sueño ${d.sleep_h} h y KSS ${d.kss}. Requiere revisión de aptitud; no otorga autorización EVA.`,source:GUIDE_SOURCE});
  if(d.eva_scheduled) signals.push({id:'S-EVA',text:'EVA programada. Se muestra el historial previo; aptitud no determinada.',source:GUIDE_SOURCE});
  if(env?.co2_mmHg>3) signals.push({id:'S-CO2',text:`CO₂ horario del módulo: ${env.co2_mmHg} mmHg; supera el criterio de demostración de la guía. No es una medición continua de promedio móvil.`,source:GUIDE_SOURCE});
  const raw=data.vitals.find(v=>v.astro===crew&&v.day===day&&v.hour===hour);
  if(day>=6&&d.feeling==='fine'&&raw.hr_z>2&&raw.rr_z>2) signals.push({id:'S-DISCORDANCE',text:'Refiere sentirse bien; FC y FR superan +2 DE de su línea base. Hallazgo descriptivo, no diagnóstico.',source:'Comparación descriptiva ±2 DE; guía KUNTUR X, escenario Diego; criterio clínico pendiente'});
  return {record,assessment:assessRecord(record),environment:env,signals};
}
export function packet(data,state,crew,end,mode='mission') {
  if(!['A','B','C','D'].includes(crew)||!['mission','local'].includes(mode)||!Number.isFinite(Date.parse(end))) throw new Error('Ventana u origen de Earth Packet inválido.');
  const endMs=Date.parse(end),startMs=endMs-24*3600000;
  const within=iso=>{const t=Date.parse(iso);return t>startMs&&t<=endMs;};
  const records=mode==='mission' ? data.vitals.filter(v=>v.astro===crew&&within(missionAt(v.day,v.hour))).map(v=>missionRecord(data,crew,v.day,v.hour)) : state.records.filter(r=>r.crew===crew&&within(r.observedAt));
  const scored=records.map(r=>({record:r,assessment:assessRecord(r)}));
  const totals=scored.map(x=>x.assessment.news.total).filter(n=>n!==null);
  const days=[...new Set(records.map(r=>r.daily?.day).filter(d=>d!==undefined))];
  const notices=[];
  for(const {record,assessment} of scored) {
    const engine=assessment.engine;
    if(engine.reason==='rule_matched') notices.push({at:record.observedAt,id:engine.ruleId,recordId:record.id,text:`Ensayo del motor: ${engine.level}`,source:engine.source.ref,clinicalReview:'pending'});
  }
  if(mode==='mission') for(const r of records) {
    const v=data.vitals.find(x=>`mission-${x.astro}-${x.day}-${x.hour}`===r.id);
    const result=missionSignals(data,crew,v.day,v.hour);
    notices.push(...result.signals.map(s=>({...s,at:r.observedAt,clinicalReview:'pending'})));
  }
  const related=state.alerts.filter(a=>a.crew===crew&&(within(a.createdAt)||['medicalAckAt','buddyAckAt','closedAt'].some(k=>a[k]&&within(a[k]))));
  const actions=state.reviews.filter(v=>within(v.at)&&state.records.some(r=>r.id===v.recordId&&r.crew===crew)).map(v=>({type:'medical-review',at:v.at,recordId:v.recordId,note:v.note}));
  for(const a of related) for(const key of ['medicalAckAt','buddyAckAt','closedAt']) if(a[key]&&within(a[key])) actions.push({type:key,at:a[key],alertId:a.id,note:'Acción de simulacro'});
  return {schemaVersion:1,synthetic:true,crew,timeZone:'America/Lima',mode,units:{hr:'lpm',rr:'rpm',spo2:'%',sbp:'mmHg',temp:'°C',dbp:'mmHg'},window:{startExclusive:new Date(startMs).toISOString(),endInclusive:end},news2:{max:totals.length?Math.max(...totals):null,complete:totals.length,incomplete:records.length-totals.length,source:NEWS_SOURCE},
    records,checkIns:mode==='mission'?data.daily.filter(d=>d.astro===crew&&days.includes(d.day)):records.filter(r=>r.source==='manual').map(r=>({id:r.id,at:r.observedAt,answers:r.answers,note:r.note})),
    notices,alerts:related,actions,queue:{status:'queued',transmitted:false,transportImplemented:false},clinicalReview:'pending'};
}
export function packetCsv(p) {
  const headers=['type','crew','time','id','hr','rr','spo2','sbp','temp','news2','detail'];
  const rows=[['summary',p.crew,p.window.endInclusive,'','','','','','',p.news2.max??'',JSON.stringify({window:p.window,queue:p.queue,clinicalReview:p.clinicalReview})]];
  for(const r of p.records) rows.push(['measurement',p.crew,r.observedAt,r.id,r.vitals.hr??'',r.vitals.rr??'',r.vitals.spo2??'',r.vitals.sbp??'',r.vitals.temp??'',assessRecord(r).news.total??'',JSON.stringify({source:r.source,newsContext:r.newsContext??null})]);
  for(const [type,list] of [['check-in',p.checkIns],['notice',p.notices],['alert',p.alerts],['action',p.actions]]) for(const r of list) rows.push([type,p.crew,r.at??r.createdAt??'',r.id??r.recordId??'','','','','','','',JSON.stringify(r)]);
  // Quote every cell and neutralize spreadsheet formula prefixes in untrusted free text.
  const cell=v=>{let s=String(v);if(/^[\s]*[=+@-]/.test(s)) s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  return '\uFEFF'+[headers,...rows].map(row=>row.map(cell).join(',')).join('\r\n');
}
