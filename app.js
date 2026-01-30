// app.js — Planning 5×8 avec module Paie (quantités)

// Dummy planning source example:
// localStorage.setItem("planningDays", JSON.stringify([
//   {date:"2026-01-26", poste:"NUIT", heuresSup:2, isFerie:false},
//   {date:"2026-01-27", poste:"MATIN", heuresSup:0, isFerie:false}
// ]));

const app = document.getElementById("app");

function parseDate(d){ return new Date(d+"T00:00:00"); }
function isSunday(d){ return d.getDay() === 0; }

function getPlanning(){
  try { return JSON.parse(localStorage.getItem("planningDays")||"[]"); }
  catch { return []; }
}

function pageHome(){
  return `<div class="h1">Planning 5×8</div>
  <div class="card"><p class="p">Module Planning + Paie</p></div>`;
}

function pagePaie(){
  return `
  <div class="h1">💶 Paie – période libre</div>
  <div class="card">
    <label class="p">Du</label>
    <input type="date" class="input" id="start">
    <label class="p">Au</label>
    <input type="date" class="input" id="end">
    <div class="row">
      <button class="btn" id="calc">Calculer</button>
    </div>
  </div>
  <div id="result"></div>
  `;
}

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

      totalH += 8;
      paniers++;

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
        <div class="p">Paniers repas : <b>${paniers}</b></div>
        <div class="p">Dimanches : <b>${dim}</b></div>
        <div class="p">Jours fériés : <b>${feries}</b></div>
        <div class="p">Repos : <b>${repos}</b></div>
      </div>
    `;
  };
}

function render(){
  const h = location.hash.replace("#","");
  let v="";
  if(h==="/paie"){ v=pagePaie(); }
  else v=pageHome();
  app.innerHTML = v;
  if(h==="/paie") bindPaie();
}

window.addEventListener("hashchange", render);
render();
