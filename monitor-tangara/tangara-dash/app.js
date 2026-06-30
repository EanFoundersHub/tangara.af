/* ============================================================
   Tángara IR · app.js — orquestación de secciones, filtros,
   gate de acceso y flujo "arranca en 0 → cargar CSV".
   ============================================================ */
(function(){
const TG = window.TG;
const {esc,num,icon}=TG;
const $ = s=>document.querySelector(s);
const el = id=>document.getElementById(id);

const CSV_KEY='tg_csv_v1';
let A=null;                 // agregación activa
let F=null;                 // filtros de tabla
let baseMode='consolidado'; // consolidado | historico
let resumenRep='';          // '' = todos los informes cargados en el CSV
let resumenActorClass='';   // '' = todas las capas de contacto del embudo
const blank=()=>({reporte:'',estado:'',prio:'',contacto:'',actor:'',registroTipo:'',flujo:'',ruta:'',etapa:'',capital:'',depto:'',pais:'',genero:'',women2x:'',ventas:'',validacion:'',innovacion:'',genValor:'',trlBands:[],completion:'',contactClass:'',search:'',mujRange:'',transition:'',label:''});

/* ===================== NAV ===================== */
const SECTIONS=['resumen','evolucion','portafolio','actores','genero','territorio','base'];
const SECTION_META={
  resumen:['Resumen ejecutivo','Avance, calidad y prioridades de la convocatoria'],
  evolucion:['Evolución & calidad','Crecimiento semanal y trazabilidad de registros'],
  portafolio:['Portafolio','TRL, ruta, sector y capital de las postulaciones'],
  actores:['Actores & retos','Capas de ecosistema, perfiles y retos del primer corte'],
  genero:['Género & 2X','Liderazgo femenino y criterio de inversión 2X'],
  territorio:['Territorio','Distribución geográfica de las postulaciones'],
  base:['Base & contactos','Listado filtrable con datos de contacto'],
};
function nav(id){
  SECTIONS.forEach(s=>{
    el('pane-'+s).classList.toggle('active', s===id);
    el('nav-'+s).classList.toggle('active', s===id);
  });
  const m=SECTION_META[id]; if(m){const t=el('topTitle'),s=el('topSub');if(t)t.textContent=m[0];if(s)s.textContent=m[1];}
  document.querySelector('.main').scrollTo({top:0,behavior:'smooth'});
}
TG.nav=nav;

/* ===================== DATA STATUS ===================== */
function setStatus(){
  const pill=el('dataPill'), clr=el('btnClear');
  if(A){
    pill.classList.add('ok');
    pill.querySelector('.txt').textContent=`${num(A.N)} en base · ${num(A.histTotal)} hist.`;
    clr.style.display='';
  }else{
    pill.classList.remove('ok');
    pill.querySelector('.txt').textContent='Sin datos cargados';
    clr.style.display='none';
  }
}

/* ===================== LOAD ===================== */
function ingest(text){
  try{
    A=TG.load(text);
    sessionStorage.setItem(CSV_KEY,text);
    F=blank(); resumenRep=''; resumenActorClass='';
    setStatus(); renderAll(); nav('resumen');
  }catch(e){
    console.error(e);
    alert('No se pudo leer el CSV. Verifica que sea el consolidado oficial.');
  }
}
function onFile(ev){
  const f=ev.target.files&&ev.target.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=e=>ingest(e.target.result);
  rd.readAsText(f,'utf-8');
}
TG.onFile=onFile;
function clearData(){
  A=null; F=blank(); resumenRep=''; resumenActorClass=''; sessionStorage.removeItem(CSV_KEY);
  setStatus(); renderAll(); nav('resumen');
}
TG.clearData=clearData;

/* ===================== EMPTY STATES ===================== */
function emptyHero(){
  return `<div class="empty">
    <div class="ring">${icon('upload','')}</div>
    <h2>Carga el CSV consolidado para activar el monitor</h2>
    <p>El tablero arranca en cero por diseño. Selecciona el consolidado semanal y todas las vistas —avance a la meta, calidad, territorio y contactos— se calculan al instante en tu navegador.</p>
    <label class="drop" id="dropZone">
      ${icon('upload','')}
      <div><b style="font-family:var(--font-display);font-size:1.05rem">Soltar archivo o hacer clic</b></div>
      <input type="file" accept=".csv" style="display:none" id="heroFile">
      <span class="btn btn-primary">${icon('upload')}Seleccionar CSV consolidado</span>
    </label>
    <div class="hint">Se procesa localmente · no se sube a ningún servidor</div>
  </div>`;
}
function emptyPanel(){
  return `<div class="locked-panel">${icon('lock','')}
    <div>Carga el CSV consolidado en <b style="color:var(--text)">Resumen</b> para ver esta sección.</div>
    <button class="btn btn-ghost" onclick="TG.nav('resumen')">Ir a cargar datos</button></div>`;
}
function wireHeroDrop(){
  const zone=el('dropZone'), inp=el('heroFile');
  if(!zone||!inp) return;
  inp.addEventListener('change',onFile);
  ['dragenter','dragover'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.add('drag');}));
  ['dragleave','drop'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.remove('drag');}));
  zone.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f){const rd=new FileReader();rd.onload=x=>ingest(x.target.result);rd.readAsText(f,'utf-8');}});
}

/* ===================== RENDER ALL ===================== */
function renderAll(){
  if(!A){
    el('pane-resumen').innerHTML=emptyHero();
    ['evolucion','portafolio','actores','genero','territorio','base'].forEach(s=>el('pane-'+s).innerHTML=emptyPanel());
    wireHeroDrop();
    return;
  }
  renderResumen(); renderEvolucion(); renderPortafolio(); renderActores(); renderGenero(); renderTerritorio(); renderBase();
  requestAnimationFrame(animateCounts);
}
/* count-up sutil de los KPIs del Resumen (una vez al cargar datos) */
function animateCounts(){
  document.querySelectorAll('#pane-resumen .kpi .value, #pane-resumen .meta-num b').forEach(elm=>{
    const raw=(elm.textContent||'').trim();
    const m=raw.match(/^([\d.]+)(%?)$/);
    if(!m) return;
    const target=parseInt(m[1].replace(/\./g,''),10);
    if(!isFinite(target)||target<=1) return;
    const pct=m[2], dur=650, t0=performance.now();
    function step(now){
      const p=Math.min(1,(now-t0)/dur), e=1-Math.pow(1-p,3);
      elm.textContent=Math.round(target*e).toLocaleString('es-CO')+pct;
      if(p<1) requestAnimationFrame(step); else elm.textContent=raw;
    }
    requestAnimationFrame(step);
  });
}

/* ===================== RESUMEN ===================== */
function pctOf(n){return A.N?Math.round(n/A.N*100):0;}
/* agregación activa del Resumen: todo el CSV o un solo informe */
function resumenAgg(){
  if(!resumenRep || !A) return A;
  try{ const sub=A.rows.filter(r=>r.reporte===resumenRep); return sub.length?TG.aggregate(sub):A; }
  catch(e){ console.warn(e); return A; }
}
function reportOptions(){
  const ord=new Map();
  A.rows.forEach(r=>{ if(r.reporte && !ord.has(r.reporte)) ord.set(r.reporte, r.orden||0); });
  return [...ord.keys()].sort((a,b)=>(ord.get(a)||0)-(ord.get(b)||0));
}
function renderResumen(){
  const R=resumenAgg();
  const p=n=>R.N?Math.round(n/R.N*100):0;
  const reps=reportOptions();
  const repSelector=`<div class="resumen-scope">
    <div class="field"><label>Informe</label>
      <select onchange="TG.setResumenRep(this.value)">
        <option value="">Todos los informes (${reps.length})</option>
        ${reps.map(rp=>`<option value="${esc(rp)}" ${rp===resumenRep?'selected':''}>${esc(rp)}</option>`).join('')}
      </select>
    </div>
    <span class="scope-note">${resumenRep
      ? `Mostrando solo <b>${esc(resumenRep.split('·')[0].trim())}</b> · ${num(R.N)} registros de ese informe`
      : `Consolidado de <b>${reps.length}</b> informes cargados · ${num(R.N)} registros únicos`}</span>
    ${resumenRep?`<button class="scope-clear" onclick="TG.setResumenRep('')">× ver todos los informes</button>`:''}
  </div>`;
  const trend = R.lastNew===R.prevNew?{dir:'flat',text:'igual'}
    : R.lastNew>R.prevNew?{dir:'up',text:'+'+(R.lastNew-R.prevNew)+' vs corte previo'}
    : {dir:'down',text:(R.lastNew-R.prevNew)+' vs corte previo'};
  const html=`
  ${repSelector}
  <div class="section-head"><h3>¿Cuántas postulaciones reales tenemos?</h3><span class="h-note">se cuentan las <b>completas</b> · los registros parciales no suman como postulación · meta 150</span></div>
  <div class="grid g-4 mb">
    ${TG.kpi({label:'Postulaciones completas',value:num(R.completas),sub:`${R.pctCompl}% de los únicos · meta ${R.META}`,acc:'acc-mag',icon:'check',action:"TG.quickCompletion('completas')"})}
    ${TG.kpi({label:'Registros únicos',value:num(R.N),sub:'recibidos en total (sin duplicar)',icon:'users',action:"TG.quick('all')"})}
    ${TG.kpi({label:'Faltan por completar',value:num(R.faltanCompletar),sub:`${num(R.faltanContactables)} contactables (correo/celular)`,acc:'acc-warn',icon:'alert',action:"TG.quickCompletion('incompletas')"})}
    ${TG.kpi({label:'Cambiaron de estado',value:num(R.changedState),sub:'doble registro: incompleto → completo',acc:'acc-good',icon:'pulse',action:"TG.quickCompletion('cambiaron')"})}
  </div>
  ${actorBreakdown(R)}
  <div class="card pad-lg mb"><div id="metaGauge"></div></div>

  <div class="section-head"><h3>Embudo por actor · estado de contacto</h3><span class="h-note">completas · incompletas pero contactables · no es posible contactar</span></div>
  <div id="actorFunnel"></div>

  <div class="grid g-21 mb">
    <div class="card"><div class="card-h"><span class="t">Crecimiento acumulado de registros</span><span class="meta">nuevos por corte</span></div><div id="cumChart"></div></div>
    <div class="card"><div class="card-h"><span class="t">Ritmo</span></div>
      <div style="display:flex;flex-direction:column;gap:14px">
        ${miniStat('Nuevos · último corte', num(R.lastNew))}
        ${miniStat('Promedio por corte', num(Math.round(R.velocity))+' nuevos')}
        ${miniStat('Proyección a 150', R.semanasParaMeta!=null?('≈ '+R.semanasParaMeta+' '+(R.semanasParaMeta===1?'corte':'cortes')):'sin ritmo medible')}
      </div></div>
  </div>

  <div class="section-head"><h3>Base de la solución y tracción</h3><span class="h-note">sectores, madurez, ventas, validación y financiación declarada</span></div>
  <div class="grid g-3 mb">
    ${TG.kpi({label:'Sectores / verticales',value:num(R.cov.sector),sub:`${p(R.cov.sector)}% declaró sector`,acc:'acc-info',icon:'dna',action:"TG.nav('portafolio')"})}
    ${TG.kpi({label:'TRL / etapa declarada',value:num(R.trlCov),sub:`${num(R.trlReady)} investment ready`,acc:'acc-good',icon:'target',action:"TG.nav('portafolio')"})}
    ${TG.kpi({label:'Ventas o tracción',value:num(R.ventasCount),sub:'ingresos, clientes o ventas declaradas',acc:'acc-warn',icon:'coins',action:"TG.quickVentas('ventas')"})}
    ${TG.kpi({label:'Modelo tecnológico',value:num(R.baseSolucionCov.generacionValor),sub:'tipo de generación de valor',acc:'acc-mag',icon:'spark',action:"TG.nav('portafolio')"})}
    ${TG.kpi({label:'Validación técnica',value:num(R.validacionCount),sub:'señales técnicas, regulatorias o impacto',acc:'acc-info',icon:'check',action:"TG.quickValidation()"})}
    ${TG.kpi({label:'Capital buscado',value:num(R.buscanInv),sub:'monto o interés de inversión',acc:'acc-good',icon:'coins',action:"TG.quick('capital')"})}
  </div>
  <div class="note mb">La lectura de base científica/tecnológica depende de los campos disponibles en el CSV cargado. El consolidado histórico permite leer <b>sector/vertical, ruta, etapa/TRL, capital e interés de inversión</b>. Si se carga el export completo de Alchemer, el tablero también detecta <b>ingresos, tipo de solución, innovación, validación técnica y prácticas de impacto</b>.</div>

  <div class="section-head"><h3>¿Qué calidad llega?</h3><span class="h-note">composición de la base depurada</span></div>
  <div class="grid g-3 mb">
    ${TG.kpi({label:'Investment Ready · TRL 7–9',value:num(R.trlReady),sub:R.trlCov?Math.round(R.trlReady/R.trlCov*100)+'% de las que declararon':'sin dato',acc:'acc-mag',icon:'target',action:"TG.quickTrlGroup('ready')"})}
    ${TG.kpi({label:'Con contacto',value:num(R.conContacto),sub:p(R.conContacto)+'% contactables',acc:'acc-info',icon:'users',action:"TG.quick('contacto','Con contacto')"})}
    ${TG.kpi({label:'Listas para contactar',value:num(R.accionables),sub:'con calidad + canal',acc:'acc-good',icon:'check',action:"TG.quick('accionables')"})}
  </div>
  <div class="grid g-2 mb">
    <div class="card"><div class="card-h"><span class="t">Estado de las postulaciones</span></div><div id="estDonut"></div></div>
    <div class="card"><div class="card-h"><span class="t">Prioridad de seguimiento</span><span class="meta">acción del equipo</span></div><div id="prioBars"></div></div>
  </div>
  <div class="grid" id="insights"></div>`;
  el('pane-resumen').innerHTML=html;
  TG.metaGauge('metaGauge',R);
  TG.cumChart('cumChart',R.growth,R.META);
  TG.donut('estDonut',R.estados,{action:'TG.quickEstado',centerLabel:'postulaciones'});
  TG.bars('prioBars',R.prioridades,{action:'TG.quickPrio'});
  el('insights').innerHTML=buildInsights(R).map(TG.insight).join('');
  renderActorFunnel(R);
}
function miniStat(k,v){return `<div style="display:flex;justify-content:space-between;align-items:baseline;padding-bottom:11px;border-bottom:1px solid var(--line)">
  <span style="color:var(--dim);font-size:.84rem">${esc(k)}</span>
  <b style="font-family:var(--font-display);font-size:1.15rem;letter-spacing:-.01em">${esc(v)}</b></div>`;}

/* ----- desglose: a qué actor pertenecen las postulaciones completas ----- */
const ACTOR_COLORS=['var(--mag)','#36C2A6','#F2A93B','#5B8DEF','#C77BE0','#9aa6c9'];
function actorBreakdown(R){
  const items=R.byActor.map(x=>({label:x.label,n:x.completasTot,enc:encodeURIComponent(x.label)}))
    .filter(x=>x.n>0).sort((a,b)=>b.n-a.n);
  const tot=items.reduce((s,x)=>s+x.n,0);
  if(!tot) return '';
  const seg=items.map((x,i)=>{
    const pct=Math.round(x.n/tot*100), col=ACTOR_COLORS[i%ACTOR_COLORS.length];
    return `<button class="ab-seg" style="flex:${x.n};background:${col}" title="${esc(x.label)}: ${x.n} (${pct}%)"
      onclick="TG.quickActorClass('${x.enc}','completa')"></button>`;
  }).join('');
  const legend=items.map((x,i)=>{
    const pct=Math.round(x.n/tot*100), col=ACTOR_COLORS[i%ACTOR_COLORS.length];
    return `<button class="ab-leg" onclick="TG.quickActorClass('${x.enc}','completa')">
      <span class="dot" style="background:${col}"></span>
      <span class="lab">${esc(x.label)}</span>
      <b>${num(x.n)}</b><span class="pct">${pct}%</span></button>`;
  }).join('');
  return `<div class="card actor-breakdown mb">
    <div class="ab-head"><span class="t">¿A qué actor representan estas <b>${num(tot)}</b> postulaciones completas?</span><span class="meta">clic para ver en la base</span></div>
    <div class="ab-bar">${seg}</div>
    <div class="ab-legend">${legend}</div>
  </div>`;
}

/* ----- embudo por actor con filtro de 3 estados de contacto/completitud ----- */
const ACTOR_CLASSES=[
  {key:'',                     label:'Todas',                       cls:'all'},
  {key:'completa',             label:'Completas',                   cls:'good'},
  {key:'incompletaContactable',label:'Incompletas · contactables',  cls:'warn'},
  {key:'sinContacto',          label:'No es posible contactar',     cls:'bad'},
];
function renderActorFunnel(R){
  R=R||resumenAgg();
  const box=el('actorFunnel'); if(!box) return;
  const totals={'':0,completa:0,incompletaContactable:0,sinContacto:0};
  R.byActor.forEach(x=>{
    totals['']+=x.n;
    totals.completa+=x.completasTot;
    totals.incompletaContactable+=x.incompletasContactables;
    totals.sinContacto+=x.sinContacto;
  });
  const chips=ACTOR_CLASSES.map(c=>`<button class="funnel-chip ${c.cls} ${resumenActorClass===c.key?'on':''}" onclick="TG.setActorClass('${c.key}')">
    <span class="lbl">${esc(c.label)}</span><b>${num(totals[c.key])}</b></button>`).join('');
  box.innerHTML=`
    <div class="funnel-filter">${chips}</div>
    <div class="actor-layer-grid mb">${R.byActor.map(x=>layerCard(x,resumenActorClass)).join('')}</div>
    <div class="note mb">Cada capa separa los registros en tres estados de gestión: <b>completas</b>, <b>incompletas pero contactables</b> (tienen correo o celular para hacer seguimiento) y las que <b>no es posible contactar</b> (sin información de contacto). Usa los filtros de arriba o haz clic en cualquier número para ver esos registros en la base.</div>`;
}
function layerCard(x, activeClass){
  const enc=encodeURIComponent(x.label);
  const states=[
    {key:'completa',             n:x.completasTot,            label:'completas',                cls:'good'},
    {key:'incompletaContactable',n:x.incompletasContactables, label:'incompletas · contactables',cls:'warn'},
    {key:'sinContacto',          n:x.sinContacto,             label:'no es posible contactar',  cls:'bad'},
  ];
  const rows=states.map(s=>{
    const dim=activeClass && activeClass!==s.key ? ' is-dim' : '';
    const on=activeClass && activeClass===s.key ? ' is-on' : '';
    return `<button class="actor-state ${s.cls}${dim}${on}" onclick="TG.quickActorClass('${enc}','${s.key}')">
      <span class="n">${num(s.n)}</span><span class="lbl">${esc(s.label)}</span></button>`;
  }).join('');
  return `<div class="actor-card">
    <div class="actor-top"><span>${esc(x.label)}</span><b>${num(x.n)}</b></div>
    <div class="actor-sub">${num(x.contactables)} contactables · ${num(x.sinContacto)} sin contacto</div>
    <div class="actor-states">${rows}</div>
  </div>`;
}

function buildInsights(R){
  R=R||A;
  const p=n=>R.N?Math.round(n/R.N*100):0;
  const out=[];
  out.push({kind:R.pctCompl<50?'warn':'good',icon:R.pctCompl<50?'alert':'check',title:`${R.completas} postulaciones completas (${R.pctCompl}% de los únicos)`,
    body:`De ${R.N} registros únicos recibidos, <b>${R.faltanCompletar} faltan por completar</b>. ${R.changedState} ya pasaron de incompleto a completo — la conversión está ocurriendo, vale la pena empujar a las parciales contactables.`});

  out.push({kind:'info',icon:'pulse',title:`${R.accionables} listas para contactar`,
    body:`Con calidad y canal de contacto disponible. ${R.trlReady} son <b>Investment Ready (TRL 7–9)</b> entre las que declararon su etapa.`});

  const sinCanal=R.prioridades.find(p=>/sin canal/i.test(p.label));
  const consent=R.prioridades.find(p=>/consentimiento/i.test(p.label));
  const ruido=(sinCanal?sinCanal.n:0)+(consent?consent.n:0);
  if(ruido) out.push({kind:'warn',icon:'filter',title:`${ruido} registros no gestionables`,
    body:`Entre "sin canal de contacto" y "solo consentimiento". Conviene depurarlos para no inflar el conteo de la convocatoria.`});

  if(R.rutas[0]) out.push({kind:'info',icon:'dna',title:`Ruta dominante: ${esc(R.rutas[0].label)}`,
    body:`${R.rutas[0].n} postulaciones (${p(R.rutas[0].n)}%). ${R.sectores[0]?`Sector más frecuente: <b>${esc(R.sectores[0].label)}</b>.`:''}`});
  if(R.mujeresPctRows||R.liderMujer) out.push({kind:R.cumple2x?'good':'info',icon:'users',title:`Género & 2X: ${R.cumple2x} cumplen umbral de management`,
    body:`${R.liderMujer} postulaciones reportan liderazgo femenino y ${R.mujeresPctRows} traen porcentaje de mujeres en cargos directivos. ${R.mujeresPctAvg!=null?`Promedio reportado: <b>${R.mujeresPctAvg}%</b>.`:''}`});
  return out;
}

/* ===================== EVOLUCIÓN ===================== */
function renderEvolucion(){
  const r=A.reports;
  const html=`
  <div class="note mb">Los reportes son <b>acumulativos</b>: cada corte puede reincluir registros previos. Por eso separamos <b>nuevos del corte</b> (crecimiento real) de los <b>ya registrados antes</b>. Haz clic en cualquier número para ver esas postulaciones en la base.</div>
  <div class="card mb"><div class="card-h"><span class="t">Evolución por corte semanal</span><span class="meta">${r.length} cortes</span></div>
    <div class="tbl-wrap" style="max-height:none">
    <table class="data"><thead><tr>
      <th>Reporte</th><th>Tipo</th><th>En archivo</th><th>Nuevos</th><th>Registrados antes</th><th>Contactables</th><th>Completas</th><th>Parciales</th>
    </tr></thead><tbody>${r.map(rp=>`<tr>
      <td><span class="t-org">${esc(rp.reporte)}</span><div class="t-sub">${esc((rp.fecha||''))}</div></td>
      <td><span class="badge b-mut">${esc(rp.tipo)}</span></td>
      <td class="t-mono">${num(rp.enArchivo)}</td>
      <td><span class="badge b-mag" style="cursor:pointer" onclick="TG.quickReport('${encodeURIComponent(rp.reporte)}','nuevo')">${num(rp.nuevos)}</span></td>
      <td><span class="badge b-mut" style="cursor:pointer" onclick="TG.quickReport('${encodeURIComponent(rp.reporte)}','antes')">${num(rp.antes)}</span></td>
      <td><span class="badge b-info" style="cursor:pointer" onclick="TG.quickReport('${encodeURIComponent(rp.reporte)}','contacto')">${num(rp.contactables)}</span></td>
      <td><span class="badge b-good" style="cursor:pointer" onclick="TG.quickReport('${encodeURIComponent(rp.reporte)}','Completa')">${num(rp.completas)}</span></td>
      <td><span class="badge b-warn" style="cursor:pointer" onclick="TG.quickReport('${encodeURIComponent(rp.reporte)}','Parcial')">${num(rp.parciales)}</span></td>
    </tr>`).join('')}</tbody></table></div></div>

  <div class="grid g-2 mb">
    <div class="card"><div class="card-h"><span class="t">Nuevos vs ya registrados</span><span class="meta">trazabilidad histórica</span></div><div id="traceDonut"></div></div>
    <div class="card"><div class="card-h"><span class="t">Contactabilidad de la base</span></div><div id="contactDonut"></div></div>
  </div>

  <div class="section-head"><h3>Correlación · calidad × contacto</h3><span class="h-note">¿las postulaciones de mejor calidad traen canal de contacto?</span></div>
  <div class="card mb"><div id="heatCC"></div>
    <div class="note" style="margin-top:14px">Lee cada celda como "cuántas postulaciones son <b>[fila]</b> y además <b>[columna]</b>". Lo ideal es masa en <b>Completa · Con contacto</b>. Clic en una celda para ver esas empresas.</div>
  </div>

  <div class="section-head"><h3>Calidad por corte</h3><span class="h-note">¿mejora lo que llega cada semana?</span></div>
  <div class="card"><div id="heatER"></div></div>`;
  el('pane-evolucion').innerHTML=html;
  const nuevos=A.reports.reduce((s,r)=>s+r.nuevos,0), antes=A.reports.reduce((s,r)=>s+r.antes,0);
  TG.donut('traceDonut',[{label:'Nuevos del corte',n:nuevos},{label:'Registrados antes',n:antes}],{centerLabel:'registros',action:'TG.quickTrace'});
  TG.donut('contactDonut',[{label:'Con contacto',n:A.conContacto},{label:'Sin contacto',n:A.N-A.conContacto}],{centerLabel:'postulaciones',action:'TG.quickContact'});
  TG.heatmap('heatCC',A.heatCalidadContacto,{action:'TG.quickHeatCC'});
  TG.heatmap('heatER',A.heatEstadoReporte,{});
}

/* ===================== PORTAFOLIO ===================== */
function renderPortafolio(){
  const cov=A.cov;
  const covNote=(k,lbl)=>`<span class="meta">${cov[k]} de ${A.N} declaró ${lbl}</span>`;
  const readyPct=A.trlCov?Math.round(A.trlReady/A.trlCov*100):0;
  const html=`
  <div class="section-head"><h3>TRL declarado · madurez tecnológica</h3><span class="h-note">${A.trlCov} de ${A.N} postulaciones declararon su etapa · base para “investment ready”</span></div>
  <div class="grid g-3 mb">
    ${TG.kpi({label:'Investment Ready · TRL 7–9',value:num(A.trlReady),sub:readyPct+'% de las que declararon',acc:'acc-good',icon:'check',action:"TG.quickTrlGroup('ready')"})}
    ${TG.kpi({label:'En validación · TRL 4–6',value:num(A.trlValid),sub:'prototipo / piloto',acc:'acc-info',icon:'pulse',action:"TG.quickTrlGroup('validacion')"})}
    ${TG.kpi({label:'Etapa temprana · TRL 1–3',value:num(A.trlEarly),sub:'concepto / validación',acc:'acc-warn',icon:'spark',action:"TG.quickTrlGroup('temprano')"})}
  </div>
  <div class="card mb"><div class="card-h"><span class="t">Distribución por banda TRL</span><span class="meta">de concepto a escala</span></div><div id="trlBars"></div>
    <div class="note" style="margin-top:12px">El TRL no es un campo numérico del formulario: se deriva de la <b>etapa declarada</b> de cada empresa (idea → prototipo → primeros clientes → ingresos → escala) y solo está disponible en los cortes que preguntaron etapa.</div>
  </div>

  <div class="note mb">Igual que el TRL, los campos de <b>ruta, sector y capital</b> solo vienen en ciertos cortes. El conteo refleja quiénes <b>sí declararon</b> cada dato, no el total de la base.</div>
  <div class="grid g-2 mb">
    <div class="card"><div class="card-h"><span class="t">Por ruta</span>${covNote('ruta','ruta')}</div><div id="rutaBars"></div></div>
    <div class="card"><div class="card-h"><span class="t">Por sector / vertical</span>${covNote('sector','sector')}</div><div id="sectorBars"></div></div>
  </div>
  <div class="grid g-2 mb">
    <div class="card"><div class="card-h"><span class="t">Capital buscado</span>${covNote('capital','capital')}</div><div id="capBars"></div></div>
    <div class="card"><div class="card-h"><span class="t">Interés de inversión</span></div><div id="interesBars"></div></div>
  </div>

  <div class="section-head"><h3>Base de la solución</h3><span class="h-note">tecnología, innovación, validación y tracción comercial</span></div>
  <div class="grid g-2 mb">
    <div class="card"><div class="card-h"><span class="t">Tipo de generación de valor</span><span class="meta">si el export completo lo trae</span></div><div id="genValorBars"></div></div>
    <div class="card"><div class="card-h"><span class="t">Tracción comercial</span><span class="meta">ventas, ingresos o primeros clientes</span></div>
      <div class="grid g-2" style="gap:12px;margin-bottom:14px">
        ${TG.kpi({label:'Ventas / ingresos declarados',value:num(A.ventasCount),sub:pctOf(A.ventasCount)+'% de la base',acc:'acc-warn',icon:'coins',action:"TG.quickVentas('ventas')"})}
        ${TG.kpi({label:'Ingresos 2025 reportados',value:num(A.ingresos2025Count),sub:'campo disponible en export completo',acc:'acc-info',icon:'pulse',action:"TG.quickVentas('ingresos2025')"})}
      </div>
      <div class="note">Si el CSV cargado es el consolidado histórico, la tracción se infiere desde etapa declarada: primeros clientes, ingresos recurrentes o crecimiento. Con el export completo se leen ingresos 2023–2025 y proyecciones.</div>
    </div>
  </div>
  <div class="grid g-2 mb">
    <div class="card"><div class="card-h"><span class="t">Validación técnica / científica</span></div>
      <div class="grid g-2" style="gap:12px;margin-bottom:14px">
        ${TG.kpi({label:'Validación técnica',value:num(A.validacionCount),sub:'pruebas, certificaciones o regulación',acc:'acc-good',icon:'check',action:"TG.quickValidation()"})}
        ${TG.kpi({label:'Innovación declarada',value:num(A.innovacionCount),sub:'modelo, proceso o tecnología',acc:'acc-mag',icon:'spark',action:"TG.quickInnovation()"})}
      </div>
      <div class="note">Esta sección detecta señales de base tecnológica/científica cuando el formulario exportado trae campos de validación técnica, certificaciones, regulación, innovación o generación de valor.</div>
    </div>
    <div class="card"><div class="card-h"><span class="t">Cobertura de datos de solución</span></div>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${miniStat('Ruta declarada', num(A.baseSolucionCov.ruta)+' / '+num(A.N))}
        ${miniStat('Sector / vertical', num(A.baseSolucionCov.sector)+' / '+num(A.N))}
        ${miniStat('Etapa / TRL', num(A.baseSolucionCov.etapa)+' / '+num(A.N))}
        ${miniStat('Capital / inversión', num(A.cov.capital)+' / '+num(A.N))}
      </div>
    </div>
  </div>`;
  el('pane-portafolio').innerHTML=html;
  TG.bars('trlBars',A.trlBands,{action:'TG.quickTrlBand',colorAt:(i,it)=>/TRL [789]/.test(it.label)?'#3FD78D':/TRL 4/.test(it.label)?'#5AA9F0':/TRL 1/.test(it.label)?'#F6B53F':'#B65CE0'});
  TG.bars('rutaBars',A.rutas,{action:'TG.quickRuta'});
  TG.bars('sectorBars',A.sectores.slice(0,9),{action:'TG.quickSector'});
  TG.bars('capBars',A.capitales,{action:'TG.quickCapital'});
  TG.bars('interesBars',A.intereses.slice(0,8),{});
  TG.bars('genValorBars',A.genValorDist.slice(0,8),{action:'TG.quickGenValor'});
}



/* ===================== ACTORES & RETOS ===================== */
const RETOS_INICIALES=[
  ['Clientes',3.78],['Capital / recursos',3.56],['Ventas',3.56],['Aliados / conexiones',3.44],
  ['Organización financiera',3.00],['Permisos / requisitos',2.56],['Maquinaria / equipos',2.33]
];
function hasPrimerCorte(){return A && A.rows.some(r=>/2026-05-25|Reporte 1 HTML|22505/i.test((r.reporte||'')+' '+(r.tipo||'')));}

/* filtro local de la sección Actores: por informe y por completitud/contactabilidad */
let ACT_F={reporte:'',calidad:''}; // calidad: '' | 'completo' | 'incompleto_cont' | 'incontactable'
function actCalidad(r){
  if(!r.contacto) return 'incontactable';
  return (r.estado==='Completa'||r.estado==='Sustantiva') ? 'completo' : 'incompleto_cont';
}
function actApply(rows){
  let out=rows;
  if(ACT_F.reporte) out=out.filter(r=>r.reporte===ACT_F.reporte);
  if(ACT_F.calidad) out=out.filter(r=>actCalidad(r)===ACT_F.calidad);
  return out;
}
function renderActores(){
  const base=A.portfolio||[];
  const scope = ACT_F.reporte ? base.filter(r=>r.reporte===ACT_F.reporte) : base;
  // conteos por bucket dentro del informe seleccionado (ignorando el filtro de calidad activo)
  const cAll=scope.length;
  const cComp=scope.filter(r=>actCalidad(r)==='completo').length;
  const cInc=scope.filter(r=>actCalidad(r)==='incompleto_cont').length;
  const cIncont=scope.filter(r=>actCalidad(r)==='incontactable').length;
  const reps=reportOptions();
  const pill=(key,label,n,acc)=>`<button class="act-pill ${acc} ${ACT_F.calidad===key||(!ACT_F.calidad&&key==='')?'on':''}" onclick="TG.setActCalidad('${key}')"><b>${num(n)}</b><span>${label}</span></button>`;
  const shown=actApply(base).length;
  const filterBar=`
  <div class="act-filter">
    <div class="act-filter-row">
      <div class="field act-rep"><label>Informe</label>
        <select onchange="TG.setActReporte(this.value)">
          <option value="">Todos los informes (${reps.length})</option>
          ${reps.map(rp=>`<option value="${esc(rp)}" ${rp===ACT_F.reporte?'selected':''}>${esc(rp)}</option>`).join('')}
        </select>
      </div>
      <div class="act-pills">
        ${pill('','Todos',cAll,'p-all')}
        ${pill('completo','Perfiles completos',cComp,'p-good')}
        ${pill('incompleto_cont','Incompletos · contactables',cInc,'p-warn')}
        ${pill('incontactable','Incontactables',cIncont,'p-bad')}
      </div>
    </div>
    <div class="act-filter-note">${(ACT_F.reporte||ACT_F.calidad)
        ? `Mostrando <b>${num(shown)}</b> registro${shown===1?'':'s'}${ACT_F.reporte?` del informe <b>${esc(ACT_F.reporte.split('·')[0].trim())}</b>`:''}${ACT_F.calidad?` · <b>${({completo:'completos',incompleto_cont:'incompletos contactables',incontactable:'incontactables'})[ACT_F.calidad]}</b>`:''} <button class="act-clear" onclick="TG.clearActFilter()">× limpiar filtro</button>`
        : `Base completa · <b>${num(cAll)}</b> registros · usa los filtros para acotar por informe o por estado de los perfiles`}</div>
  </div>`;

  // pools filtrados
  const sList=actApply(base.filter(r=>r.actor==='Startups y emprendimientos'));
  const inv=actApply(base.filter(r=>r.actor==='Inversionistas'));
  const ment=actApply(base.filter(r=>r.actor==='Mentores y expertos'));
  const ali=actApply(base.filter(r=>r.actor==='Aliados / ecosistema'));
  const corp=ali.filter(r=>/^Corporativo/i.test(r.rol||'') || /corporativo|empresa ancla/i.test((r.detalle||'')+' '+(r.actorSubtipo||'')));
  const ecos=ali.filter(r=>!corp.includes(r));
  // embudo de startups recomputado sobre el pool filtrado
  const sInteresComp=sList.filter(r=>r.flujoEstado==='Interés completo').length;
  const sInteresInc=sList.filter(r=>r.flujoEstado==='Interés incompleto').length;
  const sPostComp=sList.filter(r=>r.flujoEstado==='Postulación completa').length;
  const filt=(ACT_F.reporte||ACT_F.calidad);

  const html=`
  ${filterBar}
  <div class="section-head"><h3>Capas de actor y avance operativo</h3><span class="h-note">cada bloque filtra la base de contactos según actor, completitud y contacto disponible</span></div>
  <div class="grid g-4 mb">
    ${TG.kpi({label:'Startups y emprendimientos',value:num(sList.length),sub:`${num(sPostComp)} postulaciones completas · ${num(sInteresComp)} interés completo`,acc:'acc-mag',icon:'spark',action:"TG.quickActor(encodeURIComponent('Startups y emprendimientos'),'')"})}
    ${TG.kpi({label:'Inversionistas',value:num(inv.length),sub:`${num(inv.filter(r=>r.estado==='Completa'||r.estado==='Sustantiva').length)} registros completos`,acc:'acc-good',icon:'coins',action:"TG.quickActor(encodeURIComponent('Inversionistas'),'')"})}
    ${TG.kpi({label:'Mentores y expertos',value:num(ment.length),sub:`${num(ment.filter(r=>r.contacto).length)} con contacto`,acc:'acc-info',icon:'users',action:"TG.quickActor(encodeURIComponent('Mentores y expertos'),'')"})}
    ${TG.kpi({label:'Aliados / ecosistema',value:num(ali.length),sub:`${num(corp.length)} corporativos o empresas ancla`,acc:'acc-warn',icon:'target',action:"TG.quickActor(encodeURIComponent('Aliados / ecosistema'),'')"})}
  </div>
  <div class="section-head"><h3>Startups: de interés a postulación</h3><span class="h-note">separa manifestación de interés del formulario completo de postulación</span></div>
  <div class="grid g-4 mb">
    ${TG.kpi({label:'Interés completo',value:num(sInteresComp),sub:'manifestación de interés con datos',acc:'acc-info',icon:'check',action:"TG.quickActor(encodeURIComponent('Startups y emprendimientos'),encodeURIComponent('Interés completo'))"})}
    ${TG.kpi({label:'Interés incompleto',value:num(sInteresInc),sub:'quedó como registro parcial',acc:'acc-warn',icon:'alert',action:"TG.quickActor(encodeURIComponent('Startups y emprendimientos'),encodeURIComponent('Interés incompleto'))"})}
    ${TG.kpi({label:'Postulación completa',value:num(sPostComp),sub:'formulario completo terminado',acc:'acc-good',icon:'check',action:"TG.quickActor(encodeURIComponent('Startups y emprendimientos'),encodeURIComponent('Postulación completa'))"})}
    ${TG.kpi({label:'Pasó de interés a postulación',value:num(A.transitionUids?A.transitionUids.size:0),sub:filt?'métrica histórica (sin filtro)':`${num(A.transitionCompleteUids?A.transitionCompleteUids.size:0)} terminaron postulación`,acc:'acc-mag',icon:'pulse',action:"TG.quickTransition('any')"})}
  </div>
  <div class="section-head"><h3>Retos declarados por startups · primer corte</h3><span class="h-note">intensidad promedio 1–5 reportada en el formulario inicial</span></div>
  <div class="card mb"><div id="retosIniciales"></div><div class="note" style="margin-top:12px">Esta sección recupera el insight del reporte inicial: retos de clientes, capital, ventas y aliados. Si el CSV consolidado no trae cada reto a nivel fila, el clic abre el listado de startups del primer corte para seguimiento cualitativo.</div></div>
  <div class="section-head"><h3>Perfiles de actores no startup</h3><span class="h-note">inversionistas, corporativos, aliados de ecosistema y mentores con información específica cuando está disponible</span></div>
  <div class="grid g-2 mb">
    <div class="card"><div class="card-h"><span class="t">Inversionistas</span><span class="meta">vehículo · ticket · sectores</span></div>${actorProfileList(inv,'inversionista')}</div>
    <div class="card"><div class="card-h"><span class="t">Corporativos / empresas ancla</span><span class="meta">sector · pilotos · temas</span></div>${actorProfileList(corp,'corporativo')}</div>
    <div class="card"><div class="card-h"><span class="t">Aliados de ecosistema</span><span class="meta">tipo · cobertura · colaboración</span></div>${actorProfileList(ecos,'aliado')}</div>
    <div class="card"><div class="card-h"><span class="t">Mentores y expertos</span><span class="meta">experiencia · área</span></div>${actorProfileList(ment,'mentor')}</div>
  </div>`;
  el('pane-actores').innerHTML=html;
  TG.bars('retosIniciales',RETOS_INICIALES.map(x=>({label:x[0],n:x[1],suffix:' / 5'})),{action:'TG.quickRetoInicial',valueFmt:v=>Number(v).toFixed(2)+' / 5'});
}
TG.setActReporte=function(v){ ACT_F.reporte=v||''; renderActores(); };
TG.setActCalidad=function(v){ ACT_F.calidad=(v===ACT_F.calidad)?'':(v||''); renderActores(); };
TG.clearActFilter=function(){ ACT_F={reporte:'',calidad:''}; renderActores(); };
function actorProfileList(rows,type){
  if(!rows.length) return '<div class="empty-mini">No hay registros de esta capa con el CSV cargado.</div>';
  const ordered=[...rows].sort((a,b)=>(b.contacto-a.contacto)||String(a.org||a.persona).localeCompare(String(b.org||b.persona),'es'));
  return `<div class="profile-list">${ordered.slice(0,14).map((r,i)=>profileCard(r,type,i)).join('')}${ordered.length>14?`<button class="profile-more" onclick="TG.quickActor(encodeURIComponent('${esc(rows[0].actor)}'),'')">Ver ${ordered.length-14} más en base</button>`:''}</div>`;
}
function profileCard(r,type,i){
  const meta=[];
  if(type==='inversionista') meta.push(['Vehículo',r.vehiculo],['Ticket',r.ticket],['Sectores',r.invSectores],['Etapas',r.invEtapas],['Geografía',r.invGeo]);
  else if(type==='corporativo') meta.push(['Sector',r.corpSector],['Pilotos',r.pilotos],['Temas',r.temas],['Interés',r.colaboracion]);
  else if(type==='aliado') meta.push(['Tipo',r.actorSubtipo],['Cobertura',r.cobertura],['Puede apoyar en',r.colaboracion]);
  else meta.push(['Experiencia',r.experiencia],['Startups apoyadas',r.startupsApoyadas],['Área',r.areaMentor],['Superpoder',r.superpoder]);
  const chips=`${flujoBadge(r.flujoEstado)} ${r.contacto?'<span class="badge b-info">con contacto</span>':'<span class="badge b-bad">sin información de contacto</span>'}`;
  return `<div class="profile-card" onclick="TG.quickActor(encodeURIComponent('${esc(r.actor)}'),encodeURIComponent('${esc(r.flujoEstado)}'))">
    <div class="profile-title"><b>${esc(r.org||r.persona||'Sin nombre registrado')}</b><span>${chips}</span></div>
    <div class="profile-who">${esc([r.persona,r.cargo].filter(Boolean).join(' · ')||'Sin contacto nominal')}</div>
    <div class="profile-meta">${meta.filter(x=>x[1]).slice(0,5).map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('') || '<div><span>Detalle</span><b>Sin campos específicos disponibles</b></div>'}</div>
  </div>`;
}

/* ===================== GÉNERO & 2X ===================== */
function renderGenero(){
  const avg = A.mujeresPctAvg!=null ? A.mujeresPctAvg+'%' : '—';
  const html=`
  <div class="section-head"><h3>Género & 2X</h3><span class="h-note">liderazgo, management, cobertura del dato y brechas de información</span></div>
  <div class="grid g-4 mb">
    ${TG.kpi({label:'Liderazgo femenino',value:num(A.liderMujer),sub:A.cov.genero?Math.round(A.liderMujer/A.cov.genero*100)+'% de quienes declararon género':'sin dato suficiente',acc:'acc-mag',icon:'users',action:"TG.quickGenero('Mujer')"})}
    ${TG.kpi({label:'Mujeres en management',value:avg,sub:`${num(A.mujeresPctRows)} con porcentaje reportado`,acc:'acc-good',icon:'target',action:"TG.quick2X('conDato')"})}
    ${TG.kpi({label:'Cumplen criterio 2X',value:num(A.cumple2x),sub:'≥30% mujeres en dirección',acc:'acc-good',icon:'check',action:"TG.quick2X('cumple')"})}
    ${TG.kpi({label:'Sin dato suficiente',value:num(A.N-A.cov.mujeresDato),sub:'requiere completar género/management',acc:'acc-warn',icon:'alert',action:"TG.quick2X('sinDato')"})}
  </div>
  <div class="note mb">El criterio operativo 2X se evalúa con el campo <b>% mujeres en cargos directivos</b> cuando está disponible. El género del liderazgo y el porcentaje de mujeres en management son variables distintas: una describe quién lidera y la otra la composición del equipo directivo.</div>
  <div class="grid g-2 mb">
    <div class="card"><div class="card-h"><span class="t">Género del liderazgo</span><span class="meta">campo persona líder</span></div><div id="generoDonut"></div></div>
    <div class="card"><div class="card-h"><span class="t">Rangos de mujeres en dirección</span><span class="meta">línea 2X = 30%</span></div><div id="mujPctBars"></div></div>
  </div>
  <div class="grid g-2 mb">
    <div class="card"><div class="card-h"><span class="t">Semáforo 2X</span></div><div id="x2Donut"></div></div>
    <div class="card"><div class="card-h"><span class="t">Seguimiento recomendado</span></div>
      <div class="grid" id="genderInsights"></div>
    </div>
  </div>`;
  el('pane-genero').innerHTML=html;
  TG.donut('generoDonut',A.generoDist,{centerLabel:'liderazgo',action:'TG.quickGenero'});
  TG.bars('mujPctBars',A.pctRanges,{action:'TG.quick2XRange'});
  TG.donut('x2Donut',[{label:'Cumple 2X',n:A.cumple2x},{label:'No cumple 2X',n:A.noCumple2x},{label:'Sin dato suficiente',n:Math.max(0,A.N-A.cov.mujeresDato)}],{centerLabel:'empresas',action:'TG.quick2X'});
  const gi=[];
  if(A.cumple2x) gi.push({kind:'good',icon:'check',title:`${A.cumple2x} empresas cumplen el umbral 2X`,body:`Tienen ≥30% mujeres en cargos directivos según el porcentaje reportado.`});
  if(A.N-A.cov.mujeresDato) gi.push({kind:'warn',icon:'alert',title:`${A.N-A.cov.mujeresDato} sin dato suficiente`,body:`Prioriza seguimiento a parciales y completas sin porcentaje de mujeres en management para no perder capacidad de evaluación 2X.`});
  if(A.liderMujer) gi.push({kind:'info',icon:'users',title:`${A.liderMujer} liderazgos femeninos identificados`,body:`Este dato sirve para lectura de liderazgo, pero no sustituye el criterio de mujeres en cargos directivos.`});
  el('genderInsights').innerHTML=gi.map(TG.insight).join('')||'<div class="empty-mini">Sin datos de género en el archivo cargado.</div>';
}

/* ===================== TERRITORIO ===================== */
function renderTerritorio(){
  const html=`
  <div class="grid g-12">
    <div>
      <div class="card mb"><div class="card-h"><span class="t">Por departamento</span><span class="meta">Colombia</span></div><div id="deptoBars"></div></div>
      <div class="card"><div class="card-h"><span class="t">Por país</span></div><div id="paisDonut"></div></div>
    </div>
    <div class="card"><div class="card-h"><span class="t">Mapa de postulaciones</span><span class="meta">tamaño = nº de empresas</span></div>
      <div class="map-box"><svg class="map-svg" viewBox="0 0 360 470" id="mapSvg"></svg></div>
      <div class="note" id="mapNote" style="margin-top:6px"></div>
    </div>
  </div>`;
  el('pane-territorio').innerHTML=html;
  TG.bars('deptoBars',A.deptos.slice(0,12),{action:'TG.quickDepto'});
  TG.donut('paisDonut',A.paises.slice(0,8),{action:'TG.quickPais',centerLabel:'países'});
  renderMap();
}
function renderMap(){
  const svg=el('mapSvg'); if(!svg) return;
  const tip=el('tip');
  const M=TG.buildColombia(360,470,20);
  let inner=`<path d="${M.path}" fill="#1b1226" stroke="var(--mag-3)" stroke-width="1.4" stroke-linejoin="round" opacity=".92"/>`;
  let plotted=0, fuera=0;
  const maxN=Math.max(1,...A.deptos.map(d=>d.n));
  A.deptos.forEach(d=>{
    const c=M.deptXY(d.label);
    if(!c){fuera+=d.n;return;}
    plotted++;
    const r=Math.max(8,8+(d.n/maxN)*15);
    inner+=`<g class="dept-dot" data-d="${esc(d.label)}" data-n="${d.n}">
      <circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${r.toFixed(1)}" fill="#EE46DD" fill-opacity=".85" stroke="#F2ECF8" stroke-width="1.4"/>
      <text x="${c[0].toFixed(1)}" y="${(c[1]+3.5).toFixed(1)}" text-anchor="middle" fill="#fff" font-size="10" font-weight="700" font-family="'JetBrains Mono',monospace">${d.n}</text></g>`;
  });
  svg.innerHTML=inner;
  svg.querySelectorAll('.dept-dot').forEach(g=>{
    const name=g.getAttribute('data-d'), n=g.getAttribute('data-n');
    g.addEventListener('mouseenter',()=>{tip.style.display='block';tip.innerHTML=`<b>${esc(name)}</b><br>${n} postulación(es)`;});
    g.addEventListener('mousemove',e=>{tip.style.left=(e.clientX+14)+'px';tip.style.top=(e.clientY-8)+'px';});
    g.addEventListener('mouseleave',()=>tip.style.display='none');
    g.addEventListener('click',()=>TG.quickDepto(encodeURIComponent(name)));
  });
  const intl=A.paises.filter(p=>p.label!=='Colombia').reduce((s,p)=>s+p.n,0);
  el('mapNote').innerHTML=`${plotted} departamentos en mapa${fuera?` · ${fuera} sin ubicación precisa`:''}${intl?` · <b>${intl}</b> postulaciones internacionales`:''}.`;
}

/* ===================== BASE & CONTACTOS ===================== */
function uniq(arr){return [...new Set(arr.filter(Boolean))];}
function renderBase(){
  const rows=baseRows();
  const opt=(vals,sel)=>'<option value="">Todos</option>'+vals.map(v=>`<option ${v===sel?'selected':''}>${esc(v)}</option>`).join('');
  const src=A.portfolio;
  const html=`
  <div class="active-filter ${F.label?'show':''}" id="activeFilter">
    ${icon('filter','ic')}<span><b>Filtro activo:</b> ${esc(F.label||'')}</span>
    <button class="x" onclick="TG.clearFilter()">Quitar filtro</button>
  </div>
  <div class="filters">
    <div class="field"><label>Base</label><select id="fBase" onchange="TG.setBaseMode(this.value)">
      <option value="consolidado" ${baseMode==='consolidado'?'selected':''}>Depurada (sin duplicados)</option>
      <option value="historico" ${baseMode==='historico'?'selected':''}>Histórico completo</option></select></div>
    <div class="field"><label>Reporte</label><select id="fReporte" onchange="TG.setFilter('reporte',this.value)">${opt(uniq(A.rows.map(r=>r.reporte)),F.reporte)}</select></div>
    <div class="field"><label>Actor</label><select id="fActor" onchange="TG.setFilter('actor',this.value)">${opt(uniq(src.map(r=>r.actor)),F.actor)}</select></div>
    <div class="field"><label>Tipo</label><select id="fTipo" onchange="TG.setFilter('registroTipo',this.value)">${opt(uniq(src.map(r=>r.registroTipo)),F.registroTipo)}</select></div>
    <div class="field"><label>Avance</label><select id="fFlujo" onchange="TG.setFilter('flujo',this.value)">${opt(uniq(src.map(r=>r.flujoEstado)),F.flujo)}</select></div>
    <div class="field"><label>Estado fuente</label><select id="fEstado" onchange="TG.setFilter('estado',this.value)">${opt(uniq(src.map(r=>r.estado)),F.estado)}</select></div>
    <div class="field"><label>Prioridad</label><select id="fPrio" onchange="TG.setFilter('prio',this.value)">${opt(uniq(src.map(r=>r.prio)),F.prio)}</select></div>
    <div class="field"><label>Contacto</label><select id="fContacto" onchange="TG.setFilter('contacto',this.value)"><option value="">Todos</option><option ${F.contacto==='Con contacto'?'selected':''}>Con contacto</option><option ${F.contacto==='Sin contacto'?'selected':''}>Sin contacto</option></select></div>
    <div class="field"><label>Ruta</label><select id="fRuta" onchange="TG.setFilter('ruta',this.value)">${opt(uniq(src.map(r=>r.rutaShort)),F.ruta)}</select></div>
    <div class="field" style="flex:1;min-width:180px"><label>Buscar</label><input type="text" id="fSearch" placeholder="Empresa, persona, territorio, correo…" value="${esc(F.search)}" oninput="TG.setFilter('search',this.value)"></div>
    <button class="btn btn-ghost" onclick="TG.downloadFiltered()">${icon('upload')}Descargar CSV</button>
  </div>
  <div class="trl-field">
    <label>TRL · selecciona una o varias bandas</label>
    <div class="trl-chips">${A.trlBands.map(b=>`<button class="trl-chip ${F.trlBands.includes(b.label)?'on':''}" onclick="TG.toggleTrl('${encodeURIComponent(b.label)}')">${esc(b.label.split('·')[0].trim())} <b>${b.n}</b></button>`).join('')}${F.trlBands.length?`<button class="trl-chip clear" onclick="TG.clearTrl()">× limpiar TRL</button>`:''}</div>
  </div>
  <div class="card" style="padding:0">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--line)">
      <span class="t" style="font-weight:650">Registros <span id="baseCount" style="color:var(--mag);font-family:var(--font-mono);font-weight:500">· ${num(rows.length)}</span></span>
      <span class="t-sub">${baseMode==='consolidado'?'última aparición de cada registro':'todas las apariciones históricas'}</span>
    </div>
    <div class="tbl-wrap"><table class="data"><thead><tr>
      <th>Organización</th><th>Capa</th><th>Avance</th><th>Estado fuente</th><th>Contacto</th><th>Ruta</th><th>TRL</th><th>Género/2X</th><th>Tracción</th><th>Territorio</th><th>Corte</th><th></th>
    </tr></thead><tbody id="baseBody"></tbody></table></div>
  </div>`;
  el('pane-base').innerHTML=html;
  renderBaseBody(rows);
}
function baseRows(){return baseMode==='consolidado'?A.portfolio:A.rows;}
function applyFilters(rows){
  const f=F;
  return rows.filter(r=>{
    if(f.reporte && r.reporte!==f.reporte) return false;
    if(f.actor && r.actor!==f.actor) return false;
    if(f.registroTipo && r.registroTipo!==f.registroTipo) return false;
    if(f.flujo && r.flujoEstado!==f.flujo) return false;
    if(f.estado && r.estado!==f.estado) return false;
    if(f.prio && r.prio!==f.prio) return false;
    if(f.contacto==='Con contacto' && !r.contacto) return false;
    if(f.contacto==='Sin contacto' && r.contacto) return false;
    if(f.ruta && r.rutaShort!==f.ruta) return false;
    if(f.etapa && r.etapa!==f.etapa) return false;
    if(f.capital && r.capital!==f.capital) return false;
    if(f.genero && r.generoLider!==f.genero) return false;
    if(f.women2x==='cumple' && !(r.mujeresPct!=null && r.mujeresPct>=30)) return false;
    if(f.women2x==='noCumple' && !(r.mujeresPct!=null && r.mujeresPct<30)) return false;
    if(f.women2x==='conDato' && r.mujeresPct==null) return false;
    if(f.women2x==='sinDato' && ((r.mujeresPct!=null)||(r.mujeresDir&&r.mujeresDir!=='0'))) return false;
    if(f.mujRange){
      const v=r.mujeresPct; if(v==null) return false;
      if(f.mujRange==='0–10%' && !(v>=0&&v<10)) return false;
      if(f.mujRange==='10–20%' && !(v>=10&&v<20)) return false;
      if(f.mujRange==='20–30%' && !(v>=20&&v<30)) return false;
      if(f.mujRange==='30–50%' && !(v>=30&&v<50)) return false;
      if(f.mujRange==='50%+' && !(v>=50)) return false;
    }
    if(f.ventas==='ventas' && !r.ventasDeclaradas) return false;
    if(f.ventas==='ingresos2025' && !r.ingresos2025) return false;
    if(f.validacion==='si' && !(r.validacionTecnica&&r.validacionTecnica.length)) return false;
    if(f.innovacion==='si' && !(r.innovacion&&r.innovacion.length)) return false;
    if(f.genValor && !(r.generacionValor||[]).includes(f.genValor)) return false;
    if(f.depto && r.depto!==f.depto) return false;
    if(f.pais && r.pais!==f.pais) return false;
    if(f.trlBands && f.trlBands.length && !f.trlBands.includes(r.trlBand)) return false;
    if(f.contactClass==='completa' && !(r.contacto && r.estado==='Completa')) return false;
    if(f.contactClass==='incompletaContactable' && !(r.contacto && r.estado!=='Completa')) return false;
    if(f.contactClass==='sinContacto' && r.contacto) return false;
    if(f.completion==='completas' && r.estado!=='Completa') return false;
    if(f.completion==='incompletas' && r.estado==='Completa') return false;
    if(f.completion==='cambiaron' && !(A.changedUids&&A.changedUids.has(r.uid))) return false;
    if(f.transition==='any' && !(A.transitionUids&&A.transitionUids.has(r.uid))) return false;
    if(f.transition==='complete' && !(A.transitionCompleteUids&&A.transitionCompleteUids.has(r.uid))) return false;
    if(f.transition==='partial' && !(A.transitionPartialUids&&A.transitionPartialUids.has(r.uid))) return false;
    if(f.search){
      const q=f.search.toLowerCase();
      const blob=[r.org,r.persona,r.email,r.cel,r.depto,r.pais,r.sector,r.ruta,r.cargo,r.generoLider,r.capital,r.interes,r.etapa,r.trlBand,(r.generacionValor||[]).join(' ')].join(' ').toLowerCase();
      if(!blob.includes(q)) return false;
    }
    return true;
  });
}
let lastRows=[];
function renderBaseBody(rowsAll){
  const rows=applyFilters(rowsAll);
  if(F.completion==='cambiaron') rows.sort((a,b)=>(a.uid<b.uid?-1:a.uid>b.uid?1:0)||(a.orden-b.orden));
  lastRows=rows;
  const cnt=el('baseCount'); if(cnt) cnt.textContent=`· ${num(rows.length)}${rows.length!==rowsAll.length?' de '+num(rowsAll.length):''}`;
  const body=el('baseBody'); if(!body) return;
  if(!rows.length){body.innerHTML=`<tr><td colspan="12" class="empty-mini">Ningún registro coincide con el filtro.</td></tr>`;return;}
  body.innerHTML=rows.slice(0,600).map((r,i)=>`<tr>
    <td><div class="t-org">${esc(r.org||r.persona||'—')}</div>${r.persona&&r.org?`<div class="t-sub">${esc(r.persona)}${r.cargo?' · '+esc(r.cargo):''}</div>`:''}</td>
    <td><span class="badge b-info">${esc(r.actor||'—')}</span><div class="t-sub">${esc(r.registroTipo||'—')}</div></td>
    <td>${flujoBadge(r.flujoEstado)}</td>
    <td>${estadoBadge(r.estado)}</td>
    <td>${r.contacto?`<div class="t-mono">${r.email?esc(r.email):'<span class="t-sub">sin correo</span>'}</div>${r.cel?`<div class="t-mono t-sub">${esc(r.cel)}</div>`:''}`:'<span class="badge b-mut">sin información de contacto</span>'}</td>
    <td><span class="t-sub">${esc(r.rutaShort||'—')}</span></td>
    <td><span class="t-sub">${r.trlGroup&&r.trlGroup!=='nd'?esc(r.trlBand.split('·')[0].trim()):'—'}</span></td>
    <td><span class="t-sub">${esc(r.generoLider||'—')}${r.mujeresPct!=null?` · ${r.mujeresPct}%`:''}</span></td>
    <td><span class="t-sub">${r.ventasDeclaradas?'Ventas/tracción':(r.capital?'Busca capital':'—')}</span></td>
    <td><span class="t-sub">${esc([r.depto,r.pais].filter(Boolean).join(' · ')||'—')}</span></td>
    <td><span class="t-sub">${esc((r.reporte||'').split('·')[0].trim())}</span></td>
    <td><button class="btn btn-ghost" style="padding:6px 11px" onclick="TG.ficha(${i})">Ver</button></td>
  </tr>`).join('')+(rows.length>600?`<tr><td colspan="12" class="empty-mini">Mostrando 600 de ${num(rows.length)} · afina el filtro o descarga el CSV.</td></tr>`:'');
}
function estadoBadge(s){const m={'Completa':'b-good','Parcial':'b-warn','Sustantiva':'b-info','Solo consentimiento':'b-mut'};return `<span class="badge ${m[s]||'b-mut'}">${esc(s)}</span>`;}
function prioBadge(p){let c='b-mut';if(/completa|sustantiva/i.test(p))c='b-good';else if(/^alta/i.test(p))c='b-warn';else if(/sin canal/i.test(p))c='b-bad';return `<span class="badge ${c}">${esc(p)}</span>`;}
function flujoBadge(p){let c='b-mut';if(/postulación completa|interés completo|registro completo/i.test(p))c='b-good';else if(/incompleta|incompleto/i.test(p))c='b-warn';else if(/sin información de contacto/i.test(p))c='b-bad';return `<span class="badge ${c}">${esc(p||'—')}</span>`;}

TG.ficha=function(i){
  const r=lastRows[i]; if(!r) return;
  const row=(k,v)=>v?`<div class="modal-row"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`:'';
  openModal(`<div class="modal-pos"><button class="btn btn-ghost x" onclick="TG.closeModal()">Cerrar</button>
    <h3>${esc(r.org||r.persona||'Postulación')}</h3>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 16px">${estadoBadge(r.estado)}${prioBadge(r.prio)}${r.contacto?'<span class="badge b-info">contactable</span>':''}</div>
    ${row('Capa de actor', r.actor)}${row('Tipo de registro', r.registroTipo)}${row('Avance del embudo', r.flujoEstado)}${row('Persona', r.persona)}${row('Cargo', r.cargo)}
    ${row('Correo', r.email)}${row('Celular', r.cel)}
    ${row('Ruta', r.ruta)}${row('Sector', r.sector)}${row('Etapa', r.etapa)}${row('TRL declarado', r.trlGroup!=='nd'?r.trlBand:'')}
    ${row('Género líder', r.generoLider)}${row('% mujeres cargos directivos', r.mujeresPct!=null?r.mujeresPct+'%':'')}
    ${row('Ventas / tracción', r.ventasDeclaradas?'Sí, reporta ventas, ingresos, primeros clientes o pipeline comercial':'')}
    ${row('Ingresos 2025', r.ingresos2025)}${row('Tipo de generación de valor', (r.generacionValor||[]).join(' · '))}
    ${row('Validación técnica', (r.validacionTecnica||[]).join(' · '))}${row('Innovación', (r.innovacion||[]).join(' · '))}
    ${row('Capital buscado', r.capital)}${row('Interés de inversión', r.interes)}
    ${row('Territorio', [r.deptoRaw,r.paisRaw].filter(x=>x&&x!=='—').join(' · '))}
    ${row('Corte', r.reporte)}${row('Apariciones históricas', r.apariciones)}
    ${row('Reportes detectados', r.reportesDet)}
  </div>`);
};

/* ===================== FILTROS CLICABLES ===================== */
function go(partial,label){F=Object.assign(blank(),partial,{label});baseMode='consolidado';nav('base');renderBase();}
TG.quick=function(kind,val){
  if(kind==='all') return go({},'Todas las postulaciones');
  if(kind==='accionables'){F=Object.assign(blank(),{contacto:'Con contacto',label:'Listas para contactar (con calidad + canal)'});baseMode='consolidado';nav('base');renderBase();
    // afinar: solo calidad útil
    const rows=A.portfolio.filter(r=>r.contacto&&(r.estado==='Completa'||r.estado==='Parcial'||r.estado==='Sustantiva'));
    lastRows=rows; if(el('baseBody')) renderBaseBodyDirect(rows); return;}
  if(kind==='estado') return go({estado:val},'Estado · '+val);
  if(kind==='contacto') return go({contacto:val},'Contacto · '+val);
  if(kind==='capital') return go({},'Buscan inversión'), F.label='Buscan inversión';
};
function renderBaseBodyDirect(rows){const tmp=lastRows;lastRows=rows;const body=el('baseBody');if(!body)return;
  // reuse renderBaseBody markup by temporarily bypassing filters
  const saved=F.search;F.search='';renderBaseBody(rows);F.search=saved;}
TG.quickEstado=l=>go({estado:decodeURIComponent(l)},'Estado · '+decodeURIComponent(l));
TG.quickPrio=l=>go({prio:decodeURIComponent(l)},'Prioridad · '+decodeURIComponent(l));
TG.quickContact=l=>go({contacto:decodeURIComponent(l)},'Contacto · '+decodeURIComponent(l));
TG.quickRuta=l=>go({ruta:decodeURIComponent(l)},'Ruta · '+decodeURIComponent(l));
TG.quickSector=l=>go({search:decodeURIComponent(l)},'Sector · '+decodeURIComponent(l));
TG.quickEtapa=l=>go({etapa:decodeURIComponent(l)},'Etapa · '+decodeURIComponent(l));
TG.quickTrlBand=l=>go({trlBands:[decodeURIComponent(l)]},'TRL · '+decodeURIComponent(l).split('·')[0].trim());
TG.quickTrlGroup=g=>{const re=g==='ready'?/TRL [789]/:g==='validacion'?/TRL 4/:/TRL 1/;
  const bands=A.trlBands.filter(b=>re.test(b.label)).map(b=>b.label);
  const m={ready:'Investment Ready · TRL 7–9',validacion:'En validación · TRL 4–6',temprano:'Etapa temprana · TRL 1–3'};
  go({trlBands:bands},m[g]||'TRL');};
TG.toggleTrl=function(enc){const b=decodeURIComponent(enc);const i=F.trlBands.indexOf(b);
  if(i>=0)F.trlBands.splice(i,1);else F.trlBands.push(b);
  F.label='';el('activeFilter').classList.remove('show');renderBase();};
TG.clearTrl=function(){F.trlBands=[];F.label='';el('activeFilter').classList.remove('show');renderBase();};
TG.quickCompletion=function(kind){
  const m={completas:'Postulaciones completas',incompletas:'Faltan por completar (incompletas)',cambiaron:'Cambiaron de estado · incompleto → completo'};
  F=Object.assign(blank(),{completion:kind,label:m[kind]||''});
  baseMode = kind==='cambiaron' ? 'historico' : 'consolidado';
  nav('base'); renderBase();
};
TG.quickCapital=l=>go({capital:decodeURIComponent(l)},'Capital · '+decodeURIComponent(l));
TG.quickDepto=l=>go({depto:decodeURIComponent(l)},'Departamento · '+decodeURIComponent(l));
TG.quickPais=l=>go({pais:decodeURIComponent(l)},'País · '+decodeURIComponent(l));
TG.quickTrace=l=>{const lab=decodeURIComponent(l);go({},lab);};
TG.quickHeatCC=function(rk,ck){const estado=decodeURIComponent(rk),con=decodeURIComponent(ck);go({estado,contacto:con},`${estado} · ${con}`);};
TG.quickHeatRE=function(rk,ck){const ruta=decodeURIComponent(rk),etapa=decodeURIComponent(ck);go({ruta,etapa},`${ruta} · ${etapa}`);};

TG.quickActor=function(actorEnc, flujoEnc){
  const actor=decodeURIComponent(actorEnc); const flujo=flujoEnc?decodeURIComponent(flujoEnc):'';
  go({actor,flujo}, flujo?`${actor} · ${flujo}`:actor);
};
TG.quickActorClass=function(actorEnc, cls){
  const actor=decodeURIComponent(actorEnc);
  const map={completa:'completas',incompletaContactable:'incompletas pero contactables',sinContacto:'no es posible contactar'};
  go({actor,contactClass:cls}, `${actor} · ${map[cls]||cls}`);
};
TG.setResumenRep=function(v){ resumenRep=v||''; resumenActorClass=''; renderResumen(); document.querySelector('.main').scrollTo({top:0,behavior:'smooth'}); };
TG.setActorClass=function(v){ resumenActorClass = (v===resumenActorClass)?'':(v||''); renderActorFunnel(); };
TG.quickTransition=function(kind){
  const labels={any:'Startups que pasaron de interés a postulación',complete:'Startups que pasaron de interés a postulación completa',partial:'Startups que pasaron de interés a postulación incompleta'};
  F=Object.assign(blank(),{actor:'Startups y emprendimientos',transition:kind,label:labels[kind]||labels.any});
  baseMode='historico'; nav('base'); renderBase();
};


TG.quickGenero=l=>go({genero:decodeURIComponent(l)},'Género liderazgo · '+decodeURIComponent(l));
TG.quick2X=function(kind){
  const raw=decodeURIComponent(kind);
  let key=raw;
  if(/sin dato/i.test(raw)) key='sinDato';
  else if(/no cumple/i.test(raw)) key='noCumple';
  else if(/cumple/i.test(raw)) key='cumple';
  else if(/con dato|porcentaje/i.test(raw)) key='conDato';
  const map={cumple:'Cumplen criterio 2X',noCumple:'No cumplen criterio 2X',conDato:'Con porcentaje de mujeres en dirección',sinDato:'Sin dato suficiente de género/management'};
  go({women2x:key},map[key]||('2X · '+raw));
};
TG.quick2XRange=function(l){const lab=decodeURIComponent(l);go({mujRange:lab},'Rango mujeres dirección · '+lab);};
TG.quickVentas=kind=>go({ventas:kind},kind==='ingresos2025'?'Ingresos 2025 reportados':'Ventas o tracción declarada');
TG.quickValidation=()=>go({validacion:'si'},'Validación técnica / científica declarada');
TG.quickInnovation=()=>go({innovacion:'si'},'Innovación declarada');
TG.quickGenValor=l=>go({genValor:decodeURIComponent(l)},'Generación de valor · '+decodeURIComponent(l));


TG.quickPrimerCorte=function(){
  baseMode='historico'; nav('base'); renderBase();
  const rows=A.rows.filter(r=>/2026-05-25|Reporte 1 HTML|22505/i.test((r.reporte||'')+' '+(r.tipo||'')) && r.actor==='Startups y emprendimientos');
  F=Object.assign(blank(),{label:'Startups del primer corte de interés'});
  el('activeFilter').classList.add('show');
  el('activeFilter').querySelector('span').innerHTML=`<b>Filtro activo:</b> ${esc(F.label)}`;
  renderBaseBody(rows);
};
TG.quickRetoInicial=function(label){TG.quickPrimerCorte();};
TG.quickReport=function(repEnc,metric){
  const rep=decodeURIComponent(repEnc);const p={reporte:rep};let lab='Reporte · '+rep.split('·')[0].trim();
  baseMode='historico';
  if(metric==='Completa'){p.estado='Completa';lab+=' · completas';}
  else if(metric==='Parcial'){p.estado='Parcial';lab+=' · parciales';}
  else if(metric==='contacto'){p.contacto='Con contacto';lab+=' · contactables';}
  F=Object.assign(blank(),p,{label:lab});
  // nuevos/antes requieren campo esNuevo: filtramos manualmente
  nav('base');renderBase();
  if(metric==='nuevo'||metric==='antes'){
    const rows=A.rows.filter(r=>r.reporte===rep && (metric==='nuevo'?r.esNuevo:!r.esNuevo));
    F.label=lab+(metric==='nuevo'?' · nuevos':' · registrados antes');
    el('activeFilter').classList.add('show');
    el('activeFilter').querySelector('span').innerHTML=`<b>Filtro activo:</b> ${esc(F.label)}`;
    renderBaseBody(rows);
  }
};
TG.setFilter=function(k,v){F[k]=v;F.label='';el('activeFilter').classList.remove('show');renderBaseBody(baseRows());};
TG.clearFilter=function(){F=blank();renderBase();};
TG.setBaseMode=function(m){baseMode=m;renderBase();};
TG.downloadFiltered=function(){
  const rows=applyFilters(baseRows());
  if(!rows.length) return;
  const cols=['org','persona','cargo','email','cel','estado','prio','contacto','ruta','sector','etapa','trlBand','generoLider','mujeresPct','ventasDeclaradas','ingresos2025','capital','interes','depto','pais','reporte','apariciones'];
  const head=['Organizacion','Persona','Cargo','Email','Celular','Estado','Prioridad','Contactable','Ruta','Sector','Etapa','TRL','Genero_lider','Pct_mujeres_direccion','Ventas_o_traccion','Ingresos_2025','Capital','Interes_inversion','Departamento','Pais','Reporte','Apariciones'];
  const csv=[head.join(',')].concat(rows.map(r=>cols.map(c=>{
    let v=r[c]; if(c==='contacto')v=r.contacto?'Si':'No'; return '"'+String(v??'').replaceAll('"','""')+'"';
  }).join(','))).join('\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='tangara_base_filtrada.csv';a.click();URL.revokeObjectURL(a.href);
};

/* ===================== MODAL ===================== */
function openModal(html){el('modalBody').innerHTML=html;el('modal').classList.add('open');}
TG.closeModal=()=>el('modal').classList.remove('open');

/* ===================== GATE ===================== */
const ACCESS_HASH='614e8c1a14c147216b44ac3a129cb163f1a272936f839723027ca1c12b78b36a';
async function sha256(t){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function unlock(){document.body.classList.remove('locked');sessionStorage.setItem('tangara_ir_access','ok');boot();}
function initGate(){
  const input=el('accessInput'),btn=el('accessBtn'),err=el('accessError');
  async function check(){const h=await sha256((input.value||'').trim());if(h===ACCESS_HASH){err.classList.remove('show');input.value='';unlock();}else{err.classList.add('show');input.select();}}
  btn.addEventListener('click',check);
  input.addEventListener('keydown',e=>{if(e.key==='Enter')check();});
  setTimeout(()=>input.focus(),80);
}

/* ===================== BOOT ===================== */
TG.boot=boot;
function boot(){
  F=blank();
  const saved=sessionStorage.getItem(CSV_KEY);
  if(saved){try{A=TG.load(saved);}catch(e){A=null;}}
  setStatus(); renderAll();
}
window.addEventListener('DOMContentLoaded',()=>{
  // nav wiring
  SECTIONS.forEach(s=>el('nav-'+s).addEventListener('click',()=>nav(s)));
  el('topFile').addEventListener('change',onFile);
  el('btnClear').addEventListener('click',clearData);
  el('modal').addEventListener('click',e=>{if(e.target.id==='modal')TG.closeModal();});
  if(sessionStorage.getItem('tangara_ir_access')==='ok'){document.body.classList.remove('locked');boot();}
  else initGate();
});
})();
