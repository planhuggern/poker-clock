// Delt spilltilstand som alle moduler leser og skriver til.
// Fordi ES-moduler eksporterer referanser, endres dette objektet live — ingen kopi.
export const state = {
  gameState: null,
  myPlayerId: null,
  selectedTerritory: null,
  missionRevealed: false,
  modal: null,
  ws: null,
};

const listeners = new Set();

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyGameChanged() {
  for (const listener of listeners) listener(state);
}
