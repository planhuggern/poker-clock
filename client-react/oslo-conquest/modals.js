import { TERRITORIES } from './game-data.js';
import { state, setModal } from './state.js';

export function showRentModal(tid, rent, onConfirm) {
  const territory = TERRITORIES.find((x) => x.id === tid);
  const cp = state.gameState.players[state.gameState.currentPlayerIdx];

  setModal({
    type: 'rent',
    tid,
    rent,
    territoryName: territory?.name || tid,
    canPay: cp.money >= rent,
    onConfirm,
  });
}

export function showWinModal(player, mission) {
  setModal({ type: 'win', player, mission });
}
