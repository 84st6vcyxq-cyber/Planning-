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
const PAY_KEY = "planning58_pay_v1";

let state = loadState() ?? {
  refDate: "2026-01-06",
  refShift: "A",
  viewYear: 2026,
  viewMonth: 0,
  overrides: {},
  ui: { settingsHidden: false, view: "planning" }
};

const el = (id)=>document.getElementById(id);
function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function loadState(){ try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return null; } }

// ====== Paie (estimatif) ======
function parseNumberFR(v){
  const s = String(v ?? "").trim();
  if(!s) return NaN;
  return Number(s.replace(",", "."));
}
function loadPay(){ try { return JSON.parse(localStorage.getItem(PAY_KEY)); } catch { return null; } }
function savePay(cfg){ localStorage.setItem(PAY_KEY, JSON.stringify(cfg)); }

function payDefaults(){
  return {
    hourlyRate: 15.89,
    baseHours: 152.20,
    monthlySalary: 2419.20,
    useMonthly: true,

    otPct: 25,
    sundayPct: 0,
    holidayPct: 0,

    nightPrime: 0,
    panierNuit: 9.00,
    panierJour: 0,
    fixedPrimes: 0,

    retenuesPct: 18.2,
    pasPct: 0,

    holidays: ["2026-01-01"]
  };
}
function getPay(){ return { ...payDefaults(), ...(loadPay()||{}) }; }

function monthStats(y, m, cfg){
  const ms = new Date(y, m, 1);
  const me = new Date(y, m+1, 0);
  const totals = calcTotalsForRange(ms, me);

  let countM=0,countA=0,countN=0,countR=0,countV=0;
  let sundayHours=0, holidayHours=0, workDays=0;

  const holidaySet = new Set((cfg.holidays||[]).map(String));

  const cur = new Date(ms); cur.setHours(12,0,0,0);
  const end = new Date(me); end.setHours(12,0,0,0);

  while(cur <= end){
    const shift = effectiveShiftForDate(cur);
    const mins = baseMinutesForShift(shift);
    const hours = mins/60;

    if(shift==="M") countM++;
    else if(shift==="A") countA++;
    else if(shift==="N") countN++;
    else if(shift==="R") countR++;
    else if(shift==="V") countV++;

    const isWork = (shift==="M"||shift==="A"||shift==="N");
    if(isWork){
      workDays++;
      if(cur.getDay()===0) sundayHours += hours;
      const iso = isoDateLocal(cur);
      if(holidaySet.has(iso)) holidayHours += hours;
    }

    cur.setDate(cur.getDate()+1);
  }

  return {
    baseHours: totals.baseMinutes/60,
    otHours: (totals.overtimeAutoMinutes + totals.overtimeManualMinutes)/60,
    workDays, countM, countA, countN, countR, countV,
    sundayHours, holidayHours
  };
}

function eur(n){
  if(!Number.isFinite(n)) return "—";
  return n.toFixed(2).replace(".", ",") + " €";
}
function h(n){
  if(!Number.isFinite(n)) return "—";
  return n.toFixed(2).replace(".", ",") + " h";
}

function computePayForMonth(y, m){
  const cfg = getPay();
  const st = monthStats(y, m, cfg);

  const rate = Number(cfg.hourlyRate)||0;
  const baseH = Number(cfg.baseHours)||0;
  const baseSalary = Number(cfg.monthlySalary)||0;

  const base = cfg.useMonthly ? baseSalary : (baseH * rate);

  const otPay = st.otHours * rate * (1 + (Number(cfg.otPct)||0)/100);
  const sunPrem = st.sundayHours * rate * ((Number(cfg.sundayPct)||0)/100);
  const holPrem = st.holidayHours * rate * ((Number(cfg.holidayPct)||0)/100);

  const nightPrime = st.countN * (Number(cfg.nightPrime)||0);
  const panierN = st.countN * (Number(cfg.panierNuit)||0);
  const panierJ = st.workDays * (Number(cfg.panierJour)||0);
  const fixed = Number(cfg.fixedPrimes)||0;

  const brut = base + otPay + sunPrem + holPrem + nightPrime + panierN + panierJ + fixed;

  const netBefore = brut * (1 - (Number(cfg.retenuesPct)||0)/100);
  const netAfter = netBefore * (1 - (Number(cfg.pasPct)||0)/100);

  return { cfg, st, base, otPay, sunPrem, holPrem, nightPrime, panierN, panierJ, fixed, brut, netBefore, netAfter };
}

function showView(name){
  state.ui = state.ui ?? {};
  state.ui.view = name;
  saveState();

  const planningView = el("planningView");
  const payView = el("payView");
  if(!planningView || !payView) return;

  if(name === "pay"){
    planningView.classList.add("hidden");
    payView.classList.remove("hidden");
  } else {
    payView.classList.add("hidden");
    planningView.classList.remove("hidden");
  }
}

function bindPayPanel(){
  const cfg = getPay();

  const setVal = (id, v) => { const x = el(id); if(x) x.value = (v ?? ""); };

  setVal("p_rate", cfg.hourlyRate);
  setVal("p_baseH", cfg.baseHours);
  setVal("p_monthly", cfg.monthlySalary);
  setVal("p_useMonthly", cfg.useMonthly ? "yes" : "no");
  setVal("p_otPct", cfg.otPct);
  setVal("p_sunPct", cfg.sundayPct);
  setVal("p_holPct", cfg.holidayPct);
  setVal("p_nightPrime", cfg.nightPrime);
  setVal("p_panierN", cfg.panierNuit);
  setVal("p_panierJ", cfg.panierJour);
  setVal("p_fixed", cfg.fixedPrimes);
  setVal("p_retPct", cfg.retenuesPct);
  setVal("p_pasPct", cfg.pasPct);

  const hol = el("p_holidays");
  if(hol) hol.value = (cfg.holidays||[]).join(", ");

  function readCfg(){
    const useMonthly = (el("p_useMonthly")?.value === "yes");
    const holidays = String(el("p_holidays")?.value||"")
      .split(",")
      .map(s=>s.trim())
      .filter(Boolean);

    return {
      hourlyRate: parseNumberFR(el("p_rate")?.value),
      baseHours: parseNumberFR(el("p_baseH")?.value),
      monthlySalary: parseNumberFR(el("p_monthly")?.value),
      useMonthly,

      otPct: parseNumberFR(el("p_otPct")?.value),
      sundayPct: parseNumberFR(el("p_sunPct")?.value),
      holidayPct: parseNumberFR(el("p_holPct")?.value),

      nightPrime: parseNumberFR(el("p_nightPrime")?.value),
      panierNuit: parseNumberFR(el("p_panierN")?.value),
      panierJour: parseNumberFR(el("p_panierJ")?.value),
      fixedPrimes: parseNumberFR(el("p_fixed")?.value),

      retenuesPct: parseNumberFR(el("p_retPct")?.value),
      pasPct: parseNumberFR(el("p_pasPct")?.value),

      holidays
    };
  }

  function refresh(){
    const res = computePayForMonth(state.viewYear, state.viewMonth);

    if(el("payBaseHours")) el("payBaseHours").textContent = h(res.st.baseHours);
    if(el("payOtHours")) el("payOtHours").textContent = h(res.st.otHours);
    if(el("payCounts")) el("payCounts").textContent =
      `M:${res.st.countM} • A:${res.st.countA} • N:${res.st.countN} • Dim:${res.st.sundayHours.toFixed(1).replace(".",",")}h • JF:${res.st.holidayHours.toFixed(1).replace(".",",")}h`;

    if(el("payBrut")) el("payBrut").textContent = eur(res.brut);
    if(el("payNet")) el("payNet").textContent = eur(res.netBefore);
    if(el("payNetAfter")) el("payNetAfter").textContent = eur(res.netAfter);

    if(el("payBrutDetail")){
      el("payBrutDetail").textContent =
        `Base ${eur(res.base)} + HS ${eur(res.otPay)} + Dim ${eur(res.sunPrem)} + JF ${eur(res.holPrem)} + Nuit ${eur(res.nightPrime)} + PanierN ${eur(res.panierN)} + PanierJ ${eur(res.panierJ)} + Primes ${eur(res.fixed)}`;
    }

    const real = parseNumberFR(el("p_realNet")?.value);
    if(el("payGap")){
      if(Number.isFinite(real)) el("payGap").textContent = eur(res.netBefore - real);
      else el("payGap").textContent = "—";
    }
  }

  el("p_save")?.addEventListener("click", ()=>{
    const next = readCfg();
    savePay(next);
    refresh();
    alert("Paramètres paie enregistrés");
  });

  el("p_reset")?.addEventListener("click", ()=>{
    savePay(payDefaults());
    bindPayPanel();
    refresh();
  });

  [
    "p_rate","p_baseH","p_monthly","p_useMonthly","p_otPct","p_sunPct","p_holPct",
    "p_nightPrime","p_panierN","p_panierJ","p_fixed","p_retPct","p_pasPct","p_holidays","p_realNet"
  ].forEach(id => el(id)?.addEventListener("input", refresh));

  refresh();
}

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

  // Vue (planning / paie)
  showView(state.ui?.view || "planning");
  if(state.ui?.view === "pay"){ bindPayPanel(); }
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
    ui: { settingsHidden: false, view: "planning" }
  };
  saveState();
  render();
}

document.addEventListener("DOMContentLoaded", ()=>{
  el("prev").addEventListener("click", ()=>addMonths(-1));
  el("next").addEventListener("click", ()=>addMonths(+1));
  el("monthBtn").addEventListener("click", goToday);

  el("toggleSettings").addEventListener("click", toggleSettings);
  el("showPlanning")?.addEventListener("click", ()=>{ state.ui.view="planning"; saveState(); render(); });
  el("showPay")?.addEventListener("click", ()=>{ state.ui.view="pay"; saveState(); render(); });

  el("saveRef").addEventListener("click", saveReference);
  el("resetAll").addEventListener("click", resetAll);

  el("dlgSave").addEventListener("click", (e)=>{
    e.preventDefault();
    saveDayDialog();
    el("dayDialog").close();
  });

  render();
});
