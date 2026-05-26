import { useEffect, useMemo, useState } from "preact/hooks";
import {
  connectWS,
  createGame,
  joinGame,
  refreshRooms,
  sendEndTurn,
  sendGameState,
  startLocalGame,
} from "./websocket.js";
import { GameUI } from "./GameUI.jsx";
import { reduceGameAction } from "./game-reducer.js";
import { notifyGameChanged, state } from "./state.js";

const DEFAULT_WS_URL = "ws://localhost:8000/ws/oslo-conquest/";

export function App() {
  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL);
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

  function handleReducerEvents(result) {
    for (const event of result.events) {
      if (event.type === "modal") setModal(event.modal);
      if (event.type === "send_state") sendGameState(result.state);
      if (event.type === "send_end_turn") sendEndTurn(event.playerId);
    }
  }

  function dispatchGameAction(action) {
    if (!gameState) return;
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

  function handleConnect() {
    connectWS({ url: wsUrl, handlers });
  }

  function handleCreateGame() {
    if (!requireLobbyFields()) return;
    createGame({ url: wsUrl, name: playerName, room: roomId, handlers });
    setMyPlayerId(state.myPlayerId);
  }

  function handleJoinGame() {
    if (!requireLobbyFields()) return;
    joinGame({ url: wsUrl, name: playerName, room: roomId, handlers });
    setMyPlayerId(state.myPlayerId);
  }

  function handleRefreshRooms() {
    connectWS({ url: wsUrl, handlers });
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
        <h1 className="title">Oslo Conquest</h1>
        <p className="subtitle">Krig, handel og makt i Norges hjerte</p>

        <div className="ws-status">
          <div className={`ws-dot${connectionStatus === "connected" ? " connected" : ""}`} />
          <span>{connectionStatus === "connected" ? "Tilkoblet" : connectionStatus === "connecting" ? "Kobler til..." : "Frakoblet"}</span>
        </div>
        <div className={`lobby-status${lobbyStatus.isError ? " error" : ""}`}>{lobbyStatus.message}</div>

        <div className="form-group">
          <label htmlFor="ws-url">WebSocket server</label>
          <input
            type="text"
            id="ws-url"
            value={wsUrl}
            placeholder="ws://..."
            onInput={(event) => setWsUrl(event.currentTarget.value)}
          />
        </div>
        <button className="btn" type="button" onClick={handleConnect}>Koble til server</button>

        <hr className="divider" />

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
            placeholder="oslo-1"
            maxLength={20}
            onInput={(event) => setRoomId(event.currentTarget.value)}
          />
        </div>

        <button className="btn primary" type="button" onClick={handleCreateGame}>Opprett spill</button>
        <button className="btn" type="button" onClick={handleJoinGame}>Bli med i spill</button>

        <hr className="divider" />

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

        <button
          className="btn"
          type="button"
          onClick={handleStartLocalGame}
          style={{ borderColor: "#556", color: "#aaa" }}
        >
          Spill lokalt (testing)
        </button>
      </div>
    </div>
  );
}
