import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../ui.js');
vi.mock('../map.js');
vi.mock('../missions.js');
vi.mock('../dice.js');
vi.mock('../modals.js');
vi.mock('../websocket.js');

import { state } from '../state.js';
import { createInitialGameState } from '../game-state.js';
import { buyTerritory, invadeTerritory, endTurn } from '../actions.js';
import { TERRITORIES, DISTRICTS } from '../game-data.js';

function freshState(playerDefs = [{ id: 'p1', name: 'Spiller 1' }, { id: 'p2', name: 'Spiller 2' }]) {
  state.gameState = createInitialGameState(playerDefs);
  state.gameState.currentPlayerIdx = 0;
  state.myPlayerId = playerDefs[0].id;
}

beforeEach(() => freshState());
afterEach(() => { vi.restoreAllMocks(); });

describe('buyTerritory', () => {
  it('kjøper nøytralt territorium og trekker penger og en bataljon', () => {
    const cp = state.gameState.players[0];
    const tid = 't3'; // Tøyen, pris 260
    const moneyBefore = cp.money;
    const unitsBefore = cp.units;

    buyTerritory(tid);

    expect(state.gameState.territories[tid].owner).toBe('p1');
    expect(state.gameState.territories[tid].units).toBe(1);
    expect(cp.money).toBe(moneyBefore - 260);
    expect(cp.units).toBe(unitsBefore - 1);
  });

  it('avviser kjøp av territorium som allerede er eid', () => {
    const tid = 't3';
    state.gameState.territories[tid].owner = 'p2';
    const moneyBefore = state.gameState.players[0].money;

    buyTerritory(tid);

    expect(state.gameState.territories[tid].owner).toBe('p2');
    expect(state.gameState.players[0].money).toBe(moneyBefore);
  });

  it('avviser kjøp når spilleren har for lite penger', () => {
    const cp = state.gameState.players[0];
    cp.money = 100; // Tøyen koster 260

    buyTerritory('t3');

    expect(state.gameState.territories['t3'].owner).toBeNull();
    expect(cp.money).toBe(100);
  });
});

describe('invadeTerritory', () => {
  it('avviser angrep når angriperen ikke eier tilstøtende territorium', () => {
    // Alle territorier er nøytrale — p1 eier ingenting, er heller ikke på t1
    const ts = state.gameState.territories['t1'];
    const unitsBefore = state.gameState.players[0].units;

    invadeTerritory('t1');

    expect(ts.owner).toBeNull();
    expect(state.gameState.players[0].units).toBe(unitsBefore);
  });

  it('lar angriper ta territorium fra tilstøtende eget felt med sterke terninger', () => {
    // p1 eier t1 (som er nabo til t2), p2 eier t2 med 1 bataljon
    state.gameState.territories['t1'].owner = 'p1';
    state.gameState.territories['t1'].units = 3;
    state.gameState.territories['t2'].owner = 'p2';
    state.gameState.territories['t2'].units = 1;

    // Angriper kaster 6, 6, 6 — forsvarer kaster 1 → angriper vinner garantert
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.99)   // angriper terning 1 → 6
      .mockReturnValueOnce(0.99)   // angriper terning 2 → 6
      .mockReturnValueOnce(0.99)   // angriper terning 3 → 6
      .mockReturnValueOnce(0.001); // forsvarer terning → 1

    invadeTerritory('t2');

    expect(state.gameState.territories['t2'].owner).toBe('p1');
  });
});

describe('endTurn', () => {
  it('gir turen til neste spiller', () => {
    endTurn();

    expect(state.gameState.currentPlayerIdx).toBe(1);
  });

  it('nullstiller terningkast og diceUsed for spilleren som avsluttet', () => {
    const cp = state.gameState.players[0];
    cp.diceRoll = 4;
    cp.diceUsed = 2;

    endTurn();

    expect(cp.diceRoll).toBeNull();
    expect(cp.diceUsed).toBe(0);
  });

  it('hopper over eliminerte spillere', () => {
    freshState([
      { id: 'p1', name: 'Spiller 1' },
      { id: 'p2', name: 'Spiller 2' },
      { id: 'p3', name: 'Spiller 3' },
    ]);
    state.gameState.players[1].eliminated = true; // p2 er ute

    endTurn();

    expect(state.gameState.currentPlayerIdx).toBe(2); // hopper over p2 (idx 1)
  });

  it('deler ut bydelsbonus når spiller eier alle territorier i en bydel', () => {
    const cp = state.gameState.players[0];
    const did = 'sagene'; // t7 + t8, bonus: +200 kr, +1 bat.
    for (const t of TERRITORIES.filter(t => t.district === did)) {
      state.gameState.territories[t.id].owner = 'p1';
    }
    const moneyBefore = cp.money;
    const unitsBefore = cp.units;
    const { money: bonusMoney, units: bonusUnits } = DISTRICTS[did].bonus;

    endTurn();

    expect(cp.money).toBe(moneyBefore + bonusMoney);
    expect(cp.units).toBe(unitsBefore + bonusUnits);
  });
});
