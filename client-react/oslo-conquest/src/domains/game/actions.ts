import type { CheckpointId, MapNodeId, TerritoryId } from './types';

export type Action =
  | { type: 'roll_dice' }
  | { type: 'move_to_position'; territoryId: MapNodeId }
  | { type: 'buy_territory'; territoryId: TerritoryId }
  | { type: 'invade_territory'; territoryId: TerritoryId; fromTerritoryId: TerritoryId }
  | { type: 'reinforce_territory'; territoryId: TerritoryId }
  | { type: 'pay_rent'; territoryId: TerritoryId }
  | { type: 'end_turn' }
  | { type: 'choose_start_checkpoint'; checkpointTerritoryId: CheckpointId }
  | { type: 'forfeit' }
  | { type: 'return_to_lobby' };
