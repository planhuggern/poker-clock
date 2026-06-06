import { useEffect, useMemo, useState } from "react";
import {
  connectWS,
  createGame,
  joinGame,
  refreshRooms,
  sendAttack,
  sendChooseStartCheckpoint,
  sendEndTurn,
  sendMove,
  sendRollDice,
  sendGameState,
  startLocalGame,
} from "./transport/websocket/websocket.js";
import { GameUI } from "./ui/components/GameUI.jsx";
import { reduceGameAction } from "./domains/game/state/game-reducer.js";
import { notifyGameChanged, state } from "./domains/game/state/state.ts";

const DEFAULT_WS_URL = "ws://localhost:8000/ws/oslo-conquest/";

// Server authoritative betyr at serveren har full kontroll over spillets tilstand,
// og klientene sender kun handlinger som serveren validerer og utfører.
// Dette er i motsetning til en klient-autoritativ modell, 
// hvor klientene har mer kontroll over spillets tilstand og kan utføre handlinger 
// lokalt uten å vente på serveren. I Oslo Conquest brukes server-autoritativ modell 
// for flerspiller-spill, mens lokal spillmodus bruker klient-autoritativ modell for å 
// forenkle implementasjonen.
function isServerAuthoritativeGame(gameState) {
  return Boolean(gameState?.players?.some((player) => player.side));
}

export function App() {
  const [playerName, setPlayerName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [lobbyStatus, setLobbyStatus] = useState({ message: "", isError: false });
  const [rooms, setRooms] = useState([]);
  const [inGame, setInGame] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [selectedTerritory, setSelectedTerritory] = useState(null);
  const [modal, setModal] = useState(null);
  const [missionRevealed, setMissionRevealed] = useState(false);

  // Defaultverdien til et roomId settes til "oslo-x", hvor x er det høyeste eksisterende nummeret + 1 blant aktive rom.
  // Dette gjør det enklere for spillere å opprette nye rom uten å måtte finne på unike navn:
  if (roomId === "" || roomId.startsWith("oslo-")) {
    const largestNumber = rooms
      .map((room) => {
        const match = room.room.match(/^oslo-(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .reduce((maks, num) => Math.max(maks, num), 0);
    setRoomId(`oslo-${largestNumber + 1}`);
  }


  // Spillernavnet settes til en tilfeldig kul navn fra en tilfelg nickname generator,
  // for å gjøre det raskt og gøy å komme i gang:
  useEffect(() => {
    if (playerName.trim() === "") {
      const adjectives = [
        "Rasende", "Lynende", "Skinnende",
        "Dundrende", "Glitrende", "Brølende",
        "Voldsomme", "Skumle", "Mektige",
        "Fryktløse", "Våghalsende", "Uovervinnelige",
        "Tordnende", "Skjoldbærende", "Kraftfulle"
        ];
      const nouns = [
        "Ulv", "Ørn", "Løve",
        "Bjørn", "Slange", "Havfrue",
        "Trollmann", "Viking", "Kriger",
        "Skurk", "Eventyrer", "Konge",
        "Dronning", "Ninja", "Samurai",
        "Krabbe", "Falk", "Panter"
        ];
      const randomName = `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
      setPlayerName(randomName);
    }
  }, []);

  useEffect(() => {
    state.gameState = gameState;
    state.myPlayerId = myPlayerId;
    state.selectedTerritory = selectedTerritory;
    state.modal = modal;
    state.missionRevealed = missionRevealed;
    notifyGameChanged();
  }, [gameState, myPlayerId, selectedTerritory, modal, missionRevealed]);

  const handlers = useMemo(() => ({
    onConnectionChange: setConnectionStatus,
    onLobbyStatus: (message, isError = false) => setLobbyStatus({ message, isError }),
    onRooms: setRooms,
    onGameStarted: () => setInGame(true),
    onModal: setModal,
    onGameState: (nextGameState) => {
      state.gameState = nextGameState;
      setGameState(nextGameState);
    },
    onError: (message) => setLobbyStatus({ message, isError: true }),
  }), []);

  useEffect(() => {
    if (!inGame) connectWS({ url: DEFAULT_WS_URL, handlers });
  }, [handlers, inGame]);

  function handleReducerEvents(result) {
    for (const event of result.events) {
      if (event.type === "modal") setModal(event.modal);
      if (event.type === "send_state") sendGameState(result.state);
      if (event.type === "send_end_turn") sendEndTurn(event.playerId);
    }
  }

  function dispatchGameAction(action) {
    if (!gameState) return;

    if (isServerAuthoritativeGame(gameState)) {
      if (action.type === "choose_start_checkpoint") {
        sendChooseStartCheckpoint(action.checkpointTerritoryId);
      }
      if (action.type === "roll_dice") {
        sendRollDice();
      }
      if (action.type === "move_to_territory") {
        sendMove(action.territoryId);
      }
      if (action.type === "end_turn") {
        sendEndTurn();
      }
      if (action.type === "invade_territory") {
        sendAttack(action.fromTerritoryId, action.territoryId);
      }
      return;
    }

    const result = reduceGameAction(gameState, {
      playerId: myPlayerId,
      random: Math.random,
      now: () => new Date().toLocaleTimeString("no", { hour: "2-digit", minute: "2-digit" }),
    }, action);
    state.gameState = result.state;
    setGameState(result.state);
    handleReducerEvents(result);
  }

  function requireLobbyFields() {
    if (!playerName.trim() || !roomId.trim()) {
      setLobbyStatus({ message: "Fyll inn navn og rom-ID", isError: true });
      return false;
    }
    return true;
  }

  function handleCreateGame() {
    if (!requireLobbyFields()) return;
    createGame({ url: DEFAULT_WS_URL, name: playerName, room: roomId, handlers });
    // Etter å ha opprettet et spill, settes myPlayerId fra state som oppdateres av onGameState
    // når serveren sender den nye tilstanden. Deretter åpnes en lobby-flis for spillet som vises til 
    // høyre for listen over aktive rom, hvor spilleren kan vente på at andre skal bli med før spillet starter.

    

    setMyPlayerId(state.myPlayerId);
  }

  function handleJoinGame() {
    if (!requireLobbyFields()) return;
    joinGame({ url: DEFAULT_WS_URL, name: playerName, room: roomId, handlers });
    setMyPlayerId(state.myPlayerId);
  }

  function handleRefreshRooms() {
    connectWS({ url: DEFAULT_WS_URL, handlers });
    refreshRooms(handlers);
  }

  function handleSelectRoom(room) {
    setRoomId(room);
    setLobbyStatus({ message: `Valgt rom "${room}". Trykk "Bli med i spill".`, isError: false });
  }

  function handleStartLocalGame() {
    startLocalGame({ name: playerName, handlers });
    setMyPlayerId(state.myPlayerId);
  }

  if (inGame) {
    return (
      <GameUI
        gameState={gameState}
        myPlayerId={myPlayerId}
        selectedTerritory={selectedTerritory}
        setSelectedTerritory={setSelectedTerritory}
        modal={modal}
        missionRevealed={missionRevealed}
        dispatchGameAction={dispatchGameAction}
        setMissionRevealed={setMissionRevealed}
        clearModal={() => setModal(null)}
      />
    );
  }

  return (
    <div id="lobby">
      <div className="lobby-card">
        <LobbyHeader />
        <div className="lobby-grid">
          <LobbyConnectionColumn
            connectionStatus={connectionStatus}
            playerName={playerName}
            setPlayerName={setPlayerName}
            roomId={roomId}
            setRoomId={setRoomId}
            handleCreateGame={handleCreateGame}
            handleJoinGame={handleJoinGame}
          />
          <LobbyRoomsColumn
            lobbyStatus={lobbyStatus}
            rooms={rooms}
            roomId={roomId}
            handleRefreshRooms={handleRefreshRooms}
            handleSelectRoom={handleSelectRoom}
            handleStartLocalGame={handleStartLocalGame}
          />
        </div>
      </div>
    </div>
  );
}

function LobbyHeader() {
  return (
    <div className="lobby-header">
      <h1 className="title">Oslo Conquest</h1>
      <p className="subtitle">Krig, handel og makt i Norges hjerte</p>
    </div>
  );
}

function LobbyConnectionColumn({
  connectionStatus,
  playerName,
  setPlayerName,
  roomId,
  setRoomId,
  handleCreateGame,
  handleJoinGame,
}) {
  return (
    <section className="lobby-column">
      <div className="ws-status">
        <div className={`ws-dot${connectionStatus === "connected" ? " connected" : ""}`} />
        <span>{connectionStatus === "connected" ? "Tilkoblet" : connectionStatus === "connecting" ? "Kobler til..." : "Frakoblet"}</span>
      </div>

      <div className="form-group">
        <label htmlFor="player-name">Ditt navn</label>
        <input
          type="text"
          id="player-name"
          value={playerName}
          placeholder="Ola Nordmann"
          maxLength={20}
          onInput={(event) => setPlayerName(event.currentTarget.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="room-id">Rom-ID</label>
        <input
          type="text"
          id="room-id"
          value={roomId}
          maxLength={20}
          onInput={(event) => setRoomId(event.currentTarget.value)}
        />
      </div>

      <button className="btn primary" type="button" onClick={handleCreateGame}>Opprett spill</button>
      <button className="btn" type="button" onClick={handleJoinGame}>Bli med i spill</button>
    </section>
  );
}

function LobbyRoomsColumn({
  lobbyStatus,
  rooms,
  roomId,
  handleRefreshRooms,
  handleSelectRoom,
  handleStartLocalGame,
}) {
  return (
    <section className="lobby-column lobby-rooms-column">
      <div className={`lobby-status${lobbyStatus.isError ? " error" : ""}`}>{lobbyStatus.message}</div>

      <div className="room-list-header">
        <label>Aktive rom</label>
        <button className="text-btn" type="button" onClick={handleRefreshRooms}>Oppdater</button>
      </div>
      <div className="room-list">
        {rooms.length === 0 ? (
          <div className="room-empty">Ingen aktive rom</div>
        ) : rooms.map((room) => {
          const unavailable = room.started || room.playerCount >= room.maxPlayers;
          const selected = room.room === roomId;
          return (
            <button
              className={`room-card${selected ? " selected" : ""}`}
              type="button"
              key={room.room}
              disabled={unavailable}
              onClick={() => handleSelectRoom(room.room)}
            >
              <div className="room-main">
                <span className="room-name">{room.room}</span>
                <span className={`room-status${unavailable ? " unavailable" : ""}`}>
                  {unavailable ? "I gang" : "Venter på spiller"} · {room.playerCount}/{room.maxPlayers}
                </span>
              </div>
              <div className="room-players">{room.players?.join(", ") || "Ingen spillere"}</div>
            </button>
          );
        })}
      </div>

      <hr className="divider" />

      <button className="btn local-game-btn" type="button" onClick={handleStartLocalGame}>
        Spill lokalt (testing)
      </button>
    </section>
  );
}
