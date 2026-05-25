// Delt spilltilstand som alle moduler leser og skriver til.
// Fordi ES-moduler eksporterer referanser, endres dette objektet live — ingen kopi.
export const state = {
  gameState: null,
  myPlayerId: null,
  selectedTerritory: null,
  missionRevealed: false,
  modal: null,
  ws: null,
  svgEl: null,
  mapTransform: { x: 0, y: 0, scale: 1 },
  panState: {
    active: false, hasMoved: false,
    startX: 0, startY: 0, lastX: 0, lastY: 0,
    startTx: 0, startTy: 0,
  },
};

const listeners = new Set();

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyGameChanged() {
  for (const listener of listeners) listener(state);
}

export function notifySelectionChanged() {
  notifyGameChanged();
}

export function notifyModalChanged() {
  notifyGameChanged();
}

export function setModal(modal) {
  state.modal = modal;
  notifyModalChanged();
}

export function clearModal() {
  setModal(null);
}
