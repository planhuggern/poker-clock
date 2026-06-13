import { ADJACENCY, CHECKPOINTS, MISSIONS } from '../../domains/game/model/game-data.js';
import { getCurrentPlayer, isMvpGame, isMyTurn } from '../../domains/game/state/game-state.js';
import { notifyGameChanged, state } from '../../domains/game/state/state.js';
import { Player, RentModal, Territory } from '../../domains/game/types.js';

/**
 * Legacy local-game UI.
 *
 * These components are not used by the current server-authoritative Oslo
 * Conquest MVP. They are kept as reference for older local prototype features
 * such as missions, checkpoint progress, rent, and local territory actions.
 */

type Action = { type: string; [key: string]: unknown };
type PlayerWithValidMoves = Player & { validMoves?: string[] };

export function CheckpointBar() {
  if (isMvpGame()) return null;
  const currentPlayer = getCurrentPlayer();
  if (!currentPlayer) return null;

  return (
    <div id="checkpoint-bar">
      {Object.entries(CHECKPOINTS).map(([id, checkpoint]) => (
        <div className={`checkpoint${currentPlayer.checkpoints?.[id] ? ' reached' : ''}`} id={`cp-${id}`} key={id}>
          <div className="checkpoint-dot" /> {checkpoint.name}
        </div>
      ))}
    </div>
  );
}

type TerritoryActionsProps = {
  territory: Territory;
  territoryState: { owner: string | null; units: number };
  currentPlayer: PlayerWithValidMoves | null;
  dispatchGameAction: (a: Action) => void;
};

export function TerritoryActions({ territory, territoryState, currentPlayer, dispatchGameAction }: TerritoryActionsProps) {
  if (!isMyTurn() || !currentPlayer) return null;

  const myTerritory = territoryState.owner === currentPlayer.id;
  const neutral = !territoryState.owner;
  const adjacent = (ADJACENCY as Record<string, string[]>)[territory.id]?.some((id) => state.gameState!.territories[id]?.owner === currentPlayer.id);
  const canMove = currentPlayer.diceRoll !== null && currentPlayer.diceUsed < currentPlayer.diceRoll;

  return (
    <>
      {!myTerritory ? (
        <>
          <button className="action-btn" type="button" onClick={() => dispatchGameAction({ type: 'buy_territory', territoryId: territory.id })} disabled={!neutral || currentPlayer.money < territory.price}>
            Kjøp av bank <span className="price">{territory.price} kr</span>
          </button>
          <button className="action-btn" type="button" onClick={() => dispatchGameAction({ type: 'invade_territory', territoryId: territory.id })} disabled={!adjacent && currentPlayer.position !== territory.id}>
            ⚔ Invader {territoryState.owner ? `(${territoryState.units} bat.)` : `(nøytral: ${territoryState.units} bat.)`}
          </button>
        </>
      ) : (
        <button className="action-btn" type="button" onClick={() => dispatchGameAction({ type: 'reinforce_territory', territoryId: territory.id })} disabled={currentPlayer.units < 1}>
          + Forsterke <span className="price">{currentPlayer.units} tilgjengelig</span>
        </button>
      )}
      {canMove && (
        <button className="action-btn" type="button" onClick={() => dispatchGameAction({ type: 'move_to_territory', territoryId: territory.id })}>
          🚶 Beveg hit ({currentPlayer.diceUsed + 1}/{currentPlayer.diceRoll})
        </button>
      )}
    </>
  );
}

export function MissionCard({ setMissionRevealed }: { setMissionRevealed: (v: boolean) => void }) {
  if (isMvpGame()) return null;
  const myPlayer = state.gameState!.players.find((player) => player.id === state.myPlayerId);
  if (!myPlayer) return null;

  const mission = MISSIONS.find((item) => item.id === myPlayer.mission);
  const target = myPlayer.target ? state.gameState!.players.find((player) => player.id === myPlayer.target) : null;
  const text = state.missionRevealed
    ? `${mission?.emoji} ${mission?.title}: ${(mission as typeof mission & { desc?: string })?.desc ?? ''}${mission?.id === 'm8' && target ? ` (Mål: ${target.name})` : ''}`
    : 'Klikk for å se';

  return (
    <div id="mission-card" onClick={() => { setMissionRevealed(!state.missionRevealed); notifyGameChanged(); }}>
      <div className="mission-title">🎯 Ditt oppdrag</div>
      <div className={`mission-text${state.missionRevealed ? '' : ' mission-hidden'}`}>{text}</div>
    </div>
  );
}

export function RentModalView({ modal, clearModal, dispatchGameAction }: { modal: RentModal; clearModal: () => void; dispatchGameAction: (a: Action) => void }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Leie</h2>
        <p>Du landet på <strong>{modal.territoryName}</strong>.<br />Leie: <span style={{ color: 'var(--gold)' }}>{modal.rent} kr</span></p>
        {!modal.canPay && <p style={{ color: '#e87070' }}>Du har ikke råd! Tvangsangrep igangsettes.</p>}
        <button className="btn primary" type="button" onClick={() => { clearModal(); dispatchGameAction({ type: 'pay_rent', territoryId: modal.territoryId }); }}>
          {modal.canPay ? `Betal ${modal.rent} kr` : 'Angrip i stedet'}
        </button>
      </div>
    </div>
  );
}
