// Tegner og oppdaterer SVG-kartet over Oslo.
// Håndterer også pan (dra kartet rundt) og zoom (scroll), og tooltip når du holder over et område.

import { TERRITORIES, DISTRICTS, ADJACENCY, CHECKPOINTS } from './game-data.js';
import { state } from './state.js';
import { renderHUD, renderActionPanel, renderCheckpointBar } from './ui.js';
import mapData from './map.json';

export const MAP_W = 900;
export const MAP_H = 800;

// Territorieposisjoner (sentrum) beregnet fra tegnede polygoner i karteditoren
export const TERRITORY_POS = mapData.TERRITORY_POS;

// Sjekkpunktposisjoner beregnet fra spesialstedpolygonene
const CHECKPOINT_POS = {
  'lørenskog': [827, 165],
  'lysaker':   [97,  248],
  'kolbotn':   [511, 769],
};

function centroid(pts) {
  return [
    Math.round(pts.reduce((s, p) => s + p[0], 0) / pts.length),
    Math.round(pts.reduce((s, p) => s + p[1], 0) / pts.length),
  ];
}

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

  // ── Bakgrunn ──────────────────────────────────────────────────────────────

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', MAP_W); bg.setAttribute('height', MAP_H);
  bg.setAttribute('fill', '#0d1520');
  svg.appendChild(bg);

  // ── Oslofjorden ───────────────────────────────────────────────────────────

  if (mapData.specialShapes.oslofjorden) {
    const water1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    water1.setAttribute('d', mapData.specialShapes.oslofjorden);
    water1.setAttribute('fill', '#0f2540');
    water1.setAttribute('opacity', '0.92');
    svg.appendChild(water1);

    const water2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    water2.setAttribute('d', mapData.specialShapes.oslofjorden);
    water2.setAttribute('fill', 'url(#water-pat)');
    water2.setAttribute('opacity', '0.5');
    svg.appendChild(water2);

    const fjordLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    fjordLabel.setAttribute('font-family', 'Georgia,serif');
    fjordLabel.setAttribute('font-size', '11');
    fjordLabel.setAttribute('fill', 'rgba(100,160,220,0.35)');
    fjordLabel.setAttribute('letter-spacing', '3');
    fjordLabel.setAttribute('text-anchor', 'middle');
    const [fjx, fjy] = centroid(mapData._rawSpecial.oslofjorden);
    fjordLabel.setAttribute('x', fjx); fjordLabel.setAttribute('y', fjy);
    fjordLabel.textContent = 'OSLOFJORDEN';
    svg.appendChild(fjordLabel);
  }

  // ── Skog (Nordmarka / Østmarka) ───────────────────────────────────────────

  for (const [sid, label] of [['nordmarka', 'NORDMARKA'], ['østmarka', 'ØSTMARKA']]) {
    const shape = mapData.specialShapes[sid];
    if (!shape) continue;
    const forest = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    forest.setAttribute('d', shape);
    forest.setAttribute('fill', '#0d1a0d');
    forest.setAttribute('opacity', '0.85');
    svg.appendChild(forest);

    const [lx, ly] = centroid(mapData._rawSpecial[sid]);
    const forestLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    forestLabel.setAttribute('font-family', 'Georgia,serif');
    forestLabel.setAttribute('font-size', '10');
    forestLabel.setAttribute('fill', 'rgba(80,140,80,0.4)');
    forestLabel.setAttribute('letter-spacing', '2');
    forestLabel.setAttribute('text-anchor', 'middle');
    forestLabel.setAttribute('x', lx); forestLabel.setAttribute('y', ly);
    forestLabel.textContent = label;
    svg.appendChild(forestLabel);
  }

  // ── Bydeler ───────────────────────────────────────────────────────────────

  const districtGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  districtGroup.setAttribute('id', 'district-layer');

  for (const [did, pathD] of Object.entries(mapData.districtShapes)) {
    const distInfo = DISTRICTS[did];

    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', pathD);
    p.setAttribute('id', 'district-' + did);
    p.setAttribute('class', 'svg-district');
    p.setAttribute('fill', distInfo?.color || '#1a1a2a');
    p.setAttribute('fill-opacity', '0.75');
    p.setAttribute('stroke', '#2a3a2a');
    p.setAttribute('stroke-width', '1.5');
    districtGroup.appendChild(p);

    // Bydelsnavn beregnet fra polygonens tyngdepunkt
    const rawPts = mapData._rawDistricts[did];
    if (rawPts) {
      const [lx, ly] = centroid(rawPts);
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('class', 'district-label');
      t.setAttribute('x', lx); t.setAttribute('y', ly);
      t.textContent = distInfo?.name?.split(' ')[0] || did;
      districtGroup.appendChild(t);
    }
  }
  svg.appendChild(districtGroup);

  // ── Nabolinjer mellom territorier ─────────────────────────────────────────

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
      const t1info = TERRITORIES.find(t => t.id === tid);
      const t2info = TERRITORIES.find(t => t.id === nid);
      const sameDistrict = t1info && t2info && t1info.district === t2info.district;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('id', `adj-${key}`);
      line.setAttribute('class', sameDistrict ? 'adj-line intra-district' : 'adj-line');
      line.setAttribute('x1', pos1[0]); line.setAttribute('y1', pos1[1]);
      line.setAttribute('x2', pos2[0]); line.setAttribute('y2', pos2[1]);
      adjGroup.appendChild(line);
    }
  }
  svg.appendChild(adjGroup);

  // ── Sjekkpunkt-markører ───────────────────────────────────────────────────

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

  // ── Territorier ───────────────────────────────────────────────────────────

  const terrGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  terrGroup.setAttribute('id', 'territory-layer');
  for (const t of TERRITORIES) {
    const pos = TERRITORY_POS[t.id];
    if (!pos) continue;
    const [cx, cy] = pos;
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

  // ── Kompass ───────────────────────────────────────────────────────────────

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

// Farger alle territorier og bydeler basert på hvem som eier dem akkurat nå.
// Kalles etter hvert trekk slik at kartet alltid speiler spilltilstanden.
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

// Merker et territorium som valgt og oppdaterer handlingspanelet til høyre.
export function selectTerritory(tid) {
  state.selectedTerritory = tid;
  document.querySelectorAll('.adj-line').forEach(l => l.classList.remove('highlight'));
  updateTerritoryVisuals();
  renderActionPanel();
}
