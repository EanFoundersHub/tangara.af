(function tangaraCloseModule(){
"use strict";
const MARKER="TANGARA_CIERRE_V1\n";
const q=id=>document.getElementById(id);
const html=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let current=null;
let sending=false;


function closeRowView(row){
  // El panel administrativo trabaja con filas normalizadas, mientras el mentor
  // recibe filas originales de Flow 28. Admitir ambos sin crear permisos nuevos.
  const raw=row?.raw||row;
  const parsed=unifiedBitacoraView(raw);
  return {
    ...parsed,
    number:parsed.number||Number(row?.number)||0,
    type:parsed.type||String(row?.type||"").toUpperCase(),
    date:parsed.date||row?.date||"",
    mentor:parsed.mentor||row?.mentorNombre||"",
    firstAnswers:parsed.firstAnswers||row?.firstAnswers||"",
    additionalObservations:parsed.additionalObservations||row?.additionalObservations||""
  };
}
function decodeClose(row){
  const v=closeRowView(row);
  const raw=String(v.additionalObservations||"").trim();
  if(!raw.startsWith(MARKER))return null;
  try{
    const info=JSON.parse(raw.slice(MARKER.length));
    if(info?.schema!=="TANGARA_CIERRE_V1"||!Array.isArray(info?.respuestas))return null;
    return {info,view:v};
  }catch(e){
    console.warn("Tángara: evaluación final no interpretable.",e);
    return null;
  }
}

function closeEntries(rows){return (Array.isArray(rows)?rows:[]).map(decodeClose).filter(Boolean);}


function firstScores(rows,mentorType){
  const type=String(mentorType||"").toUpperCase();
  const initial=(rows||[]).map(closeRowView).find(b=>
    b.number===1&&(b.type===type||!b.type)
  );
  if(!initial?.firstAnswers)return {};
  const blocks=String(initial.firstAnswers).replace(/\r/g,"")
    .split(/\n(?=\s*\d{1,2}\.\s*(?:¿|[A-ZÁÉÍÓÚÑ]))/u);
  const scores={};
  for(const block of blocks){
    const n=block.match(/^\s*(\d{1,2})\.\s/);
    const response=block.match(/Respuesta:\s*([^\n]+)/i);
    if(!n||!response)continue;
    const value=response[1].trim();
    const explicit=value.match(/^(?:nivel|calificaci[oó]n|puntaje)?\s*[:=\-–]?\s*([1-5])(?:\s|[.)\-–:]|$)/i);
    const labeled=value.match(/\b(?:nivel|calificaci[oó]n|puntaje)\s*[:=\-–]?\s*([1-5])\b/i);
    const rating=explicit||labeled;
    if(rating)scores[Number(n[1])]=Number(rating[1]);
  }
  return scores;
}
function compareRows(info,initial){
  const fields=info.tipoMentoria==="FINANCIERO"?FIRST_BITACORA_FINANCIAL_FIELDS:FIRST_BITACORA_IMPACT_FIELDS;
  return fields.map((field,index)=>{
    const answer=info.respuestas.find(x=>x.codigo===field.code);
    const fin=Number(answer?.puntuacion);
    const ini=Number(initial[index+1]);
    return {
      field,
      initial:ini>=1&&ini<=5?ini:null,
      final:fin>=1&&fin<=5?fin:null,
      evidence:String(answer?.evidencia||"")
    };
  });
}
function renderComparisonBars(rows){
  return rows.map(({field,initial,final,evidence})=>{
    const delta=initial!==null&&final!==null?final-initial:null;
    const state=delta>0?"up":delta<0?"down":"flat";
    const deltaText=delta===null?"Sin comparación inicial":delta>0?"Avance +"+delta:delta<0?"Variación "+delta:"Sin cambio";
    return `<div class="tg-compare-card">
      <div class="tg-compare-head"><span class="tg-compare-code">${html(field.code)}</span><span class="tg-compare-delta ${delta===null?"missing":state}">${html(deltaText)}</span></div>
      <p class="tg-compare-title">${html(field.title)}</p>
      <div class="tg-compare-bars">
        <div class="tg-compare-bar-row">
          <div class="tg-compare-labels"><span>Ingreso</span><strong>${initial===null?"Sin dato":initial+"/5"}</strong></div>
          <div class="tg-compare-track"><div class="tg-compare-fill initial" style="width:${initial===null?0:initial*20}%"></div></div>
        </div>
        <div class="tg-compare-bar-row">
          <div class="tg-compare-labels"><span>Cierre</span><strong>${final===null?"Sin dato":final+"/5"}</strong></div>
          <div class="tg-compare-track"><div class="tg-compare-fill final" style="width:${final===null?0:final*20}%"></div></div>
        </div>
      </div>
      ${evidence?`<small class="tg-compare-evidence"><b>Evidencia de cierre:</b> ${html(evidence)}</small>`:""}
    </div>`;
  }).join("");
}
function renderCloseEntry(entry,initial){
  const info=entry.info,v=entry.view;
  const rows=compareRows(info,initial);
  const validFinal=rows.filter(r=>r.final!==null);
  const pairs=rows.filter(r=>r.initial!==null&&r.final!==null);
  const initialAvg=pairs.length?pairs.reduce((sum,r)=>sum+r.initial,0)/pairs.length:null;
  const comparableFinalAvg=pairs.length?pairs.reduce((sum,r)=>sum+r.final,0)/pairs.length:null;
  const finalAvg=validFinal.length?validFinal.reduce((sum,r)=>sum+r.final,0)/validFinal.length:null;
  const delta=initialAvg!==null?(comparableFinalAvg-initialAvg):null;
  const fmt=n=>n===null?"—":n.toFixed(2).replace(".",",");
  const deltaFmt=delta===null?"—":(delta>0?"+":"")+fmt(delta);
  const note=pairs.length<rows.length
    ?`<p class="tg-close-comparison-note">Solo ${pairs.length} de ${rows.length} preguntas tienen calificación inicial y final comparables. Los faltantes se indican como “Sin dato”.</p>`
    :"";
  return `<article class="bita-card tg-close-history">
    <div class="bita-head"><strong>✓ Bitácora de cierre · ${html(info.tipoMentoria==="FINANCIERO"?"Financiera":"Impacto")}</strong><span>${html(excelDate(v.date||info.fecha))}</span></div>
    <div class="tg-close-summary-strip">
      <div><small>Promedio ingreso comparable</small><strong>${fmt(initialAvg)}${initialAvg===null?"":"/5"}</strong></div>
      <div><small>Promedio cierre</small><strong>${fmt(finalAvg)}${finalAvg===null?"":"/5"}</strong></div>
      <div><small>Variación promedio comparable</small><strong class="${delta===null?"":delta>0?"up":delta<0?"down":"flat"}">${deltaFmt}</strong></div>
      <div><small>Preguntas comparables</small><strong>${pairs.length} / ${rows.length}</strong></div>
    </div>
    <p><b>Mentor:</b> ${html(v.mentor||"Mentor registrado")}</p>${note}
    <details class="bita-first-details" open><summary>Comparación pregunta por pregunta · Ingreso vs cierre</summary>
      <div class="bita-first-body"><div class="tg-compare-grid">${renderComparisonBars(rows)}</div>
        ${info.conclusion?`<div class="tg-close-summary-box"><strong>Conclusión de la mentoría</strong><p>${html(info.conclusion)}</p></div>`:""}
      </div>
    </details>
  </article>`;
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
    q("accompShell")?.querySelector('[data-acctab="base"]')?.click();
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
  // Bitácoras conserva únicamente las sesiones de seguimiento.
  // La primera bitácora y el cierre con su comparativo se muestran en Línea base.
  if(!bool(permissions?.viewBitacoras)||state!=="ok")return originalHistory(rows,permissions,state);
  const sessions=(rows||[]).filter(row=>!decodeClose(row));
  return originalHistory(sessions,permissions,state);
};

function renderBaselineComparisons(rows,permissions,state){
  if(!bool(permissions?.viewBitacoras))return '<div class="accomp-empty">No tienes permiso para consultar los resultados de cierre.</div>';
  if(state!=="ok")return '<div class="accomp-empty">La comparación se mostrará cuando el historial de bitácoras esté disponible.</div>';
  const closure=closeEntries(rows);
  if(!closure.length)return '<div class="tg-baseline-comparison-empty"><strong>Comparación ingreso vs. salida</strong><p>Aún no hay una bitácora de cierre registrada. Cuando se complete la evaluación final, aparecerán aquí las barras de cada pregunta, el resultado al ingreso y la variación alcanzada.</p></div>';
  return '<div class="tg-close-history-wrap"><h3>Ingreso vs. salida · Avance por pregunta</h3><p class="tg-baseline-compare-help">La primera bitácora se compara con la evaluación final del mismo tipo de mentoría. Las barras reflejan valores de 1 a 5.</p>'
    +closure.map(entry=>renderCloseEntry(entry,firstScores(rows,entry.info.tipoMentoria))).join('')+'</div>';
};
function renderAdminCloseComparisons(){
  // Solo usar los registros que el flujo administrativo autenticado ya entregó.
  if(!adminAuthorized)return;
  const host=document.querySelector("#adminViewBitacoras .admin-bitacoras-shell");
  if(!host)return;
  let panel=document.getElementById("tgAdminCloseComparisons");
  if(!panel){
    panel=document.createElement("section");
    panel.id="tgAdminCloseComparisons";
    panel.className="tg-admin-comparison-section";
    host.appendChild(panel);
  }
  // El filtro "Con mentorías" muestra solo seguimiento; el detalle de
  // resultados de cierre corresponde a "Todas" o "Con cierre".
  const quick=typeof adminBitacorasQuickFilter==="string"?adminBitacorasQuickFilter:"ALL";
  panel.classList.toggle("hidden",quick==="MENTORIAS");
  if(quick==="MENTORIAS")return;
  const all=Array.isArray(adminBitacorasData)?adminBitacorasData:[];
  const type=String(document.getElementById("adminBitacoraType")?.value||"").toUpperCase();
  const search=String(document.getElementById("adminBitacoraSearch")?.value||"").trim().toLowerCase();
  const entries=all.map(row=>({row,close:decodeClose(row)}))
    .filter(({row,close})=>close&&(!type||close.info.tipoMentoria===type)&&(
       !search||[row.empresa,row.empresaId,row.mentorNombre,row.mentorEmail].join(" ").toLowerCase().includes(search)
    ));
  let main="";
  if(!adminBitacorasLoaded){
    main='<p class="tg-admin-compare-notice">El flujo administrativo todavía no devolvió el historial de bitácoras; no se puede calcular el avance.</p>';
  }else if(!entries.length){
    const missing=all.some(r=>/BITÁCORA DE CIERRE/i.test(r.advances||"")&&!decodeClose(r));
    main=missing
      ?'<p class="tg-admin-compare-notice">Hay registros marcados como cierre, pero la respuesta del flujo administrativo no contiene el campo completo de observaciones con sus puntajes. Para mostrar el comparativo, Flow 07 debe incluir ObservacionesAdicionales y RespuestasPrimeraBitacora.</p>'
      :'<p class="tg-admin-compare-notice">No hay bitácoras de cierre comparables con los filtros actuales.</p>';
  }else{
    main=entries.map(({row,close})=>{
      const related=all.filter(r=>r.empresaId===row.empresaId);
      const first=firstScores(related,close.info.tipoMentoria);
      const companyName=row.empresa||companyById(row.empresaId)?.name||row.empresaId;
      return `<details class="tg-admin-compare-company">
        <summary><strong>${html(companyName)}</strong><span>${html(row.empresaId)} · ${html(close.info.tipoMentoria==="FINANCIERO"?"Financiera":"Impacto")} · Ver barras de avance</span></summary>
        <div class="tg-admin-compare-body">${renderCloseEntry(close,first)}</div>
      </details>`;
    }).join("");
  }
  panel.innerHTML=`<div class="tg-admin-compare-title"><div><span class="eyebrow">Evaluación de resultados</span><h3>Ingreso vs cierre · Avance por pregunta</h3><p>Comparativo individual de las mentorías finalizadas. La información se toma de las bitácoras disponibles en el tablero administrativo.</p></div><span class="tg-admin-comparison-count">${entries.length} cierre(s)</span></div>${main}`;
}
const originalAdminBitacoras=renderAdminBitacoras;
renderAdminBitacoras=function(){
  originalAdminBitacoras();
  renderAdminCloseComparisons();
};

const originalAccompaniment=renderAccompaniment;
renderAccompaniment=function(data){
  originalAccompaniment(data);
  const base=q("accompLineaBaseComparison");
  if(base){
    base.innerHTML=renderBaselineComparisons(data?._bitacorasLista||[],data?.permissions||{},data?._bitacorasEstado);
  }
  if(data?._bitacorasEstado!=="ok")return;
  const companyId=String(data?.empresaId||"");
  const type=mentorshipTypeForCompany(data,companyId);
  if(type!=="FINANCIERO"&&type!=="IMPACTO")return;
  const rows=data?._bitacorasLista||[];
  const hasFirst=rows.some(r=>{const v=unifiedBitacoraView(r);return v.number===1&&(v.type===type||!v.type)});
  if(!hasFirst)return;
  const completed=closeEntries(rows).some(x=>x.info.tipoMentoria===type);
  const area=q("accompLineaBaseActions");
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
    btn.className="btn btn-primary tg-close-open";
    btn.textContent="Completar bitácora de cierre";
    btn.addEventListener("click",()=>openClose(data,type));
    area.appendChild(btn);
  }
};
})();
