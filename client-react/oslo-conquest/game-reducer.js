import { produce } from 'immer';
import { ADJACENCY, DISTRICTS, MISSIONS, TERRITORIES } from './game-data.js';

export function reduceGameAction(gameState, context, action) {
  const events = [];
  const current = getCurrentPlayer(gameState);

  if (!gameState || !action) return { state: gameState, events };

  function log(draft, message, level = '') {
    draft.log = draft.log || [];
    draft.log.unshift({
      msg: message,
      type: level,
      time: context.now?.() || '',
    });
    if (draft.log.length > 50) draft.log.pop();
    events.push({ type: 'log', message, level });
  }

  function sendState() {
    events.push({ type: 'send_state' });
    events.push({ type: 'map_update' });
  }

  if (action.type === 'end_turn' && isMvpGame(gameState)) {
    if (!isMyTurn(gameState, context.playerId)) {
      const nextState = produce(gameState, (draft) => log(draft, 'Det er ikke din tur'));
      return { state: nextState, events };
    }
    events.push({ type: 'send_end_turn', playerId: context.playerId });
    return { state: gameState, events };
  }

  if (!current || !isMyTurn(gameState, context.playerId)) {
    const nextState = produce(gameState, (draft) => log(draft, 'Det er ikke din tur'));
    return { state: nextState, events };
  }

  const nextState = produce(gameState, (draft) => {
    const cp = getCurrentPlayer(draft);

    if (action.type === 'roll_dice') {
      if (cp.diceRoll !== null) return;
      cp.diceRoll = rollDie(context.random);
      cp.diceUsed = 0;
      log(draft, `${cp.name} kastet terning: ${cp.diceRoll} øyne`, 'important');
      sendState();
      return;
    }

    if (action.type === 'move_to_territory') {
      moveToTerritory(draft, cp, action.territoryId, events, context, log, sendState);
      return;
    }

    if (action.type === 'buy_territory') {
      buyTerritory(draft, cp, action.territoryId, log, sendState, events);
      return;
    }

    if (action.type === 'invade_territory') {
      invadeTerritory(draft, cp, action.territoryId, context, log, sendState, events);
      return;
    }

    if (action.type === 'reinforce_territory') {
      reinforceTerritory(draft, cp, action.territoryId, log, sendState);
      return;
    }

    if (action.type === 'pay_rent') {
      payRent(draft, cp, action.territoryId, context, log, sendState, events);
      return;
    }

    if (action.type === 'end_turn') {
      endTurn(draft, cp, log, sendState);
    }
  });

  return { state: nextState, events };
}

function buyTerritory(draft, cp, territoryId, log, sendState, events) {
  const territory = TERRITORIES.find((item) => item.id === territoryId);
  const territoryState = draft.territories[territoryId];
  if (!territory || !territoryState) return;

  if (territoryState.owner) { log(draft, 'Området er allerede eid'); return; }
  if (cp.money < territory.price) { log(draft, 'Ikke nok penger'); return; }
  if (cp.units < 1) { log(draft, 'Ingen bataljoner å plassere'); return; }

  cp.money -= territory.price;
  cp.units -= 1;
  territoryState.owner = cp.id;
  territoryState.units = 1;

  log(draft, `${cp.name} kjøpte ${territory.name} for ${territory.price} kr`, 'buy');
  pushWinEvents(draft, cp, events);
  sendState();
}

function invadeTerritory(draft, cp, territoryId, context, log, sendState, events) {
  const territory = TERRITORIES.find((item) => item.id === territoryId);
  const territoryState = draft.territories[territoryId];
  if (!territory || !territoryState) return;

  if (territoryState.owner === cp.id) { log(draft, 'Du eier allerede dette området'); return; }
  if (cp.units < 1) { log(draft, 'Ingen bataljoner til invasjon'); return; }

  const ownedNeighbors = ADJACENCY[territoryId]?.filter((id) => draft.territories[id]?.owner === cp.id) || [];
  if (ownedNeighbors.length === 0 && cp.position !== territoryId) {
    log(draft, 'Du kan bare angripe fra tilstøtende områder du eier');
    return;
  }

  const result = riskCombat(Math.min(cp.units, 3), territoryState.units, context.random);
  const prevOwner = territoryState.owner;

  if (result.attackerWins) {
    const oldOwner = prevOwner ? draft.players.find((player) => player.id === prevOwner) : null;
    territoryState.owner = cp.id;
    territoryState.units = result.attackerRemaining;
    cp.units -= result.attackerLost;

    if (prevOwner) {
      cp.conquests ||= {};
      cp.conquests[prevOwner] = (cp.conquests[prevOwner] || 0) + 1;
    }

    log(draft, `${cp.name} tok ${territory.name}! (${prevOwner ? (oldOwner?.name || 'ukjent') : 'nøytral'} tapte)`, 'combat');

    if (prevOwner) {
      const remaining = Object.values(draft.territories).filter((item) => item.owner === prevOwner).length;
      if (remaining === 0) {
        const loser = draft.players.find((player) => player.id === prevOwner);
        if (loser) {
          loser.eliminated = true;
          log(draft, `${loser.name} er eliminert!`, 'important');
        }
      }
    }
  } else {
    cp.units -= result.attackerLost;
    territoryState.units = result.defenderRemaining;
    log(draft, `${cp.name} angrep ${territory.name} – mislyktes!`, 'combat');
  }

  events.push({
    type: 'modal',
    modal: {
      type: 'dice',
      result: {
        attackerDice: result.attackerDice,
        defenderDice: result.defenderDice,
        attackerName: cp.name,
        defenderName: prevOwner ? draft.players.find((player) => player.id === prevOwner)?.name : 'Nøytral',
        attackerWins: result.attackerWins,
        attackerLost: result.attackerLost,
        defenderLost: result.defenderLost,
      },
    },
  });

  pushWinEvents(draft, cp, events);
  pushGameEndEvents(draft, events);
  sendState();
}

function reinforceTerritory(draft, cp, territoryId, log, sendState) {
  const territoryState = draft.territories[territoryId];
  const territory = TERRITORIES.find((item) => item.id === territoryId);
  if (!territoryState || !territory) return;

  if (cp.units < 1) { log(draft, 'Ingen bataljoner å forsterke med'); return; }
  if (territoryState.owner !== cp.id) { log(draft, 'Du eier ikke dette området'); return; }

  cp.units -= 1;
  territoryState.units += 1;
  log(draft, `${cp.name} forsterket ${territory.name}`);
  sendState();
}

function moveToTerritory(draft, cp, territoryId, events, context, log, sendState) {
  if (cp.diceRoll === null || cp.diceUsed >= cp.diceRoll) return;

  cp.diceUsed += 1;
  cp.position = territoryId;

  if (territoryId === 'lysaker_cp') cp.checkpoints.lysaker = true;
  if (territoryId === 'kolbotn_cp') cp.checkpoints.kolbotn = true;

  const territory = TERRITORIES.find((item) => item.id === territoryId);
  const territoryState = draft.territories[territoryId];
  if (!territory || !territoryState) return;

  log(draft, `${cp.name} beveger seg til ${territory.name} (${cp.diceUsed}/${cp.diceRoll})`);

  if (cp.diceUsed === cp.diceRoll && territoryState.owner && territoryState.owner !== cp.id) {
    const rent = Math.floor(territory.price * 0.15);
    const owner = draft.players.find((player) => player.id === territoryState.owner);
    log(draft, `${cp.name} lander på ${owner.name}s område. Leie: ${rent} kr`, 'important');
    events.push({
      type: 'modal',
      modal: {
        type: 'rent',
        territoryId,
        rent,
        territoryName: territory.name,
        canPay: cp.money >= rent,
      },
    });
  }

  sendState();
}

function payRent(draft, cp, territoryId, context, log, sendState, events) {
  const territory = TERRITORIES.find((item) => item.id === territoryId);
  const territoryState = draft.territories[territoryId];
  if (!territory || !territoryState) return;

  const rent = Math.floor(territory.price * 0.15);
  if (cp.money < rent) {
    log(draft, `${cp.name} har ikke råd til leie – tvangsangrep!`, 'combat');
    invadeTerritory(draft, cp, territoryId, context, log, sendState, events);
    return;
  }

  cp.money -= rent;
  const owner = draft.players.find((player) => player.id === territoryState.owner);
  if (owner) owner.money += rent;
  log(draft, `${cp.name} betalte ${rent} kr i leie til ${owner?.name}`, 'buy');
  sendState();
}

function endTurn(draft, cp, log, sendState) {
  let bonusMoney = 0;
  let bonusUnits = 0;

  for (const [districtId, district] of Object.entries(DISTRICTS)) {
    const territories = TERRITORIES.filter((territory) => territory.district === districtId);
    if (territories.every((territory) => draft.territories[territory.id]?.owner === cp.id)) {
      bonusMoney += district.bonus.money;
      bonusUnits += district.bonus.units;
    }
  }

  if (cp.checkpoints?.lørenskog && cp.checkpoints?.lysaker && cp.checkpoints?.kolbotn) {
    bonusMoney += 500;
    bonusUnits += 3;
    cp.checkpoints = { lørenskog: true, lysaker: false, kolbotn: false };
    log(draft, `${cp.name} fullførte en runde! Bonus: +500 kr +3 bat.`, 'important');
  }

  if (bonusMoney > 0 || bonusUnits > 0) {
    cp.money += bonusMoney;
    cp.units += bonusUnits;
    log(draft, `${cp.name} får bonus: +${bonusMoney} kr, +${bonusUnits} bat.`);
  }

  cp.diceRoll = null;
  cp.diceUsed = 0;

  let nextIdx = (draft.currentPlayerIdx + 1) % draft.players.length;
  while (draft.players[nextIdx].eliminated) {
    nextIdx = (nextIdx + 1) % draft.players.length;
  }

  if (nextIdx === 0) draft.round += 1;
  draft.currentPlayerIdx = nextIdx;

  log(draft, `--- ${getCurrentPlayer(draft).name}s tur ---`, 'important');
  sendState();
}

function pushWinEvents(draft, player, events) {
  const mission = MISSIONS.find((item) => item.id === player.mission);
  if (mission?.check(player, draft)) {
    events.push({ type: 'modal', modal: { type: 'win', player: { ...player }, mission } });
  }
}

function pushGameEndEvents(draft, events) {
  const alive = draft.players.filter((player) => !player.eliminated);
  if (alive.length === 1) {
    events.push({
      type: 'modal',
      modal: { type: 'win', player: { ...alive[0] }, mission: { title: 'Siste mann stående', emoji: '🏆' } },
    });
  }
}

function riskCombat(attackers, defenders, random = Math.random) {
  const attackerDice = Array.from({ length: Math.min(attackers, 3) }, () => rollDie(random)).sort((a, b) => b - a);
  const defenderDice = Array.from({ length: Math.min(defenders, 2) }, () => rollDie(random)).sort((a, b) => b - a);

  let attackerLost = 0;
  let defenderLost = 0;
  const pairs = Math.min(attackerDice.length, defenderDice.length);
  for (let i = 0; i < pairs; i += 1) {
    if (attackerDice[i] > defenderDice[i]) defenderLost += 1;
    else attackerLost += 1;
  }

  return {
    attackerDice,
    defenderDice,
    attackerLost,
    defenderLost,
    attackerWins: defenderLost > 0 && defenders - defenderLost <= 0,
    attackerRemaining: Math.max(1, attackers - attackerLost),
    defenderRemaining: Math.max(0, defenders - defenderLost),
  };
}

function rollDie(random = Math.random) {
  return Math.ceil(random() * 6);
}

function getCurrentPlayer(gameState) {
  if (!gameState) return null;
  if (gameState.activePlayer) {
    return gameState.players.find((player) => player.side === gameState.activePlayer);
  }
  return gameState.players[gameState.currentPlayerIdx];
}

function isMyTurn(gameState, playerId) {
  return getCurrentPlayer(gameState)?.id === playerId;
}

function isMvpGame(gameState) {
  return Boolean(gameState?.activePlayer);
}
