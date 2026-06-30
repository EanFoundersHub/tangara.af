/* ============================================================
   Tángara IR · charts.js — primitivas de render (vanilla)
   ============================================================ */
(function(){
const TG = window.TG = window.TG || {};

/* paleta de series (magenta de marca + semánticos espaciados) */
const SERIES = ['#EE46DD','#B65CE0','#5AA9F0','#3FD78D','#F6B53F','#F0664E','#8E7BE0','#49C5C0','#E08AD8','#9AD27A'];
TG.SERIES = SERIES;

const esc = TG.esc = s => String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const num = TG.num = n => Number(n||0).toLocaleString('es-CO');

/* ---------- iconos (stroke currentColor) ---------- */
const I = {
  home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  pulse:'<path d="M3 12h4l2-6 4 14 2-8h6"/>',
  dna:'<path d="M4 3c0 6 16 6 16 12M20 3c0 6-16 6-16 12"/><path d="M5 7h14M5 17h14"/>',
  map:'<path d="m9 4 6 2 6-2v14l-6 2-6-2-6 2V6z"/><path d="M9 4v14M15 6v14"/>',
  table:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16"/>',
  upload:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 20h16"/>',
  filter:'<path d="M3 5h18l-7 8v6l-4-2v-4z"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  up:'<path d="M12 19V5M6 11l6-6 6 6"/>',
  down:'<path d="M12 5v14M6 13l6 6 6-6"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  alert:'<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  spark:'<path d="m13 2-3 7h6l-3 7"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  users:'<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 6a3 3 0 0 1 0 6M21 20a6 6 0 0 0-3.5-5.5"/>',
  coins:'<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3"/><ellipse cx="15" cy="14" rx="6" ry="3"/><path d="M9 14.5V17c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/>',
};
TG.icon = (name,cls='ic')=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${I[name]||''}</svg>`;

/* ---------- KPI ---------- */
TG.kpi = function({label,value,sub,acc='',icon='',trend=null,action=''}){
  const clk = action?'clk':'';
  const onclick = action?` onclick="${action}"`:'';
  const filt = action?`<div class="filt">${TG.icon('filter','')}filtrar</div>`:'';
  const ic = icon?TG.icon(icon):'';
  let trendHtml='';
  if(trend){
    const dir = trend.dir||'flat';
    const ti = dir==='up'?'up':dir==='down'?'down':'';
    trendHtml=`<span class="trend ${dir}">${ti?TG.icon(ti,''):''}${esc(trend.text)}</span>`;
  }
  return `<div class="kpi ${acc} ${clk}"${onclick}>
    <div class="label">${ic}${esc(label)}</div>
    <div class="value">${value}</div>
    <div class="sub">${trendHtml||esc(sub||'')}</div>${filt}</div>`;
};

/* ---------- barras horizontales ---------- */
TG.bars = function(el, items, {action='', colorAt=null, suffixPct=false, total=0}={}){
  el = typeof el==='string'?document.getElementById(el):el;
  if(!el) return;
  if(!items.length){el.innerHTML='<div class="empty-mini">Sin datos en este corte.</div>';return;}
  const max=Math.max(1,...items.map(i=>i.n));
  const sum=total||items.reduce((a,i)=>a+i.n,0);
  el.innerHTML='<div class="bars">'+items.map((it,i)=>{
    const c = colorAt?colorAt(i,it):SERIES[i%SERIES.length];
    const w = Math.max(3, it.n/max*100);
    const pct = suffixPct&&sum?` <small>${Math.round(it.n/sum*100)}%</small>`:'';
    const onclick = action?` onclick="${action}('${encodeURIComponent(it.label)}')"`:'';
    return `<div class="bar-row ${action?'clk':''}"${onclick}>
      <div class="bar-lab" title="${esc(it.label)}">${esc(it.label)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${w}%;background:${c}"></div></div>
      <div class="bar-val">${num(it.n)}${pct}</div></div>`;
  }).join('')+'</div>';
};

/* ---------- donut (conic-gradient) ---------- */
TG.donut = function(el, items, {action='', centerLabel='', centerValue=null}={}){
  el = typeof el==='string'?document.getElementById(el):el;
  if(!el) return;
  const tot=items.reduce((a,i)=>a+i.n,0);
  if(!tot){el.innerHTML='<div class="empty-mini">Sin datos en este corte.</div>';return;}
  let deg=0; const stops=[];
  items.forEach((it,i)=>{const nd=deg+it.n/tot*360;stops.push(`${SERIES[i%SERIES.length]} ${deg}deg ${nd}deg`);deg=nd;});
  const cv = centerValue!=null?centerValue:num(tot);
  el.innerHTML=`<div class="donut-row">
    <div class="donut" style="background:conic-gradient(${stops.join(',')})">
      <div class="ctr"><b>${cv}</b><span>${esc(centerLabel||'total')}</span></div></div>
    <div class="legend">${items.map((it,i)=>{
      const onclick=action?` onclick="${action}('${encodeURIComponent(it.label)}')"`:'';
      return `<div class="leg ${action?'clk':''}"${onclick}>
        <span class="sw" style="background:${SERIES[i%SERIES.length]}"></span>
        <span class="ln" title="${esc(it.label)}">${esc(it.label)}</span>
        <b>${num(it.n)}</b><span class="pct">${Math.round(it.n/tot*100)}%</span></div>`;
    }).join('')}</div></div>`;
};

/* ---------- heatmap de correlación ---------- */
TG.heatmap = function(el, h, {action=''}={}){
  el = typeof el==='string'?document.getElementById(el):el;
  if(!el) return;
  if(!h.max){el.innerHTML='<div class="empty-mini">Sin datos suficientes para el cruce.</div>';return;}
  const cell=(v)=>{
    const t = v/h.max;
    // escala magenta sobre superficie
    const bg = v===0 ? 'var(--surface-2)' : `color-mix(in oklab, var(--mag) ${18+t*82}%, #1a0f24)`;
    const col = t>0.5?'#1a0418':'var(--text)';
    return {bg,col};
  };
  let html='<div class="heat"><table><thead><tr><th></th>'+
    h.colKeys.map(c=>`<th>${esc(c)}</th>`).join('')+'</tr></thead><tbody>';
  h.rowKeys.forEach((rk,ri)=>{
    html+=`<tr><th class="row-h" title="${esc(rk)}">${esc(rk)}</th>`;
    h.colKeys.forEach((ck,ci)=>{
      const v=h.grid[ri][ci]; const {bg,col}=cell(v);
      const onclick = (action&&v>0)?` onclick="${action}('${encodeURIComponent(rk)}','${encodeURIComponent(ck)}')"`:'';
      html+=`<td><div class="cell ${v===0?'zero':''}" style="background:${bg};color:${col}"${onclick} title="${esc(rk)} × ${esc(ck)}: ${v}">${v||'·'}</div></td>`;
    });
    html+='</tr>';
  });
  html+='</tbody></table></div><div class="heat-scale">menos<span class="grad"></span>más · color = nº de postulaciones</div>';
  el.innerHTML=html;
};

/* ---------- gauge de meta ---------- */
TG.metaGauge = function(el, a){
  el = typeof el==='string'?document.getElementById(el):el;
  if(!el) return;
  const wRec = Math.min(100, a.N/a.META*100);       // recibidos (únicos)
  const wCom = Math.min(100, a.completas/a.META*100);// completas
  el.innerHTML=`<div class="meta-wrap">
    <div class="meta-top">
      <div class="meta-num"><b>${a.completas}</b><span>/ ${a.META} completas</span></div>
      <div style="text-align:right">
        <div style="font-family:var(--font-display);font-size:1.6rem;font-weight:700;letter-spacing:-.02em">${a.pctCompl}%</div>
        <div style="color:var(--faint);font-size:.78rem">${a.N} recibidas · ${a.faltanCompletar} por completar</div>
      </div>
    </div>
    <div class="meta-track">
      <div class="meta-fill recv" style="width:${wRec}%"></div>
      <div class="meta-fill" style="width:${wCom}%"></div>
    </div>
    <div class="meta-ticks"><span>0</span><span>50</span><span>100</span><span>150 · meta</span></div>
    <div class="meta-legend">
      <span><i style="background:var(--mag)"></i>Completas ${a.completas}</span>
      <span><i style="background:var(--mag-3)"></i>Recibidas ${a.N}</span>
      <span><i style="background:var(--good)"></i>Cambiaron de estado ${a.changedState}</span>
    </div>
  </div>`;
};

/* ---------- curva acumulada (SVG) ---------- */
TG.cumChart = function(el, growth, meta){
  el = typeof el==='string'?document.getElementById(el):el;
  if(!el) return;
  if(growth.length<1){el.innerHTML='<div class="empty-mini">Sin reportes.</div>';return;}
  const W=560,H=170,padL=34,padR=16,padT=16,padB=30;
  const maxY=Math.max(meta, ...growth.map(g=>g.acum));
  const pts=growth.map((g,i)=>{
    const x=padL+(growth.length===1?0.5:i/(growth.length-1))*(W-padL-padR);
    const y=H-padB-(g.acum/maxY)*(H-padT-padB);
    return {x,y,g};
  });
  const line=pts.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area=`${line} L${pts[pts.length-1].x.toFixed(1)} ${H-padB} L${pts[0].x.toFixed(1)} ${H-padB} Z`;
  const ty=H-padB-(meta/maxY)*(H-padT-padB);
  const gy=[0,Math.round(maxY/2),maxY];
  el.innerHTML=`<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <defs><linearGradient id="magGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#EE46DD" stop-opacity=".34"/><stop offset="1" stop-color="#EE46DD" stop-opacity="0"/>
    </linearGradient></defs>
    ${gy.map(v=>{const y=H-padB-(v/maxY)*(H-padT-padB);return `<line class="grid" x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}"/><text class="lbl" x="6" y="${y+3}">${v}</text>`;}).join('')}
    <line class="target" x1="${padL}" y1="${ty}" x2="${W-padR}" y2="${ty}"/>
    <text class="lbl" x="${W-padR}" y="${ty-5}" text-anchor="end" style="fill:var(--good)">meta ${meta}</text>
    <path class="area" d="${area}"/><path class="line" d="${line}"/>
    ${pts.map(p=>`<circle class="dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.4"/>`).join('')}
    ${pts.map(p=>`<text class="lbl" x="${p.x.toFixed(1)}" y="${H-10}" text-anchor="middle">${esc((p.g.fecha||'').slice(5))}</text>`).join('')}
  </svg>`;
};

/* ---------- insight ---------- */
TG.insight = ({kind='info',icon='spark',title,body})=>
  `<div class="insight ${kind}">${TG.icon(icon)}<div><b>${esc(title)}</b><p>${body}</p></div></div>`;

})();
