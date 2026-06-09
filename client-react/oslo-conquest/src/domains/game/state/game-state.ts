// Funksjoner som leser og setter opp spilltilstanden.
// Skiller seg fra state.js: her er logikken, der er bare dataene.
import { Player, GameState, TerritoryState } from '../types';
import { TERRITORIES, MISSIONS, PLAYER_COLORS, PLAYER_COLOR_NAMES } from '../model/game-data';
import { state } from './state.js';




// Bygger et nytt, blankt spillbrett med alle territorier nøytrale og spillerne klar.
// Trekker tilfeldige oppdragskort og setter startposisjon til Lørenskog for alle.
export function createInitialGameState(players: Player[]): GameState {
  const territories: Record<string, TerritoryState> = {};
  for (const t of TERRITORIES) {
    territories[t.id] = t.type === 'checkpoint'
      ? { territoryId: t.id, owner: null, units: 0, checkpoint: t.checkpoint }
      : { territoryId: t.id, owner: null, units: t.neutralUnits };
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
      position: 'lørenskog_cp',
      checkpoints: { lørenskog: true, lysaker: false, kolbotn: false },
      roundComplete: false, diceRoll: null, diceUsed: 0,
      eliminated: false, conquests: {},
    };
  });

  return { phase: 'playing', round: 1, currentPlayerIdx: 0, players: ps, territories, log: [] };
}

export function getCurrentPlayer(): Player | null {
  const gameState = state.gameState;
  if (!gameState) return null;
  if (gameState.activePlayer) {
    return gameState.players.find(p => p.side === gameState.activePlayer) || null;
  }
  return gameState.players[gameState.currentPlayerIdx] || null;
}

export function isMyTurn(): boolean {
  return getCurrentPlayer()?.id === state.myPlayerId;
}

export function isMvpGame(): boolean {
  const gameState = state.gameState;
  if (!gameState) return false;

  // Server-authoritative MVP states include side markers on players.
  // We also treat setup as MVP even if activePlayer is temporarily missing.
  return Boolean(gameState.phase === 'setup' || gameState.players?.some((player) => player.side));
}

export function findPlayerByOwner(owner: string | null | undefined): Player | null {
  if (!owner || !state.gameState) return null;
  return state.gameState.players.find(p => p.id === owner || p.side === owner) || null;
}
