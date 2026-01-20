// ====== Planning 5x8 V3 ======
// Nouveauté V3: +15 min d'HS automatiquement à chaque journée travaillée (M/A/N)

// Cycle (15 jours): NNN RR AAA RR MMM RR
const ROTATION = ["N","N","N","R","R","A","A","A","R","R","M","M","M","R","R"];

// Horaires (tes horaires)
const SHIFT_TIME = {
  M: { start: "04:00", end: "12:15" },
  A: { start: "12:00", end: "20:15" },
  N: { start: "20:00", end: "04:15" }
};

const AUTO_OT_MIN_PER_WORKDAY = 15; // +15 min d'HS pour chaque jour travaillé

const SHIFT_LABEL = { N:"Nuit", A:"Après-midi", M:"Matin", R:"Repos", V:"Congé" };
const DOW = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];


function sanitizeShift(s){
  if(!s) return "R";
  const x = String(s).trim().toUpperCase();
  return (x==="M"||x==="A"||x==="N"||x==="R"||x==="V") ? x : "R";
}

const LS_KEY = "planning58_v3";

let state = loadState() ?? {
  refDate: isoDate(new Date()),
  refShift: "A",
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth(), // 0-11
  overrides: {} // { "YYYY-MM-DD": {shift:"V", note:"...", overtimeMinutes:120} } (overtimeMinutes = HS ajoutées)
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
  const ms = 24*60*60*1000;
  return Math.round((b.getTime() - a.getTime())/ms);
}

function hhmmToMinutes(hhmm){
  const [h, m] = hhmm.split(":").map(Number);
  return h*60 + m;
}

function shiftBaseMinutes(shift){
  if(!SHIFT_TIME[shift]) return 0;
  const start = hhmmToMinutes(SHIFT_TIME[shift].start);
  const end = hhmmToMinutes(SHIFT_TIME[shift].end);
  return (end >= start) ? (end - start) : ((24*60 - start) + end);
}

const BASE_MINUTES = {
  M: shiftBaseMinutes("M"),
  A: shiftBaseMinutes("A"),
  N: shiftBaseMinutes("N"),
  R: 0,
  V: 0
};

function minutesToHM(mins){
  const x = Math.abs(Math.round(mins));
  const h = Math.floor(x/60);
  const m = x % 60;
  return `${h}h${String(m).padStart(2,"0")}`;
}
function minutesToDecimalHours(mins){
  const h = mins/60;
  return (Math.round(h*100)/100).toString().replace(".", ",") + " h";
}

function rotationIndexForDate(date){
  const ref = parseISO(state.refDate);
  let refIdx = ROTATION.findIndex(s => s === state.refShift);
  if(refIdx < 0) refIdx = 0;

  const delta = daysBetween(ref, date);
  let idx = (refIdx + (delta % ROTATION.length));
  if(idx < 0) idx += ROTATION.length;
  return idx;
}

function plannedShiftForDate(date){
  return sanitizeShift(ROTATION[rotationIndexForDate(date)]);
}

function effectiveShiftForDate(date){
  const key = isoDate(date);
  const ov = state.overrides[key];
  if(ov?.shift) return sanitizeShift(ov.shift);
  return sanitizeShift(plannedShiftForDate(date));
}

function manualOvertimeMinutesForKey(key){
  const ov = state.overrides[key];
  return ov?.overtimeMinutes ? Number(ov.overtimeMinutes) : 0;
}

function autoOvertimeMinutesForShift(shift){
  return (shift === "M" || shift === "A" || shift === "N") ? AUTO_OT_MIN_PER_WORKDAY : 0;
}

function totalOvertimeMinutesForDate(date){
  const key = isoDate(date);
  const shift = effectiveShiftForDate(date);
  return autoOvertimeMinutesForShift(shift) + manualOvertimeMinutesForKey(key);
}

// ====== Totaux ======
function calcTotalsForRange(dateStart, dateEndInclusive){
  let base = 0;
  let otAuto = 0;
  let otManual = 0;

  const cur = new Date(dateStart);
  while(cur <= dateEndInclusive){
    const key = isoDate(cur);
    const shift = effectiveShiftForDate(cur);

    base += BASE_MINUTES[shift] ?? 0;

    const a = autoOvertimeMinutesForShift(shift);
    const m = manualOvertimeMinutesForKey(key);

    otAuto += a;
    otManual += m;

    cur.setDate(cur.getDate() + 1);
  }
  return {
    baseMinutes: base,
    overtimeAutoMinutes: otAuto,
    overtimeManualMinutes: otManual,
    overtimeMinutes: otAuto + otManual,
    totalMinutes: base + otAuto + otManual
  };
}

function renderTotals(){
  const y = state.viewYear;
  const m = state.viewMonth;

  const ms = new Date(y, m, 1); ms.setHours(0,0,0,0);
  const me = new Date(y, m+1, 0); me.setHours(0,0,0,0);
  const mt = calcTotalsForRange(ms, me);

  el("monthTotal").textContent = minutesToDecimalHours(mt.totalMinutes);
  el("monthBreakdown").textContent =
    `Base: ${minutesToDecimalHours(mt.baseMinutes)} • HS auto: ${minutesToDecimalHours(mt.overtimeAutoMinutes)} • HS ajoutées: ${minutesToDecimalHours(mt.overtimeManualMinutes)}`;

  const ys = new Date(y, 0, 1); ys.setHours(0,0,0,0);
  const ye = new Date(y, 11, 31); ye.setHours(0,0,0,0);
  const yt = calcTotalsForRange(ys, ye);

  el("yearTotal").textContent = minutesToDecimalHours(yt.totalMinutes);
  el("yearBreakdown").textContent =
    `Base: ${minutesToDecimalHours(yt.baseMinutes)} • HS auto: ${minutesToDecimalHours(yt.overtimeAutoMinutes)} • HS ajoutées: ${minutesToDecimalHours(yt.overtimeManualMinutes)}`;
}

// ====== UI ======
function monthTitle(y,m){
  return new Date(y,m,1).toLocaleDateString("fr-FR", {month:"long", year:"numeric"});
}
function capitalize(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

function render(){
  const now = new Date();
  const todayKey = isoDate(now);

  el("subtitle").textContent =
    `Cycle: NNN RR AAA RR MMM RR • Réf: ${state.refDate} = ${SHIFT_LABEL[state.refShift]} • Durées: M ${minutesToHM(BASE_MINUTES.M)}, A ${minutesToHM(BASE_MINUTES.A)}, N ${minutesToHM(BASE_MINUTES.N)} • HS auto +0h15/jour travaillé`;

  el("monthTitle").textContent = capitalize(monthTitle(state.viewYear, state.viewMonth));

  el("refDate").value = state.refDate;
  el("refShift").value = state.refShift;

  renderTotals();

  const grid = el("grid");
  grid.innerHTML = "";

  for(const d of DOW){
    const div = document.createElement("div");
    div.className = "dow";
    div.textContent = d;
    grid.appendChild(div);
  }

  const first = new Date(state.viewYear, state.viewMonth, 1);
  const last = new Date(state.viewYear, state.viewMonth+1, 0);
  const firstDow = (first.getDay() + 6) % 7;

  for(let i=0;i<firstDow;i++){
    const pad = document.createElement("div");
    pad.className = "day muted";
    grid.appendChild(pad);
  }

  for(let day=1; day<=last.getDate(); day++){
    const date = new Date(state.viewYear, state.viewMonth, day);
    const key = isoDate(date);

    const shift = effectiveShiftForDate(date);
    const ov = state.overrides[key];
    const hsMin = totalOvertimeMinutesForDate(date);

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day" + (key===todayKey ? " today" : "");
    cell.dataset.date = key;

    const num = document.createElement("div");
    num.className = "num";
    num.textContent = day;

    const tag = document.createElement("div");
    tag.className = `tag ${shift}`;
    tag.textContent = SHIFT_LABEL[shift] ?? shift;

    cell.appendChild(num);
    cell.appendChild(tag);

    if(hsMin > 0){
      const hs = document.createElement("div");
      hs.className = "hs";
      hs.textContent = `HS +${minutesToHM(hsMin)}`;
      cell.appendChild(hs);
    }

    const note = document.createElement("div");
    note.className = "note";
    note.textContent = ov?.note ? ov.note : "";
    if(note.textContent) cell.appendChild(note);

    cell.addEventListener("click", ()=>openDayDialog(key, shift));
    grid.appendChild(cell);
  }
}

// ===== Dialog =====
let currentKey = null;

function openDayDialog(key, currentShift){
  currentKey = key;
  const ov = state.overrides[key] ?? {};

  // Si on passe un shift, on le calcule aussi au cas où
  const date = parseISO(key);
  const effShift = currentShift || effectiveShiftForDate(date);
  const auto = autoOvertimeMinutesForShift(effShift);

  el("dlgTitle").textContent = `Jour: ${key}`;
  el("overrideShift").value = ov.shift ?? "";
  el("note").value = ov.note ?? "";

  const hs = ov.overtimeMinutes ? (Number(ov.overtimeMinutes)/60) : 0;
  el("overtime").value = hs ? (Math.round(hs*100)/100).toString() : "";

  el("autoHsHint").textContent = (auto > 0)
    ? `HS auto ce jour: +${minutesToHM(auto)} (déjà compté)`
    : `HS auto ce jour: +0h00`;

  el("dayDialog").showModal();
}

function toMinutesFromHoursInput(value){
  if(value === "" || value === null || value === undefined) return 0;
  const x = Number(String(value).replace(",", "."));
  if(!isFinite(x) || x <= 0) return 0;
  return Math.round(x * 60);
}

function saveDayDialog(){
  if(!currentKey) return;
  const shift = el("overrideShift").value;
  const note = el("note").value.trim();
  const overtimeMinutes = toMinutesFromHoursInput(el("overtime").value);

  if(shift || note || overtimeMinutes > 0){
    state.overrides[currentKey] = {
      shift: shift || undefined,
      note: note || undefined,
      overtimeMinutes: overtimeMinutes > 0 ? overtimeMinutes : undefined
    };
  }else{
    delete state.overrides[currentKey];
  }
  saveState();
  render();
}

// ===== Navigation / actions =====
function addMonths(delta){
  let y = state.viewYear;
  let m = state.viewMonth + delta;
  while(m<0){ m+=12; y--; }
  while(m>11){ m-=12; y++; }
  state.viewYear = y; state.viewMonth = m;
  saveState();
  render();
}

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
