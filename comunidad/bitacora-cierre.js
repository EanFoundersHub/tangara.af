(function tangaraCloseModule(){
"use strict";
const MARKER="TANGARA_CIERRE_V1\n";
const q=id=>document.getElementById(id);
const html=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let current=null;
let sending=false;

function decodeClose(row){
  const v=unifiedBitacoraView(row);
  const raw=String(v.additionalObservations||"").trim();
  if(!raw.startsWith(MARKER))return null;
  try{
    const info=JSON.parse(raw.slice(MARKER.length));
    if(info?.schema!=="TANGARA_CIERRE_V1"||!Array.isArray(info?.respuestas))return null;
    return {info,view:v};
  }catch(e){console.warn("Tángara: la evaluación final no se pudo interpretar.",e);return null;}
}
function closeEntries(rows){return (Array.isArray(rows)?rows:[]).map(decodeClose).filter(Boolean);}

function firstScores(rows,mentorType){
  const initial=(rows||[]).map(unifiedBitacoraView).find(b=>b.number===1&&(b.type===mentorType||!b.type));
  if(!initial?.firstAnswers)return {};
  const blocks=initial.firstAnswers.replace(/\r/g,"").split(/\n(?=\s*\d{1,2}\.\s*(?:¿|[A-ZÁÉÍÓÚÑ]))/u);
  const scores={};
  for(const block of blocks){
    const n=block.match(/^\s*(\d{1,2})\.\s/);
    const response=block.match(/Respuesta:\s*([^\n]+)/i);
    if(!n||!response)continue;
    // Sólo se compara una puntuación explícita al inicio de la respuesta.
    const rating=response[1].trim().match(/^(?:nivel\s*)?([1-5])(?=\s|[.)\-–:]|$)/i);
    if(rating)scores[Number(n[1])]=Number(rating[1]);
  }
  return scores;
}
function renderCloseEntry(entry,first){
  const info=entry.info,v=entry.view;
  const grades=info.respuestas.filter(x=>Number(x.puntuacion)>=1&&Number(x.puntuacion)<=5);
  const avg=grades.length?(grades.reduce((sum,x)=>sum+Number(x.puntuacion),0)/grades.length):null;
  const fields=info.tipoMentoria==="FINANCIERO"?FIRST_BITACORA_FINANCIAL_FIELDS:FIRST_BITACORA_IMPACT_FIELDS;
  const cards=fields.map((field,i)=>{
    const answer=info.respuestas.find(x=>x.codigo===field.code);
    if(!answer)return "";
    const score=Number(answer.puntuacion);
    const baseline=first[i+1];
    const delta=Number.isFinite(baseline)?`<span class="tg-close-delta">Inicial ${baseline}/5 · Cambio ${score-baseline>0?"+":""}${score-baseline}</span>`:"";
    return `<div class="tg-close-answer"><div class="tg-close-answer-top"><span>${html(field.code)}</span><strong>${html(score)}/5</strong>${delta}</div><p>${html(field.title)}</p>${answer.evidencia?`<small><b>Evidencia de cierre:</b> ${html(answer.evidencia)}</small>`:""}</div>`;
  }).join("");
  return `<article class="bita-card tg-close-history"><div class="bita-head"><strong>✓ Bitácora de cierre · ${html(info.tipoMentoria==="FINANCIERO"?"Financiera":"Impacto")}</strong><span>${html(excelDate(v.date||info.fecha))}</span></div>
  <p><b>Mentor:</b> ${html(v.mentor||"Mentor registrado")} · <b>Resultado final:</b> ${avg===null?"Sin puntaje":avg.toFixed(2).replace(".",",")+"/5"}</p>
  <details class="bita-first-details"><summary>Ver las mismas preguntas y resultados de cierre</summary><div class="bita-first-body"><div class="tg-close-answers">${cards}</div>
  ${info.conclusion?`<div class="tg-close-summary"><strong>Conclusión al cierre</strong><p>${html(info.conclusion)}</p></div>`:""}</div></details></article>`;
}
function ensureModal(){
  if(q("tgCloseBackdrop"))return;
  const wrapper=document.createElement("div");
  wrapper.innerHTML=`<div class="backdrop tg-close-backdrop" id="tgCloseBackdrop" role="dialog" aria-modal="true" aria-labelledby="tgCloseTitle">
    <article class="modal tg-close-modal">
      <header class="modal-head"><button class="close" id="tgCloseDismiss" type="button" aria-label="Cerrar">×</button>
        <span class="eyebrow">Medición final · Acompañamiento</span><h2 id="tgCloseTitle" style="margin-top:10px;font-size:clamp(27px,3vw,38px)">Bitácora de cierre</h2>
        <p>Evalúa los mismos criterios de la primera bitácora para registrar la línea de salida de esta mentoría.</p>
      </header>
      <div class="modal-body"><form id="tgCloseForm">
        <div class="tg-close-context"><strong id="tgCloseCompany"></strong><span id="tgCloseType"></span></div>
        <div class="tg-close-date"><label for="tgCloseDate">Fecha de evaluación de cierre</label><input id="tgCloseDate" type="date" required></div>
        <div class="tg-close-form-guide">Responde todos los criterios con la misma escala <b>1 = Sin evidencia</b> y <b>5 = Investor/ready</b>. Usa la evidencia disponible al cierre.</div>
        <div id="tgCloseQuestions" class="tg-close-question-list"></div>
        <label class="tg-close-conclusion" for="tgCloseConclusion">Conclusión general y principales cambios al cierre <span>(obligatorio)</span><textarea id="tgCloseConclusion" rows="4" required placeholder="Describe los avances evidenciados durante el acompañamiento y los aspectos que aún requieren fortalecimiento."></textarea></label>
        <div class="tg-close-result" id="tgCloseResult">Responde todos los criterios para calcular el resultado final.</div>
        <div class="tg-close-error hidden" id="tgCloseError" role="alert"></div>
        <div class="tg-close-actions"><button type="button" class="btn btn-soft" id="tgCloseCancel">Cancelar</button><button type="submit" class="btn btn-primary" id="tgCloseSubmit">Guardar bitácora de cierre</button></div>
      </form></div>
    </article></div>`;
  document.body.appendChild(wrapper.firstElementChild);
  const close=()=>{if(!sending)q("tgCloseBackdrop").classList.remove("open");};
  q("tgCloseDismiss").addEventListener("click",close);
  q("tgCloseCancel").addEventListener("click",close);
  q("tgCloseBackdrop").addEventListener("click",e=>{if(e.target.id==="tgCloseBackdrop")close();});
  q("tgCloseForm").addEventListener("submit",saveClose);
  q("tgCloseQuestions").addEventListener("change",updateResult);
  document.addEventListener("keydown",e=>{if(e.key==="Escape")close();});
}
function openClose(data,type){
  const companyId=String(data?.empresaId||"");
  const companyName=String(data?.empresa||companyId);
  const existing=closeEntries(data?._bitacorasLista).some(x=>x.info.tipoMentoria===type);
  const hasFirst=(data?._bitacorasLista||[]).some(r=>{const b=unifiedBitacoraView(r);return b.number===1&&(b.type===type||!b.type)});
  if(!hasFirst||existing||!bool(data?.permissions?.createBitacora)||data?._bitacorasEstado!=="ok"){
    return toast("La evaluación final requiere la primera bitácora, el permiso de mentoría y no tener un cierre anterior.");
  }
  ensureModal();
  current={companyId,companyName,type};
  const fields=type==="FINANCIERO"?FIRST_BITACORA_FINANCIAL_FIELDS:FIRST_BITACORA_IMPACT_FIELDS;
  const initial=firstScores(data?._bitacorasLista||[],type);
  q("tgCloseCompany").textContent=companyName+" · "+companyId;
  q("tgCloseType").textContent=type==="FINANCIERO"?"Mentoría financiera":"Mentoría de impacto";
  q("tgCloseDate").value=todayForInput();
  q("tgCloseConclusion").value="";
  q("tgCloseError").classList.add("hidden");
  q("tgCloseError").textContent="";
  q("tgCloseQuestions").innerHTML=fields.map((f,i)=>`<fieldset class="tg-close-question" data-code="${html(f.code)}"><legend><span>${i+1}</span> ${html(f.title)}</legend>
    <p class="tg-close-evidence"><b>Evidencia mínima:</b> ${html(f.evidence)}</p>
    ${initial[i+1]?`<div class="tg-close-initial">Medición inicial registrada: <b>${initial[i+1]}/5</b></div>`:""}
    <label class="tg-close-field">Calificación de cierre (1–5) <select name="nivel-${html(f.code)}" data-rating="${html(f.code)}" required><option value="">Selecciona un nivel</option><option value="1">1 · Sin evidencia</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5 · Investor/ready</option></select></label>
    <label class="tg-close-field">Evidencia / observación al cierre <span>(opcional)</span><textarea name="evidencia-${html(f.code)}" data-evidence="${html(f.code)}" rows="2" placeholder="Qué evidencia respalda esta calificación"></textarea></label></fieldset>`).join("");
  updateResult();
  q("tgCloseBackdrop").classList.add("open");
  q("tgCloseDate").focus();
}
function updateResult(){
  const form=q("tgCloseForm");
  if(!form||!current)return;
  const fields=current.type==="FINANCIERO"?FIRST_BITACORA_FINANCIAL_FIELDS:FIRST_BITACORA_IMPACT_FIELDS;
  const scores=fields.map(f=>Number(form.querySelector(`[data-rating="${f.code}"]`)?.value)).filter(n=>n>=1&&n<=5);
  const out=q("tgCloseResult");
  if(scores.length!==fields.length){out.textContent=`${scores.length} de ${fields.length} criterios evaluados`;return;}
  const avg=scores.reduce((a,b)=>a+b,0)/scores.length;
  out.textContent=`Resultado final: ${avg.toFixed(2).replace(".",",")} / 5 · ${fields.length} criterios evaluados`;
}
async function saveClose(e){
  e.preventDefault();
  if(sending||!current||!session?.accessToken)return;
  const form=q("tgCloseForm");
  if(!form.reportValidity())return;
  const fields=current.type==="FINANCIERO"?FIRST_BITACORA_FINANCIAL_FIELDS:FIRST_BITACORA_IMPACT_FIELDS;
  const respuestas=fields.map(f=>({
    codigo:f.code,
    puntuacion:Number(form.querySelector(`[data-rating="${f.code}"]`).value),
    evidencia:String(form.querySelector(`[data-evidence="${f.code}"]`).value||"").trim()
  }));
  if(respuestas.some(x=>!Number.isInteger(x.puntuacion)||x.puntuacion<1||x.puntuacion>5))return;
  const fecha=q("tgCloseDate").value;
  const conclusion=q("tgCloseConclusion").value.trim();
  if(!fecha||!conclusion)return;
  const avg=(respuestas.reduce((s,x)=>s+x.puntuacion,0)/respuestas.length).toFixed(2);
  const payload={schema:"TANGARA_CIERRE_V1",empresaId:current.companyId,tipoMentoria:current.type,fecha,respuestas,conclusion};
  const btn=q("tgCloseSubmit");
  const old=btn.textContent;
  sending=true;btn.disabled=true;btn.textContent="Guardando evaluación…";
  q("tgCloseError").classList.add("hidden");
  try{
    // Se guarda como una nueva bitácora en Flow 28, sin reemplazar la primera.
    const res=await apiPost(FLOW_BITACORAS_URL,{
      accessToken:session.accessToken,operacion:"CREAR",
      empresaId:current.companyId,empresa:current.companyName,
      tipoMentoria:current.type,fechaSesion:fecha,
      avances:`BITÁCORA DE CIERRE · Evaluación final ${avg}/5 (${respuestas.length} criterios)`,
      proximosPasos:conclusion,
      observacionesAdicionales:MARKER+JSON.stringify(payload)
    });
    if(!res?.ok||String(res.status||"").toUpperCase()!=="BITACORA_CREADA")throw new Error(res?.message||"El flujo no confirmó que la bitácora haya sido guardada.");
    const id=current.companyId;
    q("tgCloseBackdrop").classList.remove("open");
    toast("Bitácora de cierre guardada en el historial de la empresa.");
    current=null;
    await loadAccompaniment(id);
  }catch(err){
    console.error("Bitácora de cierre:",err);
    const error=q("tgCloseError");
    error.textContent=err?.message||"No se confirmó el guardado. Revisa el flujo de bitácoras.";
    error.classList.remove("hidden");
  }finally{
    sending=false;btn.disabled=false;btn.textContent=old;
  }
}
const originalHistory=renderUnifiedBitacoras;
renderUnifiedBitacoras=function(rows,permissions,state){
  if(!bool(permissions?.viewBitacoras)||state!=="ok")return originalHistory(rows,permissions,state);
  const closure=closeEntries(rows);
  if(!closure.length)return originalHistory(rows,permissions,state);
  const ordinary=(rows||[]).filter(r=>!decodeClose(r));
  const rendered=originalHistory(ordinary,permissions,state);
  const sample=closure[0].info.tipoMentoria;
  const initial=firstScores(ordinary,sample);
  return rendered+`<div class="tg-close-history-wrap"><h3>Evaluación final del acompañamiento</h3>${closure.map(entry=>renderCloseEntry(entry,firstScores(ordinary,entry.info.tipoMentoria))).join("")}</div>`;
};
const originalAccompaniment=renderAccompaniment;
renderAccompaniment=function(data){
  originalAccompaniment(data);
  if(data?._bitacorasEstado!=="ok")return;
  const companyId=String(data?.empresaId||"");
  const type=mentorshipTypeForCompany(data,companyId);
  if(type!=="FINANCIERO"&&type!=="IMPACTO")return;
  const rows=data?._bitacorasLista||[];
  const hasFirst=rows.some(r=>{const v=unifiedBitacoraView(r);return v.number===1&&(v.type===type||!v.type)});
  if(!hasFirst)return;
  const completed=closeEntries(rows).some(x=>x.info.tipoMentoria===type);
  const area=q("accompShell")?.querySelector(".mentor-overview-side");
  if(!area)return;
  const permission=bool(data?.permissions?.createBitacora);
  if(completed){
    const status=document.createElement("span");
    status.className="tg-close-done";
    status.textContent="✓ Bitácora de cierre registrada";
    area.appendChild(status);
  }else if(permission){
    const btn=document.createElement("button");
    btn.type="button";
    btn.className="btn btn-soft mentor-primary-action tg-close-open";
    btn.textContent="Bitácora de cierre";
    btn.addEventListener("click",()=>openClose(data,type));
    area.appendChild(btn);
  }
};
})();
