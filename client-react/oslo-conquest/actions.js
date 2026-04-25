import { TERRITORIES, DISTRICTS, ADJACENCY } from './game-data.js';
import { state } from './state.js';
import { getCurrentPlayer, isMyTurn } from './game-state.js';
import { renderHUD, renderActionPanel, renderCheckpointBar, addLog } from './ui.js';
import { updateTerritoryVisuals } from './map.js';
import { checkMissionComplete, checkGameEnd } from './missions.js';
import { showDiceResult } from './dice.js';
import { showRentModal } from './modals.js';
import { sendGameState } from './websocket.js';

export function rollDice() {
  if (!isMyTurn()) return;
  const cp = getCurrentPlayer();
  if (cp.diceRoll !== null) return;

  cp.diceRoll = Math.ceil(Math.random() * 6);
  cp.diceUsed = 0;
  addLog(`${cp.name} kastet terning: ${cp.diceRoll} øyne`, 'important');
  renderHUD();
  renderActionPanel();
  sendGameState();
}

export function moveToTerritory(tid) {
  if (!isMyTurn()) return;
  const cp = getCurrentPlayer();
  if (cp.diceRoll === null || cp.diceUsed >= cp.diceRoll) return;

  cp.diceUsed++;
  cp.position = tid;

  if (tid === 'lysaker_cp') cp.checkpoints.lysaker = true;
  if (tid === 'kolbotn_cp') cp.checkpoints.kolbotn = true;

  const t = TERRITORIES.find(x => x.id === tid);
  const ts = state.gameState.territories[tid];
  addLog(`${cp.name} beveger seg til ${t.name} (${cp.diceUsed}/${cp.diceRoll})`);

  if (cp.diceUsed === cp.diceRoll && ts.owner && ts.owner !== cp.id) {
    const rent = Math.floor(t.price * 0.15);
    const owner = state.gameState.players.find(x => x.id === ts.owner);
    addLog(`${cp.name} lander på ${owner.name}s område. Leie: ${rent} kr`, 'important');
    showRentModal(tid, rent, () => payRent(tid));
  }

  renderCheckpointBar();
  renderActionPanel();
  sendGameState();
}

export function buyTerritory(tid) {
  if (!isMyTurn()) return;
  const cp = getCurrentPlayer();
  const t = TERRITORIES.find(x => x.id === tid);
  const ts = state.gameState.territories[tid];

  if (ts.owner) { addLog('Området er allerede eid'); return; }
  if (cp.money < t.price) { addLog('Ikke nok penger'); return; }
  if (cp.units < 1) { addLog('Ingen bataljoner å plassere'); return; }

  cp.money -= t.price;
  cp.units -= 1;
  ts.owner = cp.id;
  ts.units = 1;

  addLog(`${cp.name} kjøpte ${t.name} for ${t.price} kr`, 'buy');
  updateTerritoryVisuals();
  renderHUD();
  renderActionPanel();
  checkMissionComplete(cp);
  sendGameState();
}

export function invadeTerritory(tid) {
  if (!isMyTurn()) return;
  const cp = getCurrentPlayer();
  const ts = state.gameState.territories[tid];
  const t = TERRITORIES.find(x => x.id === tid);

  if (ts.owner === cp.id) { addLog('Du eier allerede dette området'); return; }
  if (cp.units < 1) { addLog('Ingen bataljoner til invasjon'); return; }

  const ownedNeighbors = ADJACENCY[tid]?.filter(nid => state.gameState.territories[nid]?.owner === cp.id);
  if (ownedNeighbors.length === 0 && cp.position !== tid) {
    addLog('Du kan bare angripe fra tilstøtende områder du eier');
    return;
  }

  const defUnits = ts.units;
  const attUnits = Math.min(cp.units, 3);
  const result = riskCombat(attUnits, defUnits);
  const prevOwner = ts.owner;

  if (result.attackerWins) {
    const oldOwner = prevOwner ? state.gameState.players.find(x => x.id === prevOwner) : null;
    ts.owner = cp.id;
    ts.units = result.attackerRemaining;
    cp.units -= result.attackerLost;

    if (prevOwner) {
      if (!cp.conquests[prevOwner]) cp.conquests[prevOwner] = 0;
      cp.conquests[prevOwner]++;
    }

    addLog(`${cp.name} tok ${t.name}! (${prevOwner ? (oldOwner?.name || 'ukjent') : 'nøytral'} tapte)`, 'combat');

    if (prevOwner) {
      const remaining = Object.values(state.gameState.territories).filter(x => x.owner === prevOwner).length;
      if (remaining === 0) {
        const loser = state.gameState.players.find(x => x.id === prevOwner);
        if (loser) { loser.eliminated = true; addLog(`${loser.name} er eliminert!`, 'important'); }
        checkGameEnd();
      }
    }
  } else {
    cp.units -= result.attackerLost;
    ts.units = result.defenderRemaining;
    addLog(`${cp.name} angrep ${t.name} – mislyktes!`, 'combat');
  }

  showDiceResult({
    attackerDice: result.attackerDice,
    defenderDice: result.defenderDice,
    attackerName: cp.name,
    defenderName: prevOwner ? state.gameState.players.find(x => x.id === prevOwner)?.name : 'Nøytral',
    attackerWins: result.attackerWins,
    attackerLost: result.attackerLost,
    defenderLost: result.defenderLost,
  });

  updateTerritoryVisuals();
  renderHUD();
  renderActionPanel();
  checkMissionComplete(cp);
  sendGameState();
}

function riskCombat(attackers, defenders) {
  const aDice = Array.from({ length: Math.min(attackers, 3) }, () => Math.ceil(Math.random() * 6)).sort((a, b) => b - a);
  const dDice = Array.from({ length: Math.min(defenders, 2) }, () => Math.ceil(Math.random() * 6)).sort((a, b) => b - a);

  let aLost = 0, dLost = 0;
  const pairs = Math.min(aDice.length, dDice.length);
  for (let i = 0; i < pairs; i++) {
    if (aDice[i] > dDice[i]) dLost++;
    else aLost++;
  }

  return {
    attackerDice: aDice, defenderDice: dDice,
    attackerLost: aLost, defenderLost: dLost,
    attackerWins: dLost > 0 && defenders - dLost <= 0,
    attackerRemaining: Math.max(1, attackers - aLost),
    defenderRemaining: Math.max(0, defenders - dLost),
  };
}

export function reinforceTerritory(tid) {
  if (!isMyTurn()) return;
  const cp = getCurrentPlayer();
  if (cp.units < 1) { addLog('Ingen bataljoner å forsterke med'); return; }

  const ts = state.gameState.territories[tid];
  if (ts.owner !== cp.id) { addLog('Du eier ikke dette området'); return; }

  cp.units -= 1;
  ts.units += 1;

  const t = TERRITORIES.find(x => x.id === tid);
  addLog(`${cp.name} forsterket ${t.name}`);
  updateTerritoryVisuals();
  renderHUD();
  renderActionPanel();
  sendGameState();
}

export function payRent(tid) {
  const cp = getCurrentPlayer();
  const t = TERRITORIES.find(x => x.id === tid);
  const ts = state.gameState.territories[tid];
  const rent = Math.floor(t.price * 0.15);

  if (cp.money < rent) {
    addLog(`${cp.name} har ikke råd til leie – tvangsangrep!`, 'combat');
    invadeTerritory(tid);
  } else {
    cp.money -= rent;
    const owner = state.gameState.players.find(x => x.id === ts.owner);
    if (owner) owner.money += rent;
    addLog(`${cp.name} betalte ${rent} kr i leie til ${owner?.name}`, 'buy');
    renderHUD();
    sendGameState();
  }
}

export function endTurn() {
  if (!isMyTurn()) { addLog('Det er ikke din tur'); return; }

  const cp = getCurrentPlayer();
  let bonusMoney = 0, bonusUnits = 0;

  for (const [did, district] of Object.entries(DISTRICTS)) {
    const terrs = TERRITORIES.filter(t => t.district === did);
    if (terrs.every(t => state.gameState.territories[t.id]?.owner === cp.id)) {
      bonusMoney += district.bonus.money;
      bonusUnits += district.bonus.units;
    }
  }

  if (cp.checkpoints.lørenskog && cp.checkpoints.lysaker && cp.checkpoints.kolbotn) {
    bonusMoney += 500;
    bonusUnits += 3;
    cp.checkpoints = { lørenskog: true, lysaker: false, kolbotn: false };
    addLog(`${cp.name} fullførte en runde! Bonus: +500 kr +3 bat.`, 'important');
  }

  if (bonusMoney > 0 || bonusUnits > 0) {
    cp.money += bonusMoney;
    cp.units += bonusUnits;
    addLog(`${cp.name} får bonus: +${bonusMoney} kr, +${bonusUnits} bat.`);
  }

  cp.diceRoll = null;
  cp.diceUsed = 0;

  let nextIdx = (state.gameState.currentPlayerIdx + 1) % state.gameState.players.length;
  while (state.gameState.players[nextIdx].eliminated) {
    nextIdx = (nextIdx + 1) % state.gameState.players.length;
  }

  if (nextIdx === 0) state.gameState.round++;
  state.gameState.currentPlayerIdx = nextIdx;

  addLog(`--- ${getCurrentPlayer().name}s tur ---`, 'important');
  renderHUD();
  renderActionPanel();
  renderCheckpointBar();
  sendGameState();
}
