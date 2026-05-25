import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../ui.js');
vi.mock('../map.js');
vi.mock('../dice.js');

import { state } from '../state.js';
import { createGame, joinGame } from '../websocket.js';

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
});
