/*═══════════════════════════════════════════════════════
  SIEMBRA DE ARROZ – UNP Ingeniería Informática 2026-1
  Archivo: assets/js/game.js
  Descripción: Lógica principal del juego (Canvas, niveles,
               puntuación, ranking y conexión con backend).
═══════════════════════════════════════════════════════*/

const cv = document.getElementById('gameCanvas');
const c  = cv.getContext('2d');
const W  = cv.width, H = cv.height;

/* ── Imágenes (reemplaza URLs por tus fotos locales) ──
   Ejemplo: loadImg('bg1','assets/img/campo_chira.jpg')
─────────────────────────────────────────────────────── */
const IM = {};
function loadImg(k, u) {
  IM[k] = new Image();
  IM[k].crossOrigin = 'anonymous';
  IM[k].src = u;
}
loadImg('bg1', 'assets/img/campo_chira.jpg')
loadImg('bg2', 'assets/img/campo_inundado.jpg')
loadImg('person', 'assets/img/personajes/campesino.png')


/*════════════════════════════════════════════════════
  DEFINICIÓN DE PIEZAS Y CONEXIONES
  ─────────────────────────────────────────────────
  Tipos de pieza:
    H   ─   bocas E y W              (horizontal)
    V   │   bocas N y S              (vertical)
    LR  └   bocas N y E              (curva ↑→)
    LL  ┘   bocas N y W              (curva ↑←)
    UL  ┌   bocas S y E              (curva ↓→)
    UR  ┐   bocas S y W              (curva ↓←)
    TE  ├   bocas N, S, E            (T hacia derecha)
    TW  ┤   bocas N, S, W            (T hacia izquierda)
    TN  ┴   bocas N, E, W            (T hacia arriba)
    TS  ┬   bocas S, E, W            (T hacia abajo)
    X   +   bocas N, S, E, W         (cruce)
════════════════════════════════════════════════════ */

const CONEX = {
  H:['E','W'],  V:['N','S'],
  LR:['N','E'], LL:['N','W'], UL:['S','E'], UR:['S','W'],
  TE:['N','S','E'], TW:['N','S','W'],
  TN:['N','E','W'], TS:['S','E','W'],
  X:['N','S','E','W']
};
const OPP = {N:'S', S:'N', E:'W', W:'E'};

function nbr(r, c, d) {
  return d==='N'?[r-1,c] : d==='S'?[r+1,c] : d==='E'?[r,c+1] : [r,c-1];
}

/*════════════════════════════════════════════════════
  GENERACIÓN PROCEDURAL DEL MAPA (Nivel 1)
  ─────────────────────────────────────────────────
  1. Fuentes en col 0 (filas 1 y 4)
  2. Parcelas en col GW-1 (todas las filas)
  3. Random-walk dirigido hacia la derecha
  4. ~22% de celdas del camino se marcan FIJAS (pista)
  5. Resto de celdas = LIBRE (el jugador coloca piezas)
  6. 4-5 rocas en celdas fuera del camino de solución
  7. Inventario SIEMPRE con todos los tipos garantizados
════════════════════════════════════════════════════ */

const GW = 10, GH = 6;  // 10 columnas × 6 filas
const CS = 72;           // tamaño de celda en px
const OX = 8, OY = 32;  // offset en el canvas

let grid = [], inv = {}, sel = null;
let flujoSet = new Set(), parcsOk = 0, parcsTotal = 0;
let parts = [], tick = 0;
let hovR = -1, hovC = -1;
let flashMsg = '', flashT = 0;
let solucionCeldas = new Set();

/* ── Genera el mapa aleatorio con solución garantizada ── */
function generarMapa() {
  grid = [];
  for (let r = 0; r < GH; r++) {
    grid[r] = [];
    for (let cc = 0; cc < GW; cc++)
      grid[r][cc] = {tipo:'LIBRE', pieza:null, agua:0};
  }
  solucionCeldas = new Set();

  // Col 0: filas vacías excepto fuentes en 1 y 4
  for (let r = 0; r < GH; r++) grid[r][0] = {tipo:'VACIA', pieza:null, agua:0};
  grid[1][0] = {tipo:'FUENTE', pieza:'H', agua:0};
  grid[4][0] = {tipo:'FUENTE', pieza:'H', agua:0};

  // Col GW-1: parcelas en todas las filas
  parcsTotal = 0;
  for (let r = 0; r < GH; r++) {
    grid[r][GW-1] = {tipo:'PARCELA', pieza:null, agua:0};
    parcsTotal++;
  }

  // Trazar caminos desde cada fuente
  const caminos = [];
  caminos.push(...trazarCamino(1, 0, 'E'));
  caminos.push(...trazarCamino(4, 0, 'E'));

  for (const [r, cc, _p] of caminos) solucionCeldas.add(r+','+cc);

  const piezasCamino = calcularPiezasCamino(caminos);

  // Colocar celdas: ~22% FIJAS, resto LIBRE
  for (const [r, cc, pieza] of piezasCamino) {
    if (r===0 && cc===0) continue;
    if (grid[r][cc].tipo==='FUENTE' || grid[r][cc].tipo==='PARCELA') continue;
    const esSimple = ['H','V','TE','TW','TN','TS'].includes(pieza);
    if (esSimple && Math.random() < 0.22) {
      grid[r][cc] = {tipo:'FIXED', pieza, agua:0};
    } else {
      grid[r][cc] = {tipo:'LIBRE', pieza:null, agua:0};
    }
  }

  // Colocar 4-5 rocas fuera del camino
  let rocasColocadas = 0;
  const celdas = [];
  for (let r = 0; r < GH; r++) for (let cc = 1; cc < GW-1; cc++) {
    if (!solucionCeldas.has(r+','+cc) && grid[r][cc].tipo==='LIBRE')
      celdas.push([r, cc]);
  }
  shuffle(celdas);
  for (const [r, cc] of celdas) {
    if (rocasColocadas >= 5) break;
    grid[r][cc] = {tipo:'ROCA', pieza:null, agua:0};
    rocasColocadas++;
  }

  // Calcular inventario base desde la solución
  inv = {};
  for (const [r, cc, pieza] of piezasCamino) {
    if (grid[r][cc].tipo==='FIXED' || grid[r][cc].tipo==='FUENTE' ||
        grid[r][cc].tipo==='PARCELA') continue;
    if (grid[r][cc].tipo==='LIBRE' && !grid[r][cc].pieza) {
      inv[pieza] = (inv[pieza]||0) + 1;
    }
  }
  // Redondear hacia arriba con margen
  for (const k of Object.keys(inv)) inv[k] = Math.ceil(inv[k] * 1.35) + 1;

  // ── GARANTÍA FIJA: TODOS los tipos siempre disponibles ──
  // (evita que el jugador se quede sin pieza T o curva necesaria)
  for (const tipo of Object.keys(NOMBRES)) {
    inv[tipo] = Math.max(inv[tipo] || 0, 3);
  }
  for (const tipo of ['TE','TW','TN','TS','X']) {
    inv[tipo] = Math.max(inv[tipo], 4);
  }

  return inv;
}

/* ── Random walk hacia la derecha ── */
function trazarCamino(startR, startC, _dirInit) {
  const path = [[startR, startC, 'FUENTE']];
  const visited = new Set([startR+','+startC]);
  let r = startR, cc = startC;

  while (cc < GW-1) {
    const opts = [];
    opts.push({d:'E', r, c:cc+1, w:60});
    if (r > 0 && Math.random() < 0.35) opts.push({d:'N', r:r-1, c:cc, w:20});
    if (r < GH-1 && Math.random() < 0.35) opts.push({d:'S', r:r+1, c:cc, w:20});

    const validas = opts.filter(o => {
      if (o.r < 0 || o.r >= GH || o.c < 0 || o.c >= GW-1) return false;
      if (visited.has(o.r+','+o.c)) return false;
      const cel = grid[o.r][o.c];
      if (cel.tipo==='VACIA' || cel.tipo==='FUENTE' || cel.tipo==='PARCELA') return false;
      return true;
    });

    if (!validas.length) {
      if (cc+1 <= GW-1) { path.push([r, cc+1, 'E']); visited.add(r+','+(cc+1)); cc = cc+1; }
      else break;
      continue;
    }

    const total = validas.reduce((s, o) => s+o.w, 0);
    let rnd = Math.random() * total;
    let chosen = validas[0];
    for (const o of validas) { rnd -= o.w; if (rnd <= 0) { chosen = o; break; } }

    path.push([chosen.r, chosen.c, chosen.d]);
    visited.add(chosen.r+','+chosen.c);
    r = chosen.r; cc = chosen.c;
  }

  if (cc === GW-1) solucionCeldas.add(r+','+(GW-1));
  return path;
}

/* ── Calcular qué pieza va en cada celda del camino ── */
function calcularPiezasCamino(caminos) {
  const bocas = {};
  for (let i = 0; i < caminos.length; i++) {
    const seg = caminos[i];
    const [r, cc, desde] = seg;
    if (desde === 'FUENTE') continue;
    const key = r+','+cc;
    if (!bocas[key]) bocas[key] = new Set();
    bocas[key].add(OPP[desde]);
    const sig = caminos[i+1];
    if (sig) {
      const [nr, nc, nextDir] = sig;
      if (nextDir !== 'FUENTE') {
        const mv = nr===r ? (nc>cc?'E':'W') : (nr>r?'S':'N');
        bocas[key].add(mv);
      }
    }
    if (cc === GW-2) bocas[key].add('E');
  }

  const result = [];
  for (const [key, bset] of Object.entries(bocas)) {
    const [r, cc] = key.split(',').map(Number);
    if (grid[r][cc].tipo==='FUENTE' || grid[r][cc].tipo==='PARCELA') continue;
    const bs = Array.from(bset).sort().join(',');
    const pieza = bocasAPieza(bs) || 'H';
    result.push([r, cc, pieza]);
  }
  return result;
}

function bocasAPieza(bs) {
  const m = {
    'E,W':'H',   'N,S':'V',
    'E,N':'LR',  'N,W':'LL',  'E,S':'UL',  'S,W':'UR',
    'E,N,S':'TE','N,S,W':'TW','E,N,W':'TN','E,S,W':'TS',
    'E,N,S,W':'X'
  };
  return m[bs] || 'H';
}

function shuffle(a) {
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/*════════════════════════════════════════════════
  SETUP NIVEL 1
════════════════════════════════════════════════ */
function setupN1() {
  generarMapa();
  sel = null; parts = []; tick = 0; parcsOk = 0;
  buildinv();
  show('invPanel'); show('leyenda');
  document.getElementById('hudExtra').textContent = 'Parcelas: 0/'+parcsTotal+' (meta: 4)';
  cv.style.cursor = 'pointer';
}

/* ── BFS de flujo de agua ── */
function calcFlujo() {
  const vis = new Set(), cola = [];
  for (let r = 0; r < GH; r++) {
    if (grid[r][0].tipo==='FUENTE') { vis.add(r+',0'); cola.push([r, 0]); }
  }
  flujoSet = new Set(); parcsOk = 0;
  while (cola.length) {
    const [r, cc] = cola.shift();
    const cel = grid[r][cc];
    if (cel.tipo==='ROCA') continue;
    flujoSet.add(r+','+cc);
    if (cel.tipo==='PARCELA') { parcsOk++; continue; }
    const dirs = cel.pieza ? CONEX[cel.pieza] : (cel.tipo==='FUENTE'?['E']:[]);
    for (const d of dirs) {
      const [nr, nc] = nbr(r, cc, d);
      const k = nr+','+nc;
      if (nr<0||nr>=GH||nc<0||nc>=GW||vis.has(k)) continue;
      const ncel = grid[nr][nc];
      if (ncel.tipo==='ROCA') continue;
      if (ncel.tipo==='PARCELA') { vis.add(k); cola.push([nr,nc]); continue; }
      if (ncel.pieza && CONEX[ncel.pieza].includes(OPP[d])) { vis.add(k); cola.push([nr,nc]); }
    }
  }
  // Animación de agua
  for (let r = 0; r < GH; r++) for (let cc = 0; cc < GW; cc++) {
    const f = flujoSet.has(r+','+cc) ? 1 : 0;
    const cel = grid[r][cc];
    if (f > cel.agua) cel.agua = Math.min(1, cel.agua+0.06);
    else              cel.agua = Math.max(0, cel.agua-0.08);
  }
  G.pts1 = parcsOk * 30; G.pts = G.pts1;
  document.getElementById('hudPts').textContent = G.pts;
  const meta = parcsOk>=4 ? '✅ META!' : '(meta: 4)';
  document.getElementById('hudExtra').textContent = `Parcelas: ${parcsOk}/${parcsTotal} ${meta}`;
}

/* ── Partículas de agua ── */
function spawnParts() {
  tick++;
  for (let r = 0; r < GH; r++) for (let cc = 0; cc < GW; cc++) {
    if (!flujoSet.has(r+','+cc)) continue;
    const cel = grid[r][cc];
    if (cel.agua < 0.4 || Math.random() > .16) continue;
    const dirs = cel.pieza ? CONEX[cel.pieza] : (cel.tipo==='FUENTE'?['E']:[]);
    if (!dirs.length) continue;
    const d = dirs[tick % dirs.length];
    const vm = {N:[0,-1.5], S:[0,1.5], E:[1.5,0], W:[-1.5,0]};
    const [vx, vy] = vm[d] || [0,0];
    parts.push({
      x: OX+cc*CS+CS/2+(Math.random()-.5)*9,
      y: OY+r*CS+CS/2+(Math.random()-.5)*9,
      vx: vx+(Math.random()-.5)*.5,
      vy: vy+(Math.random()-.5)*.5,
      v: 24+Math.random()*16,
      r: 2+Math.random()*2.2
    });
  }
  parts.forEach(p => { p.x += p.vx; p.y += p.vy; p.v--; });
  parts = parts.filter(p => p.v > 0).slice(-280);
}

/* ── Dibuja un segmento de tubería ── */
function drawPipe(px, py, pieza, fill, stroke, sz) {
  sz = sz || CS;
  const hw = sz*.24, mg = sz*.07;
  const mx = px+sz/2, my = py+sz/2;
  const con = CONEX[pieza] || [];
  c.fillStyle = fill;
  c.fillRect(mx-hw, my-hw, hw*2, hw*2);
  if (con.includes('N')) c.fillRect(mx-hw, py+mg,  hw*2, my-hw-(py+mg));
  if (con.includes('S')) c.fillRect(mx-hw, my+hw,  hw*2, (py+sz-mg)-(my+hw));
  if (con.includes('E')) c.fillRect(mx+hw, my-hw, (px+sz-mg)-(mx+hw), hw*2);
  if (con.includes('W')) c.fillRect(px+mg, my-hw,  mx-hw-(px+mg), hw*2);
  if (stroke) {
    c.strokeStyle = stroke; c.lineWidth = 1;
    const o = hw + .8;
    c.beginPath();
    if (con.includes('N')) { c.moveTo(mx-o,my-hw); c.lineTo(mx-o,py+mg); c.moveTo(mx+o,my-hw); c.lineTo(mx+o,py+mg); }
    if (con.includes('S')) { c.moveTo(mx-o,my+hw); c.lineTo(mx-o,py+sz-mg); c.moveTo(mx+o,my+hw); c.lineTo(mx+o,py+sz-mg); }
    if (con.includes('E')) { c.moveTo(mx+hw,my-o); c.lineTo(px+sz-mg,my-o); c.moveTo(mx+hw,my+o); c.lineTo(px+sz-mg,my+o); }
    if (con.includes('W')) { c.moveTo(mx-hw,my-o); c.lineTo(px+mg,my-o); c.moveTo(mx-hw,my+o); c.lineTo(px+mg,my+o); }
    c.stroke();
  }
}

/* ── Dibujo completo Nivel 1 ── */
function drawN1() {
  if (IM.bg1.complete && IM.bg1.naturalWidth>0) {
    c.globalAlpha = .18; c.drawImage(IM.bg1,0,0,W,H); c.globalAlpha = 1;
  }
  c.fillStyle = 'rgba(5,12,3,.78)'; c.fillRect(0,0,W,H);
  c.fillStyle = 'rgba(140,215,60,.82)'; c.font = 'bold 12px Segoe UI';
  c.fillText('🌊 Irrigación Chira-Piura  —  Conecta el agua de las acequias a las parcelas de arroz', 8, 18);

  for (let r = 0; r < GH; r++) for (let cl = 0; cl < GW; cl++) {
    const cel = grid[r][cl];
    const px = OX+cl*CS, py = OY+r*CS;
    const enFlujo = flujoSet.has(r+','+cl);
    const aw = cel.agua;
    const isHov = (r===hovR && cl===hovC);

    if (cel.tipo==='VACIA') {
      c.fillStyle='rgba(15,9,3,.88)'; c.fillRect(px,py,CS,CS);
      c.strokeStyle='rgba(35,20,8,.5)'; c.lineWidth=.4; c.strokeRect(px+.5,py+.5,CS-1,CS-1);
      continue;
    }
    if (cel.tipo==='FUENTE') {
      c.fillStyle='rgba(5,45,100,.9)'; c.fillRect(px,py,CS,CS);
      drawPipe(px,py,'H','rgba(12,115,205,.95)','rgba(50,175,255,.5)');
      c.fillStyle=`rgba(18,145,248,${.28+aw*.3})`; c.fillRect(px+2,py+2,CS-4,CS-4);
      c.strokeStyle='rgba(40,175,255,.65)'; c.lineWidth=2; c.strokeRect(px+2,py+2,CS-4,CS-4);
      c.font='bold 8px Segoe UI'; c.fillStyle='rgba(110,200,255,.88)';
      c.fillText('ACEQUIA',px+3,py+12); continue;
    }
    if (cel.tipo==='PARCELA') {
      if (enFlujo) {
        c.fillStyle=`rgba(6,65,135,${.55+aw*.35})`; c.fillRect(px,py,CS,CS);
        c.fillStyle=`rgba(18,138,228,${aw*.28})`; c.fillRect(px+3,py+3,CS-6,CS-6);
        c.strokeStyle=`rgba(38,205,120,${aw*.55})`; c.lineWidth=2.5; c.strokeRect(px+2,py+2,CS-4,CS-4);
        c.strokeStyle=`rgba(60,185,255,${aw*.5})`; c.lineWidth=1.2;
        for (let w=0;w<3;w++) { c.beginPath();c.arc(px+CS/2,py+CS/2,6+w*9+(tick%26)*.38,0,Math.PI*2);c.stroke(); }
        c.font='22px serif'; c.fillText('🌾',px+CS/2-11,py+CS/2+8);
      } else {
        c.fillStyle='rgba(45,28,8,.85)'; c.fillRect(px,py,CS,CS);
        c.font='20px serif'; c.fillStyle='rgba(110,82,34,.72)'; c.fillText('🟫',px+CS/2-10,py+CS/2+7);
        c.strokeStyle='rgba(80,54,15,.55)'; c.lineWidth=1.2; c.strokeRect(px+2,py+2,CS-4,CS-4);
        c.font='bold 8px Segoe UI'; c.fillStyle='rgba(148,112,44,.68)'; c.fillText('PARCELA',px+3,py+CS-5);
      }
      continue;
    }
    if (cel.tipo==='ROCA') {
      c.fillStyle='rgba(12,5,3,.92)'; c.fillRect(px,py,CS,CS);
      const p = .48+Math.sin(tick*.14)*.28;
      c.fillStyle=`rgba(155,35,8,${p})`; c.fillRect(px+5,py+5,CS-10,CS-10);
      c.strokeStyle=`rgba(230,70,18,${p+.15})`; c.lineWidth=2.5; c.strokeRect(px+4,py+4,CS-8,CS-8);
      c.font='24px serif'; c.fillStyle='#ddd'; c.fillText('🪨',px+CS/2-12,py+CS/2+9);
      c.font='bold 8px Segoe UI'; c.fillStyle='rgba(255,168,70,.78)'; c.fillText('clic=quitar',px+3,py+CS-5);
      if (isHov) { c.strokeStyle='rgba(255,110,35,.75)';c.lineWidth=3;c.strokeRect(px+2,py+2,CS-4,CS-4); }
      continue;
    }
    if (cel.tipo==='LIBRE' && !cel.pieza) {
      c.fillStyle = isHov&&sel ? 'rgba(50,110,18,.35)' : 'rgba(22,14,5,.72)';
      c.fillRect(px,py,CS,CS);
      c.strokeStyle = isHov&&sel ? 'rgba(88,215,48,.68)' : 'rgba(65,48,15,.32)';
      c.lineWidth = isHov&&sel ? 2 : 1;
      c.setLineDash([3,3]); c.strokeRect(px+2,py+2,CS-4,CS-4); c.setLineDash([]);
      if (isHov && sel) {
        drawPipe(px,py,sel,'rgba(70,195,45,.32)','rgba(95,235,65,.4)');
        c.fillStyle='rgba(85,220,45,.22)'; c.fillRect(px+2,py+2,CS-4,CS-4);
      }
      continue;
    }
    if (cel.tipo==='FIXED') {
      c.fillStyle='rgba(14,8,3,.88)'; c.fillRect(px,py,CS,CS);
      if (enFlujo) {
        drawPipe(px,py,cel.pieza,`rgba(12,112,198,${.5+aw*.44})`,`rgba(45,168,242,${aw*.58})`);
        c.fillStyle=`rgba(72,185,255,${aw*.14})`; c.fillRect(px+2,py+2,CS-4,CS-4);
      } else {
        drawPipe(px,py,cel.pieza,'rgba(18,60,14,.82)','rgba(42,95,26,.52)');
      }
      c.strokeStyle='rgba(200,200,160,.05)'; c.lineWidth=.6; c.strokeRect(px,py,CS,CS);
      c.font='bold 7px Segoe UI'; c.fillStyle='rgba(148,195,72,.38)'; c.fillText('FIJO',px+3,py+11);
      continue;
    }
    if (cel.tipo==='LIBRE' && cel.pieza) {
      c.fillStyle='rgba(14,8,3,.88)'; c.fillRect(px,py,CS,CS);
      if (enFlujo) {
        drawPipe(px,py,cel.pieza,`rgba(12,112,198,${.5+aw*.44})`,`rgba(45,168,242,${aw*.58})`);
        c.fillStyle=`rgba(72,185,255,${aw*.14})`; c.fillRect(px+2,py+2,CS-4,CS-4);
        c.strokeStyle=`rgba(35,195,255,${aw*.38})`; c.lineWidth=1.5; c.strokeRect(px+2,py+2,CS-4,CS-4);
      } else {
        drawPipe(px,py,cel.pieza,'rgba(24,132,18,.72)','rgba(52,205,52,.56)');
        c.strokeStyle='rgba(44,195,44,.42)'; c.lineWidth=1.5; c.strokeRect(px+2,py+2,CS-4,CS-4);
      }
      c.font='bold 7px Segoe UI'; c.fillStyle='rgba(170,250,140,.42)';
      c.fillText('tuya·clic=quitar',px+2,py+CS-5);
      if (isHov) { c.strokeStyle='rgba(255,248,90,.65)';c.lineWidth=2.5;c.strokeRect(px+2,py+2,CS-4,CS-4); }
    }
  }

  // Partículas
  c.save();
  for (const p of parts) {
    c.globalAlpha = p.v/40*.72;
    c.fillStyle = `hsl(200,72%,${58+p.v}%)`;
    c.beginPath(); c.arc(p.x,p.y,p.r,0,Math.PI*2); c.fill();
  }
  c.restore();

  // Separador parcelas
  c.strokeStyle='rgba(230,230,180,.08)'; c.lineWidth=1;
  const sx = OX+(GW-1)*CS;
  c.beginPath(); c.moveTo(sx,OY); c.lineTo(sx,OY+GH*CS); c.stroke();

  // Barra inferior
  c.fillStyle='rgba(0,0,0,.68)'; c.fillRect(6,H-26,W-12,22);
  if (sel) {
    c.fillStyle='#f8df28'; c.font='bold 11px Segoe UI';
    c.fillText(`"${NOMBRES[sel]}" seleccionada  ·  Clic en celda oscura = colocar  ·  Clic en pieza verde = recuperar  ·  ESC = cancelar`,10,H-11);
  } else {
    c.fillStyle='rgba(175,215,115,.72)'; c.font='10px Segoe UI';
    c.fillText('Selecciona pieza del inventario (abajo) → clic en celda oscura  ·  🪨 clic = quitar roca −10pts  ·  Pieza verde = clic para recuperar',10,H-11);
  }

  // Flash
  if (flashT > 0) {
    c.globalAlpha = Math.min(1, flashT/50);
    c.fillStyle='rgba(0,0,0,.74)'; c.fillRect(W/2-190,H/2-18,380,36);
    c.fillStyle='#ff9038'; c.font='bold 12px Segoe UI'; c.textAlign='center';
    c.fillText(flashMsg, W/2, H/2+5); c.textAlign='left'; c.globalAlpha=1; flashT--;
  }

  drawPersona(W-84, H-108);
}

function updateN1() { calcFlujo(); spawnParts(); }

/*════════════════════════════════════════════════
  INVENTARIO HTML (panel de piezas)
════════════════════════════════════════════════ */
const NOMBRES = {
  H:'Recta ─', V:'Recta │',
  LR:'Curva └', LL:'Curva ┘', UL:'Curva ┌', UR:'Curva ┐',
  TE:'T ├', TW:'T ┤', TN:'T ┴', TS:'T ┬', X:'Cruz +'
};

function buildinv() {
  const panel = document.getElementById('invPanel');
  panel.querySelectorAll('.pbtn').forEach(e => e.remove());
  for (const tipo of Object.keys(NOMBRES)) {
    if (!inv[tipo] || inv[tipo]===0) continue;
    const btn = document.createElement('div');
    btn.className = 'pbtn' + (sel===tipo?' sel':'');
    btn.dataset.t = tipo;

    // Mini-canvas de preview de la pieza
    const mc = document.createElement('canvas');
    mc.width = 38; mc.height = 38;
    const mx = mc.getContext('2d');
    mx.fillStyle = '#0a1402'; mx.fillRect(0,0,38,38);
    const hw=38*.24, mg=38*.07, mcx=19, mcy=19;
    const con = CONEX[tipo] || [];
    mx.fillStyle = 'rgba(42,178,40,.9)';
    mx.fillRect(mcx-hw, mcy-hw, hw*2, hw*2);
    if (con.includes('N')) mx.fillRect(mcx-hw, mg, hw*2, mcy-hw-mg);
    if (con.includes('S')) mx.fillRect(mcx-hw, mcy+hw, hw*2, 38-mg-(mcy+hw));
    if (con.includes('E')) mx.fillRect(mcx+hw, mcy-hw, 38-mg-(mcx+hw), hw*2);
    if (con.includes('W')) mx.fillRect(mg, mcy-hw, mcx-hw-mg, hw*2);
    mx.strokeStyle='rgba(72,235,65,.6)'; mx.lineWidth=1; mx.strokeRect(1,1,36,36);
    btn.appendChild(mc);

    const nm = document.createElement('div');
    nm.className = 'pname'; nm.textContent = NOMBRES[tipo];
    btn.appendChild(nm);

    const bdg = document.createElement('div');
    bdg.className = 'badge'; bdg.textContent = inv[tipo];
    btn.appendChild(bdg);

    btn.addEventListener('click', () => toggleSel(tipo));
    btn.addEventListener('mouseenter', e => {
      const t = document.getElementById('tip');
      t.textContent = `${NOMBRES[tipo]}  —  bocas: ${CONEX[tipo].join('+')}  —  ${inv[tipo]} disponibles`;
      t.style.display = 'block';
      t.style.left = (e.clientX+12)+'px'; t.style.top = (e.clientY-8)+'px';
    });
    btn.addEventListener('mouseleave', () => { document.getElementById('tip').style.display='none'; });
    panel.appendChild(btn);
  }
}

function toggleSel(tipo) {
  if (inv[tipo]===0) return;
  sel = (sel===tipo) ? null : tipo;
  cv.style.cursor = sel ? 'crosshair' : 'pointer';
  buildinv();
}

/*════════════════════════════════════════════════
  EVENTOS DE MOUSE Y TECLADO
════════════════════════════════════════════════ */
cv.addEventListener('click', e => {
  if (!G.activo) return;
  const rect = cv.getBoundingClientRect();
  const mx = e.clientX-rect.left, my = e.clientY-rect.top;
  const cl = Math.floor((mx-OX)/CS), r = Math.floor((my-OY)/CS);

  if (G.nivel===1) {
    if (r<0||r>=GH||cl<0||cl>=GW) return;
    const cel = grid[r][cl];
    if (cel.tipo==='ROCA') {
      cel.tipo='LIBRE'; cel.pieza=null;
      G.pts = Math.max(0, G.pts-10);
      document.getElementById('hudPts').textContent = G.pts;
      flash('Roca quitada  −10 pts');
      playSound('roca');
      return;
    }
    if (cel.tipo==='LIBRE' && cel.pieza) {
      inv[cel.pieza]++; cel.pieza=null;
      buildinv(); playSound('quitar'); return;
    }
    if (cel.tipo==='LIBRE' && !cel.pieza && sel) {
      if (inv[sel] > 0) {
        cel.pieza=sel; inv[sel]--;
        if (inv[sel]===0) {
          const nxt = Object.keys(inv).find(k => inv[k]>0) || null;
          sel=nxt; cv.style.cursor=sel?'crosshair':'pointer';
        }
        buildinv(); playSound('pieza');
      } else flash(`Sin piezas "${NOMBRES[sel]}"`);
      return;
    }
    if (cel.tipo==='FIXED') flash('Tramo fijo del canal — no se puede mover');
    if (cel.tipo==='LIBRE' && !cel.pieza && !sel) flash('Primero selecciona una pieza del inventario');
  } else {
    clickN2(mx, my);
  }
});

cv.addEventListener('contextmenu', e => {
  if (!G.activo || G.nivel!==1) return;
  e.preventDefault();
  const rect = cv.getBoundingClientRect();
  const mx = e.clientX-rect.left, my = e.clientY-rect.top;
  const cl = Math.floor((mx-OX)/CS), r = Math.floor((my-OY)/CS);
  if (r<0||r>=GH||cl<0||cl>=GW) return;
  const cel = grid[r][cl];
  if (cel.tipo==='LIBRE' && cel.pieza) {
    inv[cel.pieza]++; cel.pieza=null;
    buildinv(); playSound('quitar');
  }
});

cv.addEventListener('mousemove', e => {
  if (!G.activo) return;
  const rect = cv.getBoundingClientRect();
  const mx = e.clientX-rect.left, my = e.clientY-rect.top;
  hovC = Math.floor((mx-OX)/CS); hovR = Math.floor((my-OY)/CS);
  if (G.nivel===1 && hovR>=0&&hovR<GH&&hovC>=0&&hovC<GW) {
    const cel = grid[hovR][hovC];
    if (cel.tipo==='ROCA'||(cel.tipo==='LIBRE'&&cel.pieza)) cv.style.cursor='pointer';
    else if (cel.tipo==='LIBRE'&&sel) cv.style.cursor='crosshair';
    else if (cel.tipo==='FIXED') cv.style.cursor='not-allowed';
    else cv.style.cursor = sel?'crosshair':'default';
  }
});

cv.addEventListener('mouseleave', () => { hovR=-1; hovC=-1; });

document.addEventListener('keydown', e => {
  if (e.key==='Escape' && G.activo && G.nivel===1) {
    sel=null; cv.style.cursor='pointer'; buildinv();
  }
});

function flash(msg) { flashMsg=msg; flashT=90; }

/*════════════════════════════════════════════════
  NIVEL 2 — SIEMBRA DE BÁLAGOS
════════════════════════════════════════════════ */
let sembs=[], sf=0, sint=62, nsemb=0;
const META2 = 20;

function setupN2() {
  sembs=[]; sf=0; sint=62; nsemb=0; parts=[];
  hide('invPanel'); hide('leyenda');
  document.getElementById('hudExtra').textContent = `Bálagos: 0/${META2}`;
  cv.style.cursor = 'crosshair';
}

function clickN2(mx, my) {
  for (let i = sembs.length-1; i >= 0; i--) {
    const s = sembs[i];
    if (Math.hypot(mx-s.x, my-s.y) <= s.r+9) {
      nsemb++; G.pts2 += 15; G.pts = G.pts1+G.pts2;
      document.getElementById('hudPts').textContent = G.pts;
      document.getElementById('hudExtra').textContent = `Bálagos: ${nsemb}/${META2}`;
      for (let k=0;k<10;k++) parts.push({
        x:s.x, y:s.y, vx:(Math.random()-.5)*5.5, vy:(Math.random()-.5)*5.5, v:30, r:3.2
      });
      sembs.splice(i,1);
      playSound('balago');
      break;
    }
  }
}

function updateN2() {
  sf++;
  if (sf >= sint && sembs.length < 7) {
    const mg = 55;
    sembs.push({ x:mg+Math.random()*(W-mg*2), y:mg+Math.random()*(H-55-mg*2)+mg, r:18, v:148, vm:148, ang:0 });
    sf=0; if (sint>26) sint -= 1.5;
    playSound('agua');
  }
  sembs.forEach(s => { s.v--; s.ang += .065; });
  sembs = sembs.filter(s => s.v > 0);
  parts.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.v--; });
  parts = parts.filter(p => p.v > 0);
}

function drawN2() {
  if (IM.bg2.complete && IM.bg2.naturalWidth>0) {
    c.globalAlpha=.36; c.drawImage(IM.bg2,0,0,W,H); c.globalAlpha=1;
  }
  c.fillStyle='rgba(3,16,28,.72)'; c.fillRect(0,0,W,H);
  for (let row=0;row<3;row++) for (let col=0;col<5;col++) {
    const x=18+col*170, y=32+row*120;
    c.fillStyle='rgba(7,48,95,.62)'; c.fillRect(x+2,y+2,162,114);
    c.fillStyle='rgba(255,255,255,.03)'; c.fillRect(x+4,y+4,156,9);
    c.strokeStyle='rgba(18,105,55,.42)'; c.lineWidth=1.2; c.strokeRect(x+1,y+1,163,115);
  }
  c.fillStyle='rgba(125,208,48,.78)'; c.font='bold 12px Segoe UI';
  c.fillText('🌿 ¡Siembra los bálagos! – Haz clic rápido en los círculos dorados antes de que desaparezcan',12,20);

  for (const s of sembs) {
    const pv=s.v/s.vm, pulse=Math.sin(s.ang)*3.2;
    c.beginPath(); c.arc(s.x,s.y,s.r+11+pulse,0,Math.PI*2);
    c.fillStyle=`rgba(255,212,35,${.07+pv*.09})`; c.fill();
    const g = c.createRadialGradient(s.x-3,s.y-3,2,s.x,s.y,s.r+pulse);
    g.addColorStop(0,`rgba(255,248,75,${.7+pv*.22})`);
    g.addColorStop(1,`rgba(198,125,5,${.54+pv*.2})`);
    c.beginPath(); c.arc(s.x,s.y,s.r+pulse,0,Math.PI*2);
    c.fillStyle=g; c.fill();
    c.strokeStyle='rgba(255,255,255,.52)'; c.lineWidth=2; c.stroke();
    c.font='18px serif'; c.fillStyle='rgba(8,35,4,.88)'; c.fillText('🌱',s.x-9,s.y+6);
    const bw=s.r*2;
    c.fillStyle='rgba(0,0,0,.42)'; c.fillRect(s.x-s.r,s.y+s.r+7,bw,4);
    c.fillStyle=pv>.45?'#40ec40':pv>.2?'#e8b820':'#ec3020';
    c.fillRect(s.x-s.r,s.y+s.r+7,bw*pv,4);
  }
  c.save();
  for (const p of parts) {
    c.globalAlpha=p.v/30; c.fillStyle='#68fc38';
    c.beginPath(); c.arc(p.x,p.y,p.r,0,Math.PI*2); c.fill();
  }
  c.restore();
  const bpw=560, bpp=(nsemb/META2)*bpw;
  c.fillStyle='rgba(0,0,0,.5)'; c.fillRect(15,H-32,bpw+4,17);
  const bg = c.createLinearGradient(15,0,15+bpp,0);
  bg.addColorStop(0,'#225e10'); bg.addColorStop(1,'#70e038');
  c.fillStyle=bg; c.fillRect(17,H-31,bpp,15);
  c.strokeStyle='#305e15'; c.lineWidth=1.2; c.strokeRect(15,H-32,bpw+4,17);
  c.fillStyle='#acc884'; c.font='11px Segoe UI';
  c.fillText(`Bálagos sembrados: ${nsemb} / ${META2}`,17,H-40);
  drawPersona(W-86, H-112);
}

/*═══ Personaje campesino ═══
   Para usar tu propia imagen:
   loadImg('person','assets/img/personajes/campesino.png')
════════════════════════════ */
function drawPersona(x, y) {
  if (IM.person.complete && IM.person.naturalWidth>0) {
    c.save();
    c.beginPath(); c.arc(x+32,y+36,28,0,Math.PI*2); c.clip();
    c.drawImage(IM.person,x,y,64,72); c.restore();
    c.beginPath(); c.arc(x+32,y+36,28,0,Math.PI*2);
    c.strokeStyle='rgba(130,210,50,.42)'; c.lineWidth=2; c.stroke();
    c.font='8px Segoe UI'; c.fillStyle='rgba(150,215,60,.5)';
    c.fillText('← img aquí',x-4,y+74);
  } else {
    c.save();
    c.fillStyle='#c8a020';
    c.beginPath(); c.ellipse(x+22,y+10,20,7,0,0,Math.PI*2); c.fill();
    c.fillStyle='#dcc03c'; c.fillRect(x+8,y+4,27,10);
    c.fillStyle='#be7438';
    c.beginPath(); c.arc(x+22,y+24,10,0,Math.PI*2); c.fill();
    c.fillStyle='#346018'; c.fillRect(x+10,y+35,22,30);
    c.fillStyle='#26367e';
    c.fillRect(x+10,y+65,10,24); c.fillRect(x+23,y+65,10,24);
    c.fillStyle='#346018'; c.fillRect(x+1,y+35,9,17); c.fillRect(x+32,y+35,9,17);
    c.restore();
  }
}

/*════════════════════════════════════════════════
  GAME LOOP
════════════════════════════════════════════════ */
function gameLoop() {
  if (!G.activo) return;
  c.clearRect(0,0,W,H);
  if (G.nivel===1) {
    updateN1(); drawN1();
    if (parcsOk>=4 && parcsTotal>0) { completarN1(); return; }
  } else {
    updateN2(); drawN2();
    if (nsemb>=META2) { completarN2(); return; }
  }
  raf = requestAnimationFrame(gameLoop);
}

/*════════════════════════════════════════════════
  ESTADO Y FLUJO DEL JUEGO
════════════════════════════════════════════════ */
let G = {nivel:1, pts:0, pts1:0, pts2:0, tiempo:300, tiempoTotal:0, activo:false, nombre:'Agricultor'};
let timer = null, raf = null;

function iniciar() {
  const v = document.getElementById('inpNombre').value.trim();
  G.nombre = v || 'Agricultor';
  G.pts = G.pts1 = G.pts2 = 0; G.nivel = 1; G.tiempoTotal = 0;
  instruccion(1);
}

function instruccion(n) {
  const d = document.getElementById('infoNivel');
  if (n===1) {
    d.innerHTML = `<h2>🔧 Nivel 1 – Construye los Canales de Riego</h2>
    <p>El mapa es <b>diferente cada partida</b>. Debes llevar el agua de las 
    <span style="color:#5ab8ff">acequias (izquierda)</span> a las 
    <span style="color:#c0d860">parcelas (derecha)</span>.</p>
    <ul>
      <li>Selecciona una pieza del inventario de abajo → haz clic en una <b style="color:#888">celda oscura</b> para colocarla.</li>
      <li>Usa piezas <b style="color:#58e048">T (bifurcación)</b> para ramificar el agua a <b>varias parcelas a la vez</b>.</li>
      <li>Haz clic en tu pieza verde para recuperarla. <b>Clic derecho</b> también la recupera.</li>
      <li>Las piezas <b style="color:#5ab8ff">azules FIJO</b> ya están colocadas y dan pistas del camino.</li>
      <li>Haz clic en las <b style="color:#e04018">rocas 🪨</b> para quitarlas (−10 pts).</li>
    </ul>
    <p style="color:#e8a010">¡Riega <b>4 de 6 parcelas</b> para completar el nivel! 
    Hay más de un camino posible.</p>`;
  } else {
    d.innerHTML = `<h2>🌱 Nivel 2 – Siembra de Bálagos</h2>
    <p>El campo está inundado y listo. Trasplanta los bálagos de arroz 
    haciendo clic rápido en los <b style="color:#f8df28">círculos dorados 🌱</b> antes de que desaparezcan.<br>
    La dificultad aumenta: salen más rápido con el tiempo.</p>
    <p style="color:#e8a010">Siembra <b>${META2} bálagos</b> para completar.</p>`;
  }
  hide('sInicio'); hide('sTrans'); show('sNivel');
}

function empezar() {
  hide('sNivel');
  document.getElementById('lvlbadge').textContent = `Nivel ${G.nivel}`;
  if (G.nivel===1) { setupN1(); G.tiempo=300; }
  else             { setupN2(); G.tiempo=75; }
  G.activo=true; hudup(); startTimer();
  cancelAnimationFrame(raf); gameLoop();
  playBg();  // música de fondo al empezar
}

function completarN1() {
  stopTimer();
  G.pts1 = parcsOk*30; G.pts = G.pts1;
  const s = estrellas(G.tiempo, 300);
  document.getElementById('tMsg').textContent  = '¡Canales listos! El agua fluye 🌊';
  document.getElementById('tStars').textContent = '⭐'.repeat(s);
  document.getElementById('tDesc').textContent  =
    `Regaste ${parcsOk}/6 parcelas · Tiempo sobrante: ${G.tiempo}s · Puntos: ${G.pts1}`;
  show('sTrans');
  playSound('nivel1ok');
}

function completarN2() {
  stopTimer();
  G.pts2 = nsemb*15; G.pts = G.pts1+G.pts2;
  showFinal(estrellas(G.tiempo, 75));
  playSound('ganar');
  stopBg();
}

function siguiente() { G.nivel=2; hide('sTrans'); instruccion(2); }

function showFinal(s) {
  const bonus=G.tiempo*2, total=G.pts+bonus;
  document.getElementById('fStars').textContent = '⭐'.repeat(s);
  document.getElementById('fMsg').innerHTML =
    `<b>${G.nombre}</b>, completaste la siembra del Valle del Chira.<br>¡Eres un auténtico agricultor piurano!`;
  document.getElementById('scoreBody').innerHTML = `
    <tr><td>Nivel 1 – Canales</td><td>${G.pts1} pts</td></tr>
    <tr><td>Nivel 2 – Siembra</td><td>${G.pts2} pts</td></tr>
    <tr><td>Bonus tiempo (${G.tiempo}s)</td><td>${bonus} pts</td></tr>
    <tr><td><b>TOTAL</b></td><td><b>${total}</b></td></tr>`;
  show('sFinal');
  guardar(G.nombre, total, G.tiempoTotal);
}

function startTimer() {
  clearInterval(timer);
  timer = setInterval(() => {
    if (!G.activo) return;
    G.tiempo--; G.tiempoTotal++;
    document.getElementById('hudTime').textContent = G.tiempo;
    if (G.tiempo <= 0) gameOver();
  }, 1000);
}
function stopTimer() { clearInterval(timer); cancelAnimationFrame(raf); G.activo=false; }

function gameOver() {
  stopTimer(); stopBg(); playSound('perder');
  document.getElementById('overMsg').textContent = G.nivel===1
    ? `Regaste ${parcsOk}/6 parcelas. El nuevo mapa será diferente. ¡Inténtalo de nuevo!`
    : `Sembraste ${nsemb}/${META2} bálagos. ¡Haz clic más rápido en los círculos!`;
  show('sOver');
}

function reintentar() {
  hide('sOver');
  if (G.nivel===2) G.pts2=0;
  instruccion(G.nivel);
}

/*════════════════════════════════════════════════
  BACKEND: Guardar récord y cargar ranking
════════════════════════════════════════════════ */
async function guardar(nombre, pts, t) {
  const el = document.getElementById('dbMsg');
  el.textContent = 'Guardando...';
  try {
    const r = await fetch('backend/guardar_record.php', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        nombre_jugador: nombre,
        puntaje_total:  pts,
        tiempo_segundos: t,
        nivel_alcanzado: 2
      })
    });
    const d = await r.json();
    el.textContent = d.ok ? '✅ ¡Récord guardado!' : '⚠️ No se pudo guardar.';
  } catch {
    el.textContent = '⚠️ Backend no disponible. Sirve desde XAMPP para guardar puntajes.';
  }
}

/* ── Mostrar / ocultar ranking desde la pantalla de inicio ── */
async function mostrarRanking() {
  const panel = document.getElementById('rankingPanel');
  panel.classList.remove('hidden');
  const tbody = document.getElementById('rankingBody');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;">Cargando...</td></tr>';
  try {
    const r = await fetch('backend/obtener_records.php');
    const data = await r.json();
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;">Sin registros aún.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map((row, i) => {
      const fecha = row.fecha_registro ? row.fecha_registro.slice(0,10) : '-';
      const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
      return `<tr>
        <td>${medal}${i+1}</td>
        <td>${row.nombre_jugador}</td>
        <td>${row.puntaje_total}</td>
        <td>Nivel ${row.nivel_alcanzado}</td>
        <td>${fecha}</td>
      </tr>`;
    }).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#c06020;">Backend no disponible.</td></tr>';
  }
}

function ocultarRanking() {
  document.getElementById('rankingPanel').classList.add('hidden');
}

/*════════════════════════════════════════════════
  UTILIDADES
════════════════════════════════════════════════ */
function estrellas(t, mx) { return t/mx>.5?3:t/mx>.25?2:1; }
function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }
function hudup()  {
  document.getElementById('hudPts').textContent  = G.pts;
  document.getElementById('hudTime').textContent = G.tiempo;
}
function menu() {
  stopTimer(); stopBg();
  ['sTrans','sOver','sFinal'].forEach(hide);
  hide('invPanel'); hide('leyenda'); show('sInicio');
  G.pts=G.pts1=G.pts2=0; hudup();
}

/* ── Pantalla de espera (idle) ── */
(()=>{
  c.fillStyle='#060f03'; c.fillRect(0,0,W,H);
  c.fillStyle='rgba(100,185,36,.14)'; c.font='bold 25px Segoe UI';
  c.fillText('🌾 Siembra de Arroz en Terreno Suave – Piura', 85, H/2);
  c.fillStyle='rgba(145,195,72,.09)'; c.font='14px Segoe UI';
  c.fillText('Escribe tu nombre y presiona Comenzar', 240, H/2+36);
})();
