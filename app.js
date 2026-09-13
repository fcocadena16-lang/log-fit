'use strict';

const APP_VERSION = '9.5';
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
  birthDate:'',
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

const WORKOUT_DRAFT_KEY = 'fit-log-active-workout-v1';
const REST_TIMER_KEY = 'fit-log-rest-timer-end-v1';
let restTimerEndAt = Number(localStorage.getItem(REST_TIMER_KEY)||0) || 0;
let restTimerInterval = null;
let restTimerAlarmed = false;
let workoutAudioContext = null;

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
function ageFromBirthDate(birthDate, referenceDate=today()){
  if(!birthDate) return null;
  const b=String(birthDate).slice(0,10).split('-').map(Number);
  const r=String(referenceDate).slice(0,10).split('-').map(Number);
  if(b.length!==3||r.length!==3||b.some(x=>!Number.isFinite(x))||r.some(x=>!Number.isFinite(x))) return null;
  let age=r[0]-b[0];
  if(r[1]<b[1] || (r[1]===b[1] && r[2]<b[2])) age--;
  return age>=0 && age<130 ? age : null;
}
async function measurementReference(){
  const all=(await getAll(STORE_MEASUREMENTS)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
  const latest=all[0]||null;
  const firstValue=field=>{
    const row=all.find(m=>m?.[field]!==undefined && m?.[field]!==null && String(m[field]).trim()!=='');
    return row ? row[field] : null;
  };
  const weight=num(firstValue('weight'));
  const height=num(firstValue('height'));
  const birthDate=firstValue('birthDate')||'';
  const age=ageFromBirthDate(birthDate,today());
  return {latest,weight,height,birthDate,age};
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
  const draft=loadWorkoutDraft();
  return `<main class="screen section-screen train-screen">
    <div class="section-app-header train-header">
      <div><span class="dashboard-kicker">Rutina semanal</span><h1>Entrenar</h1><p>Selecciona una sesión. Los últimos valores se cargan automáticamente y puedes cambiarlos durante el entrenamiento.</p></div>
      <div class="section-symbol"><svg viewBox="0 0 24 24"><path d="M5 8v8M8 6v12M16 6v12M19 8v8M8 12h8M3 10v4M21 10v4"/></svg></div>
    </div>
    ${draft?`<section class="card resume-workout-card"><div><span class="section-kicker">Entrenamiento en curso</span><h3>${esc(draft.routine)}</h3><p class="subtle">Tu sesión quedó guardada automáticamente.</p></div><button class="btn primary" data-resume-workout>Continuar</button></section>`:''}
    <div class="routine-grid routine-grid-v9">${Object.keys(ROUTINES).map((n,i)=>`<button class="routine-btn routine-v9 routine-tone-${i+1}" data-routine="${esc(n)}"><span class="routine-index">0${i+1}</span><div><strong>${esc(n)}</strong><small>${ROUTINES[n].length} ejercicios</small></div><span class="card-arrow">→</span></button>`).join('')}</div>
    <div class="info-strip"><span>RIR por serie</span><span>Izq / Der</span><span>Descanso 3 min</span><span>Autoguardado</span></div>
  </main>`;
}

function loadWorkoutDraft(){
  try{
    const raw=localStorage.getItem(WORKOUT_DRAFT_KEY);
    if(!raw) return null;
    const draft=JSON.parse(raw);
    return draft?.routine && Array.isArray(draft.exercises)?draft:null;
  }catch{return null;}
}
function persistWorkoutDraft(){
  if(!activeSessionDraft) return;
  try{ localStorage.setItem(WORKOUT_DRAFT_KEY,JSON.stringify(activeSessionDraft)); }catch{}
}
function clearWorkoutDraft(){
  try{ localStorage.removeItem(WORKOUT_DRAFT_KEY); }catch{}
}
function setHasData(st,splitSides=false){
  if(splitSides) return ['leftWeight','leftReps','leftRir','rightWeight','rightReps','rightRir'].some(k=>String(st?.[k]??'')!=='');
  return String(st?.weight??'')!=='' || String(st?.reps??'')!=='' || String(st?.rir??'')!=='';
}
function exerciseHasData(e){ return (e?.sets||[]).some(st=>setHasData(st,!!e.splitSides)); }
function cloneSetForDraft(src,defaultUnit){
  const st={n:1,weight:'',unit:defaultUnit,reps:'',rir:'',leftWeight:'',leftReps:'',leftRir:'',rightWeight:'',rightReps:'',rightRir:'',_weightAuto:true,_leftWeightAuto:true,_rightWeightAuto:true};
  if(src){
    for(const k of ['weight','unit','reps','rir','leftWeight','leftReps','leftRir','rightWeight','rightReps','rightRir']) if(src[k]!==undefined) st[k]=src[k];
  }
  return st;
}
async function buildExerciseDraft(exName,meta,originalName=null){
  const prev=await latestExerciseRecord(exName);
  const prevEx=prev?.exercise;
  const count=prevEx?.sets?.length || meta.setCount;
  const sets=Array.from({length:count},(_,i)=>{
    const src=prevEx?.sets?.[i] || null;
    const st=cloneSetForDraft(src,meta.unit);
    st.n=i+1;
    return st;
  });
  return {name:exName,originalName:originalName||exName,defaultUnit:meta.unit,seed:meta.seed,previous:prev?formatPrevious(prev):meta.seed,splitSides:!!prevEx?.splitSides,sets,feeling:'',notes:''};
}
async function startRoutine(name){
  const existing=loadWorkoutDraft();
  if(existing && !confirm('Ya tienes un entrenamiento en curso. ¿Descartarlo y empezar otro?')){ activeSessionDraft=existing; renderWorkout(); return; }
  const exercises=[];
  for(const [exName,unit,setCount,seed] of ROUTINES[name]) exercises.push(await buildExerciseDraft(exName,{name:exName,unit,setCount,seed,group:EXERCISE_META[exName]?.group||'Otro'}));
  activeSessionDraft={id:uid('session'),date:today(),routine:name,createdAt:Date.now(),overallFeeling:'',notes:'',cardio:{minutes:'',heartRate:'',incline:'',speed:''},exercises};
  persistWorkoutDraft();
  renderWorkout();
}
function sideSetText(st,side){
  const p=side==='left'?'left':'right';
  const label=side==='left'?'Izq':'Der';
  return `${label} ${st?.[p+'Weight']||'—'} ${st?.unit||''} × ${st?.[p+'Reps']||'—'}${String(st?.[p+'Rir']??'')!==''?` @${st[p+'Rir']} RIR`:''}`;
}
function formatSetText(st,splitSides=false){
  return splitSides?`${sideSetText(st,'left')} / ${sideSetText(st,'right')}`:`${st?.weight||'—'} ${st?.unit||''} × ${st?.reps||'—'}${String(st?.rir??'')!==''?` @${st.rir} RIR`:''}`;
}
function formatPrevious(rec){
  const split=!!rec.exercise.splitSides;
  const sets=(rec.exercise.sets||[]).filter(s=>setHasData(s,split));
  if(!sets.length) return 'Sin series registradas';
  return `${fmtDate(rec.session.date)} · `+sets.map(s=>formatSetText(s,split)).join(' · ');
}
function timerRemainingSeconds(){ return restTimerEndAt?Math.max(0,Math.ceil((restTimerEndAt-Date.now())/1000)):180; }
function timerLabel(){ const sec=timerRemainingSeconds(); const m=Math.floor(sec/60),s=sec%60; return `${m}:${String(s).padStart(2,'0')}`; }
function ensureTimerInterval(){
  clearInterval(restTimerInterval);
  restTimerInterval=setInterval(updateRestTimerUI,500);
  updateRestTimerUI();
}
function updateRestTimerUI(){
  const el=document.querySelector('[data-rest-timer-display]');
  if(el) el.textContent=restTimerEndAt?timerLabel():'3:00';
  const big=document.querySelector('[data-timer-big]');
  if(big) big.textContent=restTimerEndAt?timerLabel():'3:00';
  if(restTimerEndAt && Date.now()>=restTimerEndAt){
    restTimerEndAt=0; localStorage.removeItem(REST_TIMER_KEY);
    if(!restTimerAlarmed){ restTimerAlarmed=true; playRestAlarm(); }
  }
}
function activateWorkoutAudio(){
  try{
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC) return;
    workoutAudioContext=workoutAudioContext||new AC();
    workoutAudioContext.resume?.();
  }catch{}
}
function playRestAlarm(){
  try{
    activateWorkoutAudio();
    if(workoutAudioContext){
      [0,.35,.7].forEach(offset=>{
        const osc=workoutAudioContext.createOscillator(); const gain=workoutAudioContext.createGain();
        osc.frequency.value=880; gain.gain.value=.12; osc.connect(gain); gain.connect(workoutAudioContext.destination);
        const t=workoutAudioContext.currentTime+offset; osc.start(t); osc.stop(t+.18);
      });
    }
    navigator.vibrate?.([250,120,250,120,350]);
  }catch{}
  const btn=document.querySelector('[data-rest-timer]'); if(btn) btn.classList.add('timer-done');
}
function startRestTimer(){
  activateWorkoutAudio(); restTimerAlarmed=false; restTimerEndAt=Date.now()+180000; localStorage.setItem(REST_TIMER_KEY,String(restTimerEndAt)); ensureTimerInterval(); closeWorkoutSheet();
}
function stopRestTimer(){ restTimerEndAt=0; restTimerAlarmed=false; localStorage.removeItem(REST_TIMER_KEY); updateRestTimerUI(); closeWorkoutSheet(); }
function renderWorkout(){
  const s=activeSessionDraft; if(!s) return;
  s.cardio=s.cardio||{minutes:'',heartRate:'',incline:'',speed:''};
  document.getElementById('bottomNav').classList.add('hide');
  const pct=completionPct(s);
  document.getElementById('app').innerHTML=`<main class="screen workout-screen">
    <div class="workout-floating-tools">
      <button class="workout-tool-btn" data-open-calculator aria-label="Calculadora de unidades"><svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M8 7h8M8 11h2M14 11h2M8 15h2M14 15h2M8 18h2M14 18h2"/></svg></button>
      <button class="workout-tool-btn timer-tool" data-rest-timer aria-label="Temporizador de descanso"><span>⏱</span><b data-rest-timer-display>${restTimerEndAt?timerLabel():'3:00'}</b></button>
    </div>
    <div class="topbar workout-topbar"><button class="btn ghost workout-exit" data-action="close-workout">← Salir</button><div class="workout-title"><div class="subtle">${fmtDate(s.date)}</div><h1>${esc(s.routine)}</h1></div></div>
    <section class="workout-overview">
      <div class="row between"><div><span class="subtle">Progreso</span><strong>${pct}%</strong></div><div class="workout-count">${s.exercises.filter(exerciseHasData).length} / ${s.exercises.length} ejercicios</div></div>
      <div class="progressbar"><div style="width:${pct}%"></div></div><div class="autosave-indicator">✓ Guardado automáticamente en este dispositivo</div>
    </section>
    <div class="field date-field"><label>Fecha</label><input id="sessionDate" type="date" value="${s.date}"></div>
    <div id="exerciseList">${s.exercises.map((e,i)=>exerciseHTML(e,i)).join('')}</div>
    <section class="card cardio-card"><div class="section-kicker">Final</div><h3>Cardio</h3><div class="cardio-grid"><div class="field"><label>Minutos</label><input inputmode="numeric" type="number" min="0" step="1" value="${esc(s.cardio.minutes)}" data-cardio="minutes"></div><div class="field"><label>Ritmo cardiaco (bpm)</label><input inputmode="numeric" type="number" min="0" step="1" value="${esc(s.cardio.heartRate)}" data-cardio="heartRate"></div><div class="field"><label>Inclinación (%)</label><input inputmode="decimal" type="number" min="0" step="0.1" value="${esc(s.cardio.incline)}" data-cardio="incline"></div><div class="field"><label>Velocidad (km/h)</label><input inputmode="decimal" type="number" min="0" step="0.1" value="${esc(s.cardio.speed)}" data-cardio="speed"></div></div></section>
    <section class="card session-card"><div class="section-kicker">Cierre</div><h3>Sesión</h3><div class="field"><label>Sensación general</label><select id="overallFeeling"><option value="">Seleccionar</option>${['Excelente','Bien','Normal','Pesada','Muy pesada','Molestia'].map(v=>`<option ${s.overallFeeling===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>Notas generales</label><textarea id="sessionNotes" placeholder="Resumen del entrenamiento…">${esc(s.notes)}</textarea></div></section>
    <div class="save-actions"><button class="btn primary block save-workout-btn" data-action="save-session">Guardar entrenamiento</button></div>
    <div id="workoutSheetHost"></div>
  </main>`;
  bindWorkoutEvents(); ensureTimerInterval();
}
function exerciseHTML(e,i){
  const alts=replacementOptions(e.name); const group=EXERCISE_META[e.name]?.group||'';
  return `<section class="card exercise" data-ex="${i}">
    <div class="exercise-head">
      <div class="exercise-number">${i+1}</div>
      <button class="exercise-title-button ${alts.length?'can-swap':''}" data-change-exercise="${i}" ${alts.length?'':'disabled'}><span class="exercise-title-wrap"><h3>${esc(e.name)}</h3>${group?`<div class="muscle-tag">${esc(group)}</div>`:''}${alts.length?`<small>Toca el título para cambiar ejercicio</small>`:''}</span>${alts.length?'<span class="swap-chevron">›</span>':''}</button>
    </div>
    <div class="previous-panel"><span>Último registro</span><strong>${esc(e.previous||e.seed)}</strong></div>
    ${e.splitSides?`<div class="split-note">Resultados independientes para izquierda y derecha</div>`:''}
    <div class="sets">${e.sets.map((st,j)=>setRowHTML(st,i,j,e.splitSides)).join('')}</div>
    <div class="exercise-footer"><button class="btn ghost compact" data-add-set="${i}">+ Añadir serie</button><button class="btn ghost compact ${e.splitSides?'active':''}" data-toggle-sides="${i}">${e.splitSides?'Un solo resultado':'↔ Izq / Der'}</button></div>
    <div class="exercise-meta-grid"><div class="field"><label>Sensaciones</label><select data-feeling="${i}"><option value="">Seleccionar</option>${['Muy ligero','Bien','Normal','Pesado','Muy pesado','Molestia'].map(v=>`<option ${e.feeling===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>Notas</label><textarea data-notes="${i}" placeholder="Técnica, molestias, ajustes…">${esc(e.notes)}</textarea></div></div>
  </section>`;
}
function setRowHTML(st,ei,si,splitSides=false){
  if(splitSides){
    return `<div class="split-set-card" data-set="${si}"><div class="split-set-head"><strong>Serie ${si+1}</strong><div class="row"><select data-side-unit data-ei="${ei}" data-si="${si}"><option ${st.unit==='kg'?'selected':''}>kg</option><option ${st.unit==='lb'?'selected':''}>lb</option></select><button class="icon-btn" data-remove-set="${ei}:${si}" aria-label="Eliminar serie">×</button></div></div><div class="split-columns"><span></span><span>Peso</span><span>Reps</span><span>RIR</span></div>${sideRowHTML(st,ei,si,'left','Izq')}${sideRowHTML(st,ei,si,'right','Der')}</div>`;
  }
  return `<div class="set-row" data-set="${si}"><span class="set-num">${si+1}</span><div class="row" style="gap:4px"><input inputmode="decimal" placeholder="0" value="${esc(st.weight)}" data-k="weight" data-ei="${ei}" data-si="${si}"><select data-k="unit" data-ei="${ei}" data-si="${si}"><option ${st.unit==='kg'?'selected':''}>kg</option><option ${st.unit==='lb'?'selected':''}>lb</option></select></div><input inputmode="numeric" placeholder="0" value="${esc(st.reps)}" data-k="reps" data-ei="${ei}" data-si="${si}"><input inputmode="numeric" placeholder="0" value="${esc(st.rir)}" data-k="rir" data-ei="${ei}" data-si="${si}"><button class="icon-btn" data-remove-set="${ei}:${si}" aria-label="Eliminar serie">×</button></div>`;
}
function sideRowHTML(st,ei,si,side,label){
  const cap=side[0].toUpperCase()+side.slice(1);
  return `<div class="side-set-row"><span class="side-label">${label}</span><input inputmode="decimal" placeholder="0" value="${esc(st[side+'Weight']||'')}" data-side-k="${side}Weight" data-side="${side}" data-ei="${ei}" data-si="${si}"><input inputmode="numeric" placeholder="0" value="${esc(st[side+'Reps']||'')}" data-side-k="${side}Reps" data-side="${side}" data-ei="${ei}" data-si="${si}"><input inputmode="numeric" placeholder="0" value="${esc(st[side+'Rir']||'')}" data-side-k="${side}Rir" data-side="${side}" data-ei="${ei}" data-si="${si}"></div>`;
}
function completionPct(s){ const total=s.exercises.length; const done=s.exercises.filter(exerciseHasData).length; return total?Math.round(done/total*100):0; }
function updateWorkoutProgress(){
  const p=completionPct(activeSessionDraft); const bar=document.querySelector('.progressbar>div'); if(bar) bar.style.width=p+'%'; const pct=document.querySelector('.workout-overview strong'); if(pct) pct.textContent=p+'%';
}
function propagateWeight(ei,si,k,value){
  const ex=activeSessionDraft.exercises[ei]; if(!ex || si!==0) return;
  const sidePrefix=k.startsWith('left')?'left':k.startsWith('right')?'right':'';
  const autoKey=sidePrefix?`_${sidePrefix}WeightAuto`:'_weightAuto';
  const targetKey=sidePrefix?`${sidePrefix}Weight`:'weight';
  ex.sets.forEach((st,j)=>{ if(j===0) return; if(st[autoKey]!==false){ st[targetKey]=value; const q=sidePrefix?`[data-side-k="${targetKey}"][data-ei="${ei}"][data-si="${j}"]`:`[data-k="weight"][data-ei="${ei}"][data-si="${j}"]`; const input=document.querySelector(q); if(input) input.value=value; }});
}
function bindWorkoutEvents(){
  document.querySelector('[data-action="close-workout"]')?.addEventListener('click',()=>{ if(confirm('¿Salir y descartar este entrenamiento? Si solo cierras la app, el entrenamiento se conserva automáticamente.')){activeSessionDraft=null;clearWorkoutDraft();stopRestTimer();document.getElementById('bottomNav').classList.remove('hide');setView('train');} });
  document.getElementById('sessionDate')?.addEventListener('change',e=>{activeSessionDraft.date=e.target.value;persistWorkoutDraft();});
  document.getElementById('overallFeeling')?.addEventListener('change',e=>{activeSessionDraft.overallFeeling=e.target.value;persistWorkoutDraft();});
  document.getElementById('sessionNotes')?.addEventListener('input',e=>{activeSessionDraft.notes=e.target.value;persistWorkoutDraft();});
  document.querySelectorAll('[data-cardio]').forEach(el=>el.addEventListener('input',e=>{activeSessionDraft.cardio[e.target.dataset.cardio]=e.target.value;persistWorkoutDraft();}));
  document.querySelectorAll('[data-k]').forEach(el=>el.addEventListener('input',e=>{const {ei,si,k}=e.target.dataset;const ex=activeSessionDraft.exercises[+ei],st=ex.sets[+si];st[k]=e.target.value;if(k==='weight'){if(+si>0)st._weightAuto=false;else propagateWeight(+ei,+si,k,e.target.value);}if(k==='unit' && +si===0){ex.sets.forEach((x,j)=>{if(j>0&&x._weightAuto!==false)x.unit=e.target.value;});}persistWorkoutDraft();updateWorkoutProgress();}));
  document.querySelectorAll('[data-side-k]').forEach(el=>el.addEventListener('input',e=>{const {ei,si,sideK,side}=e.target.dataset;const ex=activeSessionDraft.exercises[+ei],st=ex.sets[+si];st[sideK]=e.target.value;if(sideK.endsWith('Weight')){const autoKey=side==='left'?'_leftWeightAuto':'_rightWeightAuto';if(+si>0)st[autoKey]=false;else propagateWeight(+ei,+si,sideK,e.target.value);}persistWorkoutDraft();updateWorkoutProgress();}));
  document.querySelectorAll('[data-side-unit]').forEach(el=>el.addEventListener('change',e=>{const {ei,si}=e.target.dataset;const ex=activeSessionDraft.exercises[+ei];ex.sets[+si].unit=e.target.value;if(+si===0)ex.sets.forEach((x,j)=>{if(j>0)x.unit=e.target.value;});persistWorkoutDraft();}));
  document.querySelectorAll('[data-feeling]').forEach(el=>el.addEventListener('change',e=>{activeSessionDraft.exercises[+e.target.dataset.feeling].feeling=e.target.value;persistWorkoutDraft();}));
  document.querySelectorAll('[data-notes]').forEach(el=>el.addEventListener('input',e=>{activeSessionDraft.exercises[+e.target.dataset.notes].notes=e.target.value;persistWorkoutDraft();}));
  document.querySelectorAll('[data-add-set]').forEach(b=>b.addEventListener('click',()=>{const i=+b.dataset.addSet;const e=activeSessionDraft.exercises[i];const first=e.sets[0]||cloneSetForDraft(null,e.defaultUnit);const st=cloneSetForDraft(null,first.unit||e.defaultUnit);st.n=e.sets.length+1;st.weight=first.weight||'';st.leftWeight=first.leftWeight||'';st.rightWeight=first.rightWeight||'';e.sets.push(st);persistWorkoutDraft();renderWorkout();}));
  document.querySelectorAll('[data-remove-set]').forEach(b=>b.addEventListener('click',()=>{const [ei,si]=b.dataset.removeSet.split(':').map(Number);const e=activeSessionDraft.exercises[ei];if(e.sets.length===1)return;e.sets.splice(si,1);e.sets.forEach((x,n)=>x.n=n+1);persistWorkoutDraft();renderWorkout();}));
  document.querySelectorAll('[data-toggle-sides]').forEach(b=>b.addEventListener('click',()=>toggleExerciseSides(+b.dataset.toggleSides)));
  document.querySelectorAll('[data-change-exercise]').forEach(b=>b.addEventListener('click',()=>openExerciseSwapSheet(+b.dataset.changeExercise)));
  document.querySelector('[data-open-calculator]')?.addEventListener('click',openCalculatorSheet);
  document.querySelector('[data-rest-timer]')?.addEventListener('click',openTimerSheet);
  document.querySelector('[data-action="save-session"]')?.addEventListener('click',saveSession);
}
function toggleExerciseSides(index){
  const e=activeSessionDraft.exercises[index]; if(!e) return; e.splitSides=!e.splitSides;
  if(e.splitSides) e.sets.forEach(st=>{ if(!st.leftWeight)st.leftWeight=st.weight||''; if(!st.rightWeight)st.rightWeight=st.weight||''; if(!st.leftReps)st.leftReps=st.reps||''; if(!st.rightReps)st.rightReps=st.reps||''; if(!st.leftRir)st.leftRir=st.rir||''; if(!st.rightRir)st.rightRir=st.rir||''; });
  persistWorkoutDraft(); renderWorkout();
}
function openExerciseSwapSheet(index){
  const e=activeSessionDraft.exercises[index]; const alts=replacementOptions(e.name); if(!alts.length) return;
  const host=document.getElementById('workoutSheetHost'); if(!host)return;
  host.innerHTML=`<div class="workout-sheet-backdrop" data-close-workout-sheet><div class="workout-sheet" onclick="event.stopPropagation()"><div class="sheet-handle"></div><div class="sheet-header"><div><span class="section-kicker">Misma zona muscular</span><h3>Cambiar ejercicio</h3></div><button class="icon-btn icon-square" data-close-workout-sheet>✕</button></div><div class="swap-option-list">${alts.map(a=>`<button class="swap-option" data-swap-to="${esc(a.name)}"><span>${esc(a.name)}</span><small>${esc(a.group)}</small><b>›</b></button>`).join('')}</div></div></div>`;
  host.querySelectorAll('[data-close-workout-sheet]').forEach(x=>x.addEventListener('click',closeWorkoutSheet));
  host.querySelectorAll('[data-swap-to]').forEach(x=>x.addEventListener('click',()=>swapExerciseTo(index,x.dataset.swapTo)));
}
function closeWorkoutSheet(){ const host=document.getElementById('workoutSheetHost'); if(host)host.innerHTML=''; }
async function swapExerciseTo(index,newName){
  const current=activeSessionDraft.exercises[index]; const hasData=exerciseHasData(current)||current.feeling||current.notes;
  if(hasData && !confirm('Este ejercicio ya tiene datos. ¿Cambiarlo y reemplazar lo registrado en este ejercicio?')) return;
  const meta=exerciseCatalog().find(x=>x.name===newName); if(!meta)return;
  activeSessionDraft.exercises[index]=await buildExerciseDraft(newName,meta,current.originalName||current.name); persistWorkoutDraft(); renderWorkout();
}
function openCalculatorSheet(){
  const host=document.getElementById('workoutSheetHost'); if(!host)return;
  host.innerHTML=`<div class="workout-sheet-backdrop" data-close-workout-sheet><div class="workout-sheet" onclick="event.stopPropagation()"><div class="sheet-handle"></div><div class="sheet-header"><div><span class="section-kicker">Conversión rápida</span><h3>Calculadora</h3></div><button class="icon-btn icon-square" data-close-workout-sheet>✕</button></div><div class="calc-grid"><div class="field"><label>Valor</label><input id="convertValue" inputmode="decimal" type="number" step="0.01" placeholder="0"></div><div class="field"><label>Convertir</label><select id="convertDirection"><option value="lbkg">lb → kg</option><option value="kglb">kg → lb</option></select></div></div><div class="conversion-result" id="conversionResult">Escribe un valor</div></div></div>`;
  host.querySelectorAll('[data-close-workout-sheet]').forEach(x=>x.addEventListener('click',closeWorkoutSheet));
  const update=()=>{const v=+document.getElementById('convertValue')?.value;const dir=document.getElementById('convertDirection')?.value;const box=document.getElementById('conversionResult');if(!box)return;if(!Number.isFinite(v)){box.textContent='Escribe un valor';return;}const result=dir==='lbkg'?v*0.45359237:v*2.2046226218;box.innerHTML=`<strong>${round(result,2)}</strong> ${dir==='lbkg'?'kg':'lb'}`;};
  document.getElementById('convertValue')?.addEventListener('input',update); document.getElementById('convertDirection')?.addEventListener('change',update); document.getElementById('convertValue')?.focus();
}
function openTimerSheet(){
  activateWorkoutAudio(); const host=document.getElementById('workoutSheetHost'); if(!host)return;
  host.innerHTML=`<div class="workout-sheet-backdrop" data-close-workout-sheet><div class="workout-sheet timer-sheet" onclick="event.stopPropagation()"><div class="sheet-handle"></div><div class="sheet-header"><div><span class="section-kicker">Descanso entre series</span><h3>Temporizador</h3></div><button class="icon-btn icon-square" data-close-workout-sheet>✕</button></div><div class="timer-big" data-timer-big>${restTimerEndAt?timerLabel():'3:00'}</div><div class="timer-actions"><button class="btn primary" data-start-rest>Iniciar / reiniciar 3 min</button><button class="btn ghost" data-stop-rest>Detener</button></div><p class="subtle">La alarma suena mientras Fit Log está activo. Si iOS suspende la app, el tiempo queda guardado y se actualiza al volver.</p></div></div>`;
  host.querySelectorAll('[data-close-workout-sheet]').forEach(x=>x.addEventListener('click',closeWorkoutSheet)); document.querySelector('[data-start-rest]')?.addEventListener('click',startRestTimer); document.querySelector('[data-stop-rest]')?.addEventListener('click',stopRestTimer); ensureTimerInterval();
}
function cleanSessionForSave(session){
  const s=clone(session);
  for(const e of s.exercises||[]) for(const st of e.sets||[]) for(const k of Object.keys(st)) if(k.startsWith('_')) delete st[k];
  return s;
}
async function saveSession(){
  const hasData=activeSessionDraft.exercises.some(exerciseHasData);
  if(!hasData){alert('Registra al menos una serie antes de guardar.');return;}
  await put(STORE_SESSIONS,cleanSessionForSave(activeSessionDraft)); activeSessionDraft=null; clearWorkoutDraft(); stopRestTimer(); document.getElementById('bottomNav').classList.remove('hide'); currentView='history'; await render();
}

async function measureHTML(){
  const ref=await measurementReference();
  const prev=ref.latest;
  const age=ref.age;
  return `<main class="screen section-screen measure-screen">
    <div class="section-app-header measure-header">
      <div><span class="dashboard-kicker">Registro semanal</span><h1>Mediciones</h1><p>Tu peso, estatura y fecha de nacimiento alimentan automáticamente el cálculo de calorías cuando el objetivo está en modo automático.</p></div>
      <div class="section-symbol"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 7v3M11 7v2M14 7v3M17 7v2"/></svg></div>
    </div>
    ${prev?`<section class="last-measure-card"><div><span>Último registro</span><strong>${prev.weight??'—'}${prev.weight?' kg':''}</strong><small>${fmtDate(prev.date)}</small></div><div><span>Cintura</span><strong>${prev.waistMin??'—'}${prev.waistMin?' cm':''}</strong><small>mínima</small></div></section>`:''}
    <form id="measureForm" class="card measurement-form">
      <div class="form-card-title"><span class="dashboard-kicker">Nueva medición</span><h2>Registrar datos</h2></div>
      <div class="field"><label>Fecha de la medición</label><input name="date" type="date" value="${today()}" required></div>
      <div class="profile-measure-block">
        <div class="profile-measure-title"><div><span class="dashboard-kicker">Datos para calorías</span><h3>Referencia personal</h3></div><span class="profile-sync-badge">Automático</span></div>
        <div class="form-grid profile-measure-grid">
          <div class="field"><label>Estatura <span>cm</span></label><input name="height" inputmode="decimal" type="number" step="0.1" min="50" max="250" value="${ref.height??''}" placeholder="176"></div>
          <div class="field"><label>Fecha de nacimiento</label><input id="birthDateInput" name="birthDate" type="date" value="${esc(ref.birthDate)}"></div>
        </div>
        <div class="age-display simple-age"><span>Edad :</span><strong id="calculatedAge">${age!==null?`${age} años`:'—'}</strong></div>
      </div>
      <div class="form-grid">${MEASURE_FIELDS.map(([k,l,u])=>`<div class="field"><label>${l} <span>${u}</span></label><input name="${k}" inputmode="decimal" type="number" step="0.1" placeholder="${prev?.[k]??''}"></div>`).join('')}</div>
      <div class="field"><label>Notas</label><textarea name="notes" placeholder="Condiciones de medición, observaciones…"></textarea></div>
      <button class="btn primary block" type="submit">Guardar mediciones</button>
    </form>
  </main>`;
}
async function saveMeasurement(form){
  const previousRef=await measurementReference();
  const fd=new FormData(form);
  const obj={id:uid('measure'),createdAt:Date.now()};
  for(const [k,v] of fd.entries()) obj[k]=v;
  if(!obj.date) obj.date=today();
  if(!String(obj.height||'').trim() && previousRef.height!==null) obj.height=String(previousRef.height);
  if(!String(obj.birthDate||'').trim() && previousRef.birthDate) obj.birthDate=previousRef.birthDate;
  await put(STORE_MEASUREMENTS,obj);
  // En modo automático, esto sincroniza inmediatamente peso/estatura/edad y recalcula macros.
  await getNutritionGoal();
  currentView='history'; historyTab='measurements'; await render();
}

async function historyHTML(){
  const sessions=(await getAll(STORE_SESSIONS)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
  const measures=(await getAll(STORE_MEASUREMENTS)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
  const list=historyTab==='sessions'?
    (sessions.length?sessions.map(s=>`<button class="list-item" data-session-id="${s.id}"><strong>${esc(s.routine)}</strong><span class="subtle">${fmtDate(s.date)} · ${s.exercises.length} ejercicios</span><div class="chips">${s.overallFeeling?`<span class="chip">${esc(s.overallFeeling)}</span>`:''}<span class="chip">${s.exercises.reduce((n,e)=>n+e.sets.filter(x=>x.reps!==''||x.weight!=='').length,0)} series</span></div></button>`).join(''):'<div class="empty">No hay entrenamientos guardados.</div>'):
    (measures.length?measures.map(m=>`<button class="list-item" data-measure-id="${m.id}"><strong>${fmtDate(m.date)}</strong><span class="subtle">${m.weight?`${m.weight} kg`:''}${m.waistMin?` · cintura ${m.waistMin} cm`:''}</span></button>`).join(''):'<div class="empty">No hay mediciones guardadas.</div>');
  return `<main class="screen"><div class="topbar"><button class="btn ghost" data-action="history-back">← Inicio</button><div style="text-align:right"><div class="subtle">Todos tus registros</div><h1>Historial</h1></div></div><div class="tabs"><button class="tab ${historyTab==='sessions'?'active':''}" data-history-tab="sessions">Entrenamientos</button><button class="tab ${historyTab==='measurements'?'active':''}" data-history-tab="measurements">Mediciones</button></div><div class="list" style="margin-top:12px">${list}</div></main>`;
}
function historySetHTML(e,st,i){
  if(e.splitSides){
    return `<div class="history-split-set"><strong>Serie ${i+1}</strong><span>${esc(sideSetText(st,'left'))}</span><span>${esc(sideSetText(st,'right'))}</span></div>`;
  }
  return `<div class="row between"><span>Serie ${i+1}</span><strong>${esc(st.weight||'—')} ${esc(st.unit)} × ${esc(st.reps||'—')} ${String(st.rir??'')!==''?`· RIR ${esc(st.rir)}`:''}</strong></div>`;
}
async function showSession(id){
  const s=await getOne(STORE_SESSIONS,id); if(!s)return; document.getElementById('bottomNav').classList.add('hide');
  const cardio=s.cardio||{}; const hasCardio=Object.values(cardio).some(v=>String(v??'')!=='');
  document.getElementById('app').innerHTML=`<main class="screen"><div class="topbar"><button class="btn ghost" data-back-history>← Historial</button><button class="btn danger" data-delete-session="${s.id}">Eliminar</button></div><h1>${esc(s.routine)}</h1><div class="subtle">${fmtDate(s.date)}</div>${s.exercises.map(e=>`<section class="card"><h3>${esc(e.name)}</h3>${(e.sets||[]).filter(st=>setHasData(st,!!e.splitSides)).map((st,i)=>historySetHTML(e,st,i)).join('<div class="divider"></div>')||'<span class="subtle">Sin series registradas</span>'}${e.feeling?`<div class="chips"><span class="chip">${esc(e.feeling)}</span></div>`:''}${e.notes?`<p class="subtle">${esc(e.notes)}</p>`:''}</section>`).join('')}${hasCardio?`<section class="card"><h3>Cardio</h3><div class="cardio-history-grid">${cardio.minutes?`<div><span>Minutos</span><strong>${esc(cardio.minutes)}</strong></div>`:''}${cardio.heartRate?`<div><span>Ritmo cardiaco</span><strong>${esc(cardio.heartRate)} bpm</strong></div>`:''}${cardio.incline?`<div><span>Inclinación</span><strong>${esc(cardio.incline)}%</strong></div>`:''}${cardio.speed?`<div><span>Velocidad</span><strong>${esc(cardio.speed)} km/h</strong></div>`:''}</div></section>`:''}${s.overallFeeling||s.notes?`<section class="card"><h3>Sesión</h3>${s.overallFeeling?`<p>${esc(s.overallFeeling)}</p>`:''}${s.notes?`<p class="subtle">${esc(s.notes)}</p>`:''}</section>`:''}</main>`;
  document.querySelector('[data-back-history]').onclick=()=>{document.getElementById('bottomNav').classList.remove('hide');render();};
  document.querySelector('[data-delete-session]').onclick=async()=>{if(confirm('¿Eliminar este entrenamiento?')){await del(STORE_SESSIONS,id);document.getElementById('bottomNav').classList.remove('hide');render();}};
}
async function showMeasurement(id){
  const m=await getOne(STORE_MEASUREMENTS,id); if(!m)return; document.getElementById('bottomNav').classList.add('hide');
  const measureAge=ageFromBirthDate(m.birthDate,m.date||today());
  document.getElementById('app').innerHTML=`<main class="screen"><div class="topbar"><button class="btn ghost" data-back-history>← Historial</button><button class="btn danger" data-delete-measure="${m.id}">Eliminar</button></div><h1>Mediciones</h1><div class="subtle">${fmtDate(m.date)}</div><section class="card">${m.height?`<div class="row between"><span>Estatura</span><strong>${esc(m.height)} cm</strong></div><div class="divider"></div>`:''}${m.birthDate?`<div class="row between"><span>Fecha de nacimiento</span><strong>${fmtDate(m.birthDate)}</strong></div><div class="divider"></div>`:''}${measureAge!==null?`<div class="row between"><span>Edad en esta medición</span><strong>${measureAge} años</strong></div><div class="divider"></div>`:''}${MEASURE_FIELDS.map(([k,l,u])=>m[k]?`<div class="row between"><span>${l}</span><strong>${esc(m[k])} ${u}</strong></div><div class="divider"></div>`:'').join('')}${m.notes?`<p class="subtle">${esc(m.notes)}</p>`:''}</section></main>`;
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
  for(const s of sessions){const e=s.exercises.find(x=>x.name===name);if(e){const sets=e.sets.filter(x=>setHasData(x,!!e.splitSides));if(sets.length)rows.push({date:s.date,sets,splitSides:!!e.splitSides});} if(rows.length===8)break;}
  box.innerHTML=rows.length?`<div class="list">${rows.map(r=>`<div class="list-item"><strong>${fmtDate(r.date)}</strong><span class="subtle">${r.sets.map(x=>esc(formatSetText(x,r.splitSides))).join(' · ')}</span></div>`).join('')}</div>`:'No hay registros para este ejercicio.';
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
  const ref=await measurementReference();
  if(!goal) goal={...DEFAULT_NUTRITION};

  // Desde v9.3 el cálculo es siempre automático. Incluso si una versión anterior
  // dejó guardado el modo manual, se migra automáticamente al modo automático.
  const source={...DEFAULT_NUTRITION,...goal,
    key:'nutritionGoal',
    mode:'auto',
    calcWeight:ref.weight??num(goal.calcWeight)??DEFAULT_NUTRITION.calcWeight,
    height:ref.height??num(goal.height)??DEFAULT_NUTRITION.height,
    age:ref.age??num(goal.age)??DEFAULT_NUTRITION.age,
    birthDate:ref.birthDate||goal.birthDate||'',
    measurementDate:ref.latest?.date||goal.measurementDate||''
  };
  const calculated=calculateNutritionGoal(source);
  const fields=['calcWeight','height','age','birthDate','measurementDate','activity','deficit','proteinPerKg','fatPerKg','targetCalories','protein','fat','carbs','trm','expenditure'];
  const changed=!goal || fields.some(k=>{
    if(typeof calculated[k]==='number' || typeof goal?.[k]==='number') return Math.abs((+calculated[k]||0)-(+goal?.[k]||0))>0.01;
    return String(calculated[k]??'')!==String(goal?.[k]??'');
  });
  if(changed) await put(STORE_SETTINGS,calculated);
  return calculated;
}
function macroPct(value,target){ if(!target) return 0; return Math.max(0,Math.min(100,(value/target)*100)); }
const MEAL_RING_COLORS=['#5c7cfa','#7bc6b0','#f4b183','#c5a3e6','#f5cf7b','#8ecae6'];
function mealColor(index){ return MEAL_RING_COLORS[index % MEAL_RING_COLORS.length]; }
function buildMealRing(day,targetCalories){
  const target=Math.max(1,+targetCalories||1);
  let cursor=0;
  const segments=[];
  const legend=[];
  (day?.meals||[]).forEach((meal,mi)=>{
    const mt=(meal.items||[]).reduce((a,b)=>sumMacros(a,b),emptyMacros());
    if(mt.kcal>0){
      const color=mealColor(mi);
      const pct=Math.max(0,Math.min(100-cursor,(mt.kcal/target)*100));
      if(pct>0.0001){
        segments.push(`${color} ${cursor}% ${cursor+pct}%`);
        cursor+=pct;
      }
      legend.push(`<span class="ring-legend-item"><i style="background:${color}"></i>${esc(meal.name)} · ${round(mt.kcal)} kcal</span>`);
    }
  });
  if(cursor<100) segments.push(`#e9edf4 ${cursor}% 100%`);
  if(!segments.length) segments.push('#e9edf4 0 100%');
  return { background:`conic-gradient(${segments.join(',')})`, legend:legend.join('') };
}
function macroBar(type,label,value,target,unit){
  const remain=(+target||0)-(+value||0);
  const pct=macroPct(value,target);
  return `<div class="macro-card macro-${type}"><div class="row between"><div><span class="macro-label">${label}</span><strong>${round(value)} <small>${unit}</small></strong></div><div class="macro-remain ${remain<0?'over':''}">${remain>=0?'Faltan':'Exceso'}<b>${round(Math.abs(remain))} ${unit}</b></div></div><div class="macro-track"><div style="width:${pct}%"></div></div><div class="macro-target">Objetivo ${round(target)} ${unit}</div></div>`;
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
  const day=await getFoodDay(foodSelectedDate,true); const totals=foodDayTotals(day); const goal=await getNutritionGoal(); const templates=await getAll(STORE_FOOD_TEMPLATES); const calPct=Math.min(100,macroPct(totals.kcal,goal.targetCalories)); const calRemain=goal.targetCalories-totals.kcal; const ring=buildMealRing(day,goal.targetCalories);
  return `<div class="date-nav"><button class="icon-btn date-btn" data-food-date="-1">‹</button><div><strong>${foodSelectedDate===today()?'HOY':fmtDate(foodSelectedDate)}</strong><input id="foodDateInput" type="date" value="${foodSelectedDate}"></div><button class="icon-btn date-btn" data-food-date="1">›</button></div>
    <section class="card nutrition-summary premium-nutrition">
      <div class="calorie-ring" style="background:${ring.background}"><div><strong>${round(totals.kcal)}</strong><span>de ${round(goal.targetCalories)}</span><small>kcal</small></div></div>
      <div class="nutrition-copy"><div class="section-kicker">Calorías de hoy</div><h2>${calRemain>=0?`${round(calRemain)} kcal restantes`:`${round(Math.abs(calRemain))} kcal sobre objetivo`}</h2><p class="subtle">Registra tus alimentos y Fit Log ajusta el resumen automáticamente.</p>${ring.legend?`<div class="ring-legend">${ring.legend}</div>`:''}</div>
    </section>
    <div class="macro-grid">${macroBar('protein','Proteína',totals.protein,goal.protein,'g')}${macroBar('fat','Grasa',totals.fat,goal.fat,'g')}${macroBar('carbs','Carbohidratos',totals.carbs,goal.carbs,'g')}</div>
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
  const goal=await getNutritionGoal();
  return `<section class="card nutrition-auto-card">
    <form id="nutritionGoalForm">
      <input type="hidden" name="calcWeight" value="${round(+goal.calcWeight||DEFAULT_NUTRITION.calcWeight,2)}">
      <input type="hidden" name="height" value="${round(+goal.height||DEFAULT_NUTRITION.height,2)}">
      <input type="hidden" name="age" value="${+goal.age||DEFAULT_NUTRITION.age}">
      <input type="hidden" name="proteinPerKg" value="${+goal.proteinPerKg||DEFAULT_NUTRITION.proteinPerKg}">
      <input type="hidden" name="fatPerKg" value="${+goal.fatPerKg||DEFAULT_NUTRITION.fatPerKg}">
      <div class="nutrition-controls">
        <div class="field"><label>Actividad</label><select name="activity"><option value="1.2" ${+goal.activity===1.2?'selected':''}>Sedentario (1.2)</option><option value="1.375" ${+goal.activity===1.375?'selected':''}>Poca actividad (1.375)</option><option value="1.55" ${+goal.activity===1.55?'selected':''}>Moderada (1.55)</option><option value="1.725" ${+goal.activity===1.725?'selected':''}>Muy activo (1.725)</option><option value="1.9" ${+goal.activity===1.9?'selected':''}>Muy activo + trabajo físico (1.9)</option></select></div>
        <div class="field"><label>Déficit (%)</label><input name="deficit" type="number" step="1" min="0" max="50" value="${+goal.deficit||20}"></div>
      </div>
      <div id="goalPreview" class="goal-preview"></div>
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
let nutritionAutoSaveTimer=null;
async function saveNutritionGoal(form){
  const fd=new FormData(form);
  const ref=await measurementReference();
  const old=await getSetting('nutritionGoal')||DEFAULT_NUTRITION;
  const goal=calculateNutritionGoal({
    ...DEFAULT_NUTRITION,
    ...old,
    key:'nutritionGoal',
    mode:'auto',
    calcWeight:ref.weight??(+fd.get('calcWeight')||DEFAULT_NUTRITION.calcWeight),
    height:ref.height??(+fd.get('height')||DEFAULT_NUTRITION.height),
    age:ref.age??(+fd.get('age')||DEFAULT_NUTRITION.age),
    birthDate:ref.birthDate||'',
    measurementDate:ref.latest?.date||'',
    activity:+fd.get('activity')||DEFAULT_NUTRITION.activity,
    deficit:Number.isFinite(+fd.get('deficit'))?+fd.get('deficit'):DEFAULT_NUTRITION.deficit,
    proteinPerKg:+fd.get('proteinPerKg')||old.proteinPerKg||DEFAULT_NUTRITION.proteinPerKg,
    fatPerKg:+fd.get('fatPerKg')||old.fatPerKg||DEFAULT_NUTRITION.fatPerKg
  });
  await put(STORE_SETTINGS,goal);
  return goal;
}
function updateGoalPreview(){
  const form=document.getElementById('nutritionGoalForm'); const box=document.getElementById('goalPreview'); if(!form||!box) return; const fd=new FormData(form);
  const calc=calculateNutritionGoal({calcWeight:+fd.get('calcWeight'),height:+fd.get('height'),age:+fd.get('age'),activity:+fd.get('activity'),deficit:+fd.get('deficit'),proteinPerKg:+fd.get('proteinPerKg'),fatPerKg:+fd.get('fatPerKg')});
  const kcal=calc.targetCalories||1;
  const proteinPct=Math.max(0,calc.protein*4/kcal*100);
  const fatPct=Math.max(0,calc.fat*9/kcal*100);
  const carbsPct=Math.max(0,100-proteinPct-fatPct);
  box.innerHTML=`
    <div class="goal-grid compact-goal-grid">
      <div><span>TRM</span><strong>${round(calc.trm)} kcal</strong></div>
      <div><span>Gasto</span><strong>${round(calc.expenditure)} kcal</strong></div>
      <div><span>Déficit</span><strong>${round(+fd.get('deficit'))}%</strong></div>
      <div><span>Objetivo</span><strong>${round(calc.targetCalories)} kcal</strong></div>
    </div>
    <div class="macro-percent-title">Macros</div>
    <div class="macro-percent-grid">
      <div class="macro-percent-card"><span>Proteína</span><strong>${round(proteinPct)}%</strong><small>${round(calc.protein)} g</small></div>
      <div class="macro-percent-card"><span>Carbohidratos</span><strong>${round(carbsPct)}%</strong><small>${round(calc.carbs)} g</small></div>
      <div class="macro-percent-card"><span>Grasas</span><strong>${round(fatPct)}%</strong><small>${round(calc.fat)} g</small></div>
    </div>`;
}
function queueNutritionAutoSave(){
  clearTimeout(nutritionAutoSaveTimer);
  nutritionAutoSaveTimer=setTimeout(async()=>{
    const form=document.getElementById('nutritionGoalForm');
    if(form) await saveNutritionGoal(form);
  },250);
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
  const nutritionForm=document.getElementById('nutritionGoalForm');
  nutritionForm?.addEventListener('input',()=>{updateGoalPreview();queueNutritionAutoSave();});
  nutritionForm?.addEventListener('change',async()=>{updateGoalPreview();clearTimeout(nutritionAutoSaveTimer);await saveNutritionGoal(nutritionForm);});
  if(document.getElementById('goalPreview')) updateGoalPreview();
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
  document.querySelector('[data-resume-workout]')?.addEventListener('click',()=>{activeSessionDraft=loadWorkoutDraft();if(activeSessionDraft)renderWorkout();});
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
  document.getElementById('birthDateInput')?.addEventListener('change',e=>{const age=ageFromBirthDate(e.target.value,today());const el=document.getElementById('calculatedAge');if(el)el.textContent=age!==null?`${age} años`:'—';});
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
openDB().then(seedStarterFoods).then(async()=>{
  activeSessionDraft=loadWorkoutDraft();
  if(activeSessionDraft) renderWorkout(); else await render();
}).catch(err=>{document.getElementById('app').innerHTML=`<main class="screen"><div class="card"><h2>Error al abrir la base local</h2><p class="subtle">${esc(err.message)}</p></div></main>`;});
window.addEventListener('pagehide',persistWorkoutDraft);
document.addEventListener('visibilitychange',()=>{ if(document.hidden) persistWorkoutDraft(); else if(activeSessionDraft){ updateRestTimerUI(); } });
