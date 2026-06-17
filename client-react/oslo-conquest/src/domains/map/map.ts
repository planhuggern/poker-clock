import { SVG, Svg, G, Path, Rect, Circle, Text } from '@svgdotjs/svg.js';
import { TERRITORIES, DISTRICTS, CHECKPOINTS } from '../game/model/game-data.js';
import { findPlayerByOwner } from '../game/state/game-state.js';
import { GameState, Territory, MapNode } from '../game/types.js';
import rawMapData from './map.json';

export const MAP_W = 900;
export const MAP_H = 850;

type MapData = {
  TERRITORY_POS: Record<string, [number, number]>;
  territoryShapes: Record<string, string>;
  districtShapes: Record<string, string>;
  specialShapes: Record<string, string>;
  _rawTerritories: Record<string, [number, number][]>;
  _rawDistricts: Record<string, [number, number][]>;
  _rawSpecial: Record<string, [number, number][]>;
};

const mapData = rawMapData as unknown as MapData;

export const TERRITORY_POS = mapData.TERRITORY_POS;

const PIECE_POS: Record<string, [number, number]> = Object.fromEntries(
  Object.entries(mapData._rawTerritories).map(([id, pts]) => [id, polygonCentroid(pts as [number, number][])]),
);

const CHECKPOINT_POS: Record<string, [number, number]> = {
  lørenskog: [852, 160],
  lysaker: [58, 270],
  kolbotn: [545, 796],
};

type MapTransform = { x: number; y: number; scale: number };
type PanState = { active: boolean; hasMoved: boolean; startX: number; startY: number; startTx: number; startTy: number };
type TerritoryNode = { group: G; poly: Path; units: Text | null };
type PlayerPiece = { group: G; outer: Circle; inner: Circle; label: Text };
type TooltipWidget = { group: G; box: Rect; title: Text; district: Text; owner: Text };
type UpdateOptions = { gameState?: GameState | null; selectedTerritory?: string | null };
export type MapAdapter = { update: (opts?: UpdateOptions) => void; fit: () => void; destroy: () => void };

function polygonCentroid(pts: [number, number][]): [number, number] {
  const n = pts.length;
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area /= 2;
  if (Math.abs(area) < 1e-10) {
    return [
      Math.round(pts.reduce((s, p) => s + p[0], 0) / n),
      Math.round(pts.reduce((s, p) => s + p[1], 0) / n),
    ];
  }
  const f = 1 / (6 * area);
  return [Math.round(cx * f), Math.round(cy * f)];
}

function addDefs(draw: Svg): void {
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

function buildTooltip(draw: Svg): TooltipWidget {
  const group = draw.group().attr({ id: 'map-tooltip-svg', 'pointer-events': 'none' }).hide();
  const box = group.rect(190, 62).radius(4).attr({
    fill: 'rgba(10,10,20,0.97)', stroke: '#c9a84c', 'stroke-width': 1,
  });
  const title = group.text('').attr({ x: 10, y: 10, fill: '#e8c97a', 'font-size': 12, 'font-weight': 700 });
  const district = group.text('').attr({ x: 10, y: 28, fill: '#888', 'font-size': 10, 'font-style': 'italic' });
  const owner = group.text('').attr({ x: 10, y: 45, fill: '#888', 'font-size': 10 });
  return { group, box, title, district, owner };
}

function tooltipPosition(event: PointerEvent, container: HTMLElement, transform: MapTransform) {
  const rect = container.getBoundingClientRect();
  const screenX = Math.min(event.clientX - rect.left + 14, rect.width - 205);
  const screenY = Math.max(event.clientY - rect.top - 10, 10);
  return {
    x: (screenX - transform.x) / transform.scale,
    y: (screenY - transform.y) / transform.scale,
  };
}

function setTooltipText(tooltip: TooltipWidget, territory: MapNode, gameState: GameState | null): void {
  const territoryState = gameState?.territories?.[territory.id];
  const ownerPlayer = findPlayerByOwner(territoryState?.owner);
  const district = territory.type === 'territory' ? DISTRICTS[territory.district] : null;
  tooltip.title.text(territory.name);
  tooltip.district.text(territory.type === 'checkpoint' ? 'Checkpoint · friområde' : district?.name ?? '');
  tooltip.owner.text(territory.type === 'checkpoint'
    ? 'Trygt område · ingen eier'
    : `${ownerPlayer?.name ?? 'Nøytral'} · ${territoryState?.units ?? 0} units`);
  tooltip.owner.attr({ fill: ownerPlayer?.color ?? '#888' });
}

function applyMapTransform(svgNode: SVGSVGElement, transform: MapTransform): void {
  svgNode.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
}

export function createMapAdapter(
  container: HTMLElement,
  { onSelectTerritory }: { onSelectTerritory?: (id: string) => void } = {},
): MapAdapter {
  container.innerHTML = '';

  const draw = SVG().addTo(container).size(MAP_W, MAP_H).viewbox(0, 0, MAP_W, MAP_H);
  draw.attr({ id: 'oslo-svg' });

  const transform: MapTransform = { x: 0, y: 0, scale: 1 };
  const panState: PanState = { active: false, hasMoved: false, startX: 0, startY: 0, startTx: 0, startTy: 0 };
  const territoryNodes = new Map<string, TerritoryNode>();
  const districtNodes = new Map<string, Path>();
  const playerPieces = new Map<string, PlayerPiece>();
  let currentGameState: GameState | null = null;
  let currentSelectedTerritory: string | null = null;

  addDefs(draw);
  draw.rect(MAP_W, MAP_H).fill('#0d1520');

  if (mapData.specialShapes.oslofjorden) {
    draw.path(mapData.specialShapes.oslofjorden).fill('#0f2540').opacity(0.92);
    draw.path(mapData.specialShapes.oslofjorden).fill('url(#water-pat)').opacity(0.5);
    const [fjx, fjy] = polygonCentroid(mapData._rawSpecial.oslofjorden);
    draw.text('OSLOFJORDEN').attr({
      x: fjx, y: fjy, 'font-family': 'Georgia,serif', 'font-size': 11,
      fill: 'rgba(100,160,220,0.35)', 'letter-spacing': 3, 'text-anchor': 'middle',
    });
  }

  for (const [sid, label] of [['nordmarka', 'NORDMARKA'], ['østmarka', 'ØSTMARKA']] as const) {
    const shape = mapData.specialShapes[sid];
    if (!shape) continue;
    draw.path(shape).fill('#0d1a0d').opacity(0.85);
    const [lx, ly] = polygonCentroid(mapData._rawSpecial[sid]);
    draw.text(label).attr({
      x: lx, y: ly, 'font-family': 'Georgia,serif', 'font-size': 10,
      fill: 'rgba(80,140,80,0.4)', 'letter-spacing': 2, 'text-anchor': 'middle',
    });
  }

  const districtGroup = draw.group().attr({ id: 'district-layer' });
  for (const [districtId, pathD] of Object.entries(mapData.districtShapes)) {
    const districtInfo = DISTRICTS[districtId];
    const districtPath = districtGroup.path(pathD).attr({
      id: `district-${districtId}`, class: 'svg-district',
      fill: districtInfo?.color ?? '#1a1a2a', 'fill-opacity': 0.12,
      stroke: '#2a3a2a', 'stroke-width': 1.5,
    });
    districtNodes.set(districtId, districtPath);
    const rawPts = mapData._rawDistricts[districtId];
    if (rawPts) {
      const [lx, ly] = polygonCentroid(rawPts);
      districtGroup.text(districtInfo?.name?.split(' ')[0] ?? districtId).attr({ class: 'district-label', x: lx, y: ly });
    }
  }

  const checkpointGroup = draw.group().attr({ id: 'checkpoint-layer' });
  for (const [checkpointId, checkpoint] of Object.entries(CHECKPOINTS)) {
    const pos = CHECKPOINT_POS[checkpointId];
    if (!pos) continue;
    const [cx, cy] = pos;
    const territoryId = `${checkpointId}_cp`;
    const territory = TERRITORIES.find((t) => t.id === territoryId);
    const shape = mapData.specialShapes[checkpointId];
    if (!territory || !shape) continue;

    const group = checkpointGroup.group().attr({
      id: `terr-${territoryId}`, class: 'svg-territory checkpoint-territory',
      'data-id': territoryId, filter: 'url(#cp-glow)',
    });
    const poly = group.path(shape).attr({
      class: 'terr-poly', fill: 'rgba(255,232,150,0.28)',
      stroke: 'rgba(255,215,0,0.75)', 'stroke-width': 1.4,
      'stroke-dasharray': 'none', 'pointer-events': 'all',
    });
    group.polygon(`${cx},${cy - 18} ${cx + 13},${cy} ${cx},${cy + 18} ${cx - 13},${cy}`).attr({
      fill: 'rgba(255,215,0,0.18)', stroke: '#ffd700', 'stroke-width': 1.8, 'pointer-events': 'none',
    });
    group.circle(7).center(cx, cy).fill('#ffd700');
    group.text(checkpoint.name).attr({ class: 'checkpoint-label', x: cx, y: cy + 28 });
    group.text(checkpointId === 'lørenskog' ? 'START' : 'CHECKPOINT').attr({
      class: 'checkpoint-label', x: cx, y: cy + 39, style: 'font-size:7px;fill:rgba(255,215,0,0.6)',
    });

    group.on('mouseenter', (event) => { setTooltipText(tooltip, territory, currentGameState); tooltip.group.show(); moveTooltip(event as PointerEvent); });
    group.on('mousemove', (event) => moveTooltip(event as PointerEvent));
    group.on('mouseleave', () => tooltip.group.hide());
    group.on('pointerup', () => { if (panState.hasMoved) return; onSelectTerritory?.(territoryId); });

    territoryNodes.set(territoryId, { group, poly, units: null });
  }

  const territoryGroup = draw.group().attr({ id: 'territory-layer' });
  for (const territory of TERRITORIES) {
    if (territory.type === 'checkpoint') continue;
    const terr = territory as Territory;
    const pathD = mapData.territoryShapes[terr.id];
    const pos = TERRITORY_POS[terr.id];
    if (!pathD || !pos) continue;

    const [cx, cy] = pos;
    const group = territoryGroup.group().attr({ id: `terr-${terr.id}`, class: 'svg-territory', 'data-id': terr.id });
    const poly = group.path(pathD).attr({
      class: 'terr-poly', fill: '#1a1a2a', 'fill-opacity': 0.6,
      stroke: 'rgba(201,168,76,0.5)', 'stroke-width': 1, 'stroke-dasharray': '4 3', 'pointer-events': 'all',
    });
    group.text(terr.name).attr({ class: 'terr-label', x: cx, y: cy - 3 });
    const units = group.text(String(terr.neutralUnits)).attr({ class: 'terr-units', id: `units-${terr.id}`, x: cx, y: cy + 8 });

    group.on('mouseenter', (event) => { setTooltipText(tooltip, terr, currentGameState); tooltip.group.show(); moveTooltip(event as PointerEvent); });
    group.on('mousemove', (event) => moveTooltip(event as PointerEvent));
    group.on('mouseleave', () => tooltip.group.hide());
    group.on('pointerup', () => { if (panState.hasMoved) return; onSelectTerritory?.(terr.id); });

    territoryNodes.set(terr.id, { group, poly, units });
  }

  const borderGroup = draw.group().attr({ id: 'district-border-layer', 'pointer-events': 'none' });
  for (const pathD of Object.values(mapData.districtShapes)) {
    borderGroup.path(pathD).attr({ fill: 'none', stroke: '#3a4a3a', 'stroke-width': 1.8 });
  }

  const pieceLayer = draw.group().attr({ id: 'piece-layer', 'pointer-events': 'none' });

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

  function fit(): void {
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (!cw || !ch) return;
    transform.scale = Math.min(cw / MAP_W, ch / MAP_H) * 0.95;
    transform.x = (cw - MAP_W * transform.scale) / 2;
    transform.y = (ch - MAP_H * transform.scale) / 2;
    applyMapTransform(draw.node, transform);
  }

  function moveTooltip(event: PointerEvent): void {
    const position = tooltipPosition(event, container, transform);
    tooltip.group.transform({ translateX: position.x, translateY: position.y });
  }

  function update({ gameState = currentGameState, selectedTerritory = currentSelectedTerritory }: UpdateOptions = {}): void {
    currentGameState = gameState ?? null;
    currentSelectedTerritory = selectedTerritory ?? null;
    if (!currentGameState) return;

    const activePlayer = currentGameState.players?.find((p) => p.side === currentGameState!.activePlayer);
    const reachable = new Set<string>(activePlayer?.validMoves ?? []);

    const districtFullOwner = new Map<string, string>();
    for (const districtId of Object.keys(DISTRICTS)) {
      const dTerrs = TERRITORIES.filter((t): t is Territory => t.type === 'territory' && t.district === districtId);
      const ownerId = dTerrs[0] && currentGameState.territories[dTerrs[0].id]?.owner;
      if (ownerId && dTerrs.every((t) => currentGameState!.territories[t.id]?.owner === ownerId)) {
        districtFullOwner.set(districtId, ownerId);
      }
    }

    for (const territory of TERRITORIES) {
      const nodes = territoryNodes.get(territory.id);
      if (!nodes) continue;

      const territoryState = currentGameState.territories[territory.id];
      const isSelected = currentSelectedTerritory === territory.id;
      const isReachable = reachable.has(territory.id);

      if (territory.type === 'checkpoint') {
        if (isSelected) nodes.group.addClass('selected');
        else nodes.group.removeClass('selected');
        nodes.poly.attr({
          fill: isSelected ? 'rgba(255,232,150,0.42)' : 'rgba(255,232,150,0.28)',
          stroke: isSelected ? 'rgba(255,215,0,0.95)' : '#ffd700',
          'stroke-width': isSelected ? 2.4 : 1.8,
          filter: isSelected ? 'url(#sel-glow)' : '',
        });
        continue;
      }

      const owner = findPlayerByOwner(territoryState?.owner);
      if (owner) {
        nodes.poly.attr({ fill: owner.color, 'fill-opacity': 0.85, stroke: owner.color, filter: '' });
      } else {
        const districtColor = DISTRICTS[(territory as Territory).district]?.color ?? '#1a1a2a';
        nodes.poly.attr({ fill: districtColor, 'fill-opacity': 0.25, stroke: 'rgba(201,168,76,0.5)', filter: '' });
      }

      nodes.units?.text(String(territoryState?.units ?? 0));

      if (isSelected) {
        nodes.group.addClass('selected');
        nodes.poly.attr({ stroke: 'rgba(255,215,0,0.9)', 'stroke-width': 2, 'stroke-dasharray': 'none', filter: 'url(#sel-glow)' });
      } else {
        nodes.group.removeClass('selected');
        if (isReachable) {
          nodes.group.addClass('reachable');
          nodes.poly.attr({ stroke: 'rgba(140,255,180,0.9)', 'stroke-width': 1.8, 'stroke-dasharray': 'none', filter: '' });
        } else {
          nodes.group.removeClass('reachable');
          nodes.poly.attr({ 'stroke-width': 1, 'stroke-dasharray': '4 3' });
        }
      }
    }

    for (const [districtId, districtInfo] of Object.entries(DISTRICTS)) {
      const districtPath = districtNodes.get(districtId);
      if (!districtPath) continue;
      const fullOwner = districtFullOwner.get(districtId);
      if (fullOwner) {
        const owner = findPlayerByOwner(fullOwner);
        districtPath.attr({ fill: owner?.color ?? districtInfo.color, 'fill-opacity': 0.30, filter: 'url(#sel-glow)' });
      } else {
        districtPath.attr({ fill: districtInfo.color, 'fill-opacity': 0.12, filter: '' });
      }
    }

    for (const player of currentGameState.players ?? []) {
      const position = player.position;
      if (!position) { playerPieces.get(player.id)?.group.hide(); continue; }

      let coords: [number, number] | undefined = PIECE_POS[position] ?? TERRITORY_POS[position];
      if (!coords && position.endsWith('_cp')) {
        coords = CHECKPOINT_POS[position.replace('_cp', '')];
      }
      if (!coords) { playerPieces.get(player.id)?.group.hide(); continue; }

      let piece = playerPieces.get(player.id);
      if (!piece) {
        const group = pieceLayer.group().attr({ class: 'player-piece' });
        const outer = group.circle(16).attr({ fill: 'rgba(5,5,10,0.85)', stroke: '#d7d7d7', 'stroke-width': 1.2 });
        const inner = group.circle(12).attr({ fill: player.color ?? '#ddd' });
        const label = group.text((player.name ?? '?').slice(0, 1).toUpperCase()).attr({
          fill: '#f8f8f8', 'font-size': 9, 'font-family': 'Cinzel Decorative, serif',
          'font-weight': 700, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        });
        piece = { group, outer, inner, label };
        playerPieces.set(player.id, piece);
      }

      piece.group.center(coords[0], coords[1] - 12).show();
      piece.inner.attr({ fill: player.color ?? '#ddd' });
      piece.label.text((player.name ?? '?').slice(0, 1).toUpperCase());
      piece.outer.attr({
        stroke: player.side === currentGameState.activePlayer ? '#ffd700' : '#d7d7d7',
        'stroke-width': player.side === currentGameState.activePlayer ? 2 : 1.2,
      });
    }
  }

  function onPointerDown(event: PointerEvent): void {
    panState.active = true;
    panState.hasMoved = false;
    panState.startX = event.clientX;
    panState.startY = event.clientY;
    panState.startTx = transform.x;
    panState.startTy = transform.y;
    container.classList.add('grabbing');
  }

  function onPointerMove(event: PointerEvent): void {
    if (!panState.active) return;
    const dx = event.clientX - panState.startX;
    const dy = event.clientY - panState.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) panState.hasMoved = true;
    transform.x = panState.startTx + dx;
    transform.y = panState.startTy + dy;
    applyMapTransform(draw.node, transform);
    tooltip.group.hide();
  }

  function onPointerUp(): void {
    panState.active = false;
    container.classList.remove('grabbing');
    setTimeout(() => { panState.hasMoved = false; }, 20);
  }

  function onWheel(event: WheelEvent): void {
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

  container.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  container.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('resize', fit);

  requestAnimationFrame(() => { fit(); update(); });

  return {
    update,
    fit,
    destroy() {
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', fit);
      draw.remove();
    },
  };
}
