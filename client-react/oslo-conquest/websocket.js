import { state } from './state.js';
import { createInitialGameState } from './game-state.js';
import { renderGame } from './ui.js';
import { showDiceResult } from './dice.js';
import { initMap } from './map.js';

export function connectWS() {
  const url = document.getElementById('ws-url').value.trim();
  if (!url) return;

  state.ws = new WebSocket(url);

  state.ws.onopen = () => {
    document.getElementById('ws-dot').classList.add('connected');
    document.getElementById('ws-status-text').textContent = 'Tilkoblet';
  };

  state.ws.onclose = () => {
    document.getElementById('ws-dot').classList.remove('connected');
    document.getElementById('ws-status-text').textContent = 'Frakoblet';
  };

  state.ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'game_state') {
      state.gameState = msg.state;
      renderGame();
    } else if (msg.type === 'action_result') {
      state.gameState = msg.state;
      renderGame();
      if (msg.dice) showDiceResult(msg.dice);
    }
  };
}

export function sendWS(msg) {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(msg));
  }
}

export function sendGameState() {
  sendWS({ type: 'game_action', state: state.gameState });
}

export function createGame() {
  const name = document.getElementById('player-name').value.trim();
  const room = document.getElementById('room-id').value.trim();
  if (!name || !room) return alert('Fyll inn navn og rom-ID');
  state.myPlayerId = 'p_' + Math.random().toString(36).substr(2, 8);
  sendWS({ type: 'create_game', room, player: { id: state.myPlayerId, name } });
}

export function joinGame() {
  const name = document.getElementById('player-name').value.trim();
  const room = document.getElementById('room-id').value.trim();
  if (!name || !room) return alert('Fyll inn navn og rom-ID');
  state.myPlayerId = 'p_' + Math.random().toString(36).substr(2, 8);
  sendWS({ type: 'join_game', room, player: { id: state.myPlayerId, name } });
}

export function startLocalGame() {
  const name = document.getElementById('player-name').value.trim() || 'Spiller 1';
  state.myPlayerId = 'p1';
  const players = [
    { id: 'p1', name },
    { id: 'p2', name: 'Spiller 2' },
    { id: 'p3', name: 'Spiller 3' },
  ];
  state.gameState = createInitialGameState(players);
  document.getElementById('lobby').style.display = 'none';
  document.getElementById('game-container').style.display = 'block';
  initMap();
}
