// Delt spilltilstand som alle moduler leser og skriver til.
// Fordi ES-moduler eksporterer referanser, endres dette objektet live — ingen kopi.
import { GameState, GameModal, CheckpointId, TerritoryId } from '../types';

interface State {
  gameState: GameState | null;
  myPlayerId: string | null;
    selectedNodeId: TerritoryId | CheckpointId | null;
  missionRevealed: boolean;
  modal: GameModal | null;
  ws: WebSocket | null;
}


export const state: State = {
  gameState: null,
  myPlayerId: null,
  selectedNodeId: null,
  missionRevealed: false,
  modal: null,
  ws: null,
};

const listeners = new Set<(state: State) => void>();

export function subscribe(listener: (state: State) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyGameChanged(): void {
  for (const listener of listeners) listener(state);
}
