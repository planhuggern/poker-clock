import { state, notifyGameChanged } from './state.js';

export function renderHUD() {
  notifyGameChanged();
}

export function renderActionPanel() {
  notifyGameChanged();
}

export function renderCheckpointBar() {
  notifyGameChanged();
}

export function addLog(msg, type = '') {
  if (!state.gameState) return;
  state.gameState.log = state.gameState.log || [];
  state.gameState.log.unshift({
    msg,
    type,
    time: new Date().toLocaleTimeString('no', { hour: '2-digit', minute: '2-digit' }),
  });
  if (state.gameState.log.length > 50) state.gameState.log.pop();
  notifyGameChanged();
}

export function renderGame() {
  notifyGameChanged();
  import('./map.js').then(({ updateTerritoryVisuals }) => updateTerritoryVisuals());
}
