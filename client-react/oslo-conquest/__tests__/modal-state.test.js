import { describe, it, expect, beforeEach, vi } from 'vitest';

import { state } from '../state.js';
import { createInitialGameState } from '../game-state.js';
import { showDiceResult } from '../dice.js';
import { showRentModal, showWinModal } from '../modals.js';

beforeEach(() => {
  state.gameState = createInitialGameState([{ id: 'p1', name: 'Ola' }, { id: 'p2', name: 'Kari' }]);
  state.modal = null;
});

describe('modal state adapters', () => {
  it('setter dice modal state', () => {
    const result = { attackerDice: [6], defenderDice: [1], attackerWins: true };

    showDiceResult(result);

    expect(state.modal).toEqual({ type: 'dice', result });
  });

  it('setter rent modal state med confirm-callback', () => {
    const onConfirm = vi.fn();

    showRentModal('t1', 45, onConfirm);

    expect(state.modal).toMatchObject({
      type: 'rent',
      tid: 't1',
      rent: 45,
      territoryName: 'Grønland',
      canPay: true,
    });
    state.modal.onConfirm();
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('setter win modal state', () => {
    const player = state.gameState.players[0];
    const mission = { title: 'Testseier', desc: 'Vinn testen' };

    showWinModal(player, mission);

    expect(state.modal).toEqual({ type: 'win', player, mission });
  });
});
