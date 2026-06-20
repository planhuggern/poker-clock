// Active state query helpers for the server-authoritative Oslo Conquest flow.
import { findPlayerByRef } from '../../../utils/player-utils';
import { Player } from '../types';
import { state } from './state.js';

export function getCurrentPlayer(): Player | null {
  const gameState = state.gameState;

  if (!gameState) {
    return null;
  }

  if (gameState.activePlayer) {
    return findPlayerByRef(
      gameState.players,
      gameState.activePlayer
    );
  }

  return gameState.players[gameState.currentPlayerIdx] ?? null;
}

export function isMyTurn(): boolean {
  return getCurrentPlayer()?.id === state.myPlayerId;
}

export function findPlayerByOwner(owner: string | null | undefined): Player | null {
  if (!owner || !state.gameState) return null;
  return findPlayerByRef(state.gameState.players, owner);
}
