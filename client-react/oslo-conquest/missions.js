import { MISSIONS } from './game-data.js';
import { state } from './state.js';
import { showWinModal } from './modals.js';

export function checkMissionComplete(player) {
  const mission = MISSIONS.find(m => m.id === player.mission);
  if (!mission) return;
  if (mission.check(player, state.gameState)) {
    showWinModal(player, mission);
  }
}

export function checkGameEnd() {
  const alive = state.gameState.players.filter(p => !p.eliminated);
  if (alive.length === 1) {
    showWinModal(alive[0], { title: 'Siste mann stående', emoji: '🏆' });
    return;
  }
  for (const p of alive) {
    const mission = MISSIONS.find(m => m.id === p.mission);
    if (mission?.id === 'm8' && mission.check(p, state.gameState)) {
      showWinModal(p, mission);
      return;
    }
  }
}
