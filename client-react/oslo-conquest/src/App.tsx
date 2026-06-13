import { useEffect, useMemo, useState } from 'react';
import {
  connectWS, createGame, joinGame,
  sendAttack, sendChooseStartCheckpoint, sendEndTurn,
  sendMove, sendRollDice, sendGameState, startLocalGame,
} from './transport/websocket/websocket.js';
import { GameUI } from './ui/components/GameUI.js';
import { reduceGameAction } from './domains/game/state/game-reducer.js';
import { notifyGameChanged, state } from './domains/game/state/state.js';
import { GameState, GameModal, Handlers, RoomInfo } from './domains/game/types.js';

const DEFAULT_WS_URL = 'ws://localhost:8000/ws/oslo-conquest/';

function isServerAuthoritativeGame(gameState: GameState | null): boolean {
  return Boolean(gameState?.players?.some((p) => p.side));
}

type LobbyStatus = { message: string; isError: boolean };

export function App() {
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('oslo-conquest-player-name') ?? '');
  const [roomId, setRoomId] = useState('');
  const [suggestedRoomId, setSuggestedRoomId] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lobbyStatus, setLobbyStatus] = useState<LobbyStatus>({ message: '', isError: false });
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [inGame, setInGame] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(() => localStorage.getItem('oslo-conquest-player-id'));
  const [selectedTerritory, setSelectedTerritory] = useState<string | null>(null);
  const [modal, setModal] = useState<GameModal | null>(null);
  const [missionRevealed, setMissionRevealed] = useState(false);

  useEffect(() => {
    const largest = rooms
      .map((room) => { const m = room.room.match(/^oslo-(\d+)$/); return m ? parseInt(m[1], 10) : 0; })
      .reduce((max, n) => Math.max(max, n), 0);
    setSuggestedRoomId(`oslo-${largest + 1}`);
  }, [rooms]);

  const effectiveRoomId = roomId.trim() || suggestedRoomId;

  useEffect(() => {
    if (playerName.trim() === '') {
      const adjectives = ['Rasende', 'Lynende', 'Skinnende', 'Dundrende', 'Glitrende', 'Brølende', 'Voldsomme', 'Skumle', 'Mektige', 'Fryktløse', 'Våghalsende', 'Uovervinnelige', 'Tordnende', 'Skjoldbærende', 'Kraftfulle'];
      const nouns = ['Ulv', 'Ørn', 'Løve', 'Bjørn', 'Slange', 'Havfrue', 'Trollmann', 'Viking', 'Kriger', 'Skurk', 'Eventyrer', 'Konge', 'Dronning', 'Ninja', 'Samurai', 'Krabbe', 'Falk', 'Panter'];
      setPlayerName(`${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`);
    }
  }, []);

  useEffect(() => {
    if (playerName.trim()) localStorage.setItem('oslo-conquest-player-name', playerName);
    if (myPlayerId) localStorage.setItem('oslo-conquest-player-id', myPlayerId);
  }, [playerName, myPlayerId]);

  useEffect(() => {
    state.gameState = gameState;
    state.myPlayerId = myPlayerId;
    state.selectedTerritory = selectedTerritory;
    state.modal = modal;
    state.missionRevealed = missionRevealed;
    notifyGameChanged();
  }, [gameState, myPlayerId, selectedTerritory, modal, missionRevealed]);

  const handlers = useMemo<Handlers>(() => ({
    onConnectionChange: setConnectionStatus,
    onLobbyStatus: (message, isError = false) => setLobbyStatus({ message, isError }),
    onRooms: setRooms,
    onGameStarted: () => setInGame(true),
    onModal: setModal,
    onGameState: (nextGameState) => { state.gameState = nextGameState; setGameState(nextGameState); },
    onError: (message) => setLobbyStatus({ message, isError: true }),
  }), []);

  useEffect(() => {
    if (!inGame) connectWS({ url: DEFAULT_WS_URL, handlers });
  }, [handlers, inGame]);

  function handleReducerEvents(result: ReturnType<typeof reduceGameAction>): void {
    for (const event of result.events) {
      if (event.type === 'modal') setModal(event.modal);
      if (event.type === 'send_state') sendGameState(result.state);
      if (event.type === 'send_end_turn') sendEndTurn(event.playerId);
    }
  }

  function dispatchGameAction(action: { type: string; [key: string]: unknown }): void {
    if (!gameState) return;

    if (isServerAuthoritativeGame(gameState)) {
      if (action.type === 'choose_start_checkpoint') sendChooseStartCheckpoint(action.checkpointTerritoryId as string);
      if (action.type === 'roll_dice') sendRollDice();
      if (action.type === 'move_to_territory') sendMove(action.territoryId as string);
      if (action.type === 'end_turn') sendEndTurn();
      if (action.type === 'invade_territory') sendAttack(action.fromTerritoryId as string, action.territoryId as string);
      return;
    }

    const result = reduceGameAction(
      gameState,
      { playerId: myPlayerId!, random: Math.random, now: () => new Date().toLocaleTimeString('no', { hour: '2-digit', minute: '2-digit' }) },
      action as Parameters<typeof reduceGameAction>[2],
    );
    state.gameState = result.state;
    setGameState(result.state);
    handleReducerEvents(result);
  }

  function requireLobbyFields(): boolean {
    if (!playerName.trim() || !effectiveRoomId) {
      setLobbyStatus({ message: 'Fyll inn navn og rom-ID', isError: true });
      return false;
    }
    return true;
  }

  function handleCreateGame(): void {
    if (!requireLobbyFields()) return;
    createGame({ url: DEFAULT_WS_URL, name: playerName, room: effectiveRoomId, handlers });
    setMyPlayerId(state.myPlayerId);
  }

  function handleJoinGame(): void {
    if (!requireLobbyFields()) return;
    joinGame({ url: DEFAULT_WS_URL, name: playerName, room: effectiveRoomId, handlers });
    setMyPlayerId(state.myPlayerId);
  }

  function handleSelectRoom(room: string): void {
    setRoomId(room);
    setLobbyStatus({ message: `Valgt rom "${room}". Trykk "Bli med i spill".`, isError: false });
  }

  function handleStartLocalGame(): void {
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
            suggestedRoomId={suggestedRoomId}
            setRoomId={setRoomId}
            handleCreateGame={handleCreateGame}
            handleJoinGame={handleJoinGame}
          />
          <LobbyRoomsColumn
            lobbyStatus={lobbyStatus}
            rooms={rooms}
            effectiveRoomId={effectiveRoomId}
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

type LobbyConnectionColumnProps = {
  connectionStatus: string;
  playerName: string;
  setPlayerName: (name: string) => void;
  roomId: string;
  suggestedRoomId: string;
  setRoomId: (id: string) => void;
  handleCreateGame: () => void;
  handleJoinGame: () => void;
};

function LobbyConnectionColumn({ connectionStatus, playerName, setPlayerName, roomId, suggestedRoomId, setRoomId, handleCreateGame, handleJoinGame }: LobbyConnectionColumnProps) {
  return (
    <section className="lobby-column">
      <div className="ws-status">
        <div className={`ws-dot${connectionStatus === 'connected' ? ' connected' : ''}`} />
        <span>{connectionStatus === 'connected' ? 'Tilkoblet' : connectionStatus === 'connecting' ? 'Kobler til...' : 'Frakoblet'}</span>
      </div>
      <div className="form-group">
        <label htmlFor="player-name">Ditt navn</label>
        <input type="text" id="player-name" value={playerName} placeholder="Ola Nordmann" maxLength={20} onInput={(e) => setPlayerName(e.currentTarget.value)} />
      </div>
      <div className="form-group">
        <label htmlFor="room-id">Rom-ID</label>
        <input type="text" id="room-id" value={roomId} placeholder={suggestedRoomId} maxLength={20} onInput={(e) => setRoomId(e.currentTarget.value)} />
      </div>
      <button className="btn primary" type="button" onClick={handleCreateGame}>Opprett spill</button>
      <button className="btn" type="button" onClick={handleJoinGame}>Bli med i spill</button>
    </section>
  );
}

type LobbyRoomsColumnProps = {
  lobbyStatus: LobbyStatus;
  rooms: RoomInfo[];
  effectiveRoomId: string;
  handleSelectRoom: (room: string) => void;
  handleStartLocalGame: () => void;
};

function LobbyRoomsColumn({ lobbyStatus, rooms, effectiveRoomId, handleSelectRoom, handleStartLocalGame }: LobbyRoomsColumnProps) {
  return (
    <section className="lobby-column lobby-rooms-column">
      <div className={`lobby-status${lobbyStatus.isError ? ' error' : ''}`}>{lobbyStatus.message}</div>
      <div className="room-list-header">
        <label>Aktive rom</label>
      </div>
      <div className="room-list">
        {rooms.length === 0 ? (
          <div className="room-empty">Ingen aktive rom</div>
        ) : rooms.map((room) => {
          const unavailable = room.started || room.playerCount >= room.maxPlayers;
          const selected = room.room === effectiveRoomId;
          return (
            <button className={`room-card${selected ? ' selected' : ''}`} type="button" key={room.room} disabled={unavailable} onClick={() => handleSelectRoom(room.room)}>
              <div className="room-main">
                <span className="room-name">{room.room}</span>
                <span className={`room-status${unavailable ? ' unavailable' : ''}`}>
                  {unavailable ? 'I gang' : 'Venter på spiller'} · {room.playerCount}/{room.maxPlayers}
                </span>
              </div>
              <div className="room-players">{room.players?.join(', ') ?? 'Ingen spillere'}</div>
            </button>
          );
        })}
      </div>
      <hr className="divider" />
      <button className="btn local-game-btn" type="button" onClick={handleStartLocalGame}>Spill lokalt (testing)</button>
    </section>
  );
}
