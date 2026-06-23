import type { Action } from '../../domains/game/actions';
import type { Territory, TerritoryId } from '../../domains/game/types';

type AttackButtonProps = {
  territory: Territory;
  canAttack: boolean;
  attackFromTerritoryId: TerritoryId | null;
  dispatchGameAction: (action: Action) => void;
};

  export function AttackButton({
  territory,
  canAttack,
  attackFromTerritoryId,
  dispatchGameAction,
}: AttackButtonProps) {
  const isDisabled =  !canAttack || attackFromTerritoryId === null;

  function attackHandler(): void {
    if (attackFromTerritoryId !== null) {
      dispatchGameAction({
        type: 'invade_territory',
        territoryId: territory.id,
        fromTerritoryId: attackFromTerritoryId,
      });
    }
  }

  return (
    <button
      className="action-btn"
      type="button"
      onClick={attackHandler}
      disabled={isDisabled}
    >
      ⚔ Angrip område
    </button>
  );
}