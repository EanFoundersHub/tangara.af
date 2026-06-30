/* ============================================================
   Tángara IR · maps.js — Colombia proyectada desde coordenadas
   geográficas reales (borde + centroides departamentales).
   Mercator simple → encaja en cualquier viewBox y los puntos
   caen automáticamente en su lugar.
   ============================================================ */
(function(){
const TG = window.TG = window.TG || {};

/* Borde nacional aproximado [lng,lat], en orden horario desde la
   península de La Guajira (NE). ~45 vértices: suficiente para que
   se lea claramente como Colombia. */
const CO_BORDER = [
  [-71.66,12.46],[-72.45,11.75],[-73.35,11.30],[-74.20,11.25],[-74.85,11.10],
  [-75.53,10.40],[-75.70,9.45],[-76.20,9.00],[-76.75,8.65],[-77.30,8.05],
  [-77.90,7.23],[-77.67,6.50],[-77.36,5.60],[-77.30,4.80],[-77.50,4.05],
  [-77.62,3.10],[-78.20,2.55],[-78.85,1.80],
  [-78.00,0.95],[-77.10,0.42],[-76.30,0.40],[-75.30,-0.10],
  [-74.80,-0.55],[-73.20,-1.80],[-71.80,-2.30],[-70.70,-3.80],[-69.95,-4.22],
  [-69.40,-1.40],[-69.85,-0.60],[-69.80,0.60],[-69.30,1.05],[-69.80,1.75],
  [-68.20,1.80],[-67.30,2.05],[-66.88,1.22],
  [-67.40,2.85],[-67.82,3.38],[-67.30,4.10],[-67.45,6.19],
  [-69.45,6.10],[-70.10,6.95],[-71.10,7.05],[-72.05,7.38],[-72.45,8.05],
  [-72.95,9.20],[-72.75,10.70],[-71.30,11.55],
];

/* centroides departamentales [lng,lat] */
const CO_DEPTS = {
  'bogota':[-74.08,4.66],'cundinamarca':[-74.30,4.95],'antioquia':[-75.55,6.85],
  'valle':[-76.40,3.80],'atlantico':[-74.90,10.70],'bolivar':[-74.60,9.20],
  'magdalena':[-74.20,10.30],'guajira':[-72.30,11.40],'cesar':[-73.55,9.50],
  'norte de santander':[-72.65,8.05],'santander':[-73.20,6.95],'boyaca':[-73.10,5.60],
  'risaralda':[-75.85,5.10],'caldas':[-75.45,5.30],'quindio':[-75.68,4.50],
  'tolima':[-75.25,4.20],'huila':[-75.55,2.70],'cauca':[-76.80,2.40],
  'narino':[-77.60,1.40],'putumayo':[-76.20,0.70],'caqueta':[-74.80,1.20],
  'meta':[-73.20,3.70],'casanare':[-72.00,5.40],'arauca':[-70.90,6.70],
  'vichada':[-69.50,4.80],'guaviare':[-72.40,2.10],'guainia':[-68.50,2.80],
  'vaupes':[-70.50,0.90],'amazonas':[-71.50,-2.60],'choco':[-76.90,5.90],
  'cordoba':[-75.90,8.40],'sucre':[-75.10,9.20],'risaralda2':[-75.85,5.10],
};

function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function mercX(lng){return lng*Math.PI/180;}
function mercY(lat){return Math.log(Math.tan(Math.PI/4 + lat*Math.PI/360));}
/* construye path + proyector para un viewBox dado */
TG.buildColombia = function(W,H,pad){
  const xs=CO_BORDER.map(p=>mercX(p[0])), ys=CO_BORDER.map(p=>mercY(p[1]));
  const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
  const dx=maxX-minX, dy=maxY-minY;
  const s=Math.min((W-2*pad)/dx,(H-2*pad)/dy);
  const offX=(W-s*dx)/2, offY=(H-s*dy)/2;
  const project=([lng,lat])=>[offX+(mercX(lng)-minX)*s, offY+(maxY-mercY(lat))*s];
  const path='M'+CO_BORDER.map(c=>project(c).map(n=>n.toFixed(1)).join(' ')).join(' L')+' Z';
  function deptXY(name){
    const n=norm(name);
    for(const k in CO_DEPTS){ if(n.includes(k.replace(/\d$/,''))) return project(CO_DEPTS[k]); }
    if(n.includes('bogot')) return project(CO_DEPTS['bogota']);
    return null;
  }
  return {path, project, deptXY, W, H};
};
})();
