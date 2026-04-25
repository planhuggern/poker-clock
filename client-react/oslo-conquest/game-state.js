import { TERRITORIES, MISSIONS, PLAYER_COLORS, PLAYER_COLOR_NAMES } from './game-data.js';
import { state } from './state.js';

export function createInitialGameState(players) {
  const territories = {};
  for (const t of TERRITORIES) {
    territories[t.id] = { id: t.id, owner: null, units: t.neutralUnits };
  }

  const shuffled = [...MISSIONS].sort(() => Math.random() - 0.5);

  const ps = players.map((p, i) => {
    const mission = shuffled[i % shuffled.length];
    const target = mission.id === 'm8' ? players[(i + 1) % players.length].id : null;
    return {
      id: p.id, name: p.name,
      color: PLAYER_COLORS[i], colorName: PLAYER_COLOR_NAMES[i],
      money: 2000, units: 10,
      mission: mission.id, target,
      position: 'lørenskog',
      checkpoints: { lørenskog: true, lysaker: false, kolbotn: false },
      roundComplete: false, diceRoll: null, diceUsed: 0,
      eliminated: false, conquests: {},
    };
  });

  return { phase: 'playing', round: 1, currentPlayerIdx: 0, players: ps, territories, log: [] };
}

export function getCurrentPlayer() {
  return state.gameState?.players[state.gameState.currentPlayerIdx];
}

export function isMyTurn() {
  return getCurrentPlayer()?.id === state.myPlayerId;
}
