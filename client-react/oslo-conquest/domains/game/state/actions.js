export { reduceGameAction } from './game-reducer.js';

export const actions = {
  rollDice: () => ({ type: 'roll_dice' }),
  buyTerritory: (territoryId) => ({ type: 'buy_territory', territoryId }),
  invadeTerritory: (territoryId) => ({ type: 'invade_territory', territoryId }),
  reinforceTerritory: (territoryId) => ({ type: 'reinforce_territory', territoryId }),
  moveToTerritory: (territoryId) => ({ type: 'move_to_territory', territoryId }),
  payRent: (territoryId) => ({ type: 'pay_rent', territoryId }),
  endTurn: () => ({ type: 'end_turn' }),
};
