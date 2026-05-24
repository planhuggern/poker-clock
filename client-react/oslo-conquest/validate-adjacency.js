// Validerer at ADJACENCY i game-data.js stemmer med polygongeometrien i map.json.
// Kjøres med: node oslo-conquest/validate-adjacency.js (fra client-react/)
// Avslutter med exit-kode 1 hvis feil finnes, 0 hvis alt er OK.

import { createRequire } from 'module';
import { TERRITORIES, ADJACENCY } from './game-data.js';

const require = createRequire(import.meta.url);
const { territoryShapes, _rawTerritories } = require('./map.json');

const errors = [];
const fail = (msg) => errors.push(msg);

// Returnerer true hvis polygon A og B deler minst ett vertex innen tol piksler.
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

// H1: Alle IDer i TERRITORIES, ADJACENCY og territoryShapes skal matche hverandre.
const territoryIds = new Set(TERRITORIES.map(t => t.id));
const shapeIds     = new Set(Object.keys(territoryShapes));
const adjacencyIds = new Set(Object.keys(ADJACENCY));

for (const id of territoryIds) {
  if (!shapeIds.has(id))     fail(`H1: '${id}' finnes i TERRITORIES men ikke i territoryShapes`);
  if (!adjacencyIds.has(id)) fail(`H1: '${id}' finnes i TERRITORIES men ikke i ADJACENCY`);
}
for (const id of shapeIds) {
  if (!territoryIds.has(id)) fail(`H1: '${id}' finnes i territoryShapes men ikke i TERRITORIES`);
}
for (const id of adjacencyIds) {
  if (!territoryIds.has(id)) fail(`H1: '${id}' finnes i ADJACENCY men ikke i TERRITORIES`);
}

// H4: ADJACENCY skal være symmetrisk — hvis t1→t2, så t2→t1.
for (const [t1, neighbors] of Object.entries(ADJACENCY)) {
  for (const t2 of neighbors) {
    if (!ADJACENCY[t2]?.includes(t1)) {
      fail(`H4: Asymmetri — '${t1}' lister '${t2}' som nabo, men ikke omvendt`);
    }
  }
}

// H2: Hvert nabopar i ADJACENCY skal dele minst ett polygonpunkt.
const checkedPairs = new Set();
for (const [t1, neighbors] of Object.entries(ADJACENCY)) {
  for (const t2 of neighbors) {
    const key = [t1, t2].sort().join('|');
    if (checkedPairs.has(key)) continue;
    checkedPairs.add(key);

    const pts1 = _rawTerritories[t1];
    const pts2 = _rawTerritories[t2];
    if (!pts1 || !pts2) continue;

    if (!sharePoint(pts1, pts2)) {
      fail(`H2: '${t1}' og '${t2}' er naboer i ADJACENCY men deler ingen polygonpunkter (innen 2px)`);
    }
  }
}

// H3: Hvert polygon-par som deler et punkt skal stå i ADJACENCY (hull-sjekk).
const allIds = [...territoryIds];
for (let i = 0; i < allIds.length; i++) {
  for (let j = i + 1; j < allIds.length; j++) {
    const t1 = allIds[i], t2 = allIds[j];
    const pts1 = _rawTerritories[t1];
    const pts2 = _rawTerritories[t2];
    if (!pts1 || !pts2) continue;

    if (sharePoint(pts1, pts2) && !ADJACENCY[t1]?.includes(t2)) {
      fail(`H3: '${t1}' og '${t2}' deler polygonpunkter men er ikke naboer i ADJACENCY (mulig hull)`);
    }
  }
}

// Rapport
if (errors.length === 0) {
  console.log('OK: Alle kart-valideringer bestått (H1 ID-konsistens, H2 ADJACENCY→geometri, H3 hull-sjekk, H4 symmetri)');
} else {
  for (const e of errors) console.error('FEIL:', e);
  console.error(`\n${errors.length} feil funnet`);
  process.exit(1);
}
