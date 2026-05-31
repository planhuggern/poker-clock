import { describe, it, expect } from 'vitest';
import { TERRITORIES, ADJACENCY } from '../../domains/game/model/game-data.js';
import mapData from '../../domains/map/map.json';

const { specialShapes, territoryShapes, _rawSpecial, _rawTerritories } = mapData;

function sharePoint(ptsA, ptsB, tol = 2) {
  const tol2 = tol * tol;
  for (const [ax, ay] of ptsA) {
    for (const [bx, by] of ptsB) {
      const dx = ax - bx, dy = ay - by;
      if (dx * dx + dy * dy <= tol2) return true;
    }
  }
  return false;
}

const territoryIds = new Set(TERRITORIES.map(t => t.id));
const shapedTerritoryIds = new Set(TERRITORIES.filter(t => t.type !== 'checkpoint').map(t => t.id));
const shapeIds = new Set(Object.keys(territoryShapes));
const adjacencyIds = new Set(Object.keys(ADJACENCY));
const checkpointTerritories = TERRITORIES.filter(t => t.type === 'checkpoint');

describe('H1: ID-konsistens', () => {
  it('alle TERRITORIES-IDer finnes i territoryShapes', () => {
    expect([...shapedTerritoryIds].filter(id => !shapeIds.has(id))).toEqual([]);
  });

  it('alle TERRITORIES-IDer finnes i ADJACENCY', () => {
    expect([...territoryIds].filter(id => !adjacencyIds.has(id))).toEqual([]);
  });

  it('alle territoryShapes-IDer finnes i TERRITORIES', () => {
    expect([...shapeIds].filter(id => !territoryIds.has(id))).toEqual([]);
  });

  it('alle ADJACENCY-IDer finnes i TERRITORIES', () => {
    expect([...adjacencyIds].filter(id => !territoryIds.has(id))).toEqual([]);
  });
});

describe('Checkpoint-friområder', () => {
  it('har eksplisitte landbare nabolister', () => {
    expect(ADJACENCY.kolbotn_cp).toEqual(expect.arrayContaining(['t35', 't34']));
    expect(ADJACENCY.lørenskog_cp).toEqual(expect.arrayContaining(['t26', 't27', 't28']));
    expect(ADJACENCY.lysaker_cp).toEqual(expect.arrayContaining(['t17', 't15']));
  });

  it('har specialShape-geometri for polygonflatene', () => {
    const missing = checkpointTerritories
      .map(t => t.checkpoint)
      .filter(checkpointId => !specialShapes[checkpointId] || !_rawSpecial[checkpointId]);
    expect(missing).toEqual([]);
  });
});

describe('H4: Symmetri i ADJACENCY', () => {
  it('for hvert t1→t2 gjelder t2→t1', () => {
    const asymmetric = [];
    for (const [t1, neighbors] of Object.entries(ADJACENCY)) {
      for (const t2 of neighbors) {
        if (!ADJACENCY[t2]?.includes(t1)) asymmetric.push(`${t1}→${t2}`);
      }
    }
    expect(asymmetric).toEqual([]);
  });
});

describe('H2: ADJACENCY → geometri', () => {
  it('alle nabopar i ADJACENCY deler minst ett polygonpunkt (innen 2px)', () => {
    const missing = [];
    const checked = new Set();
    for (const [t1, neighbors] of Object.entries(ADJACENCY)) {
      for (const t2 of neighbors) {
        const key = [t1, t2].sort().join('|');
        if (checked.has(key)) continue;
        checked.add(key);
        const pts1 = _rawTerritories[t1];
        const pts2 = _rawTerritories[t2];
        if (!pts1 || !pts2) continue;
        if (!sharePoint(pts1, pts2)) missing.push(`${t1}↔${t2}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('H3: geometri → ADJACENCY (hull-sjekk)', () => {
  it('polygonpar som deler punkt er naboer i ADJACENCY', () => {
    const allIds = [...territoryIds];
    const holes = [];
    for (let i = 0; i < allIds.length; i++) {
      for (let j = i + 1; j < allIds.length; j++) {
        const t1 = allIds[i], t2 = allIds[j];
        const pts1 = _rawTerritories[t1];
        const pts2 = _rawTerritories[t2];
        if (!pts1 || !pts2) continue;
        if (sharePoint(pts1, pts2) && !ADJACENCY[t1]?.includes(t2)) {
          holes.push(`${t1}↔${t2}`);
        }
      }
    }
    expect(holes).toEqual([]);
  });
});
