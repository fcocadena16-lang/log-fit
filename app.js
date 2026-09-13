'use strict';

const DB_NAME = 'fit-log-db';
const DB_VERSION = 1;
const STORE_SESSIONS = 'sessions';
const STORE_MEASUREMENTS = 'measurements';
const STORE_SETTINGS = 'settings';

const ROUTINES = {
  'Upper 1': [
    ['Press inclinado con barra','kg',3,'~92.5 kg · 4 / 4 / 3'],
    ['Chest-supported row','kg',3,'60 kg · 8 / 7 / 6'],
    ['Pec deck fly','kg',2,'~95 kg / 210 lb · 8 / 6'],
    ['Lat pulldown agarre abierto','lb',2,'160 → 145 lb · 6 → 8'],
    ['Laterales mancuerna','lb',4,'30 lb c/u · 9 / 9 / 8 / 8'],
    ['Reverse fly máquina','lb',3,'140 lb · 9 / 8 / 8'],
    ['Incline curl sentado','lb',2,'40 lb c/u · 8 / 7'],
    ['Overhead triceps','lb',3,'100 lb · 9 / 8 / 8'],
    ['Shrugs','lb',2,'100 lb · 10 / 9'],
    ['Wrist curl','lb',2,'80 lb · 10 / 10'],
    ['Wrist extension','lb',2,'30 lb · 9 / 9']
  ],
  'Upper 2': [
    ['Press inclinado mancuernas','lb',3,'85 → 95 lb c/u · 9 → 6 / 4'],
    ['Remo mancuerna banco inclinado','lb',3,'70 lb c/u · 8 / 7 / 6'],
    ['Pec deck fly','kg',2,'~95 kg / 210 lb · 8 / 7'],
    ['Neutral-grip pulldown','lb',2,'160 lb · 8 / 7'],
    ['Laterales cable','lb',4,'40 lb · 8 / 8 / 7 / 6'],
    ['Reverse fly cable','lb',3,'30 lb · 8 / 7 / 6'],
    ['Curl barra Z parado','lb',3,'90 lb · 7 / 6 / 6'],
    ['Overhead triceps','lb',2,'100 lb · 8 / 7'],
    ['Skullcrusher barra Z','lb',2,'90 lb · 8 / 8'],
    ['Shrugs','lb',2,'100 lb · 9 / 9'],
    ['Wrist curl','lb',2,'80 lb · 11 / 9'],
    ['Wrist extension','lb',2,'30 lb · 9 / 8']
  ],
  'Lower 1': [
    ['Leg extension','lb',2,'130 lb · 10 / 9'],
    ['Seated leg curl','kg',2,'86 kg · 8 / 7'],
    ['Hack squat','kg',3,'120 kg · 7 / 6 / 5'],
    ['RDL','kg',2,'~124 kg · 8 / 6'],
    ['Aducción','lb',3,'150 lb · 10 / 9 / 8'],
    ['Abducción','lb',3,'120 lb · 10 / 9 / 9'],
    ['Pantorrilla','kg',4,'145 kg · 9 / 9 / 8 / 7'],
    ['Cable crunch','lb',2,'150 lb · 8 / 8']
  ],
  'Lower 2': [
    ['Hack squat','kg',4,'122.5 kg ×9 · dropset 145.1 ×2 → 122.5 +4 · 122.5 ×6'],
    ['RDL','kg',2,'~124 kg · 8 / 6'],
    ['Leg extension','lb',2,'130 lb · 7 / 6'],
    ['Seated leg curl','kg',2,'86 kg · 6 / 6'],
    ['Lying leg curl','lb',1,'Peso anterior no verificable · 7'],
    ['Abducción','lb',2,'120 lb · 9 / 9'],
    ['Aducción','lb',2,'140 lb · 8 / 8'],
    ['Pantorrilla','kg',3,'145 kg · 8 / 8 / 7']
  ]
};

const MEASURE_FIELDS = [
  ['weight','Peso','kg'],
  ['armRelaxed','Brazo relajado','cm'],
  ['armFlexed','Brazo en flexión','cm'],
  ['chest','Circunferencia mesoesternal','cm'],
  ['waistMin','Cintura mínima','cm'],
  ['waistNavel','Cintura ombligo','cm'],
  ['hipMax','Cadera máxima','cm'],
  ['thighUpper','Muslo a 1 cm del glúteo','cm'],
  ['thighMid','Muslo medio','cm'],
  ['calf','Pantorrilla máxima','cm'],
  ['forearm','Antebrazo','cm']
];

let dbPromise;
let currentView = 'home';
let activeSessionDraft = null;
let historyTab = 'sessions';

function openDB(){
  if(dbPromise) return dbPromise;
  dbPromise = new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains(STORE_SESSIONS)) db.createObjectStore(STORE_SESSIONS,{keyPath:'id'});
      if(!db.objectStoreNames.contains(STORE_MEASUREMENTS)) db.createObjectStore(STORE_MEASUREMENTS,{keyPath:'id'});
      if(!db.objectStoreNames.contains(STORE_SETTINGS)) db.createObjectStore(STORE_SETTINGS,{keyPath:'key'});
    };
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
  return dbPromise;
}
function tx(store,mode='readonly'){ return openDB().then(db=>db.transaction(store,mode).objectStore(store)); }
async function put(store,obj){ const s=await tx(store,'readwrite'); return new Promise((res,rej)=>{const r=s.put(obj);r.onsuccess=()=>res(obj);r.onerror=()=>rej(r.error)}); }
async function getAll(store){ const s=await tx(store); return new Promise((res,rej)=>{const r=s.getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)}); }
async function getOne(store,id){ const s=await tx(store); return new Promise((res,rej)=>{const r=s.get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}); }
async function del(store,id){ const s=await tx(store,'readwrite'); return new Promise((res,rej)=>{const r=s.delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)}); }

const esc = s => String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const today = () => new Date().toISOString().slice(0,10);
const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
function fmtDate(v){ if(!v) return ''; const [y,m,d]=v.slice(0,10).split('-'); return `${d}/${m}/${y}`; }
function num(v){ const n=parseFloat(v); return Number.isFinite(n)?n:null; }

async function latestMeasurement(){
  const all=await getAll(STORE_MEASUREMENTS); return all.sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
}
async function latestExerciseRecord(name){
  const sessions=(await getAll(STORE_SESSIONS)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
  for(const s of sessions){ const ex=s.exercises?.find(e=>e.name===name); if(ex) return {session:s,exercise:ex}; }
  return null;
}

function setView(view){ currentView=view; document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===view)); render(); }

async function render(){
  const app=document.getElementById('app');
  if(currentView==='home') app.innerHTML=await homeHTML();
  if(currentView==='train') app.innerHTML=trainHTML();
  if(currentView==='measure') app.innerHTML=await measureHTML();
  if(currentView==='history') app.innerHTML=await historyHTML();
  if(currentView==='progress') app.innerHTML=await progressHTML();
  bindViewEvents();
}

async function homeHTML(){
  const m=await latestMeasurement(); const sessions=await getAll(STORE_SESSIONS);
  const recent=sessions.sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt).slice(0,3);
  return `<main class="screen">
    <div class="topbar"><div><div class="subtle">Registro personal</div><h1>Fit Log</h1></div><span class="status ok">● Local</span></div>
    <section class="card hero"><div class="subtle">Última medición</div><div class="hero-grid">
      <div class="metric"><span class="subtle">Peso</span><strong>${m?.weight??'—'}${m?.weight?' kg':''}</strong></div>
      <div class="metric"><span class="subtle">Cintura</span><strong>${m?.waistMin??'—'}${m?.waistMin?' cm':''}</strong></div>
    </div></section>
    <div class="section-title"><h2>Entrenar</h2><button class="btn ghost" data-action="measure-now">+ Mediciones</button></div>
    <div class="routine-grid">${Object.keys(ROUTINES).map(n=>`<button class="routine-btn" data-routine="${esc(n)}"><strong>${esc(n)}</strong><small>${ROUTINES[n].length} ejercicios</small></button>`).join('')}</div>
    <div class="section-title"><h2>Reciente</h2><button class="btn ghost" data-action="history">Ver todo</button></div>
    ${recent.length?`<div class="list">${recent.map(s=>`<button class="list-item" data-session-id="${s.id}"><strong>${esc(s.routine)}</strong><span class="subtle">${fmtDate(s.date)} · ${s.exercises.length} ejercicios</span></button>`).join('')}</div>`:'<div class="empty">Todavía no hay entrenamientos guardados.</div>'}
  </main>`;
}
function trainHTML(){
  return `<main class="screen"><div class="topbar"><div><div class="subtle">Selecciona tu sesión</div><h1>Entrenar</h1></div></div>
  <div class="routine-grid">${Object.keys(ROUTINES).map(n=>`<button class="routine-btn" data-routine="${esc(n)}"><strong>${esc(n)}</strong><small>${ROUTINES[n].length} ejercicios</small></button>`).join('')}</div>
  <div class="notice" style="margin-top:18px">Cada serie guarda peso, repeticiones y RIR. Las sensaciones y notas quedan separadas por ejercicio.</div></main>`;
}

async function startRoutine(name){
  const exercises=[];
  for(const [exName,unit,setCount,seed] of ROUTINES[name]){
    const prev=await latestExerciseRecord(exName);
    exercises.push({name:exName,defaultUnit:unit,seed,previous:prev?formatPrevious(prev):seed,sets:Array.from({length:setCount},(_,i)=>({n:i+1,weight:'',unit,reps:'',rir:''})),feeling:'',notes:''});
  }
  activeSessionDraft={id:uid('session'),date:today(),routine:name,createdAt:Date.now(),overallFeeling:'',notes:'',exercises};
  renderWorkout();
}
function formatPrevious(rec){
  const sets=rec.exercise.sets.filter(s=>s.reps!==''||s.weight!=='');
  if(!sets.length) return 'Sin series registradas';
  return `${fmtDate(rec.session.date)} · `+sets.map(s=>`${s.weight||'—'} ${s.unit} × ${s.reps||'—'}${s.rir!==''?` @${s.rir} RIR`:''}`).join(' · ');
}
function renderWorkout(){
  const s=activeSessionDraft; if(!s) return;
  document.getElementById('bottomNav').classList.add('hide');
  document.getElementById('app').innerHTML=`<main class="screen">
    <div class="topbar"><button class="btn ghost" data-action="close-workout">← Salir</button><div style="text-align:right"><div class="subtle">${fmtDate(s.date)}</div><h1 style="font-size:22px">${esc(s.routine)}</h1></div></div>
    <div class="progressbar"><div style="width:${completionPct(s)}%"></div></div>
    <div class="field"><label>Fecha</label><input id="sessionDate" type="date" value="${s.date}"></div>
    <div id="exerciseList">${s.exercises.map((e,i)=>exerciseHTML(e,i)).join('')}</div>
    <section class="card"><h3 style="margin-top:0">Sesión</h3><div class="field"><label>Sensación general</label><select id="overallFeeling"><option value="">Seleccionar</option>${['Excelente','Bien','Normal','Pesada','Muy pesada','Molestia'].map(v=>`<option ${s.overallFeeling===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>Notas generales</label><textarea id="sessionNotes">${esc(s.notes)}</textarea></div></section>
    <div class="sticky-actions"><button class="btn primary block" data-action="save-session">Guardar entrenamiento</button></div>
  </main>`;
  bindWorkoutEvents();
}
function exerciseHTML(e,i){
  return `<section class="card exercise" data-ex="${i}"><div class="exercise-head"><div><h3>${i+1}. ${esc(e.name)}</h3><div class="previous">Último registro: ${esc(e.previous||e.seed)}</div></div></div>
    <div class="set-head"><span>Serie</span><span>Peso</span><span>Reps</span><span>RIR</span><span></span></div>
    <div class="sets">${e.sets.map((st,j)=>setRowHTML(st,i,j)).join('')}</div>
    <div class="exercise-footer"><button class="btn ghost" data-add-set="${i}">+ Serie</button></div>
    <div class="form-grid"><div class="field"><label>Sensaciones</label><select data-feeling="${i}"><option value="">Seleccionar</option>${['Muy ligero','Bien','Normal','Pesado','Muy pesado','Molestia'].map(v=>`<option ${e.feeling===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>Notas</label><textarea data-notes="${i}" placeholder="Técnica, molestias, ajustes…">${esc(e.notes)}</textarea></div></div></section>`;
}
function setRowHTML(st,ei,si){
  return `<div class="set-row" data-set="${si}"><span class="set-num">${si+1}</span><div class="row" style="gap:4px"><input inputmode="decimal" placeholder="0" value="${esc(st.weight)}" data-k="weight" data-ei="${ei}" data-si="${si}"><select data-k="unit" data-ei="${ei}" data-si="${si}"><option ${st.unit==='kg'?'selected':''}>kg</option><option ${st.unit==='lb'?'selected':''}>lb</option></select></div><input inputmode="numeric" placeholder="0" value="${esc(st.reps)}" data-k="reps" data-ei="${ei}" data-si="${si}"><input inputmode="numeric" placeholder="0" value="${esc(st.rir)}" data-k="rir" data-ei="${ei}" data-si="${si}"><button class="icon-btn" data-remove-set="${ei}:${si}" aria-label="Eliminar serie">×</button></div>`;
}
function completionPct(s){ const total=s.exercises.length; const done=s.exercises.filter(e=>e.sets.some(st=>st.reps!==''||st.weight!=='')).length; return total?Math.round(done/total*100):0; }
function bindWorkoutEvents(){
  document.querySelector('[data-action="close-workout"]')?.addEventListener('click',()=>{ if(confirm('¿Salir? El entrenamiento no guardado se perderá.')){activeSessionDraft=null;document.getElementById('bottomNav').classList.remove('hide');setView('train');} });
  document.getElementById('sessionDate')?.addEventListener('change',e=>activeSessionDraft.date=e.target.value);
  document.getElementById('overallFeeling')?.addEventListener('change',e=>activeSessionDraft.overallFeeling=e.target.value);
  document.getElementById('sessionNotes')?.addEventListener('input',e=>activeSessionDraft.notes=e.target.value);
  document.querySelectorAll('[data-k]').forEach(el=>el.addEventListener('input',e=>{const {ei,si,k}=e.target.dataset;activeSessionDraft.exercises[+ei].sets[+si][k]=e.target.value;document.querySelector('.progressbar>div').style.width=completionPct(activeSessionDraft)+'%';}));
  document.querySelectorAll('[data-feeling]').forEach(el=>el.addEventListener('change',e=>activeSessionDraft.exercises[+e.target.dataset.feeling].feeling=e.target.value));
  document.querySelectorAll('[data-notes]').forEach(el=>el.addEventListener('input',e=>activeSessionDraft.exercises[+e.target.dataset.notes].notes=e.target.value));
  document.querySelectorAll('[data-add-set]').forEach(b=>b.addEventListener('click',()=>{const i=+b.dataset.addSet;const e=activeSessionDraft.exercises[i];e.sets.push({n:e.sets.length+1,weight:'',unit:e.defaultUnit,reps:'',rir:''});renderWorkout();}));
  document.querySelectorAll('[data-remove-set]').forEach(b=>b.addEventListener('click',()=>{const [ei,si]=b.dataset.removeSet.split(':').map(Number);const e=activeSessionDraft.exercises[ei];if(e.sets.length===1)return;e.sets.splice(si,1);e.sets.forEach((x,n)=>x.n=n+1);renderWorkout();}));
  document.querySelector('[data-action="save-session"]')?.addEventListener('click',saveSession);
}
async function saveSession(){
  const hasData=activeSessionDraft.exercises.some(e=>e.sets.some(s=>s.weight!==''||s.reps!==''));
  if(!hasData){alert('Registra al menos una serie antes de guardar.');return;}
  await put(STORE_SESSIONS,JSON.parse(JSON.stringify(activeSessionDraft)));
  activeSessionDraft=null; document.getElementById('bottomNav').classList.remove('hide'); currentView='history'; document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view==='history')); await render();
}

async function measureHTML(){
  const prev=await latestMeasurement();
  return `<main class="screen"><div class="topbar"><div><div class="subtle">Registro semanal</div><h1>Mediciones</h1></div></div>
    ${prev?`<div class="notice">Último registro: ${fmtDate(prev.date)} · ${prev.weight??'—'} kg</div>`:''}
    <form id="measureForm" class="card"><div class="field"><label>Fecha</label><input name="date" type="date" value="${today()}" required></div><div class="form-grid">${MEASURE_FIELDS.map(([k,l,u])=>`<div class="field"><label>${l} (${u})</label><input name="${k}" inputmode="decimal" type="number" step="0.1" placeholder="${prev?.[k]??''}"></div>`).join('')}</div><div class="field"><label>Notas</label><textarea name="notes" placeholder="Condiciones de medición, observaciones…"></textarea></div><button class="btn primary block" type="submit">Guardar mediciones</button></form>
  </main>`;
}
async function saveMeasurement(form){
  const fd=new FormData(form); const obj={id:uid('measure'),createdAt:Date.now()};
  for(const [k,v] of fd.entries()) obj[k]=v;
  if(!obj.date) obj.date=today();
  await put(STORE_MEASUREMENTS,obj); currentView='history'; historyTab='measurements'; document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view==='history')); render();
}

async function historyHTML(){
  const sessions=(await getAll(STORE_SESSIONS)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
  const measures=(await getAll(STORE_MEASUREMENTS)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
  const list=historyTab==='sessions'?
    (sessions.length?sessions.map(s=>`<button class="list-item" data-session-id="${s.id}"><strong>${esc(s.routine)}</strong><span class="subtle">${fmtDate(s.date)} · ${s.exercises.length} ejercicios</span><div class="chips">${s.overallFeeling?`<span class="chip">${esc(s.overallFeeling)}</span>`:''}<span class="chip">${s.exercises.reduce((n,e)=>n+e.sets.filter(x=>x.reps!==''||x.weight!=='').length,0)} series</span></div></button>`).join(''):'<div class="empty">No hay entrenamientos guardados.</div>'):
    (measures.length?measures.map(m=>`<button class="list-item" data-measure-id="${m.id}"><strong>${fmtDate(m.date)}</strong><span class="subtle">${m.weight?`${m.weight} kg`:''}${m.waistMin?` · cintura ${m.waistMin} cm`:''}</span></button>`).join(''):'<div class="empty">No hay mediciones guardadas.</div>');
  return `<main class="screen"><div class="topbar"><div><div class="subtle">Todos tus registros</div><h1>Historial</h1></div></div><div class="tabs"><button class="tab ${historyTab==='sessions'?'active':''}" data-history-tab="sessions">Entrenamientos</button><button class="tab ${historyTab==='measurements'?'active':''}" data-history-tab="measurements">Mediciones</button></div><div class="list" style="margin-top:12px">${list}</div></main>`;
}
async function showSession(id){
  const s=await getOne(STORE_SESSIONS,id); if(!s)return;
  document.getElementById('bottomNav').classList.add('hide');
  document.getElementById('app').innerHTML=`<main class="screen"><div class="topbar"><button class="btn ghost" data-back-history>← Historial</button><button class="btn danger" data-delete-session="${s.id}">Eliminar</button></div><h1>${esc(s.routine)}</h1><div class="subtle">${fmtDate(s.date)}</div>${s.exercises.map(e=>`<section class="card"><h3>${esc(e.name)}</h3>${e.sets.filter(st=>st.weight!==''||st.reps!=='').map((st,i)=>`<div class="row between"><span>Serie ${i+1}</span><strong>${esc(st.weight||'—')} ${esc(st.unit)} × ${esc(st.reps||'—')} ${st.rir!==''?`· RIR ${esc(st.rir)}`:''}</strong></div>`).join('<div class="divider"></div>')||'<span class="subtle">Sin series registradas</span>'}${e.feeling?`<div class="chips"><span class="chip">${esc(e.feeling)}</span></div>`:''}${e.notes?`<p class="subtle">${esc(e.notes)}</p>`:''}</section>`).join('')}${s.overallFeeling||s.notes?`<section class="card"><h3>Sesión</h3>${s.overallFeeling?`<p>${esc(s.overallFeeling)}</p>`:''}${s.notes?`<p class="subtle">${esc(s.notes)}</p>`:''}</section>`:''}</main>`;
  document.querySelector('[data-back-history]').onclick=()=>{document.getElementById('bottomNav').classList.remove('hide');render();};
  document.querySelector('[data-delete-session]').onclick=async()=>{if(confirm('¿Eliminar este entrenamiento?')){await del(STORE_SESSIONS,id);document.getElementById('bottomNav').classList.remove('hide');render();}};
}
async function showMeasurement(id){
  const m=await getOne(STORE_MEASUREMENTS,id); if(!m)return;
  document.getElementById('bottomNav').classList.add('hide');
  document.getElementById('app').innerHTML=`<main class="screen"><div class="topbar"><button class="btn ghost" data-back-history>← Historial</button><button class="btn danger" data-delete-measure="${m.id}">Eliminar</button></div><h1>Mediciones</h1><div class="subtle">${fmtDate(m.date)}</div><section class="card">${MEASURE_FIELDS.map(([k,l,u])=>m[k]?`<div class="row between"><span>${l}</span><strong>${esc(m[k])} ${u}</strong></div><div class="divider"></div>`:'').join('')}${m.notes?`<p class="subtle">${esc(m.notes)}</p>`:''}</section></main>`;
  document.querySelector('[data-back-history]').onclick=()=>{document.getElementById('bottomNav').classList.remove('hide');render();};
  document.querySelector('[data-delete-measure]').onclick=async()=>{if(confirm('¿Eliminar esta medición?')){await del(STORE_MEASUREMENTS,id);document.getElementById('bottomNav').classList.remove('hide');render();}};
}

async function progressHTML(){
  const measures=(await getAll(STORE_MEASUREMENTS)).sort((a,b)=>a.date.localeCompare(b.date));
  const selected='weight';
  return `<main class="screen"><div class="topbar"><div><div class="subtle">Tendencias</div><h1>Progreso</h1></div></div>
    <section class="card"><div class="field"><label>Medición</label><select id="metricSelect">${MEASURE_FIELDS.map(([k,l])=>`<option value="${k}" ${k===selected?'selected':''}>${l}</option>`).join('')}</select></div></section>
    <div id="chartArea">${chartHTML(measures,selected)}</div>
    <div class="section-title"><h2>Ejercicios</h2></div><section class="card"><div class="field"><label>Ejercicio</label><select id="exerciseSelect"><option value="">Seleccionar</option>${[...new Set(Object.values(ROUTINES).flat().map(x=>x[0]))].sort().map(n=>`<option>${esc(n)}</option>`).join('')}</select></div><div id="exerciseProgress" class="subtle">Selecciona un ejercicio para ver sus últimas sesiones.</div></section>
  </main>`;
}
function chartHTML(data,key){
  const pts=data.map(d=>({date:d.date,val:num(d[key])})).filter(x=>x.val!==null);
  if(pts.length<2) return '<div class="empty">Registra al menos dos mediciones para generar una gráfica.</div>';
  const vals=pts.map(p=>p.val), min=Math.min(...vals), max=Math.max(...vals), span=(max-min)||1; const w=600,h=220,pad=30;
  const xy=pts.map((p,i)=>({x:pad+(i/(pts.length-1))*(w-pad*2),y:h-pad-((p.val-min)/span)*(h-pad*2),...p}));
  const path=xy.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  return `<div class="chart-wrap"><svg viewBox="0 0 ${w} ${h}" class="chart-svg" role="img"><line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" class="chart-axis"/><path d="${path}" class="chart-line"/>${xy.map((p,i)=>`<circle cx="${p.x}" cy="${p.y}" r="4" class="chart-dot"/><text x="${p.x}" y="${Math.max(12,p.y-9)}" text-anchor="middle" class="chart-label">${p.val}</text>${(i===0||i===xy.length-1)?`<text x="${p.x}" y="${h-7}" text-anchor="middle" class="chart-label">${p.date.slice(5)}</text>`:''}`).join('')}</svg></div>`;
}
async function renderExerciseProgress(name){
  const box=document.getElementById('exerciseProgress'); if(!name){box.textContent='Selecciona un ejercicio para ver sus últimas sesiones.';return;}
  const sessions=(await getAll(STORE_SESSIONS)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
  const rows=[]; for(const s of sessions){const e=s.exercises.find(x=>x.name===name);if(e){const sets=e.sets.filter(x=>x.weight!==''||x.reps!=='');if(sets.length)rows.push({date:s.date,sets});} if(rows.length===8)break;}
  box.innerHTML=rows.length?`<div class="list">${rows.map(r=>`<div class="list-item"><strong>${fmtDate(r.date)}</strong><span class="subtle">${r.sets.map(x=>`${esc(x.weight||'—')} ${esc(x.unit)} × ${esc(x.reps||'—')}${x.rir!==''?` @${esc(x.rir)}`:''}`).join(' · ')}</span></div>`).join('')}</div>`:'No hay registros para este ejercicio.';
}

function bindViewEvents(){
  document.querySelectorAll('[data-routine]').forEach(b=>b.addEventListener('click',()=>startRoutine(b.dataset.routine)));
  document.querySelector('[data-action="measure-now"]')?.addEventListener('click',()=>setView('measure'));
  document.querySelector('[data-action="history"]')?.addEventListener('click',()=>setView('history'));
  document.getElementById('measureForm')?.addEventListener('submit',e=>{e.preventDefault();saveMeasurement(e.currentTarget)});
  document.querySelectorAll('[data-history-tab]').forEach(b=>b.addEventListener('click',()=>{historyTab=b.dataset.historyTab;render();}));
  document.querySelectorAll('[data-session-id]').forEach(b=>b.addEventListener('click',()=>showSession(b.dataset.sessionId)));
  document.querySelectorAll('[data-measure-id]').forEach(b=>b.addEventListener('click',()=>showMeasurement(b.dataset.measureId)));
  document.getElementById('metricSelect')?.addEventListener('change',async e=>{const data=(await getAll(STORE_MEASUREMENTS)).sort((a,b)=>a.date.localeCompare(b.date));document.getElementById('chartArea').innerHTML=chartHTML(data,e.target.value);});
  document.getElementById('exerciseSelect')?.addEventListener('change',e=>renderExerciseProgress(e.target.value));
}

document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
window.addEventListener('online',()=>document.querySelectorAll('.status').forEach(x=>x.textContent='● Local + red'));
window.addEventListener('offline',()=>document.querySelectorAll('.status').forEach(x=>x.textContent='● Local'));

if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(console.error)); }
openDB().then(render).catch(err=>{document.getElementById('app').innerHTML=`<main class="screen"><div class="card"><h2>Error al abrir la base local</h2><p class="subtle">${esc(err.message)}</p></div></main>`;});
