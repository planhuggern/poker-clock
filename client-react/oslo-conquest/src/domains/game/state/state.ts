// Delt spilltilstand som alle moduler leser og skriver til.
// Fordi ES-moduler eksporterer referanser, endres dette objektet live — ingen kopi.
interface GameState {
  id: string;
  players: {
    id: string;
    name: string;
    color: string;
  }[];
}

interface Modal {
  type: "createGame" | "joinGame" | "mission" | "gameOver";
  props?: unknown;
}

interface State {
  gameState: GameState | null;
  myPlayerId: string | null;
  selectedTerritory: string | null;
  missionRevealed: boolean;
  modal: Modal | null;
  ws: WebSocket | null;
}


export const state: State = {
  gameState: null,
  myPlayerId: null,
  selectedTerritory: null,
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
