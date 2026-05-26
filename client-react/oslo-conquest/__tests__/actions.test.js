import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createInitialGameState } from '../game-state.js';
import { reduceGameAction } from '../game-reducer.js';
import { DISTRICTS, TERRITORIES } from '../game-data.js';

let gameState;
const context = { playerId: 'p1', random: Math.random };

function freshState(playerDefs = [{ id: 'p1', name: 'Spiller 1' }, { id: 'p2', name: 'Spiller 2' }]) {
  gameState = createInitialGameState(playerDefs);
  gameState.currentPlayerIdx = 0;
}

function reduce(action, overrideContext = {}) {
  return reduceGameAction(gameState, { ...context, ...overrideContext }, action);
}

beforeEach(() => freshState());

describe('buy_territory', () => {
  it('kjøper nøytralt territorium og trekker penger og en bataljon', () => {
    const cp = gameState.players[0];
    const moneyBefore = cp.money;
    const unitsBefore = cp.units;

    const result = reduce({ type: 'buy_territory', territoryId: 't3' });

    expect(result.state).not.toBe(gameState);
    expect(result.state.territories.t3.owner).toBe('p1');
    expect(result.state.territories.t3.units).toBe(1);
    expect(result.state.players[0].money).toBe(moneyBefore - 260);
    expect(result.state.players[0].units).toBe(unitsBefore - 1);
    expect(result.events).toContainEqual({ type: 'send_state' });
  });

  it('avviser kjøp av territorium som allerede er eid', () => {
    gameState.territories.t3.owner = 'p2';
    const moneyBefore = gameState.players[0].money;

    const result = reduce({ type: 'buy_territory', territoryId: 't3' });

    expect(result.state.territories.t3.owner).toBe('p2');
    expect(result.state.players[0].money).toBe(moneyBefore);
    expect(result.events).toContainEqual({ type: 'log', message: 'Området er allerede eid', level: '' });
    expect(result.events).not.toContainEqual({ type: 'send_state' });
  });

  it('avviser kjøp når spilleren har for lite penger', () => {
    gameState.players[0].money = 100;

    const result = reduce({ type: 'buy_territory', territoryId: 't3' });

    expect(result.state.territories.t3.owner).toBeNull();
    expect(result.state.players[0].money).toBe(100);
  });

  it('avviser kjøp av checkpoint-friområde', () => {
    const moneyBefore = gameState.players[0].money;
    const result = reduce({ type: 'buy_territory', territoryId: 'lysaker_cp' });

    expect(result.state.territories.lysaker_cp.owner).toBeNull();
    expect(result.state.players[0].money).toBe(moneyBefore);
    expect(result.events).toContainEqual({ type: 'log', message: 'Checkpoint er friområde og kan ikke kjøpes', level: '' });
  });
});

describe('invade_territory', () => {
  it('avviser angrep når angriperen ikke eier tilstøtende territorium', () => {
    const unitsBefore = gameState.players[0].units;

    const result = reduce({ type: 'invade_territory', territoryId: 't1' });

    expect(result.state.territories.t1.owner).toBeNull();
    expect(result.state.players[0].units).toBe(unitsBefore);
    expect(result.events).toContainEqual({
      type: 'log',
      message: 'Du kan bare angripe fra tilstøtende områder du eier',
      level: '',
    });
  });

  it('lar angriper ta territorium fra tilstøtende eget felt med sterke terninger', () => {
    gameState.territories.t1.owner = 'p1';
    gameState.territories.t1.units = 3;
    gameState.territories.t2.owner = 'p2';
    gameState.territories.t2.units = 1;

    const random = vi.fn()
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.001);

    const result = reduce({ type: 'invade_territory', territoryId: 't2' }, { random });

    expect(result.state.territories.t2.owner).toBe('p1');
    expect(result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'modal', modal: expect.objectContaining({ type: 'dice' }) }),
      { type: 'send_state' },
    ]));
  });

  it('avviser angrep på checkpoint-friområde', () => {
    gameState.territories.t15.owner = 'p1';
    const unitsBefore = gameState.players[0].units;

    const result = reduce({ type: 'invade_territory', territoryId: 'lysaker_cp' });

    expect(result.state.players[0].units).toBe(unitsBefore);
    expect(result.state.territories.lysaker_cp.owner).toBeNull();
    expect(result.events).toContainEqual({ type: 'log', message: 'Checkpoint er friområde og kan ikke angripes', level: '' });
  });
});

describe('checkpoint movement', () => {
  it('lar spiller lande på checkpoint og markerer checkpointet', () => {
    gameState.players[0].diceRoll = 1;
    gameState.players[0].diceUsed = 0;
    gameState.players[0].position = 't15';

    const result = reduce({ type: 'move_to_territory', territoryId: 'lysaker_cp' });

    expect(result.state.players[0].position).toBe('lysaker_cp');
    expect(result.state.players[0].checkpoints.lysaker).toBe(true);
    expect(result.state.players[0].diceUsed).toBe(1);
    expect(result.events).toContainEqual({ type: 'send_state' });
  });

  it('avviser forsterkning av checkpoint-friområde', () => {
    const unitsBefore = gameState.players[0].units;

    const result = reduce({ type: 'reinforce_territory', territoryId: 'kolbotn_cp' });

    expect(result.state.players[0].units).toBe(unitsBefore);
    expect(result.state.territories.kolbotn_cp.units).toBe(0);
    expect(result.events).toContainEqual({ type: 'log', message: 'Checkpoint er friområde og kan ikke forsterkes', level: '' });
  });
});

describe('end_turn', () => {
  it('gir turen til neste spiller', () => {
    const result = reduce({ type: 'end_turn' });

    expect(result.state.currentPlayerIdx).toBe(1);
    expect(result.events).toContainEqual({ type: 'send_state' });
  });

  it('nullstiller terningkast og diceUsed for spilleren som avsluttet', () => {
    gameState.players[0].diceRoll = 4;
    gameState.players[0].diceUsed = 2;

    const result = reduce({ type: 'end_turn' });

    expect(result.state.players[0].diceRoll).toBeNull();
    expect(result.state.players[0].diceUsed).toBe(0);
  });

  it('hopper over eliminerte spillere', () => {
    freshState([
      { id: 'p1', name: 'Spiller 1' },
      { id: 'p2', name: 'Spiller 2' },
      { id: 'p3', name: 'Spiller 3' },
    ]);
    gameState.players[1].eliminated = true;

    const result = reduce({ type: 'end_turn' });

    expect(result.state.currentPlayerIdx).toBe(2);
  });

  it('deler ut bydelsbonus når spiller eier alle territorier i en bydel', () => {
    const did = 'sagene';
    for (const t of TERRITORIES.filter((territory) => territory.district === did)) {
      gameState.territories[t.id].owner = 'p1';
    }
    const moneyBefore = gameState.players[0].money;
    const unitsBefore = gameState.players[0].units;
    const { money: bonusMoney, units: bonusUnits } = DISTRICTS[did].bonus;

    const result = reduce({ type: 'end_turn' });

    expect(result.state.players[0].money).toBe(moneyBefore + bonusMoney);
    expect(result.state.players[0].units).toBe(unitsBefore + bonusUnits);
  });

  it('returnerer send_end_turn event i MVP-spill', () => {
    gameState = {
      phase: 'playing',
      started: true,
      activePlayer: 'red',
      players: [
        { id: 'p1', name: 'Spiller 1', side: 'red', color: '#c0392b' },
        { id: 'p2', name: 'Spiller 2', side: 'blue', color: '#1a6b9a' },
      ],
      territories: {},
      log: [],
    };

    const result = reduce({ type: 'end_turn' });

    expect(result.state).toBe(gameState);
    expect(result.events).toContainEqual({ type: 'send_end_turn', playerId: 'p1' });
  });
});
