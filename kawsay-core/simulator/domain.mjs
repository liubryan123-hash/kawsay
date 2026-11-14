export const CREW = ['A', 'B', 'C', 'D'];
export const VERSION = 1;
export const KEY = 'kawsay.simulador.v1';
export const REST = ['Nada reparador', 'Poco reparador', 'Bastante reparador', 'Muy reparador'];
export const ACTIVITY = ['Ninguna', 'Leve', 'Moderada', 'Mucha', 'No realicé actividades'];
export const VITALS = [
  ['hr', 'Frecuencia cardiaca', 'lpm', 1, 300],
  ['rr', 'Frecuencia respiratoria', 'rpm', 1, 100],
  ['spo2', 'Saturación de oxígeno', '%', 0, 100],
  ['temp', 'Temperatura', '°C', 20, 45],
  ['sbp', 'Presión sistólica', 'mmHg', 1, 300],
  ['dbp', 'Presión diastólica', 'mmHg', 1, 200],
]; // Límites de entrada para la demo, no umbrales de alerta.
export const SYMPTOMS = ['Fatiga o cansancio', 'Dificultad para respirar', 'Dolor en el pecho', 'Dolor de cabeza'];
export function limaInput(now = new Date()) {
  return new Date(now.getTime() - 5 * 3600000).toISOString().slice(0, 16);
}
export function displayTime(iso) {
  return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(iso));
}
export function initialState() { return { version: VERSION, synthetic: true, records: [], reviews: [], alerts: [] }; }
function assert(ok, message) { if (!ok) throw new Error(message); }
export function parseEntry(input, now = new Date(), id = crypto.randomUUID()) {
  assert(CREW.includes(input.crew), 'Selecciona un tripulante.');
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.time), 'Indica la fecha y hora de Perú.');
  const observed = new Date(input.time + ':00-05:00');
  assert(Number.isFinite(+observed) && limaInput(observed) === input.time && observed <= now, 'La fecha debe existir y no estar en el futuro.');
  const vitals = {};
  for (const [key, label, , min, max] of VITALS) {
    let raw = String(input[key] ?? '').trim();
    if (!raw) continue;
    if (key === 'spo2') raw = raw.replace(/\s*%$/, '').trim();
    raw = raw.replace(',', '.');
    assert(/^\d+(\.\d+)?$/.test(raw), label + ': introduce un número válido.');
    const value = Number(raw);
    assert(Number.isFinite(value) && value >= min && value <= max, label + ': fuera de los límites de entrada de la demo.');
    vitals[key] = value;
  }
  assert(!(vitals.sbp !== undefined && vitals.dbp !== undefined && vitals.sbp < vitals.dbp), 'Revisa la presión: la sistólica es menor que la diastólica.');
  const answers = {};
  if (input.sleep !== '' && input.sleep != null) {
    const sleep = Number(String(input.sleep ?? '').replace(',', '.'));
    assert(input.sleep != null && Number.isFinite(sleep) && sleep >= 0 && sleep <= 24, 'Las horas de sueño deben estar entre 0 y 24.');
    answers.sleep = sleep;
  }
  for (const [key, options] of [['rest', REST], ['activity', ACTIVITY]]) {
    if (input[key]) { assert(options.includes(input[key]), 'Respuesta funcional no válida.'); answers[key] = input[key]; }
  }
  for (let n = 0; n < SYMPTOMS.length; n++) {
    const value = input['symptom' + n];
    assert(!value || ['present', 'absent'].includes(value), 'Respuesta de síntoma no válida.');
    if (value) answers['symptom' + n] = value === 'present';
  }
  const note = String(input.note ?? '').trim();
  assert(note.length <= 1000, 'El reporte admite hasta 1000 caracteres.');
  assert(Object.keys(vitals).length || Object.keys(answers).length || note, 'Registra al menos una medición, respuesta o reporte.');
  const newsContext = {};
  for(const [key,name] of [['alert','newsAlert'],['onOxygen','newsOxygen']]) {
    const raw=input[name];
    assert(!raw || ['yes','no'].includes(raw), 'Contexto NEWS2 inválido.');
    if(raw) newsContext[key]=raw==='yes';
  }
  assert(!input.newsScale || input.newsScale==='1', 'Solo escala 1 disponible en este prototipo.');
  if(input.newsScale==='1') newsContext.scale=1;
  return { id, crew: input.crew, observedAt: observed.toISOString(), receivedAt: now.toISOString(), timeZone: 'America/Lima', source: 'manual', synthetic: true, vitals, answers, note, newsContext };
}
export function sensorRecord(crew, now = new Date(), id = crypto.randomUUID(), tick = 0) {
  assert(CREW.includes(crew), 'Tripulante desconocido.');
  const base = { A: 64, B: 58, C: 68, D: 62 }[crew];
  return { id, crew, observedAt: now.toISOString(), receivedAt: now.toISOString(), timeZone: 'America/Lima', source: 'sensor-simulado', synthetic: true,
    vitals: { hr: base + (tick % 7), rr: 14 + (tick % 3), spo2: 97 + (tick % 2), temp: 36.6 + (tick % 3) / 10 }, answers: {}, note: '' };
}
export function validState(state) {
  try {
    assert(state?.version === VERSION && state.synthetic === true, 'Versión incompatible.');
    for (const list of ['records', 'reviews', 'alerts']) assert(Array.isArray(state[list]), 'Lista inválida.');
    const ids = new Set();
    for (const r of state.records) {
      assert(typeof r.id === 'string' && r.id && !ids.has(r.id), 'ID inválido.'); ids.add(r.id);
      assert(CREW.includes(r.crew) && r.synthetic === true && ['manual', 'sensor-simulado'].includes(r.source), 'Registro inválido.');
      assert(Number.isFinite(Date.parse(r.observedAt)) && Number.isFinite(Date.parse(r.receivedAt)) && Date.parse(r.observedAt) <= Date.parse(r.receivedAt), 'Hora inválida.');
      assert(r.timeZone === 'America/Lima' && typeof r.note === 'string' && r.note.length <= 1000, 'Contexto inválido.');
      assert(r.vitals && r.answers && !Array.isArray(r.vitals) && !Array.isArray(r.answers), 'Respuestas inválidas.');
      if(r.newsContext!==undefined) {
        assert(r.newsContext && typeof r.newsContext==='object' && !Array.isArray(r.newsContext), 'Contexto NEWS2 inválido.');
        for(const [key,value] of Object.entries(r.newsContext)) assert(key==='scale' ? value===1 : ['alert','onOxygen'].includes(key)&&typeof value==='boolean','Contexto NEWS2 inválido.');
      }
      for (const [key, value] of Object.entries(r.vitals)) {
        const def = VITALS.find(v => v[0] === key);
        assert(def && typeof value === 'number' && Number.isFinite(value) && value >= def[3] && value <= def[4], 'Medición inválida.');
      }
      for (const [key, value] of Object.entries(r.answers)) {
        assert((key === 'sleep' && typeof value === 'number' && value >= 0 && value <= 24) ||
          (key === 'rest' && REST.includes(value)) || (key === 'activity' && ACTIVITY.includes(value)) ||
          (/^symptom[0-3]$/.test(key) && typeof value === 'boolean'), 'Respuesta inválida.');
      }
    }
    const reviewIds = new Set();
    for (const review of state.reviews) {
      assert(typeof review.id === 'string' && !reviewIds.has(review.id) && ids.has(review.recordId) && typeof review.note === 'string' && review.note.trim() && review.note.length <= 1000 && Number.isFinite(Date.parse(review.at)), 'Revisión inválida.');
      reviewIds.add(review.id);
    }
    const alertIds = new Set();
    for (const a of state.alerts) {
      assert(typeof a.id === 'string' && !alertIds.has(a.id) && CREW.includes(a.crew) && CREW.includes(a.buddy) && a.crew !== a.buddy && a.synthetic === true, 'Alerta inválida.');
      alertIds.add(a.id);
      assert(typeof a.message === 'string' && a.message.length <= 1000 && Number.isFinite(Date.parse(a.createdAt)), 'Mensaje inválido.');
      for (const key of ['medicalAckAt', 'buddyAckAt', 'closedAt']) assert(a[key] === null || Number.isFinite(Date.parse(a[key])), 'Estado inválido.');
      assert(!a.closedAt || (a.medicalAckAt && a.buddyAckAt), 'Cierre sin confirmación.');
    }
    return true;
  } catch { return false; }
}
export function loadState(storage) {
  const raw = storage.getItem(KEY);
  if (raw === null) return initialState();
  const state = JSON.parse(raw);
  assert(validState(state), 'Historial incompatible o dañado. No se sobrescribirá.');
  return state;
}
export function saveState(storage, state) {
  assert(validState(state), 'No se puede guardar un estado inválido.');
  storage.setItem(KEY, JSON.stringify(state));
  return state;
}
export function latestVitals(records, crew) {
  // Una toma completa o parcial: no mezcla valores de momentos distintos.
  return records.filter(r => r.crew === crew && Object.keys(r.vitals).length).sort((a,b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0];
}
export function newAlert(crew, buddy, now = new Date(), id = crypto.randomUUID()) {
  assert(CREW.includes(crew) && CREW.includes(buddy) && crew !== buddy, 'Selecciona un compañero distinto.');
  return { id, crew, buddy, synthetic: true, message: 'Solicitud manual de apoyo del astronauta. Simulacro.', createdAt: now.toISOString(), medicalAckAt: null, buddyAckAt: null, closedAt: null };
}
export function transitionAlert(alert, action, now = new Date()) {
  assert(!alert.closedAt, 'El simulacro ya está cerrado.');
  const next = { ...alert };
  if (action === 'medical') next.medicalAckAt ??= now.toISOString();
  else if (action === 'buddy') next.buddyAckAt ??= now.toISOString();
  else if (action === 'close') { assert(next.medicalAckAt && next.buddyAckAt, 'Falta confirmar recepción médica y del compañero.'); next.closedAt = now.toISOString(); }
  else throw new Error('Acción desconocida.');
  return next;
}
