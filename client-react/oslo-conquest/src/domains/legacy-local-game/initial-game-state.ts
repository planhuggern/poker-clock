import { Player, GameState, TerritoryState } from '../game/types.js';
import {
  MISSIONS,
  PLAYER_COLORS,
  PLAYER_COLOR_NAMES,
  TERRITORIES,
} from '../game/model/game-data.js';

/**
 * Legacy local-game initializer.
 *
 * This is not used by the current Oslo Conquest app. The active product flow is
 * server-authoritative over WebSocket. Keep this module only as reference code
 * for the older local prototype rules.
 */
export function createInitialGameState(players: Player[]): GameState {
  const territories: Record<string, TerritoryState> = {};
  for (const territory of TERRITORIES) {
    territories[territory.id] = territory.type === 'checkpoint'
      ? { territoryId: territory.id, owner: null, units: 0, checkpoint: territory.checkpoint }
      : { territoryId: territory.id, owner: null, units: territory.neutralUnits };
  }

  const shuffled = [...MISSIONS].sort(() => Math.random() - 0.5);

  const ps = players.map((player, index) => {
    const mission = shuffled[index % shuffled.length];
    const target = mission.id === 'm8' ? players[(index + 1) % players.length].id : null;
    return {
      id: player.id,
      name: player.name,
      color: PLAYER_COLORS[index],
      colorName: PLAYER_COLOR_NAMES[index],
      money: 2000,
      units: 10,
      mission: mission.id,
      target,
      position: 'lørenskog_cp',
      checkpoints: { lørenskog: true, lysaker: false, kolbotn: false },
      roundComplete: false,
      diceRoll: null,
      diceUsed: 0,
      eliminated: false,
      conquests: {},
    };
  });

  return {
    phase: 'playing',
    round: 1,
    currentPlayerIdx: 0,
    players: ps,
    territories,
    log: [],
  };
}
