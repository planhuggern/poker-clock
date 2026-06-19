// Active state query helpers for the server-authoritative Oslo Conquest flow.
import { Player } from '../types';
import { state } from './state.js';

export function getCurrentPlayer(): Player | null {
  const gameState = state.gameState;

  if (!gameState) {
    return null;
  }

  // TODO: MVP compatibility.
  // Server/MVP state uses activePlayer together with player.side.
  // The real game model should eventually use player.id only.
  if (gameState.activePlayer) {
    return gameState.players.find(
      (player) => player.side === gameState.activePlayer
    ) ?? null;
  }

  return gameState.players[gameState.currentPlayerIdx] ?? null;
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
