import { clearModal, setModal } from './state.js';

export const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function showDiceResult(result) {
  setModal({ type: 'dice', result });
}

export function closeDice() {
  clearModal();
}
