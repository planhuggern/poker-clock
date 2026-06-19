import { notifyGameChanged, state } from '../../domains/game/state/state.js';
import { GameState, GameModal, Handlers, RoomInfo } from '../../domains/game/types.js';

let pendingMessage: object | null = null;
let activeUrl = '';
let handlers: Handlers = {};

function setHandlers(nextHandlers: Handlers = {}): void {
  handlers = { ...handlers, ...nextHandlers };
}

function emit<K extends keyof Handlers>(name: K, ...args: Parameters<NonNullable<Handlers[K]>>): void {
  (handlers[name] as ((...a: typeof args) => void) | undefined)?.(...args);
}

function handleGameState(nextState: GameState & { started?: boolean }): void {
  state.gameState = nextState;

  if (nextState.started) {
    emit('onGameStarted', nextState);
    emit('onGameState', nextState);
  } else if (nextState.phase === 'waiting' as GameState['phase']) {
    emit('onLobbyStatus', `Rom "${nextState.room || ''}" er opprettet. Venter på spiller 2.`, false);
    emit('onGameState', nextState);
  }

  notifyGameChanged();
}

type IncomingMessage =
  | { type: 'game_state'; state: GameState & { started?: boolean } }
  | { type: 'action_result'; state: GameState; dice?: GameModal }
  | { type: 'room_list'; rooms?: RoomInfo[] }
  | { type: 'error'; message?: string };

function handleMessage(rawMessage: string): void {
  const msg = JSON.parse(rawMessage) as IncomingMessage;

  switch (msg.type) {
    case 'game_state':
      handleGameState(msg.state);
      break;
    case 'action_result':
      state.gameState = msg.state;
      emit('onGameState', msg.state);
      notifyGameChanged();
      if (msg.dice) emit('onModal', msg.dice);
      break;
    case 'room_list':
      emit('onRooms', msg.rooms ?? []);
      break;
    case 'error': {
      const message = msg.message ?? 'Ugyldig handling';
      emit('onLobbyStatus', message, true);
      emit('onError', message);
      break;
    }
    default:
      console.warn('Unknown websocket message type:', (msg as { type: string }).type, msg);
  }
}

export function connectWS({ url, handlers: nextHandlers }: { url?: string; handlers?: Handlers } = {}): boolean {
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

  state.ws.onerror = () => {
    emit('onConnectionChange', 'disconnected');
    emit('onLobbyStatus', 'Kunne ikke koble til serveren.', true);
  };

  state.ws.onmessage = (event) => handleMessage(event.data as string);

  return false;
}

export function sendWS(msg: object): boolean {
  if (state.ws?.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(msg));
    return true;
  }
  pendingMessage = msg;
  connectWS();
  return false;
}

export function sendEndTurn(playerId?: string): void {
  sendWS({ type: 'end_turn', playerId: playerId ?? state.myPlayerId });
}

export function sendAttack(fromTerritoryId: string, toTerritoryId: string): void {
  sendWS({ type: 'attack', playerId: state.myPlayerId, fromTerritoryId, toTerritoryId });
}

export function sendRollDice(): void {
  sendWS({ type: 'roll_dice', playerId: state.myPlayerId });
}

export function sendMove(toTerritoryId: string): void {
  sendWS({ type: 'move', playerId: state.myPlayerId, toTerritoryId });
}

export function sendChooseStartCheckpoint(checkpointTerritoryId: string): void {
  sendWS({ type: 'choose_start_checkpoint', playerId: state.myPlayerId, checkpointTerritoryId });
}

export function sendForfeit(): void {
  sendWS({ type: 'forfeit', playerId: state.myPlayerId });
}

export function closeWS(): void {
  pendingMessage = null;
  if (state.ws) {
    state.ws.onclose = null;
    state.ws.onerror = null;
    state.ws.onmessage = null;
    state.ws.close();
    state.ws = null;
  }
}

export function refreshRooms(nextHandlers?: Handlers): void {
  setHandlers(nextHandlers);
  sendWS({ type: 'list_rooms' });
}

function nextPlayerId(): string {
  return 'p_' + Math.random().toString(36).slice(2, 10);
}

export function rejoinGame({ url, room, playerId, handlers: nextHandlers }: { url?: string; room: string; playerId: string; handlers?: Handlers }): void {
  setHandlers(nextHandlers);
  if (url) activeUrl = url.trim();
  state.myPlayerId = playerId;
  sendWS({ type: 'rejoin_game', room, playerId });
}

export function createGame({ url, name, room, handlers: nextHandlers }: { url?: string; name?: string; room?: string; handlers?: Handlers } = {}): boolean {
  setHandlers(nextHandlers);
  if (url) activeUrl = url.trim();
  const cleanName = name?.trim();
  const cleanRoom = room?.trim();
  if (!cleanName || !cleanRoom) { emit('onError', 'Fyll inn navn og rom-ID'); return false; }

  state.myPlayerId = nextPlayerId();
  emit('onLobbyStatus', `Oppretter rom "${cleanRoom}"...`, false);
  sendWS({ type: 'create_game', room: cleanRoom, player: { id: state.myPlayerId, name: cleanName } });
  return true;
}

export function joinGame({ url, name, room, handlers: nextHandlers }: { url?: string; name?: string; room?: string; handlers?: Handlers } = {}): boolean {
  setHandlers(nextHandlers);
  if (url) activeUrl = url.trim();
  const cleanName = name?.trim();
  const cleanRoom = room?.trim();
  if (!cleanName || !cleanRoom) { emit('onError', 'Fyll inn navn og rom-ID'); return false; }

  state.myPlayerId = nextPlayerId();
  emit('onLobbyStatus', `Blir med i rom "${cleanRoom}"...`, false);
  sendWS({ type: 'join_game', room: cleanRoom, player: { id: state.myPlayerId, name: cleanName } });
  return true;
}
