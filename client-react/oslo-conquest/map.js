// SVG.js-adapter for Oslo-kartet. Preact eier state/livssyklus, adapteren eier SVG-noder og kartinteraksjon.

import { SVG } from '@svgdotjs/svg.js';
import { TERRITORIES, DISTRICTS, CHECKPOINTS } from './game-data.js';
import { findPlayerByOwner } from './game-state.js';
import mapData from './map.json';

export const MAP_W = 900;
export const MAP_H = 850;

// Territorieposisjoner (sentrum) beregnet fra tegnede polygoner i karteditoren
export const TERRITORY_POS = mapData.TERRITORY_POS;

// Sjekkpunktposisjoner beregnet fra spesialstedpolygonene
const CHECKPOINT_POS = {
  'lørenskog': [827, 165],
  lysaker: [97, 248],
  kolbotn: [511, 769],
};

function centroid(pts) {
  return [
    Math.round(pts.reduce((sum, point) => sum + point[0], 0) / pts.length),
    Math.round(pts.reduce((sum, point) => sum + point[1], 0) / pts.length),
  ];
}

function addDefs(draw) {
  draw.svg(`
    <defs>
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
    </defs>
  `);
}

function buildTooltip(draw) {
  const group = draw.group().attr({ id: 'map-tooltip-svg', 'pointer-events': 'none' }).hide();
  const box = group.rect(190, 62).radius(4).attr({
    fill: 'rgba(10,10,20,0.97)',
    stroke: '#c9a84c',
    'stroke-width': 1,
  });
  const title = group.text('').attr({
    x: 10,
    y: 10,
    fill: '#e8c97a',
    'font-size': 12,
    'font-weight': 700,
  });
  const district = group.text('').attr({
    x: 10,
    y: 28,
    fill: '#888',
    'font-size': 10,
    'font-style': 'italic',
  });
  const owner = group.text('').attr({
    x: 10,
    y: 45,
    fill: '#888',
    'font-size': 10,
  });

  return { group, box, title, district, owner };
}

function tooltipPosition(event, container, transform) {
  const rect = container.getBoundingClientRect();
  const screenX = Math.min(event.clientX - rect.left + 14, rect.width - 205);
  const screenY = Math.max(event.clientY - rect.top - 10, 10);
  return {
    x: (screenX - transform.x) / transform.scale,
    y: (screenY - transform.y) / transform.scale,
  };
}

function setTooltipText(tooltip, territory, gameState) {
  const territoryState = gameState?.territories?.[territory.id];
  const owner = findPlayerByOwner(territoryState?.owner);
  const district = DISTRICTS[territory.district];
  tooltip.title.text(territory.name);
  tooltip.district.text(district?.name || '');
  tooltip.owner.text(`${owner?.name || 'Nøytral'} · ${territoryState?.units || 0} units`);
  tooltip.owner.attr({ fill: owner?.color || '#888' });
}

function applyMapTransform(svgNode, transform) {
  svgNode.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
}

export function createMapAdapter(container, { onSelectTerritory } = {}) {
  container.innerHTML = '';

  const draw = SVG().addTo(container).size(MAP_W, MAP_H).viewbox(0, 0, MAP_W, MAP_H);
  draw.attr({ id: 'oslo-svg' });

  const transform = { x: 0, y: 0, scale: 1 };
  const panState = {
    active: false,
    hasMoved: false,
    startX: 0,
    startY: 0,
    startTx: 0,
    startTy: 0,
  };
  const territoryNodes = new Map();
  const districtNodes = new Map();
  let currentGameState = null;
  let currentSelectedTerritory = null;

  addDefs(draw);

  draw.rect(MAP_W, MAP_H).fill('#0d1520');

  if (mapData.specialShapes.oslofjorden) {
    draw.path(mapData.specialShapes.oslofjorden).fill('#0f2540').opacity(0.92);
    draw.path(mapData.specialShapes.oslofjorden).fill('url(#water-pat)').opacity(0.5);

    const [fjx, fjy] = centroid(mapData._rawSpecial.oslofjorden);
    draw.text('OSLOFJORDEN').attr({
      x: fjx,
      y: fjy,
      'font-family': 'Georgia,serif',
      'font-size': 11,
      fill: 'rgba(100,160,220,0.35)',
      'letter-spacing': 3,
      'text-anchor': 'middle',
    });
  }

  for (const [sid, label] of [['nordmarka', 'NORDMARKA'], ['østmarka', 'ØSTMARKA']]) {
    const shape = mapData.specialShapes[sid];
    if (!shape) continue;

    draw.path(shape).fill('#0d1a0d').opacity(0.85);
    const [lx, ly] = centroid(mapData._rawSpecial[sid]);
    draw.text(label).attr({
      x: lx,
      y: ly,
      'font-family': 'Georgia,serif',
      'font-size': 10,
      fill: 'rgba(80,140,80,0.4)',
      'letter-spacing': 2,
      'text-anchor': 'middle',
    });
  }

  const districtGroup = draw.group().attr({ id: 'district-layer' });
  for (const [districtId, pathD] of Object.entries(mapData.districtShapes)) {
    const districtInfo = DISTRICTS[districtId];
    const districtPath = districtGroup.path(pathD).attr({
      id: `district-${districtId}`,
      class: 'svg-district',
      fill: districtInfo?.color || '#1a1a2a',
      'fill-opacity': 0.75,
      stroke: '#2a3a2a',
      'stroke-width': 1.5,
    });
    districtNodes.set(districtId, districtPath);

    const rawPts = mapData._rawDistricts[districtId];
    if (rawPts) {
      const [lx, ly] = centroid(rawPts);
      districtGroup.text(districtInfo?.name?.split(' ')[0] || districtId).attr({
        class: 'district-label',
        x: lx,
        y: ly,
      });
    }
  }

  const checkpointGroup = draw.group().attr({ id: 'checkpoint-layer' });
  for (const [checkpointId, checkpoint] of Object.entries(CHECKPOINTS)) {
    const [cx, cy] = CHECKPOINT_POS[checkpointId];
    const group = checkpointGroup.group().attr({ filter: 'url(#cp-glow)' });
    group.svg(`
      <polygon points="${cx},${cy - 22} ${cx + 16},${cy} ${cx},${cy + 22} ${cx - 16},${cy}" fill="rgba(255,215,0,0.12)" stroke="#ffd700" stroke-width="1.8"/>
      <circle cx="${cx}" cy="${cy}" r="3.5" fill="#ffd700"/>
      <text class="checkpoint-label" x="${cx}" y="${cy + 36}">${checkpoint.name}</text>
      <text class="checkpoint-label" x="${cx}" y="${cy + 48}" style="font-size:7px;fill:rgba(255,215,0,0.6)">${checkpointId === 'lørenskog' ? 'START' : 'CHECKPOINT'}</text>
    `);
  }

  const territoryGroup = draw.group().attr({ id: 'territory-layer' });
  for (const territory of TERRITORIES) {
    const pathD = mapData.territoryShapes[territory.id];
    const pos = TERRITORY_POS[territory.id];
    if (!pathD || !pos) continue;

    const [cx, cy] = pos;
    const group = territoryGroup.group().attr({
      id: `terr-${territory.id}`,
      class: 'svg-territory',
      'data-id': territory.id,
    });
    const poly = group.path(pathD).attr({
      class: 'terr-poly',
      fill: '#1a1a2a',
      'fill-opacity': 0.6,
      stroke: 'rgba(201,168,76,0.5)',
      'stroke-width': 1,
      'stroke-dasharray': '4 3',
      'pointer-events': 'all',
    });
    group.text(territory.name).attr({ class: 'terr-label', x: cx, y: cy - 3 });
    const units = group.text(String(territory.neutralUnits)).attr({
      class: 'terr-units',
      id: `units-${territory.id}`,
      x: cx,
      y: cy + 8,
    });

    group.on('mouseenter', (event) => {
      setTooltipText(tooltip, territory, currentGameState);
      tooltip.group.show();
      moveTooltip(event);
    });
    group.on('mousemove', moveTooltip);
    group.on('mouseleave', () => tooltip.group.hide());
    group.on('pointerup', () => {
      if (panState.hasMoved) return;
      onSelectTerritory?.(territory.id);
    });

    territoryNodes.set(territory.id, { group, poly, units });
  }

  const borderGroup = draw.group().attr({ id: 'district-border-layer', 'pointer-events': 'none' });
  for (const pathD of Object.values(mapData.districtShapes)) {
    borderGroup.path(pathD).attr({
      fill: 'none',
      stroke: '#3a4a3a',
      'stroke-width': 1.8,
    });
  }

  const compass = draw.group().transform({ translateX: 840, translateY: 80 });
  compass.svg(`
    <circle cx="0" cy="0" r="24" fill="rgba(10,10,20,0.75)" stroke="#2a2a3a" stroke-width="1"/>
    <polygon points="0,-20 5,-7 -5,-7" fill="#c9a84c" opacity="0.9"/>
    <polygon points="0,20 5,7 -5,7" fill="#555" opacity="0.6"/>
    <polygon points="-20,0 -7,-5 -7,5" fill="#555" opacity="0.6"/>
    <polygon points="20,0 7,-5 7,5" fill="#555" opacity="0.6"/>
    <text font-family="Georgia,serif" font-size="11" fill="#c9a84c" x="0" y="-26" text-anchor="middle">N</text>
  `);

  const tooltip = buildTooltip(draw);

  function fit() {
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (!cw || !ch) return;
    transform.scale = Math.min(cw / MAP_W, ch / MAP_H) * 0.95;
    transform.x = (cw - MAP_W * transform.scale) / 2;
    transform.y = (ch - MAP_H * transform.scale) / 2;
    applyMapTransform(draw.node, transform);
  }

  function moveTooltip(event) {
    const position = tooltipPosition(event, container, transform);
    tooltip.group.transform({ translateX: position.x, translateY: position.y });
  }

  function update({ gameState = currentGameState, selectedTerritory = currentSelectedTerritory } = {}) {
    currentGameState = gameState;
    currentSelectedTerritory = selectedTerritory;
    if (!currentGameState) return;

    for (const territory of TERRITORIES) {
      const nodes = territoryNodes.get(territory.id);
      if (!nodes) continue;

      const territoryState = currentGameState.territories[territory.id];
      const owner = findPlayerByOwner(territoryState?.owner);
      if (owner) {
        nodes.poly.attr({
          fill: owner.color,
          'fill-opacity': 0.55,
          stroke: owner.color,
          filter: '',
        });
      } else {
        nodes.poly.attr({
          fill: '#1a1a2a',
          'fill-opacity': 0.6,
          stroke: 'rgba(201,168,76,0.5)',
          filter: '',
        });
      }

      nodes.units.text(String(territoryState?.units || 0));

      const isSelected = currentSelectedTerritory === territory.id;
      if (isSelected) {
        nodes.group.addClass('selected');
        nodes.poly.attr({
          stroke: 'rgba(255,215,0,0.9)',
          'stroke-width': 2,
          'stroke-dasharray': 'none',
          filter: 'url(#sel-glow)',
        });
      } else {
        nodes.group.removeClass('selected');
        nodes.poly.attr({
          'stroke-width': 1,
          'stroke-dasharray': '4 3',
        });
      }
    }

    for (const [districtId, districtInfo] of Object.entries(DISTRICTS)) {
      const territories = TERRITORIES.filter((territory) => territory.district === districtId);
      const districtPath = districtNodes.get(districtId);
      if (!districtPath) continue;

      const ownerIds = [...new Set(territories
        .map((territory) => currentGameState.territories[territory.id]?.owner)
        .filter(Boolean))];
      if (
        ownerIds.length === 1
        && territories.every((territory) => currentGameState.territories[territory.id]?.owner === ownerIds[0])
      ) {
        const owner = findPlayerByOwner(ownerIds[0]);
        districtPath.attr({ fill: owner?.color || '#1a1a2a', 'fill-opacity': 0.4 });
      } else {
        districtPath.attr({ fill: districtInfo?.color || '#1a1a2a', 'fill-opacity': 0.75 });
      }
    }
  }

  function onPointerDown(event) {
    panState.active = true;
    panState.hasMoved = false;
    panState.startX = event.clientX;
    panState.startY = event.clientY;
    panState.startTx = transform.x;
    panState.startTy = transform.y;
    container.classList.add('grabbing');
  }

  function onPointerMove(event) {
    if (!panState.active) return;
    const dx = event.clientX - panState.startX;
    const dy = event.clientY - panState.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) panState.hasMoved = true;
    transform.x = panState.startTx + dx;
    transform.y = panState.startTy + dy;
    applyMapTransform(draw.node, transform);
    tooltip.group.hide();
  }

  function onPointerUp() {
    panState.active = false;
    container.classList.remove('grabbing');
    setTimeout(() => { panState.hasMoved = false; }, 20);
  }

  function onWheel(event) {
    event.preventDefault();
    const rect = container.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    const nextScale = Math.min(Math.max(transform.scale * delta, 0.3), 4);
    transform.x = mx - (mx - transform.x) * (nextScale / transform.scale);
    transform.y = my - (my - transform.y) * (nextScale / transform.scale);
    transform.scale = nextScale;
    applyMapTransform(draw.node, transform);
  }

  function onResize() {
    fit();
  }

  container.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  container.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('resize', onResize);

  requestAnimationFrame(() => {
    fit();
    update();
  });

  const adapter = {
    update,
    fit,
    destroy() {
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      draw.remove();
    },
  };

  return adapter;
}
