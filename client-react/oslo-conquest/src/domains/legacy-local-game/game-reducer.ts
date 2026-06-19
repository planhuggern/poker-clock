import { produce, Draft } from 'immer';
import { GameState, Player, LogEntry, Mission, Territory, Checkpoint, MapNode, GameModal } from '../game/types.js';
import { ADJACENCY, DISTRICTS, MISSIONS, TERRITORIES } from '../game/model/game-data.js';
import { findPlayerByRef } from '../../utils/player-utils.js';

/**
 * Legacy local-game reducer.
 *
 * This is not used by the current Oslo Conquest app. The active product flow is
 * server-authoritative over WebSocket. Keep this module only as reference code
 * for the older local prototype rules.
 */

// --- Types ---

type Context = {
  playerId: string;
  random: () => number;
  now?: () => string;
};

type Action =
  | { type: 'roll_dice' }
  | { type: 'move_to_territory'; territoryId: string }
  | { type: 'buy_territory'; territoryId: string }
  | { type: 'invade_territory'; territoryId: string }
  | { type: 'reinforce_territory'; territoryId: string }
  | { type: 'pay_rent'; territoryId: string }
  | { type: 'end_turn' };

type Event =
  | { type: 'log'; message: string; level?: string }
  | { type: 'send_state' }
  | { type: 'map_update' }
  | { type: 'modal'; modal: GameModal }
  | { type: 'send_end_turn'; playerId: string };

type CombatResult = {
  attackerDice: number[];
  defenderDice: number[];
  attackerLost: number;
  defenderLost: number;
  attackerWins: boolean;
  attackerRemaining: number;
  defenderRemaining: number;
};

type LogFn = (draft: Draft<GameState>, message: string, level?: string) => void;

// --- Public API ---

/**
 * Reducer for game actions. Takes the current game state, the player context, and an action, and returns the new game state along with any events that should be emitted (like logs or modals).
 * @param gameState The current state of the game.
 * @param context The context of the current player, including their ID and random number generator.
 * @param action The action to be applied to the game state.
 * @returns An object containing the new game state and any events that should be emitted.
 */
export function reduceGameAction(
  gameState: GameState,
  context: Context,
  action: Action,
): { state: GameState; events: Event[] } {
  const events: Event[] = [];
  const current = getCurrentPlayer(gameState);

  if (!gameState || !action) return { state: gameState, events };

  // Helper functions for logging and sending state updates
  function log(draft: Draft<GameState>, message: string, level = ''): void {
    draft.log = draft.log || [];
    draft.log.unshift({ msg: message, type: level, time: context.now?.() || '' } satisfies LogEntry);
    if (draft.log.length > 50) draft.log.pop();
    events.push({ type: 'log', message, level });
  }

  function sendState(): void {
    events.push({ type: 'send_state' });
    events.push({ type: 'map_update' });
  }

  if (action.type === 'end_turn') {
    if (!isMyTurn(gameState, context.playerId)) {
      const nextState = produce(gameState, (draft) => log(draft, 'Det er ikke din tur'));
      return { state: nextState, events };
    }
    events.push({ type: 'send_end_turn', playerId: context.playerId });
    //endTurn(draft, cp, log, sendState);
    return { state: gameState, events };
  }

  if (!current || !isMyTurn(gameState, context.playerId)) {
    const nextState = produce(gameState, (draft) => log(draft, 'Det er ikke din tur'));
    return { state: nextState, events };
  }

  const nextState = produce(gameState, (draft) => {
    const cp = getCurrentPlayer(draft)!;

    if (action.type === 'roll_dice') {
      if (cp.diceRoll !== null) return;
      cp.diceRoll = rollDie(context.random);
      cp.diceUsed = 0;
      log(draft, `${cp.name} kastet terning: ${cp.diceRoll} øyne`, 'important');
      sendState();
      return;
    }

    if (action.type === 'move_to_territory') {
      moveToTerritory(draft, cp, action.territoryId, events, log, sendState);
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
  });

  return { state: nextState, events };
}

// --- Action handlers ---

function buyTerritory(
  draft: Draft<GameState>,
  cp: Draft<Player>,
  territoryId: string,
  log: LogFn,
  sendState: () => void,
  events: Event[],
): void {
  const territory = TERRITORIES.find((t) => t.id === territoryId);
  const territoryState = draft.territories[territoryId];
  if (!territory || !territoryState) return;
  if (isCheckpoint(territory)) { log(draft, 'Checkpoint er friområde og kan ikke kjøpes'); return; }
  if (territoryState.owner)    { log(draft, 'Området er allerede eid'); return; }
  if (cp.money < territory.price) { log(draft, 'Ikke nok penger'); return; }
  if (cp.units < 1)            { log(draft, 'Ingen bataljoner å plassere'); return; }

  cp.money -= territory.price;
  cp.units -= 1;
  territoryState.owner = cp.id;
  territoryState.units = 1;

  log(draft, `${cp.name} kjøpte ${territory.name} for ${territory.price} kr`, 'buy');
  pushWinEvents(draft, cp, events);
  sendState();
}

function invadeTerritory(
  draft: Draft<GameState>,
  cp: Draft<Player>,
  territoryId: string,
  context: Context,
  log: LogFn,
  sendState: () => void,
  events: Event[],
): void {
  const territory = TERRITORIES.find((t) => t.id === territoryId);
  const territoryState = draft.territories[territoryId];
  if (!territory || !territoryState) return;
  if (isCheckpoint(territory)) { log(draft, 'Checkpoint er friområde og kan ikke angripes'); return; }
  if (territoryState.owner === cp.id) { log(draft, 'Du eier allerede dette området'); return; }
  if (cp.units < 1) { log(draft, 'Ingen bataljoner til invasjon'); return; }

  const ownedNeighbors = (ADJACENCY as Record<string, string[]>)[territoryId]?.filter((id) => draft.territories[id]?.owner === cp.id) ?? [];
  if (ownedNeighbors.length === 0 && cp.position !== territoryId) {
    log(draft, 'Du kan bare angripe fra tilstøtende områder du eier');
    return;
  }

  const prevOwner = territoryState.owner;
  const result: CombatResult = riskCombat(Math.min(cp.units, 3), territoryState.units, context.random);

  if (result.attackerWins) {
    const oldOwner = prevOwner ? draft.players.find((p) => p.id === prevOwner) : null;
    territoryState.owner = cp.id;
    territoryState.units = result.attackerRemaining;
    cp.units -= result.attackerLost;

    if (prevOwner) {
      cp.conquests ??= {};
      cp.conquests[prevOwner] = (cp.conquests[prevOwner] ?? 0) + 1;
    }

    log(draft, `${cp.name} tok ${territory.name}! (${prevOwner ? (oldOwner?.name ?? 'ukjent') : 'nøytral'} tapte)`, 'combat');

    if (prevOwner) {
      const remaining = Object.values(draft.territories).filter((t) => t.owner === prevOwner).length;
      if (remaining === 0) {
        const loser = draft.players.find((p) => p.id === prevOwner);
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

  const defenderName = prevOwner
    ? (draft.players.find((p) => p.id === prevOwner)?.name ?? 'ukjent')
    : 'Nøytral';

  events.push({
    type: 'modal',
    modal: {
      type: 'dice',
      result: {
        attackerDice: result.attackerDice,
        defenderDice: result.defenderDice,
        attackerName: cp.name,
        defenderName,
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

function reinforceTerritory(
  draft: Draft<GameState>,
  cp: Draft<Player>,
  territoryId: string,
  log: LogFn,
  sendState: () => void,
): void {
  const territory = TERRITORIES.find((t) => t.id === territoryId);
  const territoryState = draft.territories[territoryId];
  if (!territory || !territoryState) return;
  if (isCheckpoint(territory))           { log(draft, 'Checkpoint er friområde og kan ikke forsterkes'); return; }
  if (cp.units < 1)                       { log(draft, 'Ingen bataljoner å forsterke med'); return; }
  if (territoryState.owner !== cp.id)     { log(draft, 'Du eier ikke dette området'); return; }

  cp.units -= 1;
  territoryState.units += 1;
  log(draft, `${cp.name} forsterket ${territory.name}`);
  sendState();
}

function moveToTerritory(
  draft: Draft<GameState>,
  cp: Draft<Player>,
  territoryId: string,
  events: Event[],
  log: LogFn,
  sendState: () => void,
): void {
  if (cp.diceRoll === null || cp.diceUsed >= cp.diceRoll) return;

  cp.diceUsed += 1;
  cp.position = territoryId;

  const territory = TERRITORIES.find((t) => t.id === territoryId);
  if (territory?.type === 'checkpoint') cp.checkpoints[territory.checkpoint] = true;

  const territoryState = draft.territories[territoryId];
  if (!territory || !territoryState) return;

  log(draft, `${cp.name} beveger seg til ${territory.name} (${cp.diceUsed}/${cp.diceRoll})`);

  if (isCheckpoint(territory)) { sendState(); return; }

  if (cp.diceUsed === cp.diceRoll && territoryState.owner && territoryState.owner !== cp.id) {
    const rent = Math.floor(territory.price * 0.15);
    const owner = draft.players.find((p) => p.id === territoryState.owner);
    log(draft, `${cp.name} lander på ${owner?.name}s område. Leie: ${rent} kr`, 'important');
    events.push({
      type: 'modal',
      modal: { type: 'rent', territoryId, rent, territoryName: territory.name, canPay: cp.money >= rent },
    });
  }

  sendState();
}

function payRent(
  draft: Draft<GameState>,
  cp: Draft<Player>,
  territoryId: string,
  context: Context,
  log: LogFn,
  sendState: () => void,
  events: Event[],
): void {
  const territory = TERRITORIES.find((t) => t.id === territoryId);
  const territoryState = draft.territories[territoryId];
  if (!territory || !territoryState) return;
  if (isCheckpoint(territory)) { log(draft, 'Checkpoint er friområde og har ingen leie'); return; }

  const rent = Math.floor(territory.price * 0.15);
  if (cp.money < rent) {
    log(draft, `${cp.name} har ikke råd til leie – tvangsangrep!`, 'combat');
    invadeTerritory(draft, cp, territoryId, context, log, sendState, events);
    return;
  }

  cp.money -= rent;
  const owner = draft.players.find((p) => p.id === territoryState.owner);
  if (owner) owner.money += rent;
  log(draft, `${cp.name} betalte ${rent} kr i leie til ${owner?.name}`, 'buy');
  sendState();
}

function endTurn(
  draft: Draft<GameState>,
  cp: Draft<Player>,
  log: LogFn,
  sendState: () => void,
): void {
  let bonusMoney = 0;
  let bonusUnits = 0;

  for (const [districtId, district] of Object.entries(DISTRICTS)) {
    const territories = TERRITORIES.filter((t): t is Territory => t.type === 'territory' && t.district === districtId);
    if (territories.every((t) => draft.territories[t.id]?.owner === cp.id)) {
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

  log(draft, `--- ${getCurrentPlayer(draft)?.name}s tur ---`, 'important');
  sendState();
}

// --- Event helpers ---

function pushWinEvents(draft: Draft<GameState>, player: Draft<Player>, events: Event[]): void {
  const mission = (MISSIONS as Mission[]).find((m) => m.id === player.mission);
  if (mission?.check(player as Player, draft as GameState)) {
    events.push({ type: 'modal', modal: { type: 'win', player: { ...player } as Player, mission } });
  }
}

function pushGameEndEvents(draft: Draft<GameState>, events: Event[]): void {
  const alive = draft.players.filter((p) => !p.eliminated);
  if (alive.length === 1) {
    events.push({
      type: 'modal',
      modal: { type: 'win', player: { ...alive[0] } as Player, mission: { title: 'Siste mann stående', emoji: '🏆' } },
    });
  }
}

// --- Combat ---

function riskCombat(attackers: number, defenders: number, random = Math.random): CombatResult {
  const attackerDice = Array.from({ length: Math.min(attackers, 3) }, () => rollDie(random)).sort((a, b) => b - a);
  const defenderDice = Array.from({ length: Math.min(defenders, 2) }, () => rollDie(random)).sort((a, b) => b - a);

  let attackerLost = 0;
  let defenderLost = 0;
  const pairs = Math.min(attackerDice.length, defenderDice.length);
  for (let i = 0; i < pairs; i++) {
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

function rollDie(random = Math.random): number {
  return Math.ceil(random() * 6);
}

// --- State queries ---

function getCurrentPlayer(gameState: GameState | Draft<GameState>): Player | Draft<Player> | null {
  if (!gameState) return null;
  if (gameState.activePlayer) {
    return findPlayerByRef(gameState.players, gameState.activePlayer) ?? null;
  }
  return gameState.players[gameState.currentPlayerIdx] ?? null;
}

function isMyTurn(gameState: GameState, playerId: string): boolean {
  return getCurrentPlayer(gameState)?.id === playerId;
}

function isCheckpoint(territory: MapNode | undefined): territory is Checkpoint {
  return territory?.type === 'checkpoint';
}
