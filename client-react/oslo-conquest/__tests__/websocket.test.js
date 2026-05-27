import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { state } from '../state.js';
import { connectWS, createGame, joinGame, sendAttack } from '../websocket.js';

class FakeWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.OPEN;
    this.sent = [];
    FakeWebSocket.instances.push(this);
  }

  send(message) {
    this.sent.push(JSON.parse(message));
  }
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  globalThis.WebSocket = FakeWebSocket;
  state.ws = null;
  state.myPlayerId = null;
  vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.WebSocket;
});

describe('websocket lobby commands', () => {
  it('oppretter spill fra eksplisitte lobbyverdier uten DOM', () => {
    createGame({ url: 'ws://localhost:8000/ws/oslo-conquest/', name: 'Ola', room: 'oslo-1' });
    FakeWebSocket.instances[0].onopen();

    expect(FakeWebSocket.instances[0].sent[0]).toEqual({
      type: 'create_game',
      room: 'oslo-1',
      player: { id: state.myPlayerId, name: 'Ola' },
    });
  });

  it('blir med i spill fra eksplisitte lobbyverdier uten DOM', () => {
    joinGame({ url: 'ws://localhost:8000/ws/oslo-conquest/', name: 'Kari', room: 'oslo-1' });
    FakeWebSocket.instances[0].onopen();

    expect(FakeWebSocket.instances[0].sent[0]).toEqual({
      type: 'join_game',
      room: 'oslo-1',
      player: { id: state.myPlayerId, name: 'Kari' },
    });
  });

  it('rapporterer dice-resultat som modal-event uten imperative UI', () => {
    const onModal = vi.fn();
    const gameState = { players: [], territories: {}, started: true };
    const dice = { attackerDice: [6], defenderDice: [1], attackerWins: true };

    connectWS({ url: 'ws://localhost:8000/ws/oslo-conquest/', handlers: { onModal } });
    FakeWebSocket.instances[0].onmessage({
      data: JSON.stringify({ type: 'action_result', state: gameState, dice }),
    });

    expect(onModal).toHaveBeenCalledWith({ type: 'dice', result: dice });
  });

  it('rapporterer tilkoblingsfeil via callbacks', () => {
    const onConnectionChange = vi.fn();
    const onLobbyStatus = vi.fn();

    connectWS({
      url: 'ws://localhost:8000/ws/oslo-conquest/',
      handlers: { onConnectionChange, onLobbyStatus },
    });
    FakeWebSocket.instances[0].onerror();

    expect(onConnectionChange).toHaveBeenCalledWith('disconnected');
    expect(onLobbyStatus).toHaveBeenCalledWith('Kunne ikke koble til serveren.', true);
  });

  it('sender attack-melding med fra- og tilterritorium', () => {
    state.myPlayerId = 'p1';
    connectWS({ url: 'ws://localhost:8000/ws/oslo-conquest/' });
    FakeWebSocket.instances[0].onopen();

    sendAttack('t0a', 't1');

    expect(FakeWebSocket.instances[0].sent.at(-1)).toEqual({
      type: 'attack',
      playerId: 'p1',
      fromTerritoryId: 't0a',
      toTerritoryId: 't1',
    });
  });
});
