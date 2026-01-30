// ====== Planning 5x8 V5 ======
const ROTATION = ["N","N","N","R","R","A","A","A","R","R","M","M","M","R","R"];
const SHIFT_TIME = {
  M: { start: "04:00", end: "12:15" },
  A: { start: "12:00", end: "20:15" },
  N: { start: "20:00", end: "04:15" }
};
const AUTO_OT_MIN_PER_WORKDAY = 15;
const SHIFT_LABEL = { N:"Nuit", A:"Après-midi", M:"Matin", R:"Repos", V:"Congé" };
const DOW = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const LS_KEY = "planning58_v5";

let state = loadState() ?? {
  refDate: "2026-01-06",
  refShift: "A",
  viewYear: 2026,
  viewMonth: 0,
  overrides: {},
  ui: { settingsHidden: false }
};

const el = (id)=>document.getElementById(id);
function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function loadState(){ try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return null; } }

function sanitizeShift(s){
  const x = String(s ?? "").trim().toUpperCase();
  return (x==="M"||x==="A"||x==="N"||x==="R"||x==="V") ? x : "R";
}

// ---- Dates robustes UTC (anti décalage iOS / DST) ----
function isoDateLocal(d){
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth()+1).padStart(2,"0");
  const day = String(x.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function parseISO(s){
  const [y,m,d] = s.split("-").map(Number);
  return { y, m: m-1, d };
}
function dayNumberUTC_fromISO(s){
  const p = parseISO(s);
  return Math.floor(Date.UTC(p.y, p.m, p.d) / 86400000);
}
function dayNumberUTC_fromDate(date){
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}
function daysBetweenUTC(refISO, dateObj){
  return dayNumberUTC_fromDate(dateObj) - dayNumberUTC_fromISO(refISO);
}

// ---- Durées ----
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

// ---- Roulement ----
function rotationIndexForDate(date){
  let refIdx = ROTATION.findIndex(s => s === sanitizeShift(state.refShift));
  if(refIdx < 0) refIdx = 0;

  const delta = daysBetweenUTC(state.refDate, date);
  let idx = refIdx + (delta % ROTATION.length);
  idx %= ROTATION.length;
  if(idx < 0) idx += ROTATION.length;
  return idx;
}
function plannedShiftForDate(date){
  return sanitizeShift(ROTATION[rotationIndexForDate(date)]);
}
function effectiveShiftForDate(date){
  const key = isoDateLocal(date);
  const ov = state.overrides[key];
  if(ov?.shift) return sanitizeShift(ov.shift);
  return plannedShiftForDate(date);
}

// ---- Heures sup ----
function manualOvertimeMinutesForKey(key){
  const ov = state.overrides[key];
  return ov?.overtimeMinutes ? Number(ov.overtimeMinutes) : 0;
}
function autoOvertimeMinutesForShift(shift){
  return (shift==="M"||shift==="A"||shift==="N") ? AUTO_OT_MIN_PER_WORKDAY : 0;
}
function totalOvertimeMinutesForDate(date){
  const key = isoDateLocal(date);
  const shift = effectiveShiftForDate(date);
  return autoOvertimeMinutesForShift(shift) + manualOvertimeMinutesForKey(key);
}

// ---- Totaux ----
function calcTotalsForRange(dateStart, dateEndInclusive){
  let base = 0, otAuto = 0, otManual = 0;

  const cur = new Date(dateStart);
  cur.setHours(12,0,0,0);
  const end = new Date(dateEndInclusive);
  end.setHours(12,0,0,0);

  while(cur <= end){
    const key = isoDateLocal(cur);
    const shift = effectiveShiftForDate(cur);

    base += BASE_MINUTES[shift] ?? 0;
    otAuto += autoOvertimeMinutesForShift(shift);
    otManual += manualOvertimeMinutesForKey(key);

    cur.setDate(cur.getDate() + 1);
  }
  return { baseMinutes: base, overtimeAutoMinutes: otAuto, overtimeManualMinutes: otManual, totalMinutes: base + otAuto + otManual };
}

function renderTotals(){
  const y = state.viewYear;
  const m = state.viewMonth;

  const ms = new Date(y, m, 1);
  const me = new Date(y, m+1, 0);
  const mt = calcTotalsForRange(ms, me);

  el("monthTotal").textContent = minutesToDecimalHours(mt.totalMinutes);
  el("monthBreakdown").textContent = `Base: ${minutesToDecimalHours(mt.baseMinutes)} • HS auto: ${minutesToDecimalHours(mt.overtimeAutoMinutes)} • HS ajoutées: ${minutesToDecimalHours(mt.overtimeManualMinutes)}`;

  const ys = new Date(y, 0, 1);
  const ye = new Date(y, 11, 31);
  const yt = calcTotalsForRange(ys, ye);

  el("yearTotal").textContent = minutesToDecimalHours(yt.totalMinutes);
  el("yearBreakdown").textContent = `Base: ${minutesToDecimalHours(yt.baseMinutes)} • HS auto: ${minutesToDecimalHours(yt.overtimeAutoMinutes)} • HS ajoutées: ${minutesToDecimalHours(yt.overtimeManualMinutes)}`;
}

// ---- UI ----
function monthTitle(y,m){
  return new Date(y,m,1).toLocaleDateString("fr-FR", {month:"long", year:"numeric"});
}
function capitalize(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

function applySettingsVisibility(){
  const panel = el("settingsPanel");
  if(state.ui?.settingsHidden){
    panel.classList.add("hidden");
  }else{
    panel.classList.remove("hidden");
  }
}

function render(){
  const now = new Date();
  const todayKey = isoDateLocal(now);

  el("subtitle").textContent =
    `Réf: ${state.refDate} = ${SHIFT_LABEL[sanitizeShift(state.refShift)]} • Durées: M ${minutesToHM(BASE_MINUTES.M)}, A ${minutesToHM(BASE_MINUTES.A)}, N ${minutesToHM(BASE_MINUTES.N)} • HS auto +0h15/jour travaillé`;

  el("monthBtn").textContent = capitalize(monthTitle(state.viewYear, state.viewMonth));

  el("refDate").value = state.refDate;
  el("refShift").value = sanitizeShift(state.refShift);

  applySettingsVisibility();
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
    const key = isoDateLocal(date);

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

    cell.addEventListener("click", ()=>openDayDialog(key));
    grid.appendChild(cell);
  }
}

// ---- Dialog ----
let currentKey = null;

function openDayDialog(key){
  currentKey = key;
  const ov = state.overrides[key] ?? {};
  const p = parseISO(key);
  const date = new Date(p.y, p.m, p.d);

  const effShift = effectiveShiftForDate(date);
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
      shift: shift ? sanitizeShift(shift) : undefined,
      note: note || undefined,
      overtimeMinutes: overtimeMinutes > 0 ? overtimeMinutes : undefined
    };
  }else{
    delete state.overrides[currentKey];
  }
  saveState();
  render();
}

// ---- Actions ----
function addMonths(delta){
  let y = state.viewYear;
  let m = state.viewMonth + delta;
  while(m<0){ m+=12; y--; }
  while(m>11){ m-=12; y++; }
  state.viewYear = y; state.viewMonth = m;
  saveState();
  render();
}

function goToday(){
  const d = new Date();
  state.viewYear = d.getFullYear();
  state.viewMonth = d.getMonth();
  saveState();
  render();
}

function saveReference(){
  state.refDate = el("refDate").value;
  state.refShift = sanitizeShift(el("refShift").value);
  state.ui = state.ui ?? {};
  state.ui.settingsHidden = true;
  saveState();
  render();
}

function toggleSettings(){
  state.ui = state.ui ?? {};
  state.ui.settingsHidden = !state.ui.settingsHidden;
  saveState();
  render();
}

function resetAll(){
  localStorage.removeItem(LS_KEY);
  ["planning58_v1","planning58_v2","planning58_v3","planning58_v4","planning58_v42","planning58_v5"].forEach(k=>localStorage.removeItem(k));
  state = {
    refDate: "2026-01-06",
    refShift: "A",
    viewYear: 2026,
    viewMonth: 0,
    overrides: {},
    ui: { settingsHidden: false }
  };
  saveState();
  render();
}

document.addEventListener("DOMContentLoaded", ()=>{
  el("prev").addEventListener("click", ()=>addMonths(-1));
  el("next").addEventListener("click", ()=>addMonths(+1));
  el("monthBtn").addEventListener("click", goToday);

  el("toggleSettings").addEventListener("click", toggleSettings);

  el("saveRef").addEventListener("click", saveReference);
  el("resetAll").addEventListener("click", resetAll);

  el("dlgSave").addEventListener("click", (e)=>{
    e.preventDefault();
    saveDayDialog();
    el("dayDialog").close();
  });

  render();
});


// ===== Module Paie (lecture planning V5, quantités uniquement) =====
function computePaie(start, end){
  const res = { totalH:0, nuit:0, hsJour:0, hsNuit:0, paniers:0, dim:0, feries:0, repos:0 };
  const s = new Date(start), e = new Date(end);
  for(let d=new Date(s); d<=e; d.setDate(d.getDate()+1)){
    const key = d.toISOString().slice(0,10);
    const override = state.overrides[key];
    const dow = d.getDay();
    const isSun = dow===0;
    const shift = sanitizeShift(override?.shift ?? getShiftForDate(d));
    if(shift==="R"||shift==="V"){ res.repos++; continue; }
    res.totalH += 8;
    res.paniers += 1;
    if(shift==="N") res.nuit += 8;
    const hs = Number(override?.ot ?? 0);
    if(hs>0){
      if(shift==="N") res.hsNuit += hs;
      else res.hsJour += hs;
    }
    if(isSun) res.dim++;
    if(override?.ferie) res.feries++;
  }
  return res;
}

document.getElementById("btnPaie")?.addEventListener("click", ()=>{
  document.getElementById("paieDialog").showModal();
});

document.getElementById("calcPaie")?.addEventListener("click", ()=>{
  const s = document.getElementById("paieStart").value;
  const e = document.getElementById("paieEnd").value;
  if(!s||!e) return;
  const r = computePaie(s,e);
  document.getElementById("paieResult").textContent = JSON.stringify(r,null,2);
});
