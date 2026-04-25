import { TERRITORIES, DISTRICTS, ADJACENCY } from './game-data.js';
import { state } from './state.js';
import { getCurrentPlayer, isMyTurn } from './game-state.js';

export function renderHUD() {
  if (!state.gameState) return;
  const container = document.getElementById('player-chips');
  container.innerHTML = '';

  for (const p of state.gameState.players) {
    const chip = document.createElement('div');
    chip.className = 'player-chip' + (p.id === getCurrentPlayer()?.id ? ' active' : '');
    if (p.eliminated) chip.style.opacity = '0.3';
    chip.innerHTML = `
      <div class="chip-dot" style="background:${p.color}"></div>
      <span>${p.name}</span>
      <span class="chip-money">💰 ${p.money}</span>
      <span class="chip-units">⚔ ${p.units}</span>
    `;
    container.appendChild(chip);
  }

  const ind = document.getElementById('turn-indicator');
  const cp = getCurrentPlayer();
  if (cp) {
    ind.innerHTML = `<span style="color:${cp.color}">●</span> ${cp.name}s tur – Runde ${state.gameState.round}`;
    if (cp.diceRoll !== null) {
      ind.innerHTML += ` | Terning: ${cp.diceRoll} (brukt: ${cp.diceUsed})`;
    }
  }
}

export function renderActionPanel() {
  const panel = document.getElementById('action-content');
  if (!state.selectedTerritory) {
    panel.innerHTML = '<p style="color:var(--text-muted);font-style:italic;font-size:0.9rem;">Velg et område på kartet</p>';
    if (isMyTurn()) {
      const cp = getCurrentPlayer();
      panel.innerHTML += `
        <div style="margin-top:12px;">
          ${cp.diceRoll === null
            ? `<button class="action-btn" onclick="rollDice()">🎲 Kast terning</button>`
            : `<div style="color:var(--gold);margin-bottom:8px;">Terning: ${cp.diceRoll} (${cp.diceUsed} brukt)</div>`
          }
        </div>`;
    }
    return;
  }

  const t = TERRITORIES.find(x => x.id === state.selectedTerritory);
  const ts = state.gameState.territories[state.selectedTerritory];
  const owner = ts.owner ? state.gameState.players.find(x => x.id === ts.owner) : null;
  const cp = getCurrentPlayer();
  const district = DISTRICTS[t.district];

  panel.innerHTML = `
    <div class="territory-info">
      <div class="territory-name">${t.name}</div>
      <div class="territory-district">${district.name}</div>
      <div class="territory-stats">
        <div class="stat"><span class="stat-label">Eier</span><span style="color:${owner?.color || '#888'}">${owner?.name || 'Nøytral'}</span></div>
        <div class="stat"><span class="stat-label">Bataljoner</span><span>${ts.units}</span></div>
        <div class="stat"><span class="stat-label">Pris</span><span style="color:var(--gold)">${t.price} kr</span></div>
      </div>
    </div>
    <div class="action-buttons">
  `;

  if (isMyTurn()) {
    const myTerr = ts.owner === cp.id;
    const neutral = !ts.owner;
    const enemy = ts.owner && ts.owner !== cp.id;
    const adjacent = ADJACENCY[state.selectedTerritory]?.some(nid => state.gameState.territories[nid]?.owner === cp.id);

    if (!myTerr) {
      panel.innerHTML += `
        <button class="action-btn" onclick="buyTerritory('${t.id}')" ${!neutral || cp.money < t.price ? 'disabled' : ''}>
          Kjøp av bank <span class="price">${t.price} kr</span>
        </button>
        <button class="action-btn" onclick="invadeTerritory('${t.id}')" ${!adjacent && cp.position !== t.id ? 'disabled' : ''}>
          ⚔ Invader ${enemy ? `(${ts.units} bat.)` : `(nøytral: ${ts.units} bat.)`}
        </button>
      `;
    } else {
      panel.innerHTML += `
        <button class="action-btn" onclick="reinforceTerritory('${t.id}')" ${cp.units < 1 ? 'disabled' : ''}>
          + Forsterke <span class="price">${cp.units} tilgjengelig</span>
        </button>
      `;
    }

    if (cp.diceRoll !== null && cp.diceUsed < cp.diceRoll) {
      panel.innerHTML += `<button class="action-btn" onclick="moveToTerritory('${t.id}')">🚶 Beveg hit (${cp.diceUsed + 1}/${cp.diceRoll})</button>`;
    }
  }

  panel.innerHTML += '</div>';
}

export function renderCheckpointBar() {
  if (!state.gameState) return;
  const cp = getCurrentPlayer();
  if (!cp) return;

  ['lørenskog', 'lysaker', 'kolbotn'].forEach(cid => {
    const el = document.getElementById(`cp-${cid}`);
    if (el) el.className = 'checkpoint' + (cp.checkpoints[cid] ? ' reached' : '');
  });
}

export function addLog(msg, type = '') {
  if (!state.gameState) return;
  state.gameState.log = state.gameState.log || [];
  state.gameState.log.unshift({
    msg, type,
    time: new Date().toLocaleTimeString('no', { hour: '2-digit', minute: '2-digit' }),
  });
  if (state.gameState.log.length > 50) state.gameState.log.pop();

  const container = document.getElementById('log-entries');
  if (container) {
    container.innerHTML = state.gameState.log.slice(0, 30)
      .map(e => `<div class="log-entry ${e.type}">${e.msg}</div>`)
      .join('');
  }
}

export function renderGame() {
  renderHUD();
  renderActionPanel();
  renderCheckpointBar();
  // updateTerritoryVisuals is imported lazily to avoid the circular dep with map.js
  import('./map.js').then(({ updateTerritoryVisuals }) => updateTerritoryVisuals());
}
