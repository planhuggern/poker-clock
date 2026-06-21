import { useEffect, useState } from 'react';
import { ADJACENCY, CHECKPOINTS, DISTRICTS, TERRITORIES } from '../../domains/game/model/game-data.js';
import { findPlayerByOwner, getCurrentPlayer, isMyTurn } from '../../domains/game/state/game-state.js';
import { state, subscribe } from '../../domains/game/state/state.js';
import { DICE_FACES } from '../../domains/dice/dice.js';
import { MapView } from '../../domains/map/MapView.js';
import { GameState, GameModal, DiceModal, RentModal, WinModal, Player, Territory, MapNode, TerritoryId, CheckpointId } from '../../domains/game/types.js';
import { CheckpointBar, MissionCard, RentModalView} from '../legacy-local/LegacyLocalGameUI.js';
import { playerMatchesRef } from '../../utils/player-utils.js';
import { Action } from '../../domains/game/actions.js';


type GameUIProps = {
  gameState: GameState | null;
  myPlayerId: string | null;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  modal: GameModal | null;
  missionRevealed: boolean;
  dispatchGameAction: (action: Action) => void;
  setMissionRevealed: (value: boolean) => void;
  clearModal: () => void;
};

export function GameUI({
  gameState, myPlayerId, selectedNodeId, setSelectedNodeId,
  modal, missionRevealed, dispatchGameAction, setMissionRevealed, clearModal,
}: GameUIProps) {
  const [, setVersion] = useState(0);

  useEffect(() => {
    state.gameState = gameState;
    state.myPlayerId = myPlayerId;
    state.selectedNodeId = selectedNodeId;
    state.modal = modal;
    state.missionRevealed = missionRevealed;
  }, [gameState, myPlayerId, selectedNodeId, modal, missionRevealed]);

  useEffect(() => subscribe(() => setVersion((v) => v + 1)), []);

  if (!gameState) return null;

  function handleSelectNode(nodeId: TerritoryId | CheckpointId): void {
    setSelectedNodeId(nodeId);
    if (!isMyTurn()) return;

    if (state.gameState?.phase === 'setup') {
      const territory = TERRITORIES.find((t) => t.id === nodeId);
      if (territory?.type !== 'checkpoint') return;
      dispatchGameAction({ type: 'choose_start_checkpoint', checkpointTerritoryId: nodeId });
      return;
    }

    const currentPlayer = getCurrentPlayer();
    const validMoves = currentPlayer?.validMoves ?? [];
    const isValidMove = validMoves.includes(nodeId);
    if (
      state.gameState?.phase === 'playing' &&
      currentPlayer !== null &&
      currentPlayer.diceRoll !== null &&
      isValidMove
    ) {
      dispatchGameAction({ type: 'move_to_position', territoryId: nodeId });
    }
  }

  return (
    <>
      <HUD dispatchGameAction={dispatchGameAction} />
      <MapView gameState={gameState} selectedNodeId={selectedNodeId} onSelectNode={handleSelectNode} localPlayerId={myPlayerId} />
      <TurnIndicator />
      {/* <CheckpointBar /> Not yet implemented in server*/}
      <LogPanel />
      <ActionPanel dispatchGameAction={dispatchGameAction} />
      {/* <MissionCard setMissionRevealed={setMissionRevealed} /> Not yet implemented in server*/}
      <GameModalView clearModal={clearModal} dispatchGameAction={dispatchGameAction} />
    </>
  );
}

function HUD({ dispatchGameAction }: { dispatchGameAction: (a: Action) => void }) {
  const currentPlayer = getCurrentPlayer();
  const myTurn = isMyTurn();
  const showRollButton = Boolean(
    myTurn &&
    state.gameState?.phase === 'playing' &&
    currentPlayer?.position !== null &&
    currentPlayer?.diceRoll === null,
  );

  return (
    <div id="hud">
      <span className="hud-title">Oslo Conquest</span>
      <div className="player-chips">
        {state.gameState!.players.map((player) => (
          <div className={`player-chip${player.id === currentPlayer?.id ? ' active' : ''}`} style={{ opacity: player.eliminated ? 0.3 : 1 }} key={player.id}>
            <div className="chip-dot" style={{ background: player.color }} />
            <span>{player.name}</span>

            {player.money !== undefined && (
              <span className="chip-money">💰 {player.money}</span>
            )}

            {player.units !== undefined && (
              <span className="chip-units">⚔ {player.units}</span>
            )}
          </div>
        ))}
      </div>
      {showRollButton && (
        <button className="btn" style={{ width: 'auto', padding: '6px 16px', fontSize: '0.75rem' }} type="button" onClick={() => dispatchGameAction({ type: 'roll_dice' })}>
          🎲 Kast terning
        </button>
      )}
      <button className="btn" style={{ width: 'auto', padding: '6px 16px', fontSize: '0.75rem' }} type="button" disabled={!myTurn} onClick={() => dispatchGameAction({ type: 'end_turn' })}>
        Avslutt tur →
      </button>
      {(state.gameState?.phase === 'playing' || state.gameState?.phase === 'setup') && (
        <button
          className="btn forfeit-btn"
          style={{ width: 'auto', padding: '6px 16px', fontSize: '0.75rem' }}
          type="button"
          onClick={() => {
            if (window.confirm('Er du sikker på at du vil gi opp?')) {
              dispatchGameAction({ type: 'forfeit' });
            }
          }}
        >
          🏳️ Gi opp
        </button>
      )}
    </div>
  );
}

function TurnIndicator() {
  const currentPlayer = getCurrentPlayer();
  if (!currentPlayer) return null;

  const round = state.gameState!.round ? ` – Runde ${state.gameState!.round}` : '';
  const diceText = (currentPlayer.diceRoll !== null ? ` | Terning: ${currentPlayer.diceRoll} (trekk tilgjengelig)` : '');
  const myPlayer = state.gameState?.players.find((player) => player.id === state.myPlayerId) ?? null;

  if (!myPlayer) return null;

  const turnText = isMyTurn()
    ? `Din tur${round}${diceText}`
    : `Venter på ${currentPlayer.name}${round}`;

  return (
    <div id="turn-indicator">
      <div className="identity-line">
        <span style={{ color: myPlayer.color }}>●</span> Du er {myPlayer.name}
        {myPlayer.colorName ? <span className="identity-side">{myPlayer.colorName}</span> : null}
      </div>
      <div className={`turn-status${isMyTurn() ? ' my-turn' : ''}`}>{turnText}</div>
    </div>
  );
}

function LogPanel() {
  const entries = state.gameState!.log ?? [];
  return (
    <div id="log-panel">
      <div className="panel-title">Hendelseslogg</div>
      <div className="log-entries">
        {entries.slice(0, 30).map((entry, index) => (
          <div className={`log-entry ${entry.type ?? ''}`} key={`${entry.msg}-${index}`}>{entry.msg}</div>
        ))}
      </div>
    </div>
  );
}

function ActionPanel({ dispatchGameAction }: { dispatchGameAction: (a: Action) => void }) {
  return (
    <div id="action-panel">
      <div className="panel-title">Handlinger</div>
      <ActionContent dispatchGameAction={dispatchGameAction} />
    </div>
  );
}

type PlayerWithValidMoves = Player & { validMoves?: string[] };

function ActionContent({ dispatchGameAction }: { dispatchGameAction: (a: Action) => void }) {
  const currentPlayer = getCurrentPlayer() as PlayerWithValidMoves | null;
  const isSetupPhase = Boolean(state.gameState?.phase === 'setup');
  const myTurn = isMyTurn();

  if (isSetupPhase) {
    const selectedCheckpointName = currentPlayer?.position
      ? CHECKPOINTS[currentPlayer.position.replace('_cp', '')]?.name ?? currentPlayer.position
      : null;
    if (!myTurn) {
      return (
        <div id="action-content">
          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>Venter på {currentPlayer?.name ?? 'motspiller'}.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '8px' }}>Du kan klikke i kartet for å se, men kan ikke velge startcheckpoint før det er din tur.</p>
        </div>
      );
    }
    return (
      <div id="action-content">
        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>Klikk direkte på checkpoint i kartet for å flytte startbrikken.</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '8px' }}>
          {selectedCheckpointName ? `Valgt startcheckpoint: ${selectedCheckpointName}. Trykk Avslutt tur for å låse valget.` : 'Velg et checkpoint, og trykk deretter Avslutt tur for å bekrefte.'}
        </p>
      </div>
    );
  }

  if (!state.selectedNodeId) {
    return (
      <div id="action-content">
        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
          {myTurn ? 'Velg et område på kartet' : `Venter på ${currentPlayer?.name ?? 'motspiller'}.`}
        </p>
        <div style={{ marginTop: '12px' }}>
          <button className="action-btn" type="button" onClick={() => dispatchGameAction({ type: 'roll_dice' })} disabled={!myTurn || currentPlayer?.diceRoll !== null}>🎲 Kast terning</button>
          <button className="action-btn" type="button" onClick={() => dispatchGameAction({ type: 'end_turn' })} disabled={!myTurn}>Avslutt tur</button>
          {!myTurn && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Du kan fortsatt inspisere kartet.</div>
            )}
        </div>
      </div>
    );
  }

  const node = TERRITORIES.find((t) => t.id === state.selectedNodeId);
  const territoryState = state.gameState!.territories[state.selectedNodeId!];
  if (!node || !territoryState) return null;

  const owner = findPlayerByOwner(territoryState.owner);
  const isCheckpoint = node.type === 'checkpoint';
  const territory = isCheckpoint ? null : node as Territory;
  const district = territory ? DISTRICTS[territory.district] : null;
  const validMoves = currentPlayer?.validMoves ?? [];
  const canMove = Boolean(myTurn && currentPlayer?.diceRoll !== null && validMoves.includes(node.id));
  const neighborNodeIds = (ADJACENCY as Record<string, string[]>)[node.id] ?? [];


  //TODO: Change when side is removed from server state.
  const currentPlayerOwns = (owner: string | null | undefined): boolean => {
    if (!currentPlayer) return false;
    return playerMatchesRef(currentPlayer, owner);
  };

  const attackFromTerritoryId = 
    neighborNodeIds.find(
      (id) => currentPlayerOwns(state.gameState!.territories[id]?.owner)
    ) ?? null;

  const canAttack = Boolean(
    myTurn && 
    !isCheckpoint && 
    !currentPlayerOwns(territoryState.owner) && 
    attackFromTerritoryId
  );

  return (
    <div id="action-content">
      <div className="territory-info">
        <div className="territory-name">{node.name}</div>
        <div className="territory-district">{isCheckpoint ? 'Checkpoint · friområde' : district?.name}</div>
        <div className="territory-stats">
          <div className="stat">
            <span className="stat-label">{isCheckpoint ? 'Status' : 'Eier'}</span>
            <span style={{ color: owner?.color ?? '#888' }}>{isCheckpoint ? 'Friområde' : owner?.name ?? 'Nøytral'}</span>
          </div>
          {isCheckpoint ? (
            <div className="stat"><span className="stat-label">Regel</span><span>Trygt område</span></div>
          ) : (
            <>
              <div className="stat">
                <span className="stat-label">Bataljoner</span>
                <span>{territoryState.units}</span>
              </div>
              {territory?.price != null && (
                <div className="stat">
                  <span className="stat-label">Pris</span>
                  <span style={{ color: 'var(--gold)' }}>{territory.price} kr</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="action-buttons">
        {!myTurn && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Venter på {currentPlayer?.name ?? 'motspiller'}. Du kan inspisere, men ikke handle.
          </div>
        )}

        <button
          className="action-btn"
          type="button"
          onClick={() => dispatchGameAction({ type: 'roll_dice' })}
          disabled={!myTurn || currentPlayer?.diceRoll !== null}
        >
          🎲 Kast terning
        </button>
          
        <button
          className="action-btn"
          type="button"
          onClick={() =>
            dispatchGameAction({
              type: 'move_to_position',
              territoryId: node.id,
            })
          }
          disabled={!canMove}
        >
          🚶 Flytt hit
        </button>
  
        {territory && (
          <button
            className="action-btn"
            type="button"
            onClick={() => {
              if (!territory || attackFromTerritoryId === null) return;

              dispatchGameAction({
                type: 'invade_territory',
                territoryId: territory.id,
                fromTerritoryId: attackFromTerritoryId,
              })
            }}
            disabled={!canAttack}
          >
            ⚔ Angrip område
          </button>
        )}

        <button
          className="action-btn"
          type="button"
          onClick={() => dispatchGameAction({ type: 'end_turn' })}
          disabled={!myTurn}
        >
          Avslutt tur
        </button>
  
        {myTurn && currentPlayer?.diceRoll !== null && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Gyldige trekk: {validMoves.length}
          </div>
        )}
      </div>
    </div>
  );
}

function RollDicePrompt({ dispatchGameAction }: { dispatchGameAction: (a: Action) => void }) {
  if (!isMyTurn()) return null;
  const currentPlayer = getCurrentPlayer();
  if (!currentPlayer) return null;

  return (
    <div style={{ marginTop: '12px' }}>
      {currentPlayer.diceRoll === null ? (
        <button className="action-btn" type="button" onClick={() => dispatchGameAction({ type: 'roll_dice' })}>🎲 Kast terning</button>
      ) : (
        <div style={{ color: 'var(--gold)', marginBottom: '8px' }}>Terning: {currentPlayer.diceRoll} ({currentPlayer.diceUsed} brukt)</div>
      )}
    </div>
  );
}

function GameModalView({ clearModal, dispatchGameAction }: { clearModal: () => void; dispatchGameAction: (a: Action) => void }) {
  if (!state.modal) return null;
  if (state.modal.type === 'dice') return <DiceModalView result={(state.modal as DiceModal).result} clearModal={clearModal} />;
  if (state.modal.type === 'rent') return <RentModalView modal={state.modal as RentModal} clearModal={clearModal} dispatchGameAction={dispatchGameAction} />;
  if (state.modal.type === 'win') return <WinModalView modal={state.modal as WinModal} dispatchGameAction={dispatchGameAction} />;
  return null;
}

function DiceModalView({ result, clearModal }: { result: DiceModal['result']; clearModal: () => void }) {
  return (
    <div id="dice-display" style={{ display: 'block' }}>
      <div className="dice-title">Kampoppgjør</div>
      <div style={{ marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <span>{result.attackerName ?? 'Angriper'}</span> vs <span>{result.defenderName ?? 'Forsvarer'}</span>
      </div>
      <div className="dice-row">
        {result.attackerDice.map((die, i) => <div className="die attacker" key={`a-${i}`}>{DICE_FACES[die]}</div>)}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--red)', marginBottom: '4px' }}>↑ Angriper</div>
      <div className="dice-row">
        {result.defenderDice.map((die, i) => <div className="die defender" key={`d-${i}`}>{DICE_FACES[die]}</div>)}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--blue)', marginBottom: '12px' }}>↑ Forsvarer</div>
      <div className="dice-result">
        {result.attackerWins ? `✅ Angriperen vinner! Forsvarer tapte ${result.defenderLost} bat.` : `❌ Angrepet mislyktes. Angriper tapte ${result.attackerLost} bat.`}
      </div>
      <button className="btn" style={{ marginTop: '12px' }} type="button" onClick={clearModal}>Fortsett</button>
    </div>
  );
}

function WinModalView({ modal, dispatchGameAction }: { modal: WinModal; dispatchGameAction: (a: Action) => void }) {
  return (
    <div className="modal-overlay">
      <div className="modal end-game-modal">
        <h2>🏆 Spillet er over!</h2>
        <div className="winner" style={{ color: modal.player.color }}>{modal.player.name} vinner!</div>
        <p>{modal.mission.emoji ?? ''} <strong>{modal.mission.title}</strong></p>
        <button className="btn primary" type="button" onClick={() => dispatchGameAction({ type: 'return_to_lobby' })}>Returner til lobby</button>
      </div>
    </div>
  );
}
