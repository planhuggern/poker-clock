// Modaler som dukker opp midt i spillet: leie (når du lander på andres område) og seier.
// onConfirm-callback i showRentModal gjør at vi slipper å importere actions.js hit (unngår sirkelimport).

import { TERRITORIES } from './game-data.js';
import { state } from './state.js';

export function showRentModal(tid, rent, onConfirm) {
  const t = TERRITORIES.find(x => x.id === tid);
  const cp = state.gameState.players[state.gameState.currentPlayerIdx];
  const canPay = cp.money >= rent;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>Leie</h2>
      <p>Du landet på <strong>${t.name}</strong>.<br>Leie: <span style="color:var(--gold)">${rent} kr</span></p>
      ${!canPay ? '<p style="color:#e87070">Du har ikke råd! Tvangsangrep igangsettes.</p>' : ''}
      <button class="btn primary" id="rent-confirm-btn">
        ${canPay ? `Betal ${rent} kr` : 'Angrip i stedet'}
      </button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#rent-confirm-btn').addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });
}

export function showWinModal(player, mission) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal end-game-modal">
      <h2>🏆 Spillet er over!</h2>
      <div class="winner" style="color:${player.color}">${player.name} vinner!</div>
      <p>${mission.emoji || ''} <strong>${mission.title}</strong><br>${mission.desc || ''}</p>
      <button class="btn primary" onclick="location.reload()">Nytt spill</button>
    </div>
  `;
  document.body.appendChild(overlay);
}
