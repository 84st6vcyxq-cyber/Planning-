// ====== Roulement 5x8 (15 jours) ======
// NNN RR AAA RR MMM RR
const ROTATION = ["N","N","N","R","R","A","A","A","R","R","M","M","M","R","R"];

const SHIFT_LABEL = { N:"Nuit", A:"Après-midi", M:"Matin", R:"Repos", V:"Congé" };
const DOW = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

const LS_KEY = "planning58_v1";

let state = loadState() ?? {
  // Par défaut : aujourd’hui = Après-midi (modifiable)
  refDate: isoDate(new Date()),
  refShift: "A",
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth(), // 0-11
  overrides: {} // { "YYYY-MM-DD": {shift:"V", note:"..."} }
};

const el = (id)=>document.getElementById(id);

function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function loadState(){ try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return null; } }

function isoDate(d){
  const x = new Date(d);
  x.setHours(0,0,0,0);
  const y = x.getFullYear();
  const m = String(x.getMonth()+1).padStart(2,"0");
  const day = String(x.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function parseISO(s){
  const [y,m,d] = s.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  dt.setHours(0,0,0,0);
  return dt;
}
function daysBetween(a, b){
  // b - a (en jours)
  const ms = 24*60*60*1000;
  return Math.round((b.getTime() - a.getTime())/ms);
}

function rotationIndexForDate(date){
  // On connaît un refDate + refShift ; on calcule l'index dans ROTATION
  const ref = parseISO(state.refDate);

  // prendre un index correspondant à refShift (première occurrence)
  let refIdx = ROTATION.findIndex(s => s === state.refShift);
  if(refIdx < 0) refIdx = 0;

  const delta = daysBetween(ref, date); // date - ref
  let idx = (refIdx + (delta % ROTATION.length));
  if(idx < 0) idx += ROTATION.length;
  return idx;
}
function shiftForDate(date){
  const key = isoDate(date);
  const ov = state.overrides[key];
  if(ov?.shift) return ov.shift;
  const idx = rotationIndexForDate(date);
  return ROTATION[idx];
}

function monthTitle(y,m){
  return new Date(y,m,1).toLocaleDateString("fr-FR", {month:"long", year:"numeric"});
}

function render(){
  const now = new Date();
  const todayKey = isoDate(now);

  el("subtitle").textContent = `Cycle: NNN RR AAA RR MMM RR • Réf: ${state.refDate} = ${SHIFT_LABEL[state.refShift]}`;
  el("monthTitle").textContent = capitalize(monthTitle(state.viewYear, state.viewMonth));

  // inputs
  el("refDate").value = state.refDate;
  el("refShift").value = state.refShift;

  const grid = el("grid");
  grid.innerHTML = "";

  // entêtes jours
  for(const d of DOW){
    const div = document.createElement("div");
    div.className = "dow";
    div.textContent = d;
    grid.appendChild(div);
  }

  const first = new Date(state.viewYear, state.viewMonth, 1);
  const last = new Date(state.viewYear, state.viewMonth+1, 0);

  // JS: dimanche=0... nous: lundi=0
  const firstDow = (first.getDay() + 6) % 7; // 0..6 (lun..dim)

  // cases vides avant
  for(let i=0;i<firstDow;i++){
    const pad = document.createElement("div");
    pad.className = "day muted";
    grid.appendChild(pad);
  }

  // jours du mois
  for(let day=1; day<=last.getDate(); day++){
    const date = new Date(state.viewYear, state.viewMonth, day);
    const key = isoDate(date);

    const shift = shiftForDate(date);
    const ov = state.overrides[key];

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day" + (key===todayKey ? " today" : "");
    cell.dataset.date = key;

    const num = document.createElement("div");
    num.className = "num";
    num.textContent = day;

    const tag = document.createElement("div");
    tag.className = `tag ${shift}`;
    tag.textContent = SHIFT_LABEL[shift];

    const note = document.createElement("div");
    note.className = "note";
    note.textContent = ov?.note ? ov.note : "";

    cell.appendChild(num);
    cell.appendChild(tag);
    if(note.textContent) cell.appendChild(note);

    cell.addEventListener("click", ()=>openDayDialog(key));

    grid.appendChild(cell);
  }
}

function capitalize(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

// ===== Dialog jour =====
let currentKey = null;

function openDayDialog(key){
  currentKey = key;
  const ov = state.overrides[key] ?? {};

  el("dlgTitle").textContent = `Jour: ${key}`;
  el("overrideShift").value = ov.shift ?? "";
  el("note").value = ov.note ?? "";

  el("dayDialog").showModal();
}

function saveDayDialog(){
  if(!currentKey) return;
  const shift = el("overrideShift").value; // "" ou N/A/M/R/V
  const note = el("note").value.trim();

  if(shift || note){
    state.overrides[currentKey] = { shift: shift || undefined, note: note || undefined };
  }else{
    delete state.overrides[currentKey];
  }
  saveState();
  render();
}

// ===== Navigation mois =====
function addMonths(delta){
  let y = state.viewYear;
  let m = state.viewMonth + delta;
  while(m<0){ m+=12; y--; }
  while(m>11){ m-=12; y++; }
  state.viewYear = y; state.viewMonth = m;
  saveState();
  render();
}

// ===== Référence roulement =====
function saveReference(){
  state.refDate = el("refDate").value;
  state.refShift = el("refShift").value;
  saveState();
  render();
}
function resetOverrides(){
  state.overrides = {};
  saveState();
  render();
}

// ===== Init events =====
document.addEventListener("DOMContentLoaded", ()=>{
  el("prev").addEventListener("click", ()=>addMonths(-1));
  el("next").addEventListener("click", ()=>addMonths(+1));
  el("today").addEventListener("click", ()=>{
    const d = new Date();
    state.viewYear = d.getFullYear();
    state.viewMonth = d.getMonth();
    saveState();
    render();
  });

  el("saveRef").addEventListener("click", saveReference);
  el("resetOverrides").addEventListener("click", resetOverrides);

  el("dlgSave").addEventListener("click", (e)=>{
    e.preventDefault();
    saveDayDialog();
    el("dayDialog").close();
  });

  render();
});
