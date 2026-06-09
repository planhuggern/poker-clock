import { useEffect, useState } from "react";
import { ADJACENCY, CHECKPOINTS, DISTRICTS, MISSIONS, TERRITORIES } from "../../domains/game/model/game-data.ts";
import { findPlayerByOwner, getCurrentPlayer, isMvpGame, isMyTurn } from "../../domains/game/state/game-state.ts";
import { state, notifyGameChanged, subscribe } from "../../domains/game/state/state.ts";
import { DICE_FACES } from "../../domains/dice/dice.js";
import { MapView } from "../../domains/map/MapView.jsx";

export function GameUI({
  gameState,
  myPlayerId,
  selectedTerritory,
  setSelectedTerritory,
  modal,
  missionRevealed,
  dispatchGameAction,
  setMissionRevealed,
  clearModal,
}) {
  const [, setVersion] = useState(0);

  useEffect(() => {
    state.gameState = gameState;
    state.myPlayerId = myPlayerId;
    state.selectedTerritory = selectedTerritory;
    state.modal = modal;
    state.missionRevealed = missionRevealed;
  }, [gameState, myPlayerId, selectedTerritory, modal, missionRevealed]);

  useEffect(() => subscribe(() => setVersion((version) => version + 1)), []);

  if (!gameState) return null;

  function handleSelectTerritory(territoryId) {
    setSelectedTerritory(territoryId);

    if (!isMvpGame() || !isMyTurn()) return;

    if (state.gameState?.phase === "setup") {
      const territory = TERRITORIES.find((item) => item.id === territoryId);
      if (territory?.type !== "checkpoint") return;

      dispatchGameAction({
        type: "choose_start_checkpoint",
        checkpointTerritoryId: territoryId,
      });
      return;
    }

    const currentPlayer = getCurrentPlayer();
    if (
      state.gameState?.phase === "playing" &&
      currentPlayer?.diceRoll !== null &&
      currentPlayer?.validMoves?.includes(territoryId)
    ) {
      dispatchGameAction({ type: "move_to_territory", territoryId });
    }
  }

  return (
    <>
      <HUD dispatchGameAction={dispatchGameAction} />
      <MapView
        gameState={gameState}
        selectedTerritory={selectedTerritory}
        onSelectTerritory={handleSelectTerritory}
      />
      <TurnIndicator />
      <CheckpointBar />
      <LogPanel />
      <ActionPanel dispatchGameAction={dispatchGameAction} />
      <MissionCard setMissionRevealed={setMissionRevealed} />
      <GameModal clearModal={clearModal} dispatchGameAction={dispatchGameAction} />
    </>
  );
}

function HUD({ dispatchGameAction }) {
  const currentPlayer = getCurrentPlayer();
  const showMvpRollButton = Boolean(
    isMvpGame() &&
    isMyTurn() &&
    state.gameState?.phase === "playing" &&
    currentPlayer?.position !== null &&
    currentPlayer?.diceRoll === null,
  );

  return (
    <div id="hud">
      <span className="hud-title">Oslo Conquest</span>
      <div className="player-chips">
        {state.gameState.players.map((player) => (
          <div
            className={`player-chip${player.id === currentPlayer?.id ? " active" : ""}`}
            style={{ opacity: player.eliminated ? 0.3 : 1 }}
            key={player.id}
          >
            <div className="chip-dot" style={{ background: player.color }} />
            <span>{player.name}</span>
            {isMvpGame() ? (
              <span className="chip-units">{player.colorName || player.side}</span>
            ) : (
              <>
                <span className="chip-money">💰 {player.money}</span>
                <span className="chip-units">⚔ {player.units}</span>
              </>
            )}
          </div>
        ))}
      </div>
      {showMvpRollButton && (
        <button
          className="btn"
          style={{ width: "auto", padding: "6px 16px", fontSize: "0.75rem" }}
          type="button"
          onClick={() => dispatchGameAction({ type: "roll_dice" })}
        >
          🎲 Kast terning
        </button>
      )}
      <button
        className="btn"
        style={{ width: "auto", padding: "6px 16px", fontSize: "0.75rem" }}
        type="button"
        onClick={() => dispatchGameAction({ type: "end_turn" })}
      >
        Avslutt tur →
      </button>
    </div>
  );
}

function TurnIndicator() {
  const currentPlayer = getCurrentPlayer();
  if (!currentPlayer) return null;

  const round = state.gameState.round ? ` – Runde ${state.gameState.round}` : "";
  const diceText = isMvpGame()
    ? (currentPlayer.diceRoll !== null
      ? ` | Terning: ${currentPlayer.diceRoll} (trekk tilgjengelig)`
      : "")
    : (currentPlayer.diceRoll !== null
      ? ` | Terning: ${currentPlayer.diceRoll} (brukt: ${currentPlayer.diceUsed})`
      : "");

  return (
    <div id="turn-indicator">
      <span style={{ color: currentPlayer.color }}>●</span> {currentPlayer.name}s tur{round}{diceText}
    </div>
  );
}

function CheckpointBar() {
  if (isMvpGame()) return null;
  const currentPlayer = getCurrentPlayer();
  if (!currentPlayer) return null;

  return (
    <div id="checkpoint-bar">
      {Object.entries(CHECKPOINTS).map(([id, checkpoint]) => (
        <div className={`checkpoint${currentPlayer.checkpoints?.[id] ? " reached" : ""}`} id={`cp-${id}`} key={id}>
          <div className="checkpoint-dot" /> {checkpoint.name}
        </div>
      ))}
    </div>
  );
}

function LogPanel() {
  const entries = state.gameState.log || [];

  return (
    <div id="log-panel">
      <div className="panel-title">Hendelseslogg</div>
      <div className="log-entries">
        {entries.slice(0, 30).map((entry, index) => (
          <div className={`log-entry ${entry.type || ""}`} key={`${entry.msg}-${index}`}>
            {entry.msg}
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionPanel({ dispatchGameAction }) {
  return (
    <div id="action-panel">
      <div className="panel-title">Handlinger</div>
      <ActionContent dispatchGameAction={dispatchGameAction} />
    </div>
  );
}

function ActionContent({ dispatchGameAction }) {
  const currentPlayer = getCurrentPlayer();
  const isMvpSetup = Boolean(isMvpGame() && state.gameState?.phase === "setup");

  if (isMvpSetup) {
    const selectedCheckpointName = currentPlayer?.position
      ? CHECKPOINTS[currentPlayer.position.replace("_cp", "")]?.name || currentPlayer.position
      : null;

    return (
      <div id="action-content">
        <p style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "0.9rem" }}>
          Klikk direkte på checkpoint i kartet for å flytte startbrikken.
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "8px" }}>
          {selectedCheckpointName
            ? `Valgt startcheckpoint: ${selectedCheckpointName}. Trykk Avslutt tur for å låse valget.`
            : "Velg et checkpoint, og trykk deretter Avslutt tur for å bekrefte."}
        </p>
      </div>
    );
  }

  if (!state.selectedTerritory) {
    return (
      <div id="action-content">
        <p style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "0.9rem" }}>Velg et område på kartet</p>
        {isMvpGame() ? (
          <div style={{ marginTop: "12px" }}>
            <button
              className="action-btn"
              type="button"
              onClick={() => dispatchGameAction({ type: "roll_dice" })}
              disabled={!isMyTurn() || currentPlayer?.diceRoll !== null}
            >
              🎲 Kast terning
            </button>
            <button className="action-btn" type="button" onClick={() => dispatchGameAction({ type: "end_turn" })} disabled={!isMyTurn()}>
              Avslutt tur
            </button>
          </div>
        ) : <RollDicePrompt dispatchGameAction={dispatchGameAction} />}
      </div>
    );
  }

  const territory = TERRITORIES.find((item) => item.id === state.selectedTerritory);
  const territoryState = state.gameState.territories[state.selectedTerritory];
  if (!territory || !territoryState) return null;

  const owner = findPlayerByOwner(territoryState.owner);
  const district = DISTRICTS[territory.district];
  const isCheckpoint = territory.type === "checkpoint";
  const validMoves = currentPlayer?.validMoves || [];
  const canMvpMove = Boolean(
    isMvpGame() &&
    isMyTurn() &&
    currentPlayer?.diceRoll !== null &&
    validMoves.includes(territory.id)
  );
  const selectedNeighbors = ADJACENCY[territory.id] || [];
  const mvpAttackFrom = isMvpGame()
    ? selectedNeighbors.find((id) => state.gameState.territories[id]?.owner === currentPlayer?.side)
    : null;
  const canMvpAttack = Boolean(
    isMvpGame() &&
    isMyTurn() &&
    !isCheckpoint &&
    territoryState.owner !== currentPlayer?.side &&
    mvpAttackFrom
  );

  return (
    <div id="action-content">
      <div className="territory-info">
        <div className="territory-name">{territory.name}</div>
        <div className="territory-district">{isCheckpoint ? "Checkpoint · friområde" : district.name}</div>
        <div className="territory-stats">
          <div className="stat">
            <span className="stat-label">{isCheckpoint ? "Status" : "Eier"}</span>
            <span style={{ color: owner?.color || "#888" }}>{isCheckpoint ? "Friområde" : owner?.name || "Nøytral"}</span>
          </div>
          {isCheckpoint ? (
            <div className="stat">
              <span className="stat-label">Regel</span>
              <span>Trygt område</span>
            </div>
          ) : (
            <>
              <div className="stat">
                <span className="stat-label">{isMvpGame() ? "Units" : "Bataljoner"}</span>
                <span>{territoryState.units}</span>
              </div>
              {!isMvpGame() && (
                <div className="stat">
                  <span className="stat-label">Pris</span>
                  <span style={{ color: "var(--gold)" }}>{territory.price} kr</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="action-buttons">
        {isMvpGame() ? (
          <>
            <button
              className="action-btn"
              type="button"
              onClick={() => dispatchGameAction({ type: "roll_dice" })}
              disabled={!isMyTurn() || currentPlayer?.diceRoll !== null}
            >
              🎲 Kast terning
            </button>
            <button
              className="action-btn"
              type="button"
              onClick={() => dispatchGameAction({ type: "move_to_territory", territoryId: territory.id })}
              disabled={!canMvpMove}
            >
              🚶 Flytt hit
            </button>
            <button
              className="action-btn"
              type="button"
              onClick={() => dispatchGameAction({
                type: "invade_territory",
                territoryId: territory.id,
                fromTerritoryId: mvpAttackFrom,
              })}
              disabled={!canMvpAttack}
            >
              ⚔ Angrip område
            </button>
            <button className="action-btn" type="button" onClick={() => dispatchGameAction({ type: "end_turn" })} disabled={!isMyTurn()}>
              Avslutt tur
            </button>
            {isMyTurn() && currentPlayer?.diceRoll !== null && (
              <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                Gyldige trekk: {validMoves.length}
              </div>
            )}
          </>
        ) : (
          <TerritoryActions
            territory={territory}
            territoryState={territoryState}
            currentPlayer={currentPlayer}
            dispatchGameAction={dispatchGameAction}
          />
        )}
      </div>
    </div>
  );
}

function RollDicePrompt({ dispatchGameAction }) {
  if (!isMyTurn()) return null;
  const currentPlayer = getCurrentPlayer();

  return (
    <div style={{ marginTop: "12px" }}>
      {currentPlayer.diceRoll === null ? (
        <button className="action-btn" type="button" onClick={() => dispatchGameAction({ type: "roll_dice" })}>🎲 Kast terning</button>
      ) : (
        <div style={{ color: "var(--gold)", marginBottom: "8px" }}>
          Terning: {currentPlayer.diceRoll} ({currentPlayer.diceUsed} brukt)
        </div>
      )}
    </div>
  );
}

function TerritoryActions({ territory, territoryState, currentPlayer, dispatchGameAction }) {
  if (!isMyTurn() || !currentPlayer) return null;

  const isCheckpoint = territory.type === "checkpoint";
  const myTerritory = territoryState.owner === currentPlayer.id;
  const neutral = !territoryState.owner;
  const enemy = territoryState.owner && territoryState.owner !== currentPlayer.id;
  const adjacent = ADJACENCY[territory.id]?.some((id) => state.gameState.territories[id]?.owner === currentPlayer.id);
  const canMove = currentPlayer.diceRoll !== null && currentPlayer.diceUsed < currentPlayer.diceRoll;

  if (isCheckpoint) {
    return canMove ? (
      <button className="action-btn" type="button" onClick={() => dispatchGameAction({ type: "move_to_territory", territoryId: territory.id })}>
        🚶 Beveg hit ({currentPlayer.diceUsed + 1}/{currentPlayer.diceRoll})
      </button>
    ) : null;
  }

  return (
    <>
      {!myTerritory ? (
        <>
          <button
            className="action-btn"
            type="button"
            onClick={() => dispatchGameAction({ type: "buy_territory", territoryId: territory.id })}
            disabled={!neutral || currentPlayer.money < territory.price}
          >
            Kjøp av bank <span className="price">{territory.price} kr</span>
          </button>
          <button
            className="action-btn"
            type="button"
            onClick={() => dispatchGameAction({ type: "invade_territory", territoryId: territory.id })}
            disabled={!adjacent && currentPlayer.position !== territory.id}
          >
            ⚔ Invader {enemy ? `(${territoryState.units} bat.)` : `(nøytral: ${territoryState.units} bat.)`}
          </button>
        </>
      ) : (
        <button
          className="action-btn"
          type="button"
          onClick={() => dispatchGameAction({ type: "reinforce_territory", territoryId: territory.id })}
          disabled={currentPlayer.units < 1}
        >
          + Forsterke <span className="price">{currentPlayer.units} tilgjengelig</span>
        </button>
      )}

      {canMove && (
        <button className="action-btn" type="button" onClick={() => dispatchGameAction({ type: "move_to_territory", territoryId: territory.id })}>
          🚶 Beveg hit ({currentPlayer.diceUsed + 1}/{currentPlayer.diceRoll})
        </button>
      )}
    </>
  );
}

function MissionCard({ setMissionRevealed }) {
  if (isMvpGame()) return null;
  const myPlayer = state.gameState.players.find((player) => player.id === state.myPlayerId);
  if (!myPlayer) return null;

  const mission = MISSIONS.find((item) => item.id === myPlayer.mission);
  const target = myPlayer.target ? state.gameState.players.find((player) => player.id === myPlayer.target) : null;
  const text = state.missionRevealed
    ? `${mission?.emoji} ${mission?.title}: ${mission?.desc}${mission?.id === "m8" && target ? ` (Mål: ${target.name})` : ""}`
    : "Klikk for å se";

  function toggleMission() {
    setMissionRevealed(!state.missionRevealed);
    notifyGameChanged();
  }

  return (
    <div id="mission-card" onClick={toggleMission}>
      <div className="mission-title">🎯 Ditt oppdrag</div>
      <div className={`mission-text${state.missionRevealed ? "" : " mission-hidden"}`}>{text}</div>
    </div>
  );
}

function GameModal({ clearModal, dispatchGameAction }) {
  if (!state.modal) return null;

  if (state.modal.type === "dice") return <DiceModal result={state.modal.result} clearModal={clearModal} />;
  if (state.modal.type === "rent") return <RentModal modal={state.modal} clearModal={clearModal} dispatchGameAction={dispatchGameAction} />;
  if (state.modal.type === "win") return <WinModal modal={state.modal} />;
  return null;
}

function DiceModal({ result, clearModal }) {
  return (
    <div id="dice-display" style={{ display: "block" }}>
      <div className="dice-title">Kampoppgjør</div>
      <div style={{ marginBottom: "8px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
        <span>{result.attackerName || "Angriper"}</span> vs <span>{result.defenderName || "Forsvarer"}</span>
      </div>
      <div className="dice-row">
        {(result.attackerDice || []).map((die, index) => <div className="die attacker" key={`a-${index}`}>{DICE_FACES[die]}</div>)}
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--red)", marginBottom: "4px" }}>↑ Angriper</div>
      <div className="dice-row">
        {(result.defenderDice || []).map((die, index) => <div className="die defender" key={`d-${index}`}>{DICE_FACES[die]}</div>)}
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--blue)", marginBottom: "12px" }}>↑ Forsvarer</div>
      <div className="dice-result">
        {result.attackerWins
          ? `✅ Angriperen vinner! Forsvarer tapte ${result.defenderLost} bat.`
          : `❌ Angrepet mislyktes. Angriper tapte ${result.attackerLost} bat.`}
      </div>
      <button className="btn" style={{ marginTop: "12px" }} type="button" onClick={clearModal}>Fortsett</button>
    </div>
  );
}

function RentModal({ modal, clearModal, dispatchGameAction }) {
  function confirmRent() {
    clearModal();
    dispatchGameAction({ type: "pay_rent", territoryId: modal.territoryId });
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Leie</h2>
        <p>
          Du landet på <strong>{modal.territoryName}</strong>.<br />
          Leie: <span style={{ color: "var(--gold)" }}>{modal.rent} kr</span>
        </p>
        {!modal.canPay && <p style={{ color: "#e87070" }}>Du har ikke råd! Tvangsangrep igangsettes.</p>}
        <button className="btn primary" type="button" onClick={confirmRent}>
          {modal.canPay ? `Betal ${modal.rent} kr` : "Angrip i stedet"}
        </button>
      </div>
    </div>
  );
}

function WinModal({ modal }) {
  return (
    <div className="modal-overlay">
      <div className="modal end-game-modal">
        <h2>🏆 Spillet er over!</h2>
        <div className="winner" style={{ color: modal.player.color }}>{modal.player.name} vinner!</div>
        <p>
          {modal.mission.emoji || ""} <strong>{modal.mission.title}</strong><br />
          {modal.mission.desc || ""}
        </p>
        <button className="btn primary" type="button" onClick={() => location.reload()}>Nytt spill</button>
      </div>
    </div>
  );
}
