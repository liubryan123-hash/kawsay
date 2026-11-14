import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { CREW, KEY, initialState, parseEntry, limaInput, sensorRecord, latestVitals, validState, loadState, saveState, newAlert, transitionAlert } from './domain.mjs';
const now = new Date('2026-11-14T01:00:00Z');
const input = { crew:'A', time:'2026-11-13T19:59', sleep:'', note:'' };
function storage() { const data = new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}; }
test('97 y 97% se guardan como el mismo número; cero no es ausencia',()=>{
  const a=parseEntry({...input,spo2:'97'},now,'a');
  const b=parseEntry({...input,spo2:'97%'},now,'b');
  assert.equal(a.vitals.spo2,97);assert.equal(b.vitals.spo2,97);
  assert.equal(parseEntry({...input,sleep:'0'},now).answers.sleep,0);
  assert.deepEqual(a.answers,{});
});
test('sin evaluar se omite, negativo explícito se conserva, preguntas funcionales no son booleanas',()=>{
  const r=parseEntry({...input,symptom0:'absent',rest:'Poco reparador',activity:'No realicé actividades'},now);
  assert.equal(r.answers.symptom0,false);assert.equal(r.answers.symptom1,undefined);
  assert.equal(r.answers.activity,'No realicé actividades');
  assert.deepEqual(r.vitals,{});
});
test('hora de Perú es independiente de la zona del equipo y rechaza fechas inexistentes o futuras',()=>{
  const r=parseEntry({...input,hr:'70'},now);
  assert.equal(r.observedAt,'2026-11-14T00:59:00.000Z');
  assert.equal(limaInput(now),'2026-11-13T20:00');
  for(const time of ['2026-02-30T12:00','2026-11-13T20:01','not-a-date']) assert.throws(()=>parseEntry({...input,time,hr:'70'},now));
});
test('rechaza valores malformados y presiones invertidas sin convertirlos en datos pendientes',()=>{
  for(const hr of ['abc','-1','301','1e2','0x64']) assert.throws(()=>parseEntry({...input,hr},now));
  assert.throws(()=>parseEntry({...input,spo2:'101'},now));
  assert.throws(()=>parseEntry({...input,sbp:'80',dbp:'90'},now));
  assert.throws(()=>parseEntry(input,now));
});
test('la toma del visor es del tripulante y momento correctos; no mezcla mediciones antiguas',()=>{
  const a=sensorRecord('A',now,'old'), b=sensorRecord('B',now,'other');
  const fresh=parseEntry({...input,time:'2026-11-13T20:00',hr:'72'},now,'new');
  const old={...a,observedAt:'2026-11-14T00:00:00Z'};
  const latest=latestVitals([fresh,old,b],'A');
  assert.equal(latest.id,'new');assert.equal(latest.vitals.spo2,undefined);
  assert.equal(latestVitals([b],'D'),undefined);
});
test('flujo completo: registro, persistencia, revisión y confirmaciones de ambos destinatarios',()=>{
  const s=storage();let state=loadState(s);
  const record=parseEntry({...input,note:'Reporte ficticio',hr:'70'},now,'record');
  state={...state,records:[record]};saveState(s,state);
  assert.equal(loadState(s).records[0].note,'Reporte ficticio');
  state.reviews.push({id:'review',recordId:'record',note:'Revisado en simulación',at:now.toISOString()});
  let a=newAlert('A','B',now,'alert');
  assert.throws(()=>transitionAlert(a,'close',now));
  a=transitionAlert(a,'medical',now);assert.throws(()=>transitionAlert(a,'close',now));
  a=transitionAlert(a,'buddy',now);a=transitionAlert(a,'close',now);
  assert.throws(()=>transitionAlert(a,'buddy',now));
  state.alerts.push(a);saveState(s,state);
  assert.equal(loadState(s).reviews.length,1);assert.equal(loadState(s).alerts[0].closedAt,now.toISOString());
  assert.throws(()=>newAlert('A','A',now));
});
test('historial corrupto y fallos de escritura no se convierten en guardado exitoso',()=>{
  const s=storage();s.setItem(KEY,'broken');assert.throws(()=>loadState(s));assert.equal(s.getItem(KEY),'broken');
  assert.throws(()=>saveState({setItem(){throw new Error('Quota');}},initialState()),/Quota/);
  const r=sensorRecord('A',now,'duplicate');
  assert.equal(validState({...initialState(),records:[r,r]}),false);
  assert.equal(validState({...initialState(),records:[{...r,vitals:{spo2:150}}]}),false);
  assert.equal(validState({...initialState(),reviews:[{id:'orphan',recordId:'none',note:'x',at:now.toISOString()}]}),false);
});
test('los sensores solo generan mediciones ficticias, sin respuestas inferidas',()=>{
  for(const c of CREW){const r=sensorRecord(c,now);assert.deepEqual(r.answers,{});assert.equal(r.synthetic,true);assert.equal(validState({...initialState(),records:[r]}),true);}
});
test('HTML autónomo en español contiene las cinco vistas y JavaScript con sintaxis válida',()=>{
  const html=readFileSync(new URL('../demo/kawsay-simulador.html',import.meta.url),'utf8');
  assert.match(html,/<html lang="es">/);
  assert.doesNotMatch(html,/<script[^>]+src=/);
  const code=html.match(/<script type="module">([\s\S]*)<\/script>/)[1];
  new vm.Script(code);
  for(const label of ['Registro','Visor del casco','Panel médico','Compañero de apoyo','Avance y límites']) assert.ok(code.includes(label));
});
