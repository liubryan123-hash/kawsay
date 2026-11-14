import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { news2, validateMission, missionRecord, missionSignals, missionAt, assessRecord, packet, packetCsv, baseline } from './mission.mjs';
import { parseEntry, initialState } from './domain.mjs';
import { renderMission, assessmentHTML } from './mission-ui.mjs';
const root=new URL('../../app/public/data/',import.meta.url);
const data=Object.fromEntries(['crew','vitals','daily','environment'].map(k=>[k,JSON.parse(readFileSync(new URL(k+'.json',root),'utf8'))]));
const normal={hr:75,rr:16,spo2:97,sbp:120,temp:36.8};
const context={alert:true,onOxygen:false,scale:1};
test('datasets completos y únicos; se rechaza una serie truncada o duplicada',()=>{
  assert.equal(validateMission(data),true);
  assert.throws(()=>validateMission({...data,vitals:data.vitals.slice(1)}));
  assert.throws(()=>validateMission({...data,vitals:[data.vitals[0],...data.vitals.slice(0,-1)]}));
});
test('NEWS2 escala 1: bordes oficiales de cada parámetro y oxígeno',()=>{
  assert.equal(news2(normal,context).total,0);
  const boundaries={
    rr:[[8,3],[9,1],[11,1],[12,0],[20,0],[21,2],[24,2],[25,3]],
    hr:[[40,3],[41,1],[50,1],[51,0],[90,0],[91,1],[110,1],[111,2],[130,2],[131,3]],
    spo2:[[91,3],[92,2],[93,2],[94,1],[95,1],[96,0]],
    sbp:[[90,3],[91,2],[100,2],[101,1],[110,1],[111,0],[219,0],[220,3]],
    temp:[[35,3],[35.1,1],[36,1],[36.1,0],[38,0],[38.1,1],[39,1],[39.1,2]],
  };
  for(const [key,pairs] of Object.entries(boundaries)) for(const [value,score] of pairs) assert.equal(news2({...normal,[key]:value},context).parts[key],score,`${key}=${value}`);
  assert.equal(news2(normal,{...context,onOxygen:true}).total,2);
  assert.equal(news2(normal,{...context,alert:false}).total,3);
});
test('NEWS2 no inventa contexto, no cambia escala automáticamente y rechaza fracciones ambiguas',()=>{
  assert.equal(news2(normal,{}).total,null);
  assert.equal(news2(normal,{...context,scale:2}).total,null);
  assert.equal(news2({...normal,spo2:95.5},context).total,null);
  assert.equal(news2({...normal,temp:38.05},context).total,null);
  assert.equal(news2({...normal,rr:undefined},context).total,null);
});
test('las cuatro historias provienen de los JSON y no de resultados fijados en la interfaz',()=>{
  const row19=data.vitals.find(r=>r.astro==='A'&&r.day===19&&r.hour===12);
  assert.equal(missionSignals(data,'A',19,12).assessment.news.total,5+(row19.sbp<=110?1:0));
  assert.equal(missionSignals(data,'A',20,12).assessment.news.total,7);
  assert.equal(missionSignals(data,'A',20,12).assessment.engine.ruleId,'D-NEWS-HIGH');
  assert.equal(missionSignals(data,'A',19,12).assessment.engine.ruleId,'D-NEWS-MED');
  assert.ok(missionSignals(data,'B',12,12).signals.some(s=>s.id==='S-SLEEP'));
  const ben=missionSignals(data,'B',15,12);
  assert.ok(ben.signals.some(s=>s.id==='S-EVA'));
  assert.equal(ben.signals.some(s=>s.id==='S-SLEEP'),false,'No arrastrar el criterio de sueño del día anterior');
  assert.ok(missionSignals(data,'C',22,10).signals.some(s=>s.id==='S-CO2'));
  assert.equal(missionSignals(data,'C',22,14).signals.some(s=>s.id==='S-CO2'),false);
  assert.ok(missionSignals(data,'D',25,12).signals.some(s=>s.id==='S-DISCORDANCE'));
});
test('el motor original recibe el registro manual y conserva desconocidos',()=>{
  const now=new Date('2026-11-14T01:00:00Z');
  const r=parseEntry({crew:'A',time:'2026-11-13T20:00',sleep:'',hr:'116',rr:'24',spo2:'94',sbp:'120',temp:'39.2',newsAlert:'yes',newsOxygen:'no',newsScale:'1'},now);
  assert.equal(assessRecord(r).news.total,7);
  assert.equal(assessRecord(r).engine.level,'emergency');
  const chest=parseEntry({crew:'B',time:'2026-11-13T20:00',sleep:'',symptom2:'present'},now);
  assert.equal(assessRecord(chest).engine.ruleId,'D-CHEST');
  assert.equal(assessRecord(chest).news.total,null);
  const unknown={...r,vitals:{...r.vitals,hr:105,rr:22,temp:38.5,spo2:95}};
  assert.equal(assessRecord(unknown).engine.level,'insufficient','Falta respuesta de dolor de pecho: bloquea resultado de menor gravedad');
});
test('Earth Packet contiene exactamente 24 horas, máximo calculado, check-in y cola sin envío',()=>{
  const p=packet(data,initialState(),'A',missionAt(20,23));
  assert.equal(p.records.length,24);
  const expectedMax=7+(data.vitals.some(v=>v.astro==='A'&&v.day===20&&v.sbp<=110)?1:0);
  assert.equal(p.news2.max,expectedMax);assert.equal(p.news2.complete,24);
  assert.equal(p.checkIns.length,1);assert.equal(p.checkIns[0].day,20);
  assert.equal(p.queue.transmitted,false);assert.equal(p.clinicalReview,'pending');
  const edge=packet(data,initialState(),'A',missionAt(1,0));
  assert.equal(edge.records.length,24);assert.equal(edge.records.some(r=>r.observedAt===missionAt(0,0)),false);
  assert.equal(edge.records.some(r=>r.observedAt===missionAt(1,0)),true);
});
test('Earth Packet local filtra por tripulante y fecha; preserva revisiones y datos incompletos',()=>{
  const end='2026-11-14T01:00:00Z';
  const r=parseEntry({crew:'A',time:'2026-11-13T19:00',sleep:'',note:'Reporte ficticio'},new Date(end),'r');
  const state={...initialState(),records:[r,{...r,id:'other',crew:'B'}],reviews:[{id:'review',recordId:'r',note:'Revisión ficticia',at:end}],alerts:[]};
  const p=packet(data,state,'A',end,'local');
  assert.equal(p.records.length,1);assert.equal(p.news2.max,null);assert.equal(p.news2.incomplete,1);assert.equal(p.actions.length,1);
  assert.equal(p.checkIns[0].note,'Reporte ficticio');
  const csv=packetCsv(p);assert.ok(csv.includes('medical-review'));assert.ok(csv.includes('Revisión ficticia'));
  assert.ok(csv.includes('"measurement"'));assert.ok(csv.includes('"check-in"'));
});
test('gráficos y pantallas se generan con datos, sin inyectar HTML desde los reportes',()=>{
  for(const view of ['tripulacion','detalle','packet']) {
    const html=renderMission(view,data,initialState(),'A',20,23,'mission');
    assert.ok(html.length>1000);assert.ok(!html.includes('NaN'));
  }
  assert.ok(renderMission('detalle',data,initialState(),'A',20,23,'mission').includes('<polyline'));
  const base=baseline(data,'A','hr');assert.ok(base.sd>0);
  assert.ok(assessmentHTML(missionRecord(data,'A',20,12)).includes('NEWS2 7'));
});
test('el paquete local conserva el criterio activado por un reporte manual',()=>{
  const end='2026-11-14T01:00:00Z';
  const record=parseEntry({crew:'A',time:'2026-11-13T19:00',sleep:'',symptom2:'present'},new Date(end),'local-chest');
  const p=packet(data,{...initialState(),records:[record]},'A',end,'local');
  assert.equal(p.notices.length,1);
  assert.equal(p.notices[0].id,'D-CHEST');
  assert.equal(p.notices[0].recordId,record.id);
  assert.equal(p.notices[0].clinicalReview,'pending');
  assert.equal(p.news2.max,null);
});
