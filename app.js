'use strict';

const APP_VERSION = '9.1';
let requestedUpdateVersion = null;
let updateReloadPending = false;

const DB_NAME = 'fit-log-db';
const DB_VERSION = 2;
const STORE_SESSIONS = 'sessions';
const STORE_MEASUREMENTS = 'measurements';
const STORE_SETTINGS = 'settings';
const STORE_FOODS = 'foods';
const STORE_FOOD_DAYS = 'foodDays';
const STORE_FOOD_TEMPLATES = 'foodTemplates';

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

const EXERCISE_META = {
  'Press inclinado con barra': {group:'Pecho · press'},
  'Press inclinado mancuernas': {group:'Pecho · press'},
  'Chest-supported row': {group:'Espalda · remo'},
  'Remo mancuerna banco inclinado': {group:'Espalda · remo'},
  'Pec deck fly': {group:'Pecho · apertura'},
  'Lat pulldown agarre abierto': {group:'Espalda · jalón'},
  'Neutral-grip pulldown': {group:'Espalda · jalón'},
  'Laterales mancuerna': {group:'Hombro lateral'},
  'Laterales cable': {group:'Hombro lateral'},
  'Reverse fly máquina': {group:'Hombro posterior'},
  'Reverse fly cable': {group:'Hombro posterior'},
  'Incline curl sentado': {group:'Bíceps'},
  'Curl barra Z parado': {group:'Bíceps'},
  'Overhead triceps': {group:'Tríceps'},
  'Skullcrusher barra Z': {group:'Tríceps'},
  'Shrugs': {group:'Trapecio'},
  'Wrist curl': {group:'Antebrazo · flexión'},
  'Wrist extension': {group:'Antebrazo · extensión'},
  'Leg extension': {group:'Cuádriceps · extensión'},
  'Hack squat': {group:'Cuádriceps · sentadilla'},
  'RDL': {group:'Isquios · bisagra'},
  'Seated leg curl': {group:'Isquios · curl'},
  'Lying leg curl': {group:'Isquios · curl'},
  'Aducción': {group:'Aductores'},
  'Abducción': {group:'Abductores'},
  'Pantorrilla': {group:'Pantorrilla'},
  'Cable crunch': {group:'Abdomen'}
};

function exerciseCatalog(){
  const map = new Map();
  for(const routine of Object.values(ROUTINES)){
    for(const [name,unit,setCount,seed] of routine){
      if(!map.has(name)) map.set(name,{name,unit,setCount,seed,group:EXERCISE_META[name]?.group||'Otro'});
    }
  }
  return [...map.values()];
}
function replacementOptions(name){
  const group=EXERCISE_META[name]?.group;
  if(!group) return [];
  return exerciseCatalog().filter(x=>x.group===group && x.name!==name);
}

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

const DEFAULT_MEALS = ['Desayuno','Snack','Comida','Cena'];
const FOOD_UNITS = ['g','ml','pieza','scoop','cucharadita','taza'];
const STARTER_FOODS = [
  ['Huevo',1,'pieza'],
  ['Tortilla de maíz',1,'pieza'],
  ['Pimiento verde',1,'pieza'],
  ['Coca Zero',600,'ml'],
  ['Aceite de oliva Oli Nutrioli',1,'cucharadita'],
  ['Leche deslactosada light',250,'ml'],
  ['Gold Standard 100% Whey',1,'scoop'],
  ['Plátano',1,'pieza'],
  ['Pan',1,'pieza'],
  ['Crema de cacahuate',18,'g'],
  ['Avena',15,'g'],
  ['Pollo',100,'g'],
  ['Arroz cocido',0.75,'taza'],
  ['Coca',500,'ml'],
  ['Papa',100,'g']
];

const DEFAULT_NUTRITION = {
  key:'nutritionGoal',
  mode:'auto',
  height:176,
  age:34,
  activity:1.55,
  deficit:20,
  proteinPerKg:2.1,
  fatPerKg:0.7,
  calcWeight:99.5,
  targetCalories:2393.2,
  protein:208.95,
  fat:69.65,
  carbs:232.6375,
  trm:1930,
  expenditure:2991.5,
  updatedAt:0
};

let dbPromise;
let currentView = 'home';
let activeSessionDraft = null;
let historyTab = 'sessions';
let foodTab = 'today';
let foodSelectedDate = localDateISO();
let foodScreen = 'main';
let foodPickerMealIndex = null;
let foodPickerFoodId = null;
let foodEditorId = null;

function openDB(){
  if(dbPromise) return dbPromise;
  dbPromise = new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains(STORE_SESSIONS)) db.createObjectStore(STORE_SESSIONS,{keyPath:'id'});
      if(!db.objectStoreNames.contains(STORE_MEASUREMENTS)) db.createObjectStore(STORE_MEASUREMENTS,{keyPath:'id'});
      if(!db.objectStoreNames.contains(STORE_SETTINGS)) db.createObjectStore(STORE_SETTINGS,{keyPath:'key'});
      if(!db.objectStoreNames.contains(STORE_FOODS)) db.createObjectStore(STORE_FOODS,{keyPath:'id'});
      if(!db.objectStoreNames.contains(STORE_FOOD_DAYS)) db.createObjectStore(STORE_FOOD_DAYS,{keyPath:'id'});
      if(!db.objectStoreNames.contains(STORE_FOOD_TEMPLATES)) db.createObjectStore(STORE_FOOD_TEMPLATES,{keyPath:'id'});
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
async function putMany(store,items){
  if(!Array.isArray(items) || !items.length) return;
  const db=await openDB();
  return new Promise((res,rej)=>{
    const transaction=db.transaction(store,'readwrite');
    const objectStore=transaction.objectStore(store);
    for(const item of items) objectStore.put(item);
    transaction.oncomplete=()=>res();
    transaction.onerror=()=>rej(transaction.error||new Error('No se pudo importar el respaldo.'));
    transaction.onabort=()=>rej(transaction.error||new Error('La importación fue cancelada.'));
  });
}

const esc = s => String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function localDateISO(date=new Date()){
  const y=date.getFullYear(), m=String(date.getMonth()+1).padStart(2,'0'), d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
const today = () => localDateISO();
const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
function fmtDate(v){ if(!v) return ''; const [y,m,d]=v.slice(0,10).split('-'); return `${d}/${m}/${y}`; }
function num(v){ const n=parseFloat(v); return Number.isFinite(n)?n:null; }
function round(n,d=1){ if(!Number.isFinite(n)) return 0; const p=10**d; return Math.round(n*p)/p; }
function addDays(dateStr,delta){ const [y,m,d]=dateStr.split('-').map(Number); const dt=new Date(y,m-1,d,12); dt.setDate(dt.getDate()+delta); return localDateISO(dt); }
function clone(v){ return JSON.parse(JSON.stringify(v)); }

async function getSetting(key){ return getOne(STORE_SETTINGS,key); }
async function saveSetting(key,value){ return put(STORE_SETTINGS,{key,...value}); }

async function seedStarterFoods(){
  const seeded=await getSetting('starterFoodsV1');
  if(seeded) return;
  const foods=await getAll(STORE_FOODS);
  const names=new Set(foods.map(f=>f.name.toLowerCase()));
  const newFoods=STARTER_FOODS.filter(([name])=>!names.has(name.toLowerCase())).map(([name,baseQty,unit])=>({
    id:uid('food'),name,brand:'',baseQty,unit,kcal:'',protein:'',fat:'',carbs:'',favorite:true,configured:false,createdAt:Date.now()
  }));
  await putMany(STORE_FOODS,newFoods);
  await saveSetting('starterFoodsV1',{done:true,createdAt:Date.now()});
}

function backupFileName(){
  return `fit-log-respaldo-${today()}.json`;
}
async function buildBackup(){
  const [sessions,measurements,settings,foods,foodDays,foodTemplates]=await Promise.all([
    getAll(STORE_SESSIONS),getAll(STORE_MEASUREMENTS),getAll(STORE_SETTINGS),
    getAll(STORE_FOODS),getAll(STORE_FOOD_DAYS),getAll(STORE_FOOD_TEMPLATES)
  ]);
  return {
    format:'fit-log-backup',backupVersion:2,app:'Fit Log',exportedAt:new Date().toISOString(),
    data:{sessions,measurements,settings,foods,foodDays,foodTemplates}
  };
}
async function exportBackup(){
  const msg=document.getElementById('backupMessage');
  try{
    const backup=await buildBackup();
    const json=JSON.stringify(backup,null,2);
    const fileName=backupFileName();
    const file=new File([json],fileName,{type:'application/json'});
    if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
      try{
        await navigator.share({title:'Respaldo Fit Log',text:'Respaldo de Fit Log',files:[file]});
        if(msg) msg.textContent='Respaldo preparado. Guárdalo en Archivos desde la hoja de compartir.';
        return;
      }catch(err){ if(err?.name==='AbortError'){ if(msg) msg.textContent='Exportación cancelada.'; return; } }
    }
    const blob=new Blob([json],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=fileName; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    if(msg) msg.textContent='Respaldo exportado.';
  }catch(err){ console.error(err); if(msg) msg.textContent='No se pudo crear el respaldo.'; alert('No se pudo crear el respaldo.'); }
}
function validateBackup(obj){
  if(!obj || obj.format!=='fit-log-backup' || ![1,2].includes(obj.backupVersion) || !obj.data) throw new Error('El archivo no es un respaldo válido de Fit Log.');
  for(const key of ['sessions','measurements','settings']) if(!Array.isArray(obj.data[key])) throw new Error('El respaldo está incompleto o dañado.');
  for(const key of ['foods','foodDays','foodTemplates']) if(!Array.isArray(obj.data[key])) obj.data[key]=[];
  return obj;
}
async function importBackupFile(file){
  const msg=document.getElementById('backupMessage');
  try{
    const backup=validateBackup(JSON.parse(await file.text()));
    const sCount=backup.data.sessions.length, mCount=backup.data.measurements.length, fCount=backup.data.foodDays.length;
    const exported=backup.exportedAt?new Date(backup.exportedAt).toLocaleString('es-MX'):'fecha desconocida';
    const ok=confirm(`Respaldo: ${exported}\n\n${sCount} entrenamientos\n${mCount} mediciones\n${fCount} días de comida\n\nSe combinará con los datos actuales. ¿Continuar?`);
    if(!ok){ if(msg) msg.textContent='Importación cancelada.'; return; }
    await putMany(STORE_SESSIONS,backup.data.sessions);
    await putMany(STORE_MEASUREMENTS,backup.data.measurements);
    await putMany(STORE_SETTINGS,backup.data.settings);
    await putMany(STORE_FOODS,backup.data.foods);
    await putMany(STORE_FOOD_DAYS,backup.data.foodDays);
    await putMany(STORE_FOOD_TEMPLATES,backup.data.foodTemplates);
    if(msg) msg.textContent=`Importación completa: ${sCount} entrenamientos, ${mCount} mediciones y ${fCount} días de comida.`;
    alert('Respaldo restaurado.');
    render();
  }catch(err){ console.error(err); if(msg) msg.textContent=err.message||'No se pudo importar el respaldo.'; alert(err.message||'No se pudo importar el respaldo.'); }
}

async function latestMeasurement(){
  const all=await getAll(STORE_MEASUREMENTS); return all.sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt)[0]||null;
}
async function latestExerciseRecord(name){
  const sessions=(await getAll(STORE_SESSIONS)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
  for(const s of sessions){ const ex=s.exercises?.find(e=>e.name===name); if(ex) return {session:s,exercise:ex}; }
  return null;
}

function setView(view){
  currentView=view;
  if(view==='food'){ foodScreen='main'; }
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  document.getElementById('bottomNav').classList.remove('hide');
  render();
}
async function render(){
  const app=document.getElementById('app');
  if(currentView==='home') app.innerHTML=await homeHTML();
  if(currentView==='train') app.innerHTML=trainHTML();
  if(currentView==='measure') app.innerHTML=await measureHTML();
  if(currentView==='history') app.innerHTML=await historyHTML();
  if(currentView==='progress') app.innerHTML=await progressHTML();
  if(currentView==='food') app.innerHTML=await foodHTML();
  bindViewEvents();
}

async function homeHTML(){
  const measurements=(await getAll(STORE_MEASUREMENTS)).sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt-b.createdAt);
  const m=measurements.at(-1)||null;
  const prevM=measurements.at(-2)||null;
  const sessions=(await getAll(STORE_SESSIONS)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
  const recent=sessions.slice(0,3);
  const weekStart=addDays(today(),-6);
  const weekSessions=sessions.filter(s=>s.date>=weekStart && s.date<=today()).length;
  const day=await getFoodDay(today(),false);
  const totals=day?foodDayTotals(day):emptyMacros();
  const goal=await getNutritionGoal();
  const kcalPct=goal.targetCalories?Math.min(100,Math.max(0,round((totals.kcal/goal.targetCalories)*100))):0;
  const kcalRemain=round((+goal.targetCalories||0)-totals.kcal);
  const proteinPct=goal.protein?Math.min(100,Math.max(0,round((totals.protein/goal.protein)*100))):0;
  const fatPct=goal.fat?Math.min(100,Math.max(0,round((totals.fat/goal.fat)*100))):0;
  const carbsPct=goal.carbs?Math.min(100,Math.max(0,round((totals.carbs/goal.carbs)*100))):0;
  const weightDelta=(m?.weight && prevM?.weight)?round((+m.weight)-(+prevM.weight),1):null;
  const firstWeight=measurements.find(x=>num(x.weight)!==null);
  const totalWeightDelta=(m?.weight && firstWeight?.weight)?round((+m.weight)-(+firstWeight.weight),1):null;
  const daysSinceMeasure=m?.date?Math.max(0,Math.floor((new Date(today()+'T12:00:00')-new Date(m.date+'T12:00:00'))/86400000)):null;
  const dateLabel=new Date().toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'});
  const niceDate=dateLabel.charAt(0).toUpperCase()+dateLabel.slice(1);
  return `<main class="screen home-screen dashboard-home">
    <header class="dashboard-header">
      <div>
        <div class="dashboard-date">${esc(niceDate)}</div>
        <h1>Fit Log</h1>
      </div>
      <button class="icon-btn app-menu-btn" data-action="open-settings" aria-label="Ajustes">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
      </button>
    </header>

    <section class="weight-hero">
      <div class="weight-hero-copy">
        <span class="dashboard-kicker">Peso actual</span>
        <div class="weight-main"><strong>${m?.weight??'—'}</strong><span>${m?.weight?'kg':''}</span></div>
        <div class="weight-meta">
          ${weightDelta!==null?`<span class="trend-pill ${weightDelta<=0?'trend-down':'trend-up'}">${weightDelta>0?'+':''}${weightDelta} kg vs. anterior</span>`:'<span class="trend-pill">Sin comparación aún</span>'}
          ${totalWeightDelta!==null?`<span>${totalWeightDelta>0?'+':''}${totalWeightDelta} kg desde inicio</span>`:''}
        </div>
      </div>
      <button class="weight-hero-side" data-action="progress-now">
        <span>Progreso</span>
        <strong>${m?.waistMin?`${m.waistMin} cm`:'Ver'}</strong>
        <small>${m?.waistMin?'cintura actual':'tendencias'}</small>
        <span class="card-arrow">↗</span>
      </button>
    </section>

    <div class="dashboard-section-head"><h2>Hoy</h2><span class="status mini-status ok">● Local</span></div>
    <div class="bento-grid">
      <button class="dash-card dash-training" data-action="train-now">
        <div class="dash-card-top"><span class="dash-icon"><svg viewBox="0 0 24 24"><path d="M5 8v8M8 6v12M16 6v12M19 8v8M8 12h8M3 10v4M21 10v4"/></svg></span><span class="card-arrow">→</span></div>
        <div><span class="dashboard-kicker">Entrenamiento</span><h3>${Math.min(weekSessions,4)} de 4</h3><p>sesiones en los últimos 7 días</p></div>
        <div class="week-dots">${Array.from({length:4},(_,i)=>`<i class="${i<Math.min(weekSessions,4)?'done':''}"></i>`).join('')}</div>
      </button>

      <button class="dash-card dash-food" data-action="food-now">
        <div class="dash-card-top"><span class="dash-icon"><svg viewBox="0 0 24 24"><path d="M7 3v7M4.5 3v5.2A2.8 2.8 0 0 0 7.3 11H8.5V3M7 11v10M16 3v18M16 3c3 2.3 4 5.2 4 8h-4"/></svg></span><span class="card-arrow">→</span></div>
        <div><span class="dashboard-kicker">Comida</span><h3>${round(totals.kcal)}</h3><p>de ${round(goal.targetCalories)} kcal</p></div>
        <div class="mini-progress"><i style="width:${kcalPct}%"></i></div>
        <small>${kcalRemain>=0?`${kcalRemain} kcal restantes`:`${Math.abs(kcalRemain)} kcal sobre objetivo`}</small>
      </button>

      <button class="dash-card dash-measure" data-action="measure-now">
        <div class="dash-card-top"><span class="dash-icon"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 7v3M11 7v2M14 7v3M17 7v2"/></svg></span><span class="card-arrow">→</span></div>
        <div><span class="dashboard-kicker">Mediciones</span><h3>${daysSinceMeasure===null?'Registrar':daysSinceMeasure===0?'Hoy':`${daysSinceMeasure} d`}</h3><p>${daysSinceMeasure===null?'sin registro todavía':daysSinceMeasure===0?'última medición':'desde la última medición'}</p></div>
      </button>

      <button class="dash-card dash-progress" data-action="progress-now">
        <div class="dash-card-top"><span class="dash-icon"><svg viewBox="0 0 24 24"><path d="M4 19V5M4 19h16M7 15l4-4 3 2 5-6"/></svg></span><span class="card-arrow">→</span></div>
        <div><span class="dashboard-kicker">Tendencia</span><h3>${totalWeightDelta===null?'—':`${totalWeightDelta>0?'+':''}${totalWeightDelta} kg`}</h3><p>cambio total de peso</p></div>
      </button>
    </div>

    <section class="dashboard-macros">
      <div class="dashboard-section-head inside"><div><span class="dashboard-kicker">Nutrición</span><h2>Macros de hoy</h2></div><button class="text-link" data-action="food-now">Abrir comida</button></div>
      <div class="macro-dashboard-row"><span>Proteína</span><div><i style="width:${proteinPct}%"></i></div><strong>${round(totals.protein)} / ${round(goal.protein)} g</strong></div>
      <div class="macro-dashboard-row"><span>Grasa</span><div><i style="width:${fatPct}%"></i></div><strong>${round(totals.fat)} / ${round(goal.fat)} g</strong></div>
      <div class="macro-dashboard-row"><span>Carbos</span><div><i style="width:${carbsPct}%"></i></div><strong>${round(totals.carbs)} / ${round(goal.carbs)} g</strong></div>
    </section>

    <div class="dashboard-section-head"><h2>Últimos entrenamientos</h2><button class="text-link" data-action="history">Ver todo</button></div>
    ${recent.length?`<div class="timeline-list">${recent.map((s,i)=>`<button class="timeline-item" data-session-id="${s.id}"><span class="timeline-dot ${i===0?'current':''}"></span><span class="timeline-copy"><strong>${esc(s.routine)}</strong><small>${fmtDate(s.date)} · ${s.exercises.length} ejercicios</small></span><span class="card-arrow">›</span></button>`).join('')}</div>`:'<div class="dashboard-empty">Tu historial aparecerá aquí después del primer entrenamiento.</div>'}

    <div id="settingsSheet" class="sheet-backdrop hide" aria-hidden="true">
      <div class="sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <div><div class="subtle">Fit Log</div><h3>Ajustes</h3></div>
          <button class="icon-btn icon-square" data-action="close-settings" aria-label="Cerrar">✕</button>
        </div>
        <section class="card sheet-card update-card">
          <div class="row between update-version-row"><div><div class="subtle">Aplicación</div><h4 style="margin:5px 0 2px;font-size:20px">Actualizaciones</h4></div><span class="version-badge">v${APP_VERSION}</span></div>
          <p id="updateStatus" class="subtle" style="margin:10px 0 12px">Versión instalada: ${APP_VERSION}</p>
          <div class="update-actions"><button class="btn ghost" data-action="check-update">Buscar actualización</button><button id="applyUpdateBtn" class="btn primary hide" data-action="apply-update">Actualizar ahora</button></div>
        </section>
        <section class="card sheet-card">
          <div class="subtle">Respaldo</div><h4 style="margin:6px 0 8px;font-size:20px">Importar y exportar</h4>
          <p class="subtle" style="margin-top:0">Guarda o restaura entrenamientos, mediciones, alimentos, objetivos y registros de comida.</p>
          <div class="backup-actions"><button class="btn primary" data-action="export-backup">Exportar respaldo</button><button class="btn ghost" data-action="import-backup">Importar respaldo</button></div>
          <input id="backupFileInput" class="hide" type="file" accept="application/json,.json"><div id="backupMessage" class="subtle" style="margin-top:10px"></div>
        </section>
      </div>
    </div>
  </main>`;
}

function trainHTML(){
  return `<main class="screen section-screen train-screen">
    <div class="section-app-header train-header">
      <div><span class="dashboard-kicker">Rutina semanal</span><h1>Entrenar</h1><p>Selecciona una sesión. Dentro puedes cambiar un ejercicio por otra opción de la misma zona muscular.</p></div>
      <div class="section-symbol"><svg viewBox="0 0 24 24"><path d="M5 8v8M8 6v12M16 6v12M19 8v8M8 12h8M3 10v4M21 10v4"/></svg></div>
    </div>
    <div class="routine-grid routine-grid-v9">${Object.keys(ROUTINES).map((n,i)=>`<button class="routine-btn routine-v9 routine-tone-${i+1}" data-routine="${esc(n)}"><span class="routine-index">0${i+1}</span><div><strong>${esc(n)}</strong><small>${ROUTINES[n].length} ejercicios</small></div><span class="card-arrow">→</span></button>`).join('')}</div>
    <div class="info-strip"><span>RIR por serie</span><span>Peso y reps</span><span>Sensaciones</span><span>Historial</span></div>
  </main>`;
}
async function startRoutine(name){
  const exercises=[];
  for(const [exName,unit,setCount,seed] of ROUTINES[name]){
    const prev=await latestExerciseRecord(exName);
    exercises.push({name:exName,originalName:exName,defaultUnit:unit,seed,previous:prev?formatPrevious(prev):seed,sets:Array.from({length:setCount},(_,i)=>({n:i+1,weight:'',unit,reps:'',rir:''})),feeling:'',notes:''});
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
  const pct=completionPct(s);
  document.getElementById('app').innerHTML=`<main class="screen workout-screen">
    <div class="topbar workout-topbar"><button class="btn ghost workout-exit" data-action="close-workout">← Salir</button><div class="workout-title"><div class="subtle">${fmtDate(s.date)}</div><h1>${esc(s.routine)}</h1></div></div>
    <section class="workout-overview">
      <div class="row between"><div><span class="subtle">Progreso</span><strong>${pct}%</strong></div><div class="workout-count">${s.exercises.filter(e=>e.sets.some(st=>st.reps!==''||st.weight!=='')).length} / ${s.exercises.length} ejercicios</div></div>
      <div class="progressbar"><div style="width:${pct}%"></div></div>
    </section>
    <div class="field date-field"><label>Fecha</label><input id="sessionDate" type="date" value="${s.date}"></div>
    <div id="exerciseList">${s.exercises.map((e,i)=>exerciseHTML(e,i)).join('')}</div>
    <section class="card session-card"><div class="section-kicker">Cierre</div><h3>Sesión</h3><div class="field"><label>Sensación general</label><select id="overallFeeling"><option value="">Seleccionar</option>${['Excelente','Bien','Normal','Pesada','Muy pesada','Molestia'].map(v=>`<option ${s.overallFeeling===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>Notas generales</label><textarea id="sessionNotes" placeholder="Resumen del entrenamiento…">${esc(s.notes)}</textarea></div></section>
    <div class="save-actions"><button class="btn primary block save-workout-btn" data-action="save-session">Guardar entrenamiento</button></div>
  </main>`;
  bindWorkoutEvents();
}
function exerciseHTML(e,i){
  const alts=replacementOptions(e.name); const group=EXERCISE_META[e.name]?.group||'';
  return `<section class="card exercise" data-ex="${i}">
    <div class="exercise-head">
      <div class="exercise-number">${i+1}</div>
      <div class="exercise-title-wrap"><h3>${esc(e.name)}</h3>${group?`<div class="muscle-tag">${esc(group)}</div>`:''}</div>
    </div>
    <div class="previous-panel"><span>Último registro</span><strong>${esc(e.previous||e.seed)}</strong></div>
    ${alts.length?`<details class="swap-details"><summary>Cambiar ejercicio</summary><div class="swap-wrap"><div class="swap-row"><select data-swap-select="${i}"><option value="">Alternativa de la misma zona</option>${alts.map(a=>`<option value="${esc(a.name)}">${esc(a.name)}</option>`).join('')}</select><button class="btn ghost compact" data-swap-exercise="${i}">Cambiar</button></div></div></details>`:''}
    <div class="set-head"><span>Serie</span><span>Peso</span><span>Reps</span><span>RIR</span><span></span></div>
    <div class="sets">${e.sets.map((st,j)=>setRowHTML(st,i,j)).join('')}</div>
    <div class="exercise-footer"><button class="btn ghost compact" data-add-set="${i}">+ Añadir serie</button></div>
    <div class="exercise-meta-grid"><div class="field"><label>Sensaciones</label><select data-feeling="${i}"><option value="">Seleccionar</option>${['Muy ligero','Bien','Normal','Pesado','Muy pesado','Molestia'].map(v=>`<option ${e.feeling===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>Notas</label><textarea data-notes="${i}" placeholder="Técnica, molestias, ajustes…">${esc(e.notes)}</textarea></div></div>
  </section>`;
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
  document.querySelectorAll('[data-swap-exercise]').forEach(b=>b.addEventListener('click',()=>swapExercise(+b.dataset.swapExercise)));
  document.querySelector('[data-action="save-session"]')?.addEventListener('click',saveSession);
}
async function swapExercise(index){
  const select=document.querySelector(`[data-swap-select="${index}"]`); const newName=select?.value; if(!newName) return;
  const current=activeSessionDraft.exercises[index];
  const hasData=current.sets.some(st=>st.weight!==''||st.reps!==''||st.rir!=='') || current.feeling || current.notes;
  if(hasData && !confirm('Este ejercicio ya tiene datos. ¿Cambiarlo y borrar lo registrado en este ejercicio?')) return;
  const meta=exerciseCatalog().find(x=>x.name===newName); if(!meta) return; const prev=await latestExerciseRecord(newName);
  activeSessionDraft.exercises[index]={name:newName,originalName:current.originalName||current.name,defaultUnit:meta.unit,seed:meta.seed,previous:prev?formatPrevious(prev):meta.seed,sets:Array.from({length:meta.setCount},(_,i)=>({n:i+1,weight:'',unit:meta.unit,reps:'',rir:''})),feeling:'',notes:''};
  renderWorkout();
}
async function saveSession(){
  const hasData=activeSessionDraft.exercises.some(e=>e.sets.some(s=>s.weight!==''||s.reps!==''));
  if(!hasData){alert('Registra al menos una serie antes de guardar.');return;}
  await put(STORE_SESSIONS,clone(activeSessionDraft)); activeSessionDraft=null; document.getElementById('bottomNav').classList.remove('hide'); currentView='history'; await render();
}

async function measureHTML(){
  const prev=await latestMeasurement();
  return `<main class="screen section-screen measure-screen">
    <div class="section-app-header measure-header">
      <div><span class="dashboard-kicker">Registro semanal</span><h1>Mediciones</h1><p>Guarda tus medidas en las mismas condiciones para comparar tendencias con mayor consistencia.</p></div>
      <div class="section-symbol"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 7v3M11 7v2M14 7v3M17 7v2"/></svg></div>
    </div>
    ${prev?`<section class="last-measure-card"><div><span>Último registro</span><strong>${prev.weight??'—'} kg</strong><small>${fmtDate(prev.date)}</small></div><div><span>Cintura</span><strong>${prev.waistMin??'—'}${prev.waistMin?' cm':''}</strong><small>mínima</small></div></section>`:''}
    <form id="measureForm" class="card measurement-form"><div class="form-card-title"><span class="dashboard-kicker">Nueva medición</span><h2>Registrar datos</h2></div><div class="field"><label>Fecha</label><input name="date" type="date" value="${today()}" required></div><div class="form-grid">${MEASURE_FIELDS.map(([k,l,u])=>`<div class="field"><label>${l} <span>${u}</span></label><input name="${k}" inputmode="decimal" type="number" step="0.1" placeholder="${prev?.[k]??''}"></div>`).join('')}</div><div class="field"><label>Notas</label><textarea name="notes" placeholder="Condiciones de medición, observaciones…"></textarea></div><button class="btn primary block" type="submit">Guardar mediciones</button></form>
  </main>`;
}
async function saveMeasurement(form){
  const fd=new FormData(form); const obj={id:uid('measure'),createdAt:Date.now()}; for(const [k,v] of fd.entries()) obj[k]=v; if(!obj.date) obj.date=today();
  await put(STORE_MEASUREMENTS,obj); currentView='history'; historyTab='measurements'; await render();
}

async function historyHTML(){
  const sessions=(await getAll(STORE_SESSIONS)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
  const measures=(await getAll(STORE_MEASUREMENTS)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
  const list=historyTab==='sessions'?
    (sessions.length?sessions.map(s=>`<button class="list-item" data-session-id="${s.id}"><strong>${esc(s.routine)}</strong><span class="subtle">${fmtDate(s.date)} · ${s.exercises.length} ejercicios</span><div class="chips">${s.overallFeeling?`<span class="chip">${esc(s.overallFeeling)}</span>`:''}<span class="chip">${s.exercises.reduce((n,e)=>n+e.sets.filter(x=>x.reps!==''||x.weight!=='').length,0)} series</span></div></button>`).join(''):'<div class="empty">No hay entrenamientos guardados.</div>'):
    (measures.length?measures.map(m=>`<button class="list-item" data-measure-id="${m.id}"><strong>${fmtDate(m.date)}</strong><span class="subtle">${m.weight?`${m.weight} kg`:''}${m.waistMin?` · cintura ${m.waistMin} cm`:''}</span></button>`).join(''):'<div class="empty">No hay mediciones guardadas.</div>');
  return `<main class="screen"><div class="topbar"><button class="btn ghost" data-action="history-back">← Inicio</button><div style="text-align:right"><div class="subtle">Todos tus registros</div><h1>Historial</h1></div></div><div class="tabs"><button class="tab ${historyTab==='sessions'?'active':''}" data-history-tab="sessions">Entrenamientos</button><button class="tab ${historyTab==='measurements'?'active':''}" data-history-tab="measurements">Mediciones</button></div><div class="list" style="margin-top:12px">${list}</div></main>`;
}
async function showSession(id){
  const s=await getOne(STORE_SESSIONS,id); if(!s)return; document.getElementById('bottomNav').classList.add('hide');
  document.getElementById('app').innerHTML=`<main class="screen"><div class="topbar"><button class="btn ghost" data-back-history>← Historial</button><button class="btn danger" data-delete-session="${s.id}">Eliminar</button></div><h1>${esc(s.routine)}</h1><div class="subtle">${fmtDate(s.date)}</div>${s.exercises.map(e=>`<section class="card"><h3>${esc(e.name)}</h3>${e.sets.filter(st=>st.weight!==''||st.reps!=='').map((st,i)=>`<div class="row between"><span>Serie ${i+1}</span><strong>${esc(st.weight||'—')} ${esc(st.unit)} × ${esc(st.reps||'—')} ${st.rir!==''?`· RIR ${esc(st.rir)}`:''}</strong></div>`).join('<div class="divider"></div>')||'<span class="subtle">Sin series registradas</span>'}${e.feeling?`<div class="chips"><span class="chip">${esc(e.feeling)}</span></div>`:''}${e.notes?`<p class="subtle">${esc(e.notes)}</p>`:''}</section>`).join('')}${s.overallFeeling||s.notes?`<section class="card"><h3>Sesión</h3>${s.overallFeeling?`<p>${esc(s.overallFeeling)}</p>`:''}${s.notes?`<p class="subtle">${esc(s.notes)}</p>`:''}</section>`:''}</main>`;
  document.querySelector('[data-back-history]').onclick=()=>{document.getElementById('bottomNav').classList.remove('hide');render();};
  document.querySelector('[data-delete-session]').onclick=async()=>{if(confirm('¿Eliminar este entrenamiento?')){await del(STORE_SESSIONS,id);document.getElementById('bottomNav').classList.remove('hide');render();}};
}
async function showMeasurement(id){
  const m=await getOne(STORE_MEASUREMENTS,id); if(!m)return; document.getElementById('bottomNav').classList.add('hide');
  document.getElementById('app').innerHTML=`<main class="screen"><div class="topbar"><button class="btn ghost" data-back-history>← Historial</button><button class="btn danger" data-delete-measure="${m.id}">Eliminar</button></div><h1>Mediciones</h1><div class="subtle">${fmtDate(m.date)}</div><section class="card">${MEASURE_FIELDS.map(([k,l,u])=>m[k]?`<div class="row between"><span>${l}</span><strong>${esc(m[k])} ${u}</strong></div><div class="divider"></div>`:'').join('')}${m.notes?`<p class="subtle">${esc(m.notes)}</p>`:''}</section></main>`;
  document.querySelector('[data-back-history]').onclick=()=>{document.getElementById('bottomNav').classList.remove('hide');render();};
  document.querySelector('[data-delete-measure]').onclick=async()=>{if(confirm('¿Eliminar esta medición?')){await del(STORE_MEASUREMENTS,id);document.getElementById('bottomNav').classList.remove('hide');render();}};
}

async function progressHTML(){
  const measures=(await getAll(STORE_MEASUREMENTS)).sort((a,b)=>a.date.localeCompare(b.date)); const selected='weight';
  const pts=measures.map(m=>({date:m.date,val:num(m.weight)})).filter(x=>x.val!==null);
  const latest=pts.at(-1), previous=pts.at(-2); const delta=latest&&previous?latest.val-previous.val:null;
  return `<main class="screen"><div class="topbar"><div><div class="subtle eyebrow">Tendencias</div><h1>Progreso</h1></div></div>
    <div class="progress-stats">
      <div class="progress-stat"><span>Peso actual</span><strong>${latest?`${round(latest.val,1)} kg`:'—'}</strong><small>${latest?fmtDate(latest.date):'Sin datos'}</small></div>
      <div class="progress-stat"><span>Último cambio</span><strong class="${delta===null?'':delta<=0?'good-delta':'neutral-delta'}">${delta===null?'—':`${delta>0?'+':''}${round(delta,1)} kg`}</strong><small>${previous?'vs. medición anterior':'Necesitas 2 registros'}</small></div>
    </div>
    <section class="card chart-card"><div class="field"><label>Medición</label><select id="metricSelect">${MEASURE_FIELDS.map(([k,l])=>`<option value="${k}" ${k===selected?'selected':''}>${l}</option>`).join('')}</select></div><div id="chartArea">${chartHTML(measures,selected)}</div></section>
    <div class="section-title"><h2>Rendimiento</h2></div><section class="card"><div class="field"><label>Ejercicio</label><select id="exerciseSelect"><option value="">Seleccionar ejercicio</option>${[...new Set(Object.values(ROUTINES).flat().map(x=>x[0]))].sort().map(n=>`<option>${esc(n)}</option>`).join('')}</select></div><div id="exerciseProgress" class="subtle exercise-progress-placeholder">Selecciona un ejercicio para ver sus últimas sesiones.</div></section>
  </main>`;
}
function chartHTML(data,key){
  const pts=data.map(d=>({date:d.date,val:num(d[key])})).filter(x=>x.val!==null); if(pts.length<2) return '<div class="empty">Registra al menos dos mediciones para generar una gráfica.</div>';
  const vals=pts.map(p=>p.val), min=Math.min(...vals), max=Math.max(...vals), rawSpan=(max-min)||1, margin=rawSpan*.18, lo=min-margin, hi=max+margin, span=hi-lo; const w=640,h=250,padX=34,padTop=25,padBottom=34;
  const xy=pts.map((p,i)=>({x:padX+(i/(pts.length-1))*(w-padX*2),y:padTop+((hi-p.val)/span)*(h-padTop-padBottom),...p})); const path=xy.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '); const area=`${path} L ${xy.at(-1).x.toFixed(1)} ${h-padBottom} L ${xy[0].x.toFixed(1)} ${h-padBottom} Z`;
  const grid=[0,.5,1].map(t=>{const y=padTop+t*(h-padTop-padBottom);return `<line x1="${padX}" y1="${y}" x2="${w-padX}" y2="${y}" class="chart-grid"/>`}).join('');
  return `<div class="chart-wrap premium-chart"><svg viewBox="0 0 ${w} ${h}" class="chart-svg" role="img"><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5c7cfa" stop-opacity=".22"/><stop offset="100%" stop-color="#5c7cfa" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${area}" class="chart-area"/><path d="${path}" class="chart-line"/>${xy.map((p,i)=>`<circle cx="${p.x}" cy="${p.y}" r="${i===xy.length-1?5:3.5}" class="chart-dot"/>${(i===0||i===xy.length-1)?`<text x="${p.x}" y="${Math.max(14,p.y-11)}" text-anchor="middle" class="chart-label chart-value">${p.val}</text><text x="${p.x}" y="${h-8}" text-anchor="middle" class="chart-label">${p.date.slice(5)}</text>`:''}`).join('')}</svg></div>`;
}
async function renderExerciseProgress(name){
  const box=document.getElementById('exerciseProgress'); if(!name){box.textContent='Selecciona un ejercicio para ver sus últimas sesiones.';return;}
  const sessions=(await getAll(STORE_SESSIONS)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt); const rows=[];
  for(const s of sessions){const e=s.exercises.find(x=>x.name===name);if(e){const sets=e.sets.filter(x=>x.weight!==''||x.reps!=='');if(sets.length)rows.push({date:s.date,sets});} if(rows.length===8)break;}
  box.innerHTML=rows.length?`<div class="list">${rows.map(r=>`<div class="list-item"><strong>${fmtDate(r.date)}</strong><span class="subtle">${r.sets.map(x=>`${esc(x.weight||'—')} ${esc(x.unit)} × ${esc(x.reps||'—')}${x.rir!==''?` @${esc(x.rir)}`:''}`).join(' · ')}</span></div>`).join('')}</div>`:'No hay registros para este ejercicio.';
}

function emptyMacros(){ return {kcal:0,protein:0,fat:0,carbs:0}; }
function sumMacros(a,b){ return {kcal:a.kcal+(+b.kcal||0),protein:a.protein+(+b.protein||0),fat:a.fat+(+b.fat||0),carbs:a.carbs+(+b.carbs||0)}; }
function foodDayTotals(day){
  let total=emptyMacros();
  for(const meal of day?.meals||[]) for(const item of meal.items||[]) total=sumMacros(total,item);
  return total;
}
function defaultFoodDay(date){ return {id:date,date,createdAt:Date.now(),updatedAt:Date.now(),meals:DEFAULT_MEALS.map((name,i)=>({id:`meal-${i}`,name,items:[]}))}; }
async function getFoodDay(date,create=false){
  let day=await getOne(STORE_FOOD_DAYS,date);
  if(!day && create){ day=defaultFoodDay(date); await put(STORE_FOOD_DAYS,day); }
  return day;
}
function calculateNutritionGoal(input){
  const weight=+input.calcWeight||0, height=+input.height||0, age=+input.age||0, activity=+input.activity||1, deficit=+input.deficit||0;
  const proteinPerKg=+input.proteinPerKg||0, fatPerKg=+input.fatPerKg||0;
  const trm=10*weight + 6.25*height - 5*age + 5;
  const expenditure=trm*activity;
  const targetCalories=expenditure*(1-deficit/100);
  const protein=weight*proteinPerKg, fat=weight*fatPerKg;
  const carbs=Math.max(0,(targetCalories-protein*4-fat*9)/4);
  return {...input,trm,expenditure,targetCalories,protein,fat,carbs,updatedAt:Date.now()};
}
async function getNutritionGoal(){
  let goal=await getSetting('nutritionGoal');
  if(!goal){
    const latest=await latestMeasurement();
    goal=calculateNutritionGoal({...DEFAULT_NUTRITION,calcWeight:num(latest?.weight)??DEFAULT_NUTRITION.calcWeight});
    await put(STORE_SETTINGS,goal);
  }
  return goal;
}
function macroPct(value,target){ if(!target) return 0; return Math.max(0,Math.min(100,(value/target)*100)); }
function macroBar(label,value,target,unit){
  const remain=(+target||0)-(+value||0); const pct=macroPct(value,target);
  return `<div class="macro-card"><div class="row between"><div><span class="macro-label">${label}</span><strong>${round(value)} <small>${unit}</small></strong></div><div class="macro-remain ${remain<0?'over':''}">${remain>=0?'Faltan':'Exceso'}<b>${round(Math.abs(remain))} ${unit}</b></div></div><div class="macro-track"><div style="width:${pct}%"></div></div><div class="macro-target">Objetivo ${round(target)} ${unit}</div></div>`;
}
async function foodHTML(){
  if(foodScreen==='picker') return foodPickerHTML();
  if(foodScreen==='editor') return foodEditorHTML();
  const tabs=`<div class="tabs food-tabs"><button class="tab ${foodTab==='today'?'active':''}" data-food-tab="today">Hoy</button><button class="tab ${foodTab==='history'?'active':''}" data-food-tab="history">Historial</button><button class="tab ${foodTab==='foods'?'active':''}" data-food-tab="foods">Alimentos</button><button class="tab ${foodTab==='goal'?'active':''}" data-food-tab="goal">Objetivo</button></div>`;
  let body='';
  if(foodTab==='today') body=await foodTodayHTML();
  if(foodTab==='history') body=await foodHistoryHTML();
  if(foodTab==='foods') body=await foodCatalogHTML();
  if(foodTab==='goal') body=await foodGoalHTML();
  return `<main class="screen"><div class="topbar"><div><div class="subtle">Calorías y macros</div><h1>Comida</h1></div><span class="status ok">● Local</span></div>${tabs}${body}</main>`;
}
async function foodTodayHTML(){
  const day=await getFoodDay(foodSelectedDate,true); const totals=foodDayTotals(day); const goal=await getNutritionGoal(); const templates=await getAll(STORE_FOOD_TEMPLATES); const calPct=Math.min(100,macroPct(totals.kcal,goal.targetCalories)); const calRemain=goal.targetCalories-totals.kcal;
  return `<div class="date-nav"><button class="icon-btn date-btn" data-food-date="-1">‹</button><div><strong>${foodSelectedDate===today()?'HOY':fmtDate(foodSelectedDate)}</strong><input id="foodDateInput" type="date" value="${foodSelectedDate}"></div><button class="icon-btn date-btn" data-food-date="1">›</button></div>
    <section class="card nutrition-summary premium-nutrition">
      <div class="calorie-ring" style="--pct:${calPct}%"><div><strong>${round(totals.kcal)}</strong><span>de ${round(goal.targetCalories)}</span><small>kcal</small></div></div>
      <div class="nutrition-copy"><div class="section-kicker">Calorías de hoy</div><h2>${calRemain>=0?`${round(calRemain)} kcal restantes`:`${round(Math.abs(calRemain))} kcal sobre objetivo`}</h2><p class="subtle">Registra tus alimentos y Fit Log ajusta el resumen automáticamente.</p></div>
    </section>
    <div class="macro-grid">${macroBar('Proteína',totals.protein,goal.protein,'g')}${macroBar('Grasa',totals.fat,goal.fat,'g')}${macroBar('Carbohidratos',totals.carbs,goal.carbs,'g')}</div>
    ${day.meals.map((meal,mi)=>mealHTML(meal,mi)).join('')}
    <section class="card template-card"><div class="row between"><div><div class="section-kicker">Atajos</div><strong>Plantillas</strong><div class="subtle">Guarda un día frecuente o cárgalo de nuevo.</div></div><button class="btn ghost compact" data-save-food-template>Guardar día</button></div>
      ${templates.length?`<div class="template-list">${templates.map(t=>`<button class="chip template-chip" data-load-food-template="${t.id}">${esc(t.name)}</button>`).join('')}</div>`:'<div class="subtle" style="margin-top:10px">Todavía no tienes plantillas.</div>'}
    </section>`;
}
function mealHTML(meal,mi){
  const mt=meal.items.reduce((a,b)=>sumMacros(a,b),emptyMacros());
  return `<section class="card meal-card meal-${mi}"><div class="row between meal-header"><div><div class="section-kicker">Comida ${mi+1}</div><h3>${esc(meal.name)}</h3><div class="subtle">${round(mt.kcal)} kcal · P ${round(mt.protein)} · G ${round(mt.fat)} · C ${round(mt.carbs)}</div></div><button class="btn primary compact" data-add-food="${mi}">+ Agregar</button></div>
    ${meal.items.length?`<div class="food-items">${meal.items.map((item,ii)=>`<div class="food-item"><button class="food-item-main" data-edit-food-item="${mi}:${ii}"><strong>${esc(item.name)}</strong><span>${round(item.qty,2)} ${esc(item.unit)} · ${round(item.kcal)} kcal</span><small>P ${round(item.protein)} · G ${round(item.fat)} · C ${round(item.carbs)}</small></button><button class="icon-btn danger-text" data-remove-food-item="${mi}:${ii}" aria-label="Eliminar">×</button></div>`).join('')}</div>`:'<div class="subtle meal-empty">Sin alimentos registrados.</div>'}
    <button class="btn ghost compact copy-meal" data-copy-yesterday="${mi}">Copiar de ayer</button>
  </section>`;
}
async function foodHistoryHTML(){
  const days=(await getAll(STORE_FOOD_DAYS)).filter(d=>(d.meals||[]).some(m=>(m.items||[]).length)).sort((a,b)=>b.date.localeCompare(a.date));
  return days.length?`<div class="list food-history">${days.map(d=>{const t=foodDayTotals(d);return `<button class="list-item" data-open-food-day="${d.date}"><strong>${fmtDate(d.date)}</strong><span class="subtle">${round(t.kcal)} kcal · P ${round(t.protein)} · G ${round(t.fat)} · C ${round(t.carbs)}</span></button>`}).join('')}</div>`:'<div class="empty">Todavía no hay días de comida registrados.</div>';
}
async function foodCatalogHTML(){
  const foods=(await getAll(STORE_FOODS)).sort((a,b)=>(b.favorite-a.favorite)||a.name.localeCompare(b.name,'es'));
  return `<div class="row between catalog-actions"><div class="subtle">Configura los valores de la etiqueta o de la referencia que quieras usar.</div><button class="btn primary" data-new-food>+ Nuevo</button></div>
    <div class="list">${foods.map(f=>`<button class="list-item food-catalog-item" data-edit-food="${f.id}"><div class="row between"><strong>${esc(f.name)}</strong><span>${f.favorite?'★':'☆'}</span></div><span class="subtle">${f.configured?`${round(+f.baseQty,2)} ${esc(f.unit)} · ${round(+f.kcal)} kcal · P ${round(+f.protein)} · G ${round(+f.fat)} · C ${round(+f.carbs)}`:'Configurar información nutrimental'}</span></button>`).join('')}</div>`;
}
async function foodGoalHTML(){
  const goal=await getNutritionGoal(); const latest=await latestMeasurement(); const latestWeight=num(latest?.weight);
  return `<section class="card"><div class="notice">El modo automático reproduce la estructura de tu hoja: TRM → factor de actividad → déficit; proteína 2.1 g/kg, grasa 0.7 g/kg y carbohidratos con las calorías restantes. Puedes editar todos esos valores.</div>
    ${latestWeight!==null && Math.abs(latestWeight-(+goal.calcWeight||0))>=0.2?`<div class="notice warn" style="margin-top:10px">Tu última medición es ${latestWeight} kg y el objetivo actual usa ${round(+goal.calcWeight)} kg.</div>`:''}
    <form id="nutritionGoalForm">
      <div class="field"><label>Modo</label><select name="mode" id="goalMode"><option value="auto" ${goal.mode!=='manual'?'selected':''}>Automático</option><option value="manual" ${goal.mode==='manual'?'selected':''}>Manual</option></select></div>
      <div id="autoGoalFields" class="${goal.mode==='manual'?'hide':''}">
        <div class="form-grid"><div class="field"><label>Peso usado (kg)</label><input name="calcWeight" type="number" step="0.1" value="${round(+goal.calcWeight||99.5)}"></div><div class="field"><label>Estatura (cm)</label><input name="height" type="number" step="1" value="${+goal.height||176}"></div><div class="field"><label>Edad</label><input name="age" type="number" step="1" value="${+goal.age||34}"></div><div class="field"><label>Actividad</label><select name="activity"><option value="1.2" ${+goal.activity===1.2?'selected':''}>1.2 Sedentario</option><option value="1.375" ${+goal.activity===1.375?'selected':''}>1.375 Poca act. 1-3 días</option><option value="1.55" ${+goal.activity===1.55?'selected':''}>1.55 Moderada 3-5 días</option><option value="1.725" ${+goal.activity===1.725?'selected':''}>1.725 Muy activo 6-7 días</option><option value="1.9" ${+goal.activity===1.9?'selected':''}>1.9 Muy activo + trabajo físico</option></select></div><div class="field"><label>Déficit (%)</label><input name="deficit" type="number" step="1" value="${+goal.deficit||20}"></div><div class="field"><label>Proteína (g/kg)</label><input name="proteinPerKg" type="number" step="0.1" value="${+goal.proteinPerKg||2.1}"></div><div class="field"><label>Grasa (g/kg)</label><input name="fatPerKg" type="number" step="0.1" value="${+goal.fatPerKg||0.7}"></div></div>
        ${latestWeight!==null?`<button class="btn ghost compact" type="button" data-use-latest-weight>Usar último peso: ${latestWeight} kg</button>`:''}
        <div id="goalPreview" class="goal-preview"></div>
      </div>
      <div id="manualGoalFields" class="${goal.mode==='manual'?'':'hide'}"><div class="form-grid"><div class="field"><label>Calorías</label><input name="manualCalories" type="number" step="1" value="${round(+goal.targetCalories)}"></div><div class="field"><label>Proteína (g)</label><input name="manualProtein" type="number" step="1" value="${round(+goal.protein)}"></div><div class="field"><label>Grasa (g)</label><input name="manualFat" type="number" step="1" value="${round(+goal.fat)}"></div><div class="field"><label>Carbohidratos (g)</label><input name="manualCarbs" type="number" step="1" value="${round(+goal.carbs)}"></div></div></div>
      <button class="btn primary block" type="submit">Guardar objetivo</button>
    </form>
  </section>`;
}
async function foodPickerHTML(){
  document.getElementById('bottomNav').classList.add('hide');
  const day=await getFoodDay(foodSelectedDate,true); const meal=day.meals[foodPickerMealIndex]||day.meals[0];
  if(foodPickerFoodId){
    const f=await getOne(STORE_FOODS,foodPickerFoodId); if(!f){foodPickerFoodId=null;return foodPickerHTML();}
    return `<main class="screen"><div class="topbar"><button class="btn ghost" data-food-picker-back>← Alimentos</button><div style="text-align:right"><div class="subtle">${esc(meal.name)}</div><h1>${esc(f.name)}</h1></div></div>
      <section class="card"><div class="subtle">Referencia: ${round(+f.baseQty,2)} ${esc(f.unit)} · ${f.configured?`${round(+f.kcal)} kcal · P ${round(+f.protein)} · G ${round(+f.fat)} · C ${round(+f.carbs)}`:'Sin macros configurados'}</div>
      ${f.configured?`<form id="addFoodForm"><div class="field"><label>Cantidad (${esc(f.unit)})</label><input name="qty" type="number" step="0.01" min="0.01" value="${+f.baseQty||1}" required></div><button class="btn primary block" type="submit">Agregar a ${esc(meal.name)}</button></form>`:`<div class="notice warn" style="margin-top:12px">Primero configura la información nutrimental de este alimento.</div><button class="btn primary block" data-configure-picker-food style="margin-top:12px">Configurar alimento</button>`}
      </section></main>`;
  }
  const foods=(await getAll(STORE_FOODS)).sort((a,b)=>(b.favorite-a.favorite)||a.name.localeCompare(b.name,'es'));
  const recentIds=[]; const allDays=(await getAll(STORE_FOOD_DAYS)).sort((a,b)=>b.date.localeCompare(a.date));
  for(const d of allDays) for(const m of d.meals||[]) for(const it of m.items||[]) if(it.foodId && !recentIds.includes(it.foodId)) recentIds.push(it.foodId);
  const recentSet=new Set(recentIds.slice(0,8));
  return `<main class="screen"><div class="topbar"><button class="btn ghost" data-food-picker-close>← ${esc(meal.name)}</button><div style="text-align:right"><div class="subtle">Agregar alimento</div><h1>${esc(meal.name)}</h1></div></div>
    <div class="field"><label>Buscar</label><input id="foodSearch" type="search" placeholder="Pollo, arroz, whey…"></div>
    <div class="chips filter-chips"><button class="chip active" data-food-filter="all">Todos</button><button class="chip" data-food-filter="fav">Favoritos</button><button class="chip" data-food-filter="recent">Recientes</button></div>
    <div id="foodPickerList" class="list">${foods.map(f=>foodPickerItemHTML(f,recentSet)).join('')}</div>
    <button class="btn ghost block" data-picker-new-food>+ Crear alimento</button>
  </main>`;
}
function foodPickerItemHTML(f,recentSet){
  return `<button class="list-item food-pick-item" data-pick-food="${f.id}" data-name="${esc(f.name.toLowerCase())}" data-fav="${f.favorite?'1':'0'}" data-recent="${recentSet.has(f.id)?'1':'0'}"><div class="row between"><strong>${esc(f.name)}</strong><span>${f.favorite?'★':''}</span></div><span class="subtle">${f.configured?`${round(+f.baseQty,2)} ${esc(f.unit)} · ${round(+f.kcal)} kcal · P ${round(+f.protein)} · G ${round(+f.fat)} · C ${round(+f.carbs)}`:'Configurar macros antes de usar'}</span></button>`;
}
async function foodEditorHTML(){
  document.getElementById('bottomNav').classList.add('hide');
  const existing=foodEditorId?await getOne(STORE_FOODS,foodEditorId):null;
  const f=existing||{id:'',name:'',brand:'',baseQty:100,unit:'g',kcal:'',protein:'',fat:'',carbs:'',favorite:true,configured:false};
  return `<main class="screen"><div class="topbar"><button class="btn ghost" data-food-editor-back>← Volver</button><div style="text-align:right"><div class="subtle">${existing?'Editar':'Nuevo'} alimento</div><h1>${existing?esc(f.name):'Alimento'}</h1></div></div>
    <form id="foodEditorForm" class="card"><div class="field"><label>Nombre</label><input name="name" value="${esc(f.name)}" required></div><div class="field"><label>Marca (opcional)</label><input name="brand" value="${esc(f.brand||'')}"></div>
      <div class="form-grid"><div class="field"><label>Cantidad de referencia</label><input name="baseQty" type="number" step="0.01" min="0.01" value="${esc(f.baseQty)}" required></div><div class="field"><label>Unidad</label><select name="unit">${FOOD_UNITS.map(u=>`<option ${f.unit===u?'selected':''}>${u}</option>`).join('')}</select></div></div>
      <div class="subtle">Valores nutrimentales para esa cantidad de referencia:</div><div class="form-grid"><div class="field"><label>Calorías</label><input name="kcal" type="number" step="0.1" min="0" value="${esc(f.kcal)}" required></div><div class="field"><label>Proteína (g)</label><input name="protein" type="number" step="0.1" min="0" value="${esc(f.protein)}" required></div><div class="field"><label>Grasa (g)</label><input name="fat" type="number" step="0.1" min="0" value="${esc(f.fat)}" required></div><div class="field"><label>Carbohidratos (g)</label><input name="carbs" type="number" step="0.1" min="0" value="${esc(f.carbs)}" required></div></div>
      <label class="check-row"><input name="favorite" type="checkbox" ${f.favorite?'checked':''}> Mostrar en favoritos</label>
      <button class="btn primary block" type="submit">Guardar alimento</button>${existing?`<button class="btn danger block" type="button" data-delete-food style="margin-top:10px">Eliminar alimento</button>`:''}
    </form>
  </main>`;
}
async function saveFoodEditor(form){
  const fd=new FormData(form); const existing=foodEditorId?await getOne(STORE_FOODS,foodEditorId):null;
  const obj={id:existing?.id||uid('food'),createdAt:existing?.createdAt||Date.now(),name:String(fd.get('name')||'').trim(),brand:String(fd.get('brand')||'').trim(),baseQty:+fd.get('baseQty'),unit:String(fd.get('unit')),kcal:+fd.get('kcal'),protein:+fd.get('protein'),fat:+fd.get('fat'),carbs:+fd.get('carbs'),favorite:fd.get('favorite')==='on',configured:true,updatedAt:Date.now()};
  if(!obj.name){alert('Escribe el nombre del alimento.');return;}
  await put(STORE_FOODS,obj); foodEditorId=null;
  if(foodPickerMealIndex!==null){foodScreen='picker'; foodPickerFoodId=obj.id;} else {foodScreen='main';foodTab='foods';}
  render();
}
async function addFoodToMeal(form){
  const food=await getOne(STORE_FOODS,foodPickerFoodId); if(!food?.configured) return;
  const qty=+new FormData(form).get('qty'); if(!(qty>0)) return; const scale=qty/(+food.baseQty||1);
  const day=await getFoodDay(foodSelectedDate,true); const meal=day.meals[foodPickerMealIndex]; if(!meal) return;
  meal.items.push({id:uid('item'),foodId:food.id,name:food.name,brand:food.brand||'',qty,unit:food.unit,baseQty:+food.baseQty,kcal:(+food.kcal||0)*scale,protein:(+food.protein||0)*scale,fat:(+food.fat||0)*scale,carbs:(+food.carbs||0)*scale,perBase:{kcal:+food.kcal||0,protein:+food.protein||0,fat:+food.fat||0,carbs:+food.carbs||0},addedAt:Date.now()});
  day.updatedAt=Date.now(); await put(STORE_FOOD_DAYS,day); foodScreen='main'; foodTab='today'; foodPickerFoodId=null; foodPickerMealIndex=null; document.getElementById('bottomNav').classList.remove('hide'); render();
}
async function removeFoodItem(mi,ii){
  const day=await getFoodDay(foodSelectedDate,false); if(!day?.meals?.[mi]?.items?.[ii]) return; day.meals[mi].items.splice(ii,1); day.updatedAt=Date.now(); await put(STORE_FOOD_DAYS,day); render();
}
async function editFoodItem(mi,ii){
  const day=await getFoodDay(foodSelectedDate,false); const item=day?.meals?.[mi]?.items?.[ii]; if(!item) return;
  const v=prompt(`Cantidad de ${item.name} (${item.unit})`,item.qty); if(v===null) return; const qty=+v; if(!(qty>0)){alert('Cantidad no válida.');return;}
  const scale=qty/(+item.baseQty||1); item.qty=qty; item.kcal=(+item.perBase.kcal||0)*scale; item.protein=(+item.perBase.protein||0)*scale; item.fat=(+item.perBase.fat||0)*scale; item.carbs=(+item.perBase.carbs||0)*scale; day.updatedAt=Date.now(); await put(STORE_FOOD_DAYS,day); render();
}
async function copyMealFromYesterday(mi){
  const prevDate=addDays(foodSelectedDate,-1); const prev=await getFoodDay(prevDate,false); const day=await getFoodDay(foodSelectedDate,true);
  const target=day.meals[mi]; const source=prev?.meals?.find(m=>m.name===target?.name); if(!target) return;
  if(!source?.items?.length){alert(`Ayer no hay alimentos guardados en ${target.name}.`);return;}
  if(target.items.length && !confirm(`Ya hay alimentos en ${target.name}. ¿Agregar también los de ayer?`)) return;
  target.items.push(...source.items.map(it=>({...clone(it),id:uid('item'),addedAt:Date.now()}))); day.updatedAt=Date.now(); await put(STORE_FOOD_DAYS,day); render();
}
async function saveFoodTemplate(){
  const day=await getFoodDay(foodSelectedDate,false); if(!day || !day.meals.some(m=>m.items.length)){alert('Primero registra alimentos en el día.');return;}
  const name=prompt('Nombre de la plantilla','Día habitual'); if(!name?.trim()) return;
  await put(STORE_FOOD_TEMPLATES,{id:uid('template'),name:name.trim(),createdAt:Date.now(),meals:clone(day.meals)}); render();
}
async function loadFoodTemplate(id){
  const t=await getOne(STORE_FOOD_TEMPLATES,id); if(!t) return; const day=await getFoodDay(foodSelectedDate,true);
  if(day.meals.some(m=>m.items.length) && !confirm('Este día ya tiene alimentos. ¿Reemplazarlos por la plantilla?')) return;
  day.meals=clone(t.meals).map((m,mi)=>({...m,id:`meal-${mi}`,items:(m.items||[]).map(it=>({...it,id:uid('item'),addedAt:Date.now()}))})); day.updatedAt=Date.now(); await put(STORE_FOOD_DAYS,day); render();
}
async function saveNutritionGoal(form){
  const fd=new FormData(form); const mode=String(fd.get('mode'));
  let goal;
  if(mode==='manual'){
    const old=await getNutritionGoal(); goal={...old,key:'nutritionGoal',mode:'manual',targetCalories:+fd.get('manualCalories'),protein:+fd.get('manualProtein'),fat:+fd.get('manualFat'),carbs:+fd.get('manualCarbs'),updatedAt:Date.now()};
  }else{
    goal=calculateNutritionGoal({key:'nutritionGoal',mode:'auto',calcWeight:+fd.get('calcWeight'),height:+fd.get('height'),age:+fd.get('age'),activity:+fd.get('activity'),deficit:+fd.get('deficit'),proteinPerKg:+fd.get('proteinPerKg'),fatPerKg:+fd.get('fatPerKg')});
  }
  await put(STORE_SETTINGS,goal); alert('Objetivo guardado.'); render();
}
function updateGoalPreview(){
  const form=document.getElementById('nutritionGoalForm'); const box=document.getElementById('goalPreview'); if(!form||!box) return; const fd=new FormData(form);
  const calc=calculateNutritionGoal({calcWeight:+fd.get('calcWeight'),height:+fd.get('height'),age:+fd.get('age'),activity:+fd.get('activity'),deficit:+fd.get('deficit'),proteinPerKg:+fd.get('proteinPerKg'),fatPerKg:+fd.get('fatPerKg')});
  box.innerHTML=`<div class="goal-grid"><div><span>TRM</span><strong>${round(calc.trm)} kcal</strong></div><div><span>Gasto</span><strong>${round(calc.expenditure)} kcal</strong></div><div><span>Objetivo</span><strong>${round(calc.targetCalories)} kcal</strong></div><div><span>Macros</span><strong>P ${round(calc.protein)} · G ${round(calc.fat)} · C ${round(calc.carbs)}</strong></div></div>`;
}

function bindFoodEvents(){
  document.querySelectorAll('[data-food-tab]').forEach(b=>b.addEventListener('click',()=>{foodTab=b.dataset.foodTab;foodScreen='main';render();}));
  document.querySelectorAll('[data-food-date]').forEach(b=>b.addEventListener('click',()=>{foodSelectedDate=addDays(foodSelectedDate,+b.dataset.foodDate);render();}));
  document.getElementById('foodDateInput')?.addEventListener('change',e=>{foodSelectedDate=e.target.value||today();render();});
  document.querySelectorAll('[data-add-food]').forEach(b=>b.addEventListener('click',()=>{foodPickerMealIndex=+b.dataset.addFood;foodPickerFoodId=null;foodScreen='picker';render();}));
  document.querySelectorAll('[data-remove-food-item]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const [mi,ii]=b.dataset.removeFoodItem.split(':').map(Number);removeFoodItem(mi,ii);}));
  document.querySelectorAll('[data-edit-food-item]').forEach(b=>b.addEventListener('click',()=>{const [mi,ii]=b.dataset.editFoodItem.split(':').map(Number);editFoodItem(mi,ii);}));
  document.querySelectorAll('[data-copy-yesterday]').forEach(b=>b.addEventListener('click',()=>copyMealFromYesterday(+b.dataset.copyYesterday)));
  document.querySelector('[data-save-food-template]')?.addEventListener('click',saveFoodTemplate);
  document.querySelectorAll('[data-load-food-template]').forEach(b=>b.addEventListener('click',()=>loadFoodTemplate(b.dataset.loadFoodTemplate)));
  document.querySelectorAll('[data-open-food-day]').forEach(b=>b.addEventListener('click',()=>{foodSelectedDate=b.dataset.openFoodDay;foodTab='today';render();}));
  document.querySelector('[data-new-food]')?.addEventListener('click',()=>{foodEditorId=null;foodPickerMealIndex=null;foodScreen='editor';render();});
  document.querySelectorAll('[data-edit-food]').forEach(b=>b.addEventListener('click',()=>{foodEditorId=b.dataset.editFood;foodPickerMealIndex=null;foodScreen='editor';render();}));
  document.querySelector('[data-food-picker-close]')?.addEventListener('click',()=>{foodScreen='main';foodTab='today';foodPickerMealIndex=null;document.getElementById('bottomNav').classList.remove('hide');render();});
  document.querySelector('[data-food-picker-back]')?.addEventListener('click',()=>{foodPickerFoodId=null;render();});
  document.querySelectorAll('[data-pick-food]').forEach(b=>b.addEventListener('click',()=>{foodPickerFoodId=b.dataset.pickFood;render();}));
  document.getElementById('foodSearch')?.addEventListener('input',filterFoodPicker);
  document.querySelectorAll('[data-food-filter]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-food-filter]').forEach(x=>x.classList.toggle('active',x===b));filterFoodPicker();}));
  document.querySelector('[data-picker-new-food]')?.addEventListener('click',()=>{foodEditorId=null;foodScreen='editor';render();});
  document.querySelector('[data-configure-picker-food]')?.addEventListener('click',()=>{foodEditorId=foodPickerFoodId;foodScreen='editor';render();});
  document.getElementById('addFoodForm')?.addEventListener('submit',e=>{e.preventDefault();addFoodToMeal(e.currentTarget);});
  document.querySelector('[data-food-editor-back]')?.addEventListener('click',()=>{foodEditorId=null;if(foodPickerMealIndex!==null){foodScreen='picker';foodPickerFoodId=null;}else{foodScreen='main';foodTab='foods';document.getElementById('bottomNav').classList.remove('hide');}render();});
  document.getElementById('foodEditorForm')?.addEventListener('submit',e=>{e.preventDefault();saveFoodEditor(e.currentTarget);});
  document.querySelector('[data-delete-food]')?.addEventListener('click',async()=>{if(foodEditorId && confirm('¿Eliminar este alimento del catálogo? Los registros anteriores conservarán sus datos.')){await del(STORE_FOODS,foodEditorId);foodEditorId=null;foodScreen='main';foodTab='foods';document.getElementById('bottomNav').classList.remove('hide');render();}});
  const goalMode=document.getElementById('goalMode'); goalMode?.addEventListener('change',()=>{document.getElementById('autoGoalFields')?.classList.toggle('hide',goalMode.value==='manual');document.getElementById('manualGoalFields')?.classList.toggle('hide',goalMode.value!=='manual');if(goalMode.value==='auto')updateGoalPreview();});
  document.getElementById('nutritionGoalForm')?.addEventListener('input',()=>{if(document.getElementById('goalMode')?.value==='auto')updateGoalPreview();});
  document.getElementById('nutritionGoalForm')?.addEventListener('submit',e=>{e.preventDefault();saveNutritionGoal(e.currentTarget);});
  document.querySelector('[data-use-latest-weight]')?.addEventListener('click',async()=>{const m=await latestMeasurement();const input=document.querySelector('[name="calcWeight"]');if(input&&m?.weight){input.value=m.weight;updateGoalPreview();}});
  if(document.getElementById('goalPreview') && document.getElementById('goalMode')?.value==='auto') updateGoalPreview();
}
function filterFoodPicker(){
  const q=(document.getElementById('foodSearch')?.value||'').trim().toLowerCase(); const filter=document.querySelector('[data-food-filter].active')?.dataset.foodFilter||'all';
  document.querySelectorAll('.food-pick-item').forEach(el=>{const name=el.dataset.name||''; const matchesQ=!q||name.includes(q); const matchesF=filter==='all'||(filter==='fav'&&el.dataset.fav==='1')||(filter==='recent'&&el.dataset.recent==='1'); el.classList.toggle('hide',!(matchesQ&&matchesF));});
}

function setUpdateStatus(message, kind=''){
  const el=document.getElementById('updateStatus');
  if(!el) return;
  el.textContent=message;
  el.classList.toggle('ok',kind==='ok');
  el.classList.toggle('danger-text',kind==='error');
}
function showApplyUpdate(show=true){
  document.getElementById('applyUpdateBtn')?.classList.toggle('hide',!show);
}
async function remoteAppVersion(){
  // Desde 9.1 la versión publicada vive en un archivo independiente.
  // Esto evita que el propio caché del service worker o una constante olvidada
  // impidan detectar una actualización.
  try{
    const response=await fetch(`./version.json?versionCheck=${Date.now()}`,{
      cache:'no-store',
      headers:{'Cache-Control':'no-cache, no-store, must-revalidate'}
    });
    if(response.ok){
      const data=await response.json();
      if(data?.version) return String(data.version);
    }
  }catch(_){ }

  // Compatibilidad con instalaciones 8.1/9.0 que todavía consultaban el SW.
  const response=await fetch(`./service-worker.js?versionCheck=${Date.now()}`,{
    cache:'no-store',
    headers:{'Cache-Control':'no-cache, no-store, must-revalidate'}
  });
  if(!response.ok) throw new Error('No se pudo consultar la versión publicada.');
  const text=await response.text();
  const match=text.match(/const APP_VERSION\s*=\s*['\"]([^'\"]+)['\"]/);
  if(!match) throw new Error('No se pudo leer la versión publicada.');
  return match[1];
}
async function checkForAppUpdate(){
  showApplyUpdate(false);
  requestedUpdateVersion=null;
  if(!navigator.onLine){
    setUpdateStatus(`Versión instalada: ${APP_VERSION} · Sin conexión para buscar actualizaciones.`,'error');
    return;
  }
  setUpdateStatus('Buscando actualización…');
  try{
    const remote=await remoteAppVersion();
    const reg=await navigator.serviceWorker.getRegistration();
    if(reg) await reg.update().catch(()=>{});
    if(remote!==APP_VERSION){
      requestedUpdateVersion=remote;
      setUpdateStatus(`Nueva versión disponible: ${remote}`,'ok');
      showApplyUpdate(true);
    }else{
      setUpdateStatus(`Fit Log ${APP_VERSION} está actualizado.`,'ok');
    }
  }catch(err){
    setUpdateStatus(`No se pudo buscar la actualización: ${err.message}`,'error');
  }
}
async function applyAppUpdate(){
  if(!navigator.onLine){
    setUpdateStatus('Necesitas conexión para descargar la actualización.','error');
    return;
  }
  const target=requestedUpdateVersion||'nueva';
  setUpdateStatus(`Descargando versión ${target}…`);
  const btn=document.getElementById('applyUpdateBtn');
  if(btn) btn.disabled=true;
  updateReloadPending=true;
  try{
    const reg=await navigator.serviceWorker.getRegistration();
    if(!reg) throw new Error('No hay service worker registrado.');

    let reloaded=false;
    const reloadIntoNewVersion=()=>{
      if(reloaded) return;
      reloaded=true;
      const url=new URL(location.href);
      url.searchParams.set('appVersion',requestedUpdateVersion||Date.now());
      location.replace(url.toString());
    };

    navigator.serviceWorker.addEventListener('controllerchange',reloadIntoNewVersion,{once:true});
    await reg.update();

    if(reg.waiting){
      reg.waiting.postMessage({type:'SKIP_WAITING'});
    }else if(reg.installing){
      const worker=reg.installing;
      worker.addEventListener('statechange',()=>{
        if(worker.state==='installed' && reg.waiting) reg.waiting.postMessage({type:'SKIP_WAITING'});
      });
    }else{
      // La versión nueva puede haberse activado automáticamente antes de pulsar el botón.
      setTimeout(reloadIntoNewVersion,500);
    }
    // Respaldo para iOS si no llega controllerchange al primer plano.
    setTimeout(reloadIntoNewVersion,2500);
  }catch(err){
    updateReloadPending=false;
    if(btn) btn.disabled=false;
    setUpdateStatus(`No se pudo actualizar: ${err.message}`,'error');
  }
}

function bindViewEvents(){
  document.querySelectorAll('[data-routine]').forEach(b=>b.addEventListener('click',()=>startRoutine(b.dataset.routine)));
  document.querySelector('[data-action="measure-now"]')?.addEventListener('click',()=>setView('measure'));
  document.querySelector('[data-action="food-now"]')?.addEventListener('click',()=>setView('food'));
  document.querySelector('[data-action="train-now"]')?.addEventListener('click',()=>setView('train'));
  document.querySelectorAll('[data-action="progress-now"]').forEach(b=>b.addEventListener('click',()=>setView('progress')));
  document.querySelector('[data-action="history"]')?.addEventListener('click',()=>{currentView='history';render();});
  document.querySelector('[data-action="history-back"]')?.addEventListener('click',()=>setView('home'));
  const settingsSheet=document.getElementById('settingsSheet');
  document.querySelector('[data-action="open-settings"]')?.addEventListener('click',()=>settingsSheet?.classList.remove('hide'));
  document.querySelector('[data-action="close-settings"]')?.addEventListener('click',()=>settingsSheet?.classList.add('hide'));
  settingsSheet?.addEventListener('click',e=>{ if(e.target===settingsSheet) settingsSheet.classList.add('hide'); });
  document.querySelector('[data-action="check-update"]')?.addEventListener('click',checkForAppUpdate);
  document.querySelector('[data-action="apply-update"]')?.addEventListener('click',applyAppUpdate);
  document.querySelector('[data-action="export-backup"]')?.addEventListener('click',exportBackup);
  document.querySelector('[data-action="import-backup"]')?.addEventListener('click',()=>document.getElementById('backupFileInput')?.click());
  document.getElementById('backupFileInput')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(file) await importBackupFile(file);e.target.value='';});
  document.getElementById('measureForm')?.addEventListener('submit',e=>{e.preventDefault();saveMeasurement(e.currentTarget)});
  document.querySelectorAll('[data-history-tab]').forEach(b=>b.addEventListener('click',()=>{historyTab=b.dataset.historyTab;render();}));
  document.querySelectorAll('[data-session-id]').forEach(b=>b.addEventListener('click',()=>showSession(b.dataset.sessionId)));
  document.querySelectorAll('[data-measure-id]').forEach(b=>b.addEventListener('click',()=>showMeasurement(b.dataset.measureId)));
  document.getElementById('metricSelect')?.addEventListener('change',async e=>{const data=(await getAll(STORE_MEASUREMENTS)).sort((a,b)=>a.date.localeCompare(b.date));document.getElementById('chartArea').innerHTML=chartHTML(data,e.target.value);});
  document.getElementById('exerciseSelect')?.addEventListener('change',e=>renderExerciseProgress(e.target.value));
  if(currentView==='food') bindFoodEvents();
}

document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
window.addEventListener('online',()=>document.querySelectorAll('.status').forEach(x=>x.textContent='● Local + red'));
window.addEventListener('offline',()=>document.querySelectorAll('.status').forEach(x=>x.textContent='● Local'));

if('serviceWorker' in navigator){ window.addEventListener('load',async()=>{ try{ const reg=await navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'}); reg.update().catch(()=>{}); }catch(err){ console.error(err); } }); }
openDB().then(seedStarterFoods).then(render).catch(err=>{document.getElementById('app').innerHTML=`<main class="screen"><div class="card"><h2>Error al abrir la base local</h2><p class="subtle">${esc(err.message)}</p></div></main>`;});
