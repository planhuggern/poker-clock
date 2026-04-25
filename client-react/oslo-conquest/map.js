import { TERRITORIES, DISTRICTS, ADJACENCY, CHECKPOINTS } from './game-data.js';
import { state } from './state.js';
import { renderHUD, renderActionPanel, renderCheckpointBar } from './ui.js';

export const MAP_W = 900;
export const MAP_H = 800;

export const TERRITORY_POS = {
  't1':  [375,340], 't2':  [360,362], 't3':  [394,330],
  't4':  [378,272], 't5':  [400,288], 't6':  [365,290],
  't7':  [348,254], 't8':  [328,240], 't9':  [306,286],
  't10': [292,268], 't11': [268,274], 't12': [247,292],
  't13': [228,316], 't14': [202,338], 't15': [178,354],
  't16': [240,230], 't17': [216,214], 't18': [200,192],
  't19': [320,198], 't20': [350,214], 't21': [290,178],
  't22': [420,250], 't23': [444,236], 't24': [488,198],
  't25': [510,216], 't26': [554,158], 't27': [576,174],
  't28': [534,296], 't29': [460,282], 't30': [460,360],
  't31': [490,375], 't32': [432,430], 't33': [406,446],
  't34': [370,488], 't35': [400,498],
};

const CHECKPOINT_POS = {
  'lørenskog': [680, 280],
  'lysaker':   [140, 390],
  'kolbotn':   [350, 590],
};

export function initMap() {
  const container = document.getElementById('map-container');
  container.innerHTML = '';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('id', 'oslo-svg');
  svg.setAttribute('width', MAP_W);
  svg.setAttribute('height', MAP_H);
  svg.setAttribute('viewBox', `0 0 ${MAP_W} ${MAP_H}`);
  state.svgEl = svg;

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <pattern id="water-pat" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M0 10 Q5 7 10 10 Q15 13 20 10" fill="none" stroke="#1a3a5c" stroke-width="0.5" opacity="0.5"/>
    </pattern>
    <radialGradient id="terrain-grad" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="#2a3a1a"/>
      <stop offset="60%" stop-color="#1e2e12"/>
      <stop offset="100%" stop-color="#141e0d"/>
    </radialGradient>
    <filter id="cp-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <filter id="sel-glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  `;
  svg.appendChild(defs);

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', MAP_W); bg.setAttribute('height', MAP_H); bg.setAttribute('fill', '#0d1520');
  svg.appendChild(bg);

  const grid = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  grid.setAttribute('opacity', '0.15');
  for (let x = 0; x < MAP_W; x += 40) {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', x); l.setAttribute('y1', 0); l.setAttribute('x2', x); l.setAttribute('y2', MAP_H);
    l.setAttribute('stroke', '#1a1a2a'); l.setAttribute('stroke-width', '0.5');
    grid.appendChild(l);
  }
  for (let y = 0; y < MAP_H; y += 40) {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', 0); l.setAttribute('y1', y); l.setAttribute('x2', MAP_W); l.setAttribute('y2', y);
    l.setAttribute('stroke', '#1a1a2a'); l.setAttribute('stroke-width', '0.5');
    grid.appendChild(l);
  }
  svg.appendChild(grid);

  const water = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  water.innerHTML = `
    <path d="M0 620 Q50 600 100 580 Q150 560 180 540 Q200 530 220 520 Q240 510 260 520 Q280 530 300 540 Q320 550 340 530 Q360 510 370 490 Q380 470 360 460 Q340 450 320 455 Q300 460 280 470 Q260 480 240 475 Q220 470 200 460 Q180 450 160 440 Q140 430 120 440 Q100 450 80 460 Q60 470 40 480 Q20 490 0 500 Z" fill="#0f2540" opacity="0.92"/>
    <path d="M0 620 Q50 600 100 580 Q150 560 180 540 Q200 530 220 520 Q240 510 260 520 Q280 530 300 540 Q320 550 340 530 Q360 510 370 490 Q380 470 360 460 Q340 450 320 455 Q300 460 280 470 Q260 480 240 475 Q220 470 200 460 Q180 450 160 440 Q140 430 120 440 Q100 450 80 460 Q60 470 40 480 Q20 490 0 500 Z" fill="url(#water-pat)" opacity="0.5"/>
    <text font-family="Georgia,serif" font-size="11" fill="rgba(100,160,220,0.3)" letter-spacing="3" x="120" y="530" text-anchor="middle">OSLOFJORDEN</text>
  `;
  svg.appendChild(water);

  const land = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  land.setAttribute('d', 'M150 50 Q200 30 260 25 Q320 20 380 30 Q440 40 490 55 Q540 70 580 90 Q620 110 650 140 Q680 170 700 200 Q720 230 725 265 Q730 300 720 330 Q710 360 695 385 Q680 410 660 430 Q640 450 615 462 Q590 474 565 478 Q540 482 515 478 Q490 474 470 468 Q450 462 430 470 Q410 478 395 490 Q380 502 360 508 Q340 514 318 510 Q296 506 275 498 Q254 490 235 478 Q216 466 200 452 Q184 438 170 420 Q156 402 145 380 Q134 358 128 332 Q122 306 120 278 Q118 250 122 220 Q126 190 133 162 Q140 134 145 102 Q148 76 150 50 Z');
  land.setAttribute('fill', 'url(#terrain-grad)');
  land.setAttribute('stroke', '#2a3a1a'); land.setAttribute('stroke-width', '1.5');
  svg.appendChild(land);

  const topo = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  topo.setAttribute('d', 'M200 100 Q300 80 400 90 Q500 100 580 130 Q640 155 660 200 Q680 245 665 300 Q650 350 620 390 Q580 430 530 450 Q480 468 420 462 Q360 456 320 440 Q280 424 250 400 Q220 376 205 342 Q190 308 188 270 Q186 232 195 195 Q204 158 200 100 Z');
  topo.setAttribute('fill', 'none'); topo.setAttribute('stroke', '#2a3a1a');
  topo.setAttribute('stroke-width', '0.5'); topo.setAttribute('opacity', '0.5');
  svg.appendChild(topo);

  const districtShapes = {
    'frogner':           'M200 280 Q220 260 250 250 Q270 245 290 255 Q305 265 310 285 Q315 305 305 325 Q295 345 270 355 Q245 360 225 350 Q205 340 200 320 Q196 304 200 280 Z',
    'ullern':            'M155 330 Q170 310 195 305 Q215 302 225 315 Q235 328 230 350 Q225 368 205 378 Q185 385 168 375 Q152 363 150 345 Q149 338 155 330 Z',
    'vestre-aker':       'M185 200 Q210 185 240 188 Q265 191 278 208 Q288 222 283 245 Q278 262 262 270 Q245 275 228 268 Q210 260 200 245 Q190 230 185 215 Q183 207 185 200 Z',
    'nordre-aker':       'M290 160 Q320 145 355 148 Q382 152 395 172 Q405 188 400 210 Q395 228 378 238 Q360 246 340 242 Q320 238 308 225 Q296 212 292 194 Q288 176 290 160 Z',
    'st-hanshaugen':     'M275 270 Q295 258 315 262 Q330 266 336 280 Q340 294 332 308 Q324 320 308 324 Q292 326 280 318 Q268 308 268 294 Q267 282 275 270 Z',
    'sagene':            'M310 225 Q330 215 352 218 Q368 222 375 236 Q380 248 373 262 Q365 274 350 278 Q334 280 320 274 Q306 267 303 253 Q300 240 310 225 Z',
    'grunerløkka':       'M360 248 Q382 240 402 246 Q418 252 422 268 Q426 282 418 296 Q410 308 394 312 Q378 315 365 306 Q352 297 350 282 Q348 267 360 248 Z',
    'gamle-oslo':        'M355 315 Q378 308 400 315 Q418 322 422 340 Q425 356 412 368 Q398 378 378 378 Q358 376 346 362 Q336 348 338 334 Q340 320 355 315 Z',
    'bjerke':            'M415 210 Q440 200 462 205 Q480 210 485 226 Q488 240 480 253 Q470 264 454 267 Q438 268 426 258 Q414 248 412 234 Q410 220 415 210 Z',
    'grorud':            'M470 165 Q498 155 520 160 Q540 166 545 184 Q548 198 540 212 Q530 224 514 228 Q498 230 485 220 Q472 210 470 196 Q468 180 470 165 Z',
    'stovner':           'M530 130 Q558 118 582 124 Q604 130 610 150 Q614 165 604 180 Q592 192 575 194 Q556 195 544 183 Q532 170 530 154 Q528 142 530 130 Z',
    'alna':              'M468 272 Q492 264 515 270 Q535 276 540 294 Q544 308 534 322 Q524 334 506 337 Q488 338 476 326 Q464 314 464 298 Q462 285 468 272 Z',
    'østensjø':          'M445 342 Q468 334 490 340 Q508 348 512 366 Q514 380 502 392 Q490 402 472 402 Q454 402 443 390 Q432 378 434 362 Q436 348 445 342 Z',
    'nordstrand':        'M380 398 Q408 390 432 398 Q452 406 455 425 Q457 440 442 452 Q426 462 405 460 Q384 458 372 444 Q361 430 364 415 Q367 402 380 398 Z',
    'søndre-nordstrand': 'M348 462 Q374 455 398 462 Q418 470 420 488 Q421 502 406 513 Q390 522 368 518 Q346 514 336 498 Q328 482 336 470 Q340 463 348 462 Z',
  };
  const districtLabelPos = {
    'frogner': [252,302], 'ullern': [190,345], 'vestre-aker': [234,228],
    'nordre-aker': [346,196], 'st-hanshaugen': [303,292], 'sagene': [340,248],
    'grunerløkka': [386,276], 'gamle-oslo': [380,344], 'bjerke': [448,234],
    'grorud': [508,192], 'stovner': [570,158], 'alna': [502,300],
    'østensjø': [474,368], 'nordstrand': [409,426], 'søndre-nordstrand': [378,486],
  };
  const districtShortNames = {
    'frogner':'Frogner','ullern':'Ullern','vestre-aker':'V. Aker',
    'nordre-aker':'N. Aker','st-hanshaugen':'St. H.','sagene':'Sagene',
    'grunerløkka':'Grünerl.','gamle-oslo':'G. Oslo','bjerke':'Bjerke',
    'grorud':'Grorud','stovner':'Stovner','alna':'Alna',
    'østensjø':'Østensjø','nordstrand':'Nordstr.','søndre-nordstrand':'S.Nordstr.',
  };

  const districtGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  districtGroup.setAttribute('id', 'district-layer');
  for (const [did, pathD] of Object.entries(districtShapes)) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', pathD);
    p.setAttribute('id', 'district-' + did);
    p.setAttribute('class', 'svg-district');
    p.setAttribute('fill', DISTRICTS[did]?.color || '#1a1a2a');
    p.setAttribute('fill-opacity', '0.75');
    p.setAttribute('stroke', '#2a3a2a'); p.setAttribute('stroke-width', '1.5');
    districtGroup.appendChild(p);

    const lp = districtLabelPos[did];
    if (lp) {
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('class', 'district-label');
      t.setAttribute('x', lp[0]); t.setAttribute('y', lp[1]);
      t.textContent = districtShortNames[did] || did;
      districtGroup.appendChild(t);
    }
  }
  svg.appendChild(districtGroup);

  const roads = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  roads.innerHTML = `
    <path d="M200 100 Q300 80 400 90 Q500 100 580 130 Q640 155 660 200 Q680 245 665 300 Q650 350 620 390 Q580 430 530 450 Q480 468 420 462 Q360 456 320 440 Q280 424 250 400 Q220 376 205 342 Q190 308 188 270 Q186 232 195 195" fill="none" stroke="#4a3a1a" stroke-width="1.2" stroke-dasharray="6 4" opacity="0.4"/>
    <path d="M160 430 Q200 418 240 410 Q290 400 340 398 Q390 396 430 405 Q470 414 510 430" fill="none" stroke="#4a3a1a" stroke-width="1.2" opacity="0.4"/>
    <path d="M370 145 Q368 180 362 220 Q358 255 352 285 Q346 312 340 355 Q337 380 340 400" fill="none" stroke="#1a4a6a" stroke-width="1.5" stroke-linecap="round" opacity="0.55"/>
  `;
  svg.appendChild(roads);

  const adjGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  adjGroup.setAttribute('id', 'adj-layer');
  const drawn = new Set();
  for (const [tid, neighbors] of Object.entries(ADJACENCY)) {
    const pos1 = TERRITORY_POS[tid];
    if (!pos1) continue;
    for (const nid of neighbors) {
      const key = [tid, nid].sort().join('-');
      if (drawn.has(key)) continue;
      drawn.add(key);
      const pos2 = TERRITORY_POS[nid];
      if (!pos2) continue;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('id', `adj-${key}`);
      line.setAttribute('class', 'adj-line');
      line.setAttribute('x1', pos1[0]); line.setAttribute('y1', pos1[1]);
      line.setAttribute('x2', pos2[0]); line.setAttribute('y2', pos2[1]);
      adjGroup.appendChild(line);
    }
  }
  svg.appendChild(adjGroup);

  const cpGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  cpGroup.setAttribute('id', 'checkpoint-layer');
  for (const [cid, cp] of Object.entries(CHECKPOINTS)) {
    const [cx, cy] = CHECKPOINT_POS[cid];
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('filter', 'url(#cp-glow)');
    g.innerHTML = `
      <polygon points="${cx},${cy-22} ${cx+16},${cy} ${cx},${cy+22} ${cx-16},${cy}" fill="rgba(255,215,0,0.12)" stroke="#ffd700" stroke-width="1.8"/>
      <circle cx="${cx}" cy="${cy}" r="3.5" fill="#ffd700"/>
      <text class="checkpoint-label" x="${cx}" y="${cy+36}">${cp.name}</text>
      <text class="checkpoint-label" x="${cx}" y="${cy+48}" style="font-size:7px;fill:rgba(255,215,0,0.6)">${cid === 'lørenskog' ? 'START' : 'CHECKPOINT'}</text>
    `;
    cpGroup.appendChild(g);
  }
  svg.appendChild(cpGroup);

  const terrGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  terrGroup.setAttribute('id', 'territory-layer');
  for (const t of TERRITORIES) {
    const [cx, cy] = TERRITORY_POS[t.id] || [0, 0];
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', 'terr-' + t.id);
    g.setAttribute('class', 'svg-territory');
    g.setAttribute('data-id', t.id);

    const isPremium = t.price >= 400;
    const r = isPremium ? 16 : 14;

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx); circle.setAttribute('cy', cy); circle.setAttribute('r', r);
    circle.setAttribute('fill', '#1a1a2a');
    circle.setAttribute('stroke', '#c9a84c');
    circle.setAttribute('stroke-width', isPremium ? '2' : '1.5');

    const nameT = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    nameT.setAttribute('class', 'terr-label');
    nameT.setAttribute('x', cx); nameT.setAttribute('y', cy - 3);
    nameT.textContent = t.name.substring(0, 3).toUpperCase();

    const unitsT = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    unitsT.setAttribute('class', 'terr-units');
    unitsT.setAttribute('x', cx); unitsT.setAttribute('y', cy + 8);
    unitsT.setAttribute('id', 'units-' + t.id);
    unitsT.textContent = t.neutralUnits;

    g.appendChild(circle);
    g.appendChild(nameT);
    g.appendChild(unitsT);

    g.addEventListener('mouseenter', (e) => showMapTooltip(t, e));
    g.addEventListener('mousemove', (e) => moveMapTooltip(e));
    g.addEventListener('mouseleave', hideMapTooltip);
    g.addEventListener('pointerup', () => {
      if (!state.panState.hasMoved) selectTerritory(t.id);
    });

    terrGroup.appendChild(g);
  }
  svg.appendChild(terrGroup);

  const compass = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  compass.setAttribute('transform', 'translate(840,80)');
  compass.innerHTML = `
    <circle cx="0" cy="0" r="24" fill="rgba(10,10,20,0.75)" stroke="#2a2a3a" stroke-width="1"/>
    <polygon points="0,-20 5,-7 -5,-7" fill="#c9a84c" opacity="0.9"/>
    <polygon points="0,20 5,7 -5,7" fill="#555" opacity="0.6"/>
    <polygon points="-20,0 -7,-5 -7,5" fill="#555" opacity="0.6"/>
    <polygon points="20,0 7,-5 7,5" fill="#555" opacity="0.6"/>
    <text font-family="Georgia,serif" font-size="11" fill="#c9a84c" x="0" y="-26" text-anchor="middle">N</text>
  `;
  svg.appendChild(compass);

  container.appendChild(svg);

  requestAnimationFrame(() => {
    fitMapToContainer();
    setupMapInteraction(container, svg);
    updateTerritoryVisuals();
    renderHUD();
    renderCheckpointBar();
  });
}

export function fitMapToContainer() {
  const container = document.getElementById('map-container');
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  const scale = Math.min(cw / MAP_W, ch / MAP_H) * 0.95;
  state.mapTransform.scale = scale;
  state.mapTransform.x = (cw - MAP_W * scale) / 2;
  state.mapTransform.y = (ch - MAP_H * scale) / 2;
  applyMapTransform();
}

export function applyMapTransform() {
  if (!state.svgEl) return;
  const { x, y, scale } = state.mapTransform;
  state.svgEl.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}

function setupMapInteraction(container) {
  const ps = state.panState;

  container.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.svg-territory')) return;
    ps.active = true;
    ps.hasMoved = false;
    ps.startX = e.clientX; ps.startY = e.clientY;
    ps.startTx = state.mapTransform.x; ps.startTy = state.mapTransform.y;
    container.classList.add('grabbing');
  });

  window.addEventListener('pointermove', (e) => {
    if (!ps.active) return;
    const dx = e.clientX - ps.startX;
    const dy = e.clientY - ps.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) ps.hasMoved = true;
    state.mapTransform.x = ps.startTx + dx;
    state.mapTransform.y = ps.startTy + dy;
    applyMapTransform();
    hideMapTooltip();
  });

  window.addEventListener('pointerup', () => {
    ps.active = false;
    container.classList.remove('grabbing');
    setTimeout(() => { ps.hasMoved = false; }, 20);
  });

  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(state.mapTransform.scale * delta, 0.3), 4);
    state.mapTransform.x = mx - (mx - state.mapTransform.x) * (newScale / state.mapTransform.scale);
    state.mapTransform.y = my - (my - state.mapTransform.y) * (newScale / state.mapTransform.scale);
    state.mapTransform.scale = newScale;
    applyMapTransform();
  }, { passive: false });
}

function showMapTooltip(territory, e) {
  const ts = state.gameState?.territories[territory.id];
  const owner = ts?.owner ? state.gameState.players.find(x => x.id === ts.owner) : null;
  const district = DISTRICTS[territory.district];
  const tt = document.getElementById('map-tooltip');
  tt.innerHTML = `<strong style="color:#e8c97a">${territory.name}</strong><br>
    <span style="color:#888;font-style:italic">${district?.name}</span><br>
    <span style="color:${owner?.color || '#888'}">${owner?.name || 'Nøytral'}</span> · ${ts?.units || 0} bat.<br>
    <span style="color:#c9a84c">💰 ${territory.price} kr</span>`;
  tt.style.display = 'block';
  moveMapTooltip(e);
}

function moveMapTooltip(e) {
  const tt = document.getElementById('map-tooltip');
  tt.style.left = Math.min(e.clientX + 14, window.innerWidth - 180) + 'px';
  tt.style.top = Math.max(e.clientY - 10, 70) + 'px';
}

function hideMapTooltip() {
  document.getElementById('map-tooltip').style.display = 'none';
}

export function updateTerritoryVisuals() {
  if (!state.gameState) return;
  for (const t of TERRITORIES) {
    const g = document.getElementById('terr-' + t.id);
    if (!g) continue;
    const ts = state.gameState.territories[t.id];
    const owner = ts?.owner ? state.gameState.players.find(x => x.id === ts.owner) : null;
    const circle = g.querySelector('circle');

    if (owner) {
      circle.setAttribute('fill', owner.color);
      circle.setAttribute('fill-opacity', '0.75');
      circle.setAttribute('stroke', owner.color);
      circle.setAttribute('filter', '');
    } else {
      circle.setAttribute('fill', '#1a1a2a');
      circle.setAttribute('fill-opacity', '1');
      circle.setAttribute('stroke', '#c9a84c');
      circle.setAttribute('filter', '');
    }

    const unitsEl = document.getElementById('units-' + t.id);
    if (unitsEl) unitsEl.textContent = ts?.units || 0;

    const isSelected = state.selectedTerritory === t.id;
    g.classList.toggle('selected', isSelected);
    if (isSelected) circle.setAttribute('filter', 'url(#sel-glow)');

    if (state.selectedTerritory) {
      const adj = ADJACENCY[state.selectedTerritory] || [];
      const key1 = [state.selectedTerritory, t.id].sort().join('-');
      const adjLine = document.getElementById('adj-' + key1);
      if (adjLine) adjLine.classList.toggle('highlight', adj.includes(t.id));
    }
  }

  for (const [did] of Object.entries(DISTRICTS)) {
    const terrs = TERRITORIES.filter(t => t.district === did);
    const distEl = document.getElementById('district-' + did);
    if (!distEl) continue;
    const ownerIds = [...new Set(terrs.map(t => state.gameState.territories[t.id]?.owner).filter(Boolean))];
    if (ownerIds.length === 1 && terrs.every(t => state.gameState.territories[t.id]?.owner === ownerIds[0])) {
      const owner = state.gameState.players.find(p => p.id === ownerIds[0]);
      distEl.setAttribute('fill', owner?.color || '#1a1a2a');
      distEl.setAttribute('fill-opacity', '0.4');
    } else {
      distEl.setAttribute('fill', DISTRICTS[did]?.color || '#1a1a2a');
      distEl.setAttribute('fill-opacity', '0.75');
    }
  }
}

export function selectTerritory(tid) {
  state.selectedTerritory = tid;
  document.querySelectorAll('.adj-line').forEach(l => l.classList.remove('highlight'));
  updateTerritoryVisuals();
  renderActionPanel();
}
