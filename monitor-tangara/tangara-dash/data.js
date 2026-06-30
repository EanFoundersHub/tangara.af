/* ============================================================
   Tángara IR · data.js
   Parseo del CSV consolidado + extracción del campo `detalle`
   + agregaciones. Expone window.TG.
   ============================================================ */
(function(){
const TG = window.TG = window.TG || {};

/* ---------- CSV parser (maneja comillas y saltos) ---------- */
function parseCSV(text){
  text = text.replace(/^\ufeff/,''); // BOM
  const rows=[]; let row=[], cell='', q=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i], nx=text[i+1];
    if(q){
      if(ch==='"'&&nx==='"'){cell+='"';i++;}
      else if(ch==='"') q=false;
      else cell+=ch;
    }else{
      if(ch==='"') q=true;
      else if(ch===','){row.push(cell);cell='';}
      else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell='';}
      else if(ch!=='\r') cell+=ch;
    }
  }
  if(cell.length||row.length){row.push(cell);rows.push(row);}
  const headers=(rows.shift()||[]).map(h=>h.trim());
  return rows.filter(r=>r.length>1||(r[0]||'').trim()).map(r=>{
    const o={}; headers.forEach((h,i)=>o[h]=(r[i]||'').trim()); return o;
  });
}

/* ---------- helpers ---------- */
const yes = v => /^s/i.test(String(v||'').trim());     // "Sí"
function stripTags(s){return String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();}
function shorten(s,n){s=String(s||'');return s.length>n?s.slice(0,n-1).trim()+'…':s;}

/* Extrae un valor "Clave: <...>" del campo detalle (corta en " · ") */
function field(det, key){
  const re = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*:\\s*([\\s\\S]*?)(?:\\s·\\s|$)','i');
  const m = String(det||'').match(re);
  return m ? stripTags(m[1]) : '';
}

/* Ruta: el valor real va en <strong>…</strong>, resto es boilerplate */
function extractRuta(det){
  const m = String(det||'').match(/Ruta:\s*<strong>(.*?)<\/strong>/i);
  if(!m) return '';
  let r = stripTags(m[1]);
  return r.replace(/\s*\(.*$/,'').trim(); // corta el paréntesis explicativo
}
function rutaShort(r){
  if(!r) return '';
  if(/tecnolog/i.test(r)) return 'Tecnología climática';
  if(/agricultura/i.test(r)) return 'Agricultura sostenible';
  if(/naturaleza|SBN/i.test(r)) return 'Soluciones basadas en naturaleza';
  if(/circular/i.test(r)) return 'Economía circular';
  if(/bioeconom/i.test(r)) return 'Bioeconomía';
  return shorten(r,42);
}

/* Etapa / TRL → orden de madurez */
const ETAPA_ORDER = [
  ['Idea o validación inicial', /idea|validaci/i, 1],
  ['Prototipo o piloto', /prototipo|piloto/i, 2],
  ['Primeros clientes', /primeros clientes|clientes pagantes/i, 3],
  ['Ingresos recurrentes', /ingresos recurrentes|crecimi/i, 4],
];
function etapaNorm(e){
  if(!e||e==='—') return {label:'Sin declarar', order:0};
  for(const [label,re,order] of ETAPA_ORDER) if(re.test(e)) return {label,order};
  return {label:shorten(e,30), order:5};
}

/* Etapa declarada → banda TRL (madurez tecnológica / investment readiness) */
const TRL_MAP = [
  [/idea|validaci|concepto/i,                  {band:'TRL 1–3 · Concepto y validación',   order:1, group:'temprano'}],
  [/prototipo|piloto/i,                        {band:'TRL 4–6 · Prototipo / piloto',      order:2, group:'validacion'}],
  [/primeros clientes|clientes pagantes/i,     {band:'TRL 7–8 · Mercado inicial',         order:3, group:'ready'}],
  [/ingresos recurrentes|crecimi/i,            {band:'TRL 8–9 · Comercial y crecimiento', order:4, group:'ready'}],
  [/expandir|levanta|escala|escalad/i,         {band:'TRL 9 · Escala / lista para invertir', order:5, group:'ready'}],
];
function trlFromEtapa(e){
  if(!e||e==='—') return {band:'Sin declarar', order:0, group:'nd'};
  for(const [re,v] of TRL_MAP) if(re.test(e)) return v;
  return {band:'Otra etapa declarada', order:6, group:'otro'};
}

/* Capital → orden ascendente de monto */
const CAP_ORDER=[
  [/menos de.*100/i, 'Menos de USD 100k', 1],
  [/100\.000 y.*250/i, 'USD 100k–250k', 2],
  [/250\.000 y.*500/i, 'USD 250k–500k', 3],
  [/500\.000 y.*1/i, 'USD 500k–1M', 4],
  [/más de.*1|superior.*1\.000\.000/i, 'Más de USD 1M', 5],
];
function capNorm(c){
  if(!c) return {label:'', order:99};
  for(const [re,label,order] of CAP_ORDER) if(re.test(c)) return {label,order};
  return {label:shorten(c,24), order:50};
}

/* Estado normalizado → categoría de calidad */
function estadoCat(e){
  const s=String(e||'').toLowerCase();
  if(s.includes('completa') || s==='complete') return 'Completa';
  if(s.includes('parcial') || s==='partial') return 'Parcial';
  if(s.includes('sustantiva')) return 'Sustantiva';
  if(s.includes('consentimiento')) return 'Solo consentimiento';
  return e||'Otro';
}
/* Prioridad de seguimiento → bucket accionable */
function prioCat(p){
  const s=String(p||'').toLowerCase();
  if(s.includes('completa')||s.includes('sustantiva')) return 'Completa / sustantiva';
  if(s.startsWith('alta')) return 'Alta · parcial contactable';
  if(s.includes('no contactable')) return 'Sin canal de contacto';
  if(s.includes('consentimiento')) return 'Solo consentimiento';
  if(s.startsWith('baja')) return 'Baja · registro incompleto';
  return p||'Sin clasificar';
}

/* Clasificación de país a partir de pais + departamento (campos ruidosos:
   a veces traen ciudades colombianas, a veces países). */
function nrm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
const FOREIGN=[
  [/chile|quillota/,'Chile'],[/per[u]|lima|pucallpa|huanuco/,'Perú'],[/mexic|ciudad de m/,'México'],
  [/united states|estados unidos|\busa\b/,'Estados Unidos'],[/bolivia/,'Bolivia'],[/venezuela/,'Venezuela'],
  [/ecuador|quito|guayaquil/,'Ecuador'],[/argentin|jujuy|buenos aires/,'Argentina'],[/guatemala/,'Guatemala'],
  [/brasil|brazil/,'Brasil'],[/españa|espana|madrid/,'España'],
];
const CO_PLACES=['colombia','bogota','antioquia','valle','cundinamarca','santander','boyaca','meta','choco',
  'caqueta','putumayo','narino','cauca','huila','tolima','risaralda','caldas','quindio','cordoba','sucre',
  'bolivar','atlantico','magdalena','cesar','guajira','casanare','arauca','vichada','guaviare','amazonas',
  'vaupes','guainia','norte de santander','villavicencio','quibdo','florencia','palmira','barrancabermeja',
  'rionegro','cartagena','villagarzon','medellin','cali','pereira','manizales','armenia','tunja','ibague',
  'neiva','pasto','popayan','monteria','sincelejo','valledupar','riohacha','santa marta','bucaramanga','cucuta','yopal'];
function classifyCountry(paisRaw, deptoRaw){
  const blob=nrm(paisRaw)+' '+nrm(deptoRaw);
  if(blob.includes('alianza del pac')) { for(const [re,name] of FOREIGN) if(re.test(blob)) return name; return 'Alianza del Pacífico'; }
  for(const [re,name] of FOREIGN) if(re.test(blob)) return name;
  if(CO_PLACES.some(k=>blob.includes(k))) return 'Colombia';
  if(deptoRaw && deptoRaw!=='—' && !paisRaw) return 'Colombia'; // depto colombiano sin país
  return 'No especificado';
}
function deptoNorm(d){
  if(!d||d==='—') return '';
  return shorten(d.split(/[,(]/)[0].trim(),22);
}


/* ---------- lectura flexible de export completo Alchemer ---------- */
function rawVal(row, patterns){
  patterns = Array.isArray(patterns)?patterns:[patterns];
  for(const [k,v] of Object.entries(row||{})){
    if(!v) continue;
    if(patterns.some(re=>re.test(k))) return stripTags(v);
  }
  return '';
}
function rawAny(row, patterns){
  patterns = Array.isArray(patterns)?patterns:[patterns];
  const out=[];
  for(const [k,v] of Object.entries(row||{})){
    if(!v) continue;
    if(patterns.some(re=>re.test(k))) out.push(stripTags(v));
  }
  return out.filter(Boolean);
}
function pctNum(s){
  const m=String(s||'').replace(',','.').match(/-?\d+(?:\.\d+)?/);
  if(!m) return null;
  const v=parseFloat(m[0]);
  return Number.isFinite(v)?v:null;
}
function moneyNum(s){
  const cleaned=String(s||'').replace(/[^0-9,.-]/g,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.');
  const m=cleaned.match(/-?\d+(?:\.\d+)?/);
  if(!m) return null;
  const v=parseFloat(m[0]);
  return Number.isFinite(v)?v:null;
}
function normGen(g){
  const s=nrm(g);
  if(!s) return '';
  if(/mujer|femenin/.test(s)) return 'Mujer';
  if(/hombre|masculin/.test(s)) return 'Hombre';
  if(/otro|no bin|prefiero|divers/.test(s)) return 'Otro / no declara';
  return stripTags(g);
}
function cleanChoice(v){
  let s=stripTags(v).replace(/\s+/g,' ').trim();
  return shorten(s,70);
}


/* ---------- capas de actor y embudo ---------- */
function actorLayer(rol, row){
  const r=nrm(rol||'');
  if(/startup|postulaci|emprend/.test(r)) return 'Startups y emprendimientos';
  if(/inversion|inversor|financiador|fondo/.test(r)) return 'Inversionistas';
  if(/mentor|experto|asesor/.test(r)) return 'Mentores y expertos';
  if(/ecosistema|aliado|corporativo|universidad|camara|aceleradora|incubadora|entidad/.test(r)) return 'Aliados / ecosistema';
  const blob=nrm([row.organizacion, row.cargo_tipo, row.detalle].filter(Boolean).join(' '));
  if(/mentor|experto|asesor/.test(blob)) return 'Mentores y expertos';
  if(/inversion|inversor|financiador|fondo|venture|capital/.test(blob)) return 'Inversionistas';
  if(/ecosistema|aliado|corporativo|universidad|camara|aceleradora|incubadora|entidad|fundaci[oó]n|empresa ancla/.test(blob)) return 'Aliados / ecosistema';
  if(/startup|postulaci|emprend|fundador|lider/.test(blob)) return 'Startups y emprendimientos';
  return 'Sin clasificación de actor';
}
function sourceKind(tipo, rol){
  const blob=nrm([tipo, rol].filter(Boolean).join(' '));
  if(/csv alchemer crudo|postulaci/.test(blob)) return 'Postulación';
  return 'Manifestación de interés';
}
function workflowStatus(actor, kind, estado, contacto){
  if(!contacto) return 'Registro sin información de contacto';
  if(actor==='Startups y emprendimientos'){
    if(kind==='Postulación'){
      if(estado==='Completa') return 'Postulación completa';
      if(estado==='Parcial') return 'Postulación incompleta';
      if(estado==='Sustantiva') return 'Postulación con datos sustantivos';
      return 'Postulación sin clasificar';
    }
    if(estado==='Completa'||estado==='Sustantiva') return 'Interés completo';
    if(estado==='Parcial') return 'Interés incompleto';
    return 'Interés sin clasificar';
  }
  if(estado==='Completa'||estado==='Sustantiva') return 'Registro completo';
  if(estado==='Parcial') return 'Registro incompleto';
  return 'Registro sin clasificar';
}

/* ---------- normalización por fila ---------- */
function normalize(raw){
  return raw.map((r,idx)=>{
    const det=r.detalle||'';
    const etapaRaw = field(det,'Etapa') || rawVal(r,[/tlr_level/i,/etapa/i,/madurez/i]);
    const ruta=extractRuta(det) || rawVal(r,[/tipo_empresa/i,/ruta/i]);
    const sector=field(det,'Sector') || rawVal(r,[/vertical/i,/sector/i,/agri_subsector/i]);
    const etapa=etapaNorm(etapaRaw);
    const trl=trlFromEtapa(etapaRaw);
    const cap=capNorm(field(det,'Capital') || rawVal(r,[/monto_inversion/i,/capital buscado/i]));
    const interes=field(det,'Interés inversión') || rawVal(r,[/^interes_inversion$/i,/inter[eé]s.*invers/i]);
    const muj=field(det,'% mujeres dirección') || rawVal(r,[/^mujeres_direccion$/i]);
    const pctMuj = pctNum(rawVal(r,[/^porcentaje_cargos$/i,/porcentaje.*cargos/i]));
    const generoLider=normGen(rawVal(r,[/^sexo:emp1:emp1$/i,/g[eé]nero.*l[ií]der/i,/sexo/i]));
    const email=(r.email||rawVal(r,[/^email:emp1:emp1$/i,/^email$/i,/correo/i])||'').trim();
    const cel=(r.celular||rawVal(r,[/^cel:emp1:emp1$/i,/celular/i,/telefono|tel[eé]fono/i])||'').trim();
    const primeraVenta=rawVal(r,[/^primera_venta_solucion$/i,/primera.*venta/i]);
    const ingresos2023=rawVal(r,[/ingresos? 2023/i]);
    const ingresos2024=rawVal(r,[/ingresos? 2024/i]);
    const ingresos2025=rawVal(r,[/ingresos? 2025/i]);
    const proy2026=rawVal(r,[/proyecci[oó]n.*2026/i]);
    const genValor=rawAny(r,[/generacion_valor/i]);
    const validacion=rawAny(r,[/validacion_tecnica/i,/certificado_impacto/i,/regulkacion|regulacion/i,/pruebas avaladas/i]);
    const innovacion=rawAny(r,[/innovacion_01/i,/innovaci[oó]n/i]);
    const ingresosNums=[ingresos2023,ingresos2024,ingresos2025].map(moneyNum).filter(v=>v&&v>0);
    const ventasTxt=[primeraVenta,ingresos2025,ingresos2024,ingresos2023].filter(Boolean).join(' ');
    const ventasDeclaradas = ingresosNums.length>0 || /primeros clientes|clientes pagantes|ingresos recurrentes|ventas|pipeline comercial/i.test((etapaRaw||'')+' '+ventasTxt);
    const vehiculo=field(det,'Vehículo') || rawVal(r,[/veh[ií]culo/i,/vehicle/i]);
    const ticket=field(det,'Ticket') || rawVal(r,[/ticket/i]);
    const invSectores=field(det,'Sectores') || rawVal(r,[/sectores.*invers/i,/sectores/i]);
    const invEtapas=field(det,'Etapas') || rawVal(r,[/etapas.*invers/i,/etapas/i]);
    const invGeo=field(det,'Geografía') || rawVal(r,[/geograf/i,/pa[ií]ses.*invers/i]);
    const actorSubtipo=field(det,'Tipo') || rawVal(r,[/tipo.*entidad/i,/tipo.*actor/i]);
    const cobertura=field(det,'Cobertura') || rawVal(r,[/cobertura/i]);
    const colaboracion=field(det,'Aliado en') || field(det,'Interés') || rawVal(r,[/aliado.*en/i,/inter[eé]s/i,/colaboraci[oó]n/i]);
    const corpSector=field(det,'Sector') || rawVal(r,[/sector.*corporativo/i,/sector/i]);
    const pilotos=field(det,'Pilotos') || rawVal(r,[/pilotos/i]);
    const temas=field(det,'Temas') || rawVal(r,[/temas|retos|desaf[ií]os/i]);
    const experiencia=field(det,'Experiencia') || rawVal(r,[/experiencia/i]);
    const startupsApoyadas=field(det,'Startups apoyadas') || rawVal(r,[/startups.*apoyadas/i]);
    const areaMentor=field(det,'Área') || rawVal(r,[/[aá]rea/i]);
    const superpoder=field(det,'Superpoder') || rawVal(r,[/superpoder|fortaleza/i]);
    const org = r.organizacion || r.nombre_emp || r.empresa || rawVal(r,[/^nombre_emp$/i,/empresa|organizaci[oó]n|emprendimiento/i]);
    const persona = r.nombre || rawVal(r,[/^name:emp1:emp1$/i,/nombre.*emp/i,/contacto/i]);
    const cargo = r.cargo_tipo || rawVal(r,[/^cargo_empren:emp1$/i,/cargo/i]);
    const contactoFlag = yes(r.tiene_contacto) || !!(email||cel);
    const estadoN = estadoCat(r.estado_normalizado||r.Status||r.status_original);
    const actorN = actorLayer(r.rol||'', r);
    const kindN = sourceKind(r.tipo_fuente||'', r.rol||'');
    return {
      reporte:r.reporte_semana||r.reporte||'Carga directa CSV', fecha:r.fecha_reporte||r['Date Submitted']||r.fecha_envio||'', orden:+(r.orden_reporte||1),
      tipo:r.tipo_fuente||'CSV cargado', uid:r.registro_unico_id||r['Response ID']||r.response_id||String(idx+1),
      consolidado: r.usar_en_consolidado_sin_duplicados ? yes(r.usar_en_consolidado_sin_duplicados) : true,
      primer:r.primer_reporte_detectado||r.fecha_reporte||'', ultimo:r.ultimo_reporte_detectado||r.fecha_reporte||'',
      reportesDet:r.reportes_detectados||'', apariciones:+(r.conteo_apariciones_historicas||1),
      esNuevo: r.primer_reporte_detectado ? (r.primer_reporte_detectado||'')===(r.fecha_reporte||'') : true,
      estado:estadoN, estadoRaw:r.estado_normalizado||r.Status||r.status_original||'',
      prio:prioCat(r.prioridad_seguimiento), prioRaw:r.prioridad_seguimiento||'',
      contacto: contactoFlag,
      rol:r.rol||'', actor:actorN, registroTipo:kindN, flujoEstado:workflowStatus(actorN, kindN, estadoN, contactoFlag),
      persona, org, cargo, email, cel,
      pais:classifyCountry(r.pais||r.Pais||r.country,r.departamento||r.departamento_emprendimiento||r.ciudad),
      depto:deptoNorm(r.departamento||r.departamento_emprendimiento||r.ciudad),
      paisRaw:r.pais||'', deptoRaw:r.departamento||'',
      ruta, rutaShort:rutaShort(ruta), sector: sector && sector!=='—' ? shorten(sector,34) : '',
      etapa:etapa.label, etapaOrder:etapa.order, etapaRaw:etapaRaw||'',
      trlBand:trl.band, trlOrder:trl.order, trlGroup:trl.group,
      capital:cap.label, capitalOrder:cap.order, interes, mujeresDir:muj, mujeresPct:pctMuj, generoLider,
      primeraVenta, ingresos2023, ingresos2024, ingresos2025, proy2026, ventasDeclaradas,
      generacionValor:genValor.map(cleanChoice), validacionTecnica:validacion.map(cleanChoice), innovacion:innovacion.map(cleanChoice),
      fechaEnvio:r.fecha_envio||r['Date Submitted']||'', det,
      vehiculo, ticket, invSectores, invEtapas, invGeo, actorSubtipo, cobertura, colaboracion,
      corpSector, pilotos, temas, experiencia, startupsApoyadas, areaMentor, superpoder,
    };
  });
}

/* ---------- conteos ordenados ---------- */
function tally(rows, keyFn, {orderFn, drop=['',null,undefined]}={}){
  const m=new Map();
  rows.forEach(r=>{const k=keyFn(r); if(drop.includes(k))return; m.set(k,(m.get(k)||0)+1);});
  let arr=[...m.entries()].map(([label,n])=>({label,n}));
  if(orderFn) arr.sort((a,b)=>orderFn(a)-orderFn(b));
  else arr.sort((a,b)=>b.n-a.n);
  return arr;
}

/* ---------- agregación principal ---------- */
const META = 150;
function aggregate(rows){
  const portfolio = rows.filter(r=>r.consolidado);   // base depurada sin duplicados
  const N = portfolio.length;

  /* reportes ordenados */
  const repMap=new Map();
  rows.forEach(r=>{
    if(!r.reporte) return;
    if(!repMap.has(r.reporte)) repMap.set(r.reporte,{reporte:r.reporte,fecha:r.fecha,orden:r.orden,tipo:r.tipo,
      enArchivo:0,nuevos:0,antes:0,contactables:0,completas:0,parciales:0,sinContacto:0});
    const o=repMap.get(r.reporte);
    o.enArchivo++;
    if(r.esNuevo)o.nuevos++; else o.antes++;
    if(r.contacto)o.contactables++; else o.sinContacto++;
    if(r.estado==='Completa')o.completas++;
    if(r.estado==='Parcial')o.parciales++;
  });
  const reports=[...repMap.values()].sort((a,b)=>a.orden-b.orden);

  /* crecimiento neto acumulado (entrantes nuevos por reporte) */
  let cum=0;
  const growth=reports.map(rp=>{cum+=rp.nuevos;return {reporte:rp.reporte,fecha:rp.fecha,nuevos:rp.nuevos,acum:cum};});
  const lastNew = reports.length?reports[reports.length-1].nuevos:0;
  const prevNew = reports.length>1?reports[reports.length-2].nuevos:0;
  /* velocidad = promedio de nuevos por reporte (últimos hasta 3) */
  const recent=reports.slice(-3);
  const velocity = recent.length? recent.reduce((a,r)=>a+r.nuevos,0)/recent.length : 0;
  const totalNuevos = reports.reduce((a,r)=>a+r.nuevos,0);
  const faltan = Math.max(0, META - N);
  const semanasParaMeta = velocity>0 ? Math.ceil(faltan/velocity) : null;

  /* calidad sobre portfolio */
  const estados = tally(portfolio,r=>r.estado);
  const prioridades = tally(portfolio,r=>r.prio);
  const conContacto = portfolio.filter(r=>r.contacto).length;
  const completas = portfolio.filter(r=>r.estado==='Completa').length;
  const parciales = portfolio.filter(r=>r.estado==='Parcial').length;
  const accionables = portfolio.filter(r=>r.contacto && (r.estado==='Completa'||r.estado==='Parcial'||r.estado==='Sustantiva')).length;

  /* completitud y transiciones de estado por registro único (histgrico completo) */
  const faltanCompletar = N - completas;            // únicos sin estado completo
  const faltanContactables = portfolio.filter(r=>r.estado!=='Completa' && r.contacto).length; // incompletas con correo/celular
  const byUid=new Map();
  rows.forEach(r=>{ if(!r.uid) return; if(!byUid.has(r.uid)) byUid.set(r.uid,new Set()); byUid.get(r.uid).add(r.estado); });
  const changedUids=new Set();
  byUid.forEach((states,uid)=>{
    const hasComplete=states.has('Completa');
    const hasIncomplete=states.has('Parcial')||states.has('Sustantiva')||states.has('Solo consentimiento');
    if(hasComplete && hasIncomplete) changedUids.add(uid);
  });
  const changedState=changedUids.size;             // doble registro: incompleto → completo

  /* portafolio */
  const rutas = tally(portfolio,r=>r.rutaShort);
  const sectores = tally(portfolio,r=>r.sector);
  const etapas = tally(portfolio,r=>r.etapa,{orderFn:a=>{const f=portfolio.find(r=>r.etapa===a.label);return f?f.etapaOrder:9;}});
  /* TRL declarado (madurez tecnológica) */
  const trlDeclared = portfolio.filter(r=>r.trlGroup!=='nd');
  const trlBands = tally(trlDeclared,r=>r.trlBand,{orderFn:a=>{const f=trlDeclared.find(r=>r.trlBand===a.label);return f?f.trlOrder:9;}});
  const trlReady = portfolio.filter(r=>r.trlGroup==='ready').length;
  const trlValid = portfolio.filter(r=>r.trlGroup==='validacion').length;
  const trlEarly = portfolio.filter(r=>r.trlGroup==='temprano').length;
  const trlCov = trlDeclared.length;
  const capitales = tally(portfolio,r=>r.capital,{orderFn:a=>{const f=portfolio.find(r=>r.capital===a.label);return f?f.capitalOrder:99;}});
  const intereses = tally(portfolio,r=>r.interes);
  const buscanInv = portfolio.filter(r=>r.capital).length;

  /* género y 2X */
  const generoDist = tally(portfolio,r=>r.generoLider,{drop:['']});
  const mujeresPctRows = portfolio.filter(r=>r.mujeresPct!=null);
  const mujeresPctAvg = mujeresPctRows.length ? Math.round(mujeresPctRows.reduce((s,r)=>s+r.mujeresPct,0)/mujeresPctRows.length*10)/10 : null;
  const cumple2x = mujeresPctRows.filter(r=>r.mujeresPct>=30);
  const noCumple2x = mujeresPctRows.filter(r=>r.mujeresPct<30);
  const liderMujer = portfolio.filter(r=>r.generoLider==='Mujer');
  const mujeresDeclarado = portfolio.filter(r=>(r.mujeresDir&&r.mujeresDir!=='0') || r.mujeresPct!=null);
  const mujDist = tally(portfolio,r=>r.mujeresDir,{drop:['']});
  const pctRanges = [
    {label:'0–10%', test:v=>v>=0&&v<10}, {label:'10–20%', test:v=>v>=10&&v<20},
    {label:'20–30%', test:v=>v>=20&&v<30}, {label:'30–50%', test:v=>v>=30&&v<50},
    {label:'50%+', test:v=>v>=50}
  ].map(b=>({label:b.label,n:mujeresPctRows.filter(r=>b.test(r.mujeresPct)).length})).filter(x=>x.n);

  /* base de solución, tecnología, tracción */
  const ventasCount = portfolio.filter(r=>r.ventasDeclaradas).length;
  const ingresos2025Count = portfolio.filter(r=>moneyNum(r.ingresos2025)>0).length;
  const genValorItems=[]; portfolio.forEach(r=>(r.generacionValor||[]).forEach(v=>genValorItems.push({label:v})));
  const genValorDist = tally(genValorItems,r=>r.label);
  const validacionCount = portfolio.filter(r=>(r.validacionTecnica||[]).length).length;
  const innovacionCount = portfolio.filter(r=>(r.innovacion||[]).length).length;
  const baseSolucionCov = {
    ruta: portfolio.filter(r=>r.rutaShort).length, sector: portfolio.filter(r=>r.sector).length,
    etapa: portfolio.filter(r=>r.etapa&&r.etapa!=='Sin declarar').length,
    ventas: ventasCount, ingresos2025: ingresos2025Count,
    generacionValor: portfolio.filter(r=>(r.generacionValor||[]).length).length,
    validacion: validacionCount, innovacion: innovacionCount
  };


  /* capas del embudo por tipo de actor */
  const actorOrder=['Startups y emprendimientos','Inversionistas','Mentores y expertos','Aliados / ecosistema','Sin clasificación de actor'];
  const byActor = actorOrder.map(label=>{
    const rs=portfolio.filter(r=>r.actor===label);
    const isStart=label==='Startups y emprendimientos';
    const interest=rs.filter(r=>r.registroTipo==='Manifestación de interés');
    const post=rs.filter(r=>r.registroTipo==='Postulación');
    return {
      label, n:rs.length, contactables:rs.filter(r=>r.contacto).length, sinContacto:rs.filter(r=>!r.contacto).length,
      /* clasificación unificada de gestión por contacto + completitud */
      completasTot:rs.filter(r=>r.contacto && r.estado==='Completa').length,
      incompletasContactables:rs.filter(r=>r.contacto && r.estado!=='Completa').length,
      completos:rs.filter(r=>r.flujoEstado==='Registro completo').length,
      incompletos:rs.filter(r=>/incomplet[ao]/i.test(r.flujoEstado)).length,
      interesCompleto:interest.filter(r=>r.flujoEstado==='Interés completo'||r.flujoEstado==='Registro completo').length,
      interesIncompleto:interest.filter(r=>/incomplet[ao]/i.test(r.flujoEstado)).length,
      postulacionCompleta:post.filter(r=>r.flujoEstado==='Postulación completa').length,
      postulacionIncompleta:post.filter(r=>r.flujoEstado==='Postulación incompleta').length,
      isStart
    };
  }).filter(x=>x.n);
  const actorDist = byActor.map(x=>({label:x.label,n:x.n}));

  const transitionUids=new Set();
  const transitionCompleteUids=new Set();
  const transitionPartialUids=new Set();
  const byUidFlow=new Map();
  rows.forEach(r=>{ if(!r.uid) return; if(!byUidFlow.has(r.uid)) byUidFlow.set(r.uid,[]); byUidFlow.get(r.uid).push(r); });
  byUidFlow.forEach((rs,uid)=>{
    const hasInterest=rs.some(r=>r.actor==='Startups y emprendimientos' && r.registroTipo==='Manifestación de interés');
    const hasPost=rs.some(r=>r.actor==='Startups y emprendimientos' && r.registroTipo==='Postulación');
    if(hasInterest && hasPost){
      transitionUids.add(uid);
      if(rs.some(r=>r.registroTipo==='Postulación' && r.estado==='Completa')) transitionCompleteUids.add(uid);
      if(rs.some(r=>r.registroTipo==='Postulación' && r.estado==='Parcial')) transitionPartialUids.add(uid);
    }
  });

  /* territorio */
  const paises = tally(portfolio,r=>r.pais);
  const deptos = tally(portfolio,r=>r.depto);

  /* cobertura de campos ricos (solo ciertos cortes los traen) */
  const cov = {
    ruta: portfolio.filter(r=>r.rutaShort).length,
    sector: portfolio.filter(r=>r.sector).length,
    etapa: portfolio.filter(r=>r.etapa&&r.etapa!=='Sin declarar').length,
    capital: portfolio.filter(r=>r.capital).length,
    genero: portfolio.filter(r=>r.generoLider).length,
    mujeresPct: mujeresPctRows.length,
    mujeresDato: mujeresDeclarado.length,
  };

  /* correlaciones (heatmaps) */
  const heatCalidadContacto = heat(portfolio,
    ['Completa','Parcial','Sustantiva','Solo consentimiento'], r=>r.estado,
    ['Con contacto','Sin contacto'], r=>r.contacto?'Con contacto':'Sin contacto');
  // calidad por corte (poblado: usa todas las filas)
  const repShort = {}; reports.forEach(r=>{repShort[r.reporte]=(r.fecha||'').slice(5)+' · R'+r.orden;});
  const heatEstadoReporte = heat(rows.filter(r=>r.reporte),
    ['Completa','Parcial','Sustantiva','Solo consentimiento'], r=>r.estado,
    reports.map(r=>repShort[r.reporte]), r=>repShort[r.reporte]);

  return {
    META, N, faltan, pct: Math.round(N/META*100), pctCompl: N?Math.round(completas/N*100):0,
    reports, growth, lastNew, prevNew, velocity, totalNuevos, semanasParaMeta,
    histTotal: rows.length, uniqueTotal:N,
    estados, prioridades, conContacto, completas, parciales, accionables,
    faltanCompletar, faltanContactables, changedState, changedUids,
    rutas, sectores, etapas, capitales, intereses, buscanInv,
    trlBands, trlReady, trlValid, trlEarly, trlCov,
    conMuj:mujeresDeclarado.length, mujDist, generoDist, liderMujer:liderMujer.length,
    mujeresPctRows:mujeresPctRows.length, mujeresPctAvg, cumple2x:cumple2x.length, noCumple2x:noCumple2x.length, pctRanges,
    ventasCount, ingresos2025Count, genValorDist, validacionCount, innovacionCount, baseSolucionCov,
    paises, deptos,
    byActor, actorDist, transitionUids, transitionCompleteUids, transitionPartialUids,
    cov, heatCalidadContacto, heatEstadoReporte,
    portfolio, rows,
  };
}

function heat(rows, rowKeys, rowFn, colKeys, colFn){
  const grid = rowKeys.map(()=>colKeys.map(()=>0));
  let max=0;
  rows.forEach(r=>{
    const ri=rowKeys.indexOf(rowFn(r)), ci=colKeys.indexOf(colFn(r));
    if(ri>=0&&ci>=0){grid[ri][ci]++; if(grid[ri][ci]>max)max=grid[ri][ci];}
  });
  return {rowKeys,colKeys,grid,max};
}

TG.parseCSV = parseCSV;
TG.normalize = normalize;
TG.aggregate = aggregate;
TG.load = function(text){ return aggregate(normalize(parseCSV(text))); };
TG.META = META;
})();
