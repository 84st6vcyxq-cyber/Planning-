// app.js — Planning RESTAURÉ + Paie (quantités)

// Utilities
const app = document.getElementById("app");
function parseDate(d){ return new Date(d+"T00:00:00"); }
function isSunday(d){ return d.getDay()===0; }
function getPlanning(){
  try { return JSON.parse(localStorage.getItem("planningDays")||"[]"); }
  catch { return []; }
}

// Pages
function pageHome(){
  return `<div class="h1">Accueil</div>
  <div class="card"><div class="p">Planning 5×8 + module Paie</div></div>`;
}

function pagePlanning(){
  const days = getPlanning();
  if(!days.length){
    return `<div class="h1">📅 Planning</div>
    <div class="card"><div class="p">Aucune donnée planning trouvée.</div></div>`;
  }
  const rows = days.slice(0,31).map(d=>`
    <div class="card">
      <b>${d.date}</b> — ${d.poste} — HS: ${d.heuresSup||0}
    </div>
  `).join("");
  return `<div class="h1">📅 Planning</div>${rows}`;
}

function pagePaie(){
  return `
  <div class="h1">💶 Paie – période libre</div>
  <div class="card">
    <label class="p">Du</label>
    <input type="date" class="input" id="start">
    <label class="p">Au</label>
    <input type="date" class="input" id="end">
    <div class="row"><button class="btn" id="calc">Calculer</button></div>
  </div>
  <div id="result"></div>
  `;
}

// Bindings
function bindPaie(){
  document.getElementById("calc").onclick = ()=>{
    const start = parseDate(document.getElementById("start").value);
    const end = parseDate(document.getElementById("end").value);
    if(!start || !end) return;

    const days = getPlanning();
    let totalH=0, nuit=0, hsJour=0, hsNuit=0, paniers=0, dim=0, feries=0, repos=0;

    days.forEach(d=>{
      const dt = parseDate(d.date);
      if(dt < start || dt > end) return;

      if(d.poste === "REPOS"){ repos++; return; }
      totalH += 8; paniers++;
      if(d.poste === "NUIT") nuit += 8;
      if(isSunday(dt)) dim++;
      if(d.isFerie) feries++;
      const hs = Number(d.heuresSup||0);
      if(hs>0){
        if(d.poste === "NUIT") hsNuit += hs;
        else hsJour += hs;
      }
    });

    document.getElementById("result").innerHTML = `
      <div class="card">
        <div class="p">Heures totales : <b>${totalH}</b></div>
        <div class="p">Heures de nuit : <b>${nuit}</b></div>
        <div class="p">HS jour : <b>${hsJour}</b></div>
        <div class="p">HS nuit : <b>${hsNuit}</b></div>
        <div class="p">Paniers : <b>${paniers}</b></div>
        <div class="p">Dimanches : <b>${dim}</b></div>
        <div class="p">Jours fériés : <b>${feries}</b></div>
        <div class="p">Repos : <b>${repos}</b></div>
      </div>
    `;
  };
}

// Router
function render(){
  const h = location.hash.replace("#","");
  let v="";
  if(h==="/planning") v = pagePlanning();
  else if(h==="/paie") v = pagePaie();
  else v = pageHome();
  app.innerHTML = v;
  if(h==="/paie") bindPaie();
}

window.addEventListener("hashchange", render);
render();
