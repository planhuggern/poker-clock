// Nettverkslaget for Oslo Conquest.
// Lobby-UI eies av Preact; denne modulen sender/mottar meldinger og rapporterer
// status tilbake via callbacks.

import { notifyGameChanged, state } from './state.js';
import { createInitialGameState } from './game-state.js';

let pendingMessage = null;
let activeUrl = '';
let handlers = {};

function setHandlers(nextHandlers = {}) {
  handlers = { ...handlers, ...nextHandlers };
}

function emit(name, ...args) {
  handlers[name]?.(...args);
}

function handleGameState(nextState) {
  state.gameState = nextState;

  if (nextState.started) {
    emit('onGameStarted', nextState);
    emit('onGameState', nextState);
  } else if (nextState.phase === 'waiting') {
    emit('onLobbyStatus', `Rom "${nextState.room || ''}" er opprettet. Venter på spiller 2.`, false);
    emit('onGameState', nextState);
  }

  notifyGameChanged();
}

function handleMessage(rawMessage) {
  const msg = JSON.parse(rawMessage);

  if (msg.type === 'game_state') {
    handleGameState(msg.state);
  } else if (msg.type === 'action_result') {
    state.gameState = msg.state;
    emit('onGameState', msg.state);
    notifyGameChanged();
    if (msg.dice) emit('onModal', { type: 'dice', result: msg.dice });
  } else if (msg.type === 'room_list') {
    emit('onRooms', msg.rooms || []);
  } else if (msg.type === 'error') {
    const message = msg.message || 'Ugyldig handling';
    emit('onLobbyStatus', message, true);
    emit('onError', message);
  }
}

export function connectWS({ url, handlers: nextHandlers } = {}) {
  setHandlers(nextHandlers);
  if (url) activeUrl = url.trim();
  if (!activeUrl) return false;

  if (state.ws?.readyState === WebSocket.OPEN) return true;
  if (state.ws?.readyState === WebSocket.CONNECTING) return false;

  state.ws = new WebSocket(activeUrl);
  emit('onConnectionChange', 'connecting');
  emit('onLobbyStatus', 'Kobler til server...', false);

  state.ws.onopen = () => {
    emit('onConnectionChange', 'connected');
    emit('onLobbyStatus', '', false);
    if (pendingMessage) {
      const msg = pendingMessage;
      pendingMessage = null;
      sendWS(msg);
    } else {
      refreshRooms();
    }
  };

  state.ws.onclose = () => {
    emit('onConnectionChange', 'disconnected');
    emit('onLobbyStatus', 'Mistet tilkoblingen til serveren.', true);
  };

  state.ws.onmessage = (event) => handleMessage(event.data);

  return false;
}

export function sendWS(msg) {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(msg));
    return true;
  }

  pendingMessage = msg;
  connectWS();
  return false;
}

// Sender hele spilltilstanden til serveren, som videresender den til de andre spillerne.
export function sendGameState(nextState = state.gameState) {
  sendWS({ type: 'game_action', state: nextState });
}

export function sendEndTurn() {
  sendWS({ type: 'end_turn', playerId: state.myPlayerId });
}

export function refreshRooms(nextHandlers) {
  setHandlers(nextHandlers);
  sendWS({ type: 'list_rooms' });
}

function nextPlayerId() {
  return 'p_' + Math.random().toString(36).slice(2, 10);
}

export function createGame({ url, name, room, handlers: nextHandlers } = {}) {
  setHandlers(nextHandlers);
  if (url) activeUrl = url.trim();
  const cleanName = name?.trim();
  const cleanRoom = room?.trim();
  if (!cleanName || !cleanRoom) {
    emit('onError', 'Fyll inn navn og rom-ID');
    return false;
  }

  state.myPlayerId = nextPlayerId();
  emit('onLobbyStatus', `Oppretter rom "${cleanRoom}"...`, false);
  sendWS({ type: 'create_game', room: cleanRoom, player: { id: state.myPlayerId, name: cleanName } });
  return true;
}

export function joinGame({ url, name, room, handlers: nextHandlers } = {}) {
  setHandlers(nextHandlers);
  if (url) activeUrl = url.trim();
  const cleanName = name?.trim();
  const cleanRoom = room?.trim();
  if (!cleanName || !cleanRoom) {
    emit('onError', 'Fyll inn navn og rom-ID');
    return false;
  }

  state.myPlayerId = nextPlayerId();
  emit('onLobbyStatus', `Blir med i rom "${cleanRoom}"...`, false);
  sendWS({ type: 'join_game', room: cleanRoom, player: { id: state.myPlayerId, name: cleanName } });
  return true;
}

export function startLocalGame({ name, handlers: nextHandlers } = {}) {
  setHandlers(nextHandlers);
  const playerName = name?.trim() || 'Spiller 1';
  state.myPlayerId = 'p1';
  const players = [
    { id: 'p1', name: playerName },
    { id: 'p2', name: 'Spiller 2' },
    { id: 'p3', name: 'Spiller 3' },
  ];
  state.gameState = createInitialGameState(players);
  emit('onGameStarted', state.gameState);
  emit('onGameState', state.gameState);
  notifyGameChanged();
  return true;
}
