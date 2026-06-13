import { useEffect, useMemo, useState } from 'react';
import {
  connectWS, createGame, joinGame, rejoinGame,
  sendAttack, sendChooseStartCheckpoint, sendEndTurn,
  sendMove, sendRollDice,
} from './transport/websocket/websocket.js';
import { GameUI } from './ui/components/GameUI.js';
import { notifyGameChanged, state } from './domains/game/state/state.js';
import { GameState, GameModal, Handlers, RoomInfo } from './domains/game/types.js';
import { getCurrentPlayer } from '@shared/auth/authClient.js';

const DEFAULT_WS_URL = 'ws://localhost:8000/ws/oslo-conquest/';

function isServerAuthoritativeGame(gameState: GameState | null): boolean {
  return Boolean(gameState?.players?.some((p) => p.side));
}

function isMyServerTurn(gameState: GameState | null, playerId: string | null): boolean {
  if (!gameState?.activePlayer || !playerId) return false;
  return gameState.players.some((player) => (
    player.id === playerId && player.side === gameState.activePlayer
  ));
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
  const [myPlayerId, setMyPlayerId] = useState<string | null>(
    () => localStorage.getItem('oslo-conquest-player-id') ?? getCurrentPlayer()?.id ?? null,
  );
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
  const existingPlayerRoom = useMemo(() => {
    if (!myPlayerId) return null;
    return rooms.find((room) => room.playerIds?.includes(myPlayerId)) ?? null;
  }, [myPlayerId, rooms]);

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
    if (inGame) return;
    const storedRoom = localStorage.getItem('oslo-conquest-active-room');
    const storedPlayerId = localStorage.getItem('oslo-conquest-player-id');
    if (storedRoom && storedPlayerId) {
      rejoinGame({ url: DEFAULT_WS_URL, room: storedRoom, playerId: storedPlayerId, handlers });
    } else {
      connectWS({ url: DEFAULT_WS_URL, handlers });
    }
  }, [handlers, inGame]);

  function dispatchGameAction(action: { type: string; [key: string]: unknown }): void {
    if (!gameState) return;
    if (!isServerAuthoritativeGame(gameState)) return;

    if (!isMyServerTurn(gameState, myPlayerId)) return;
    if (action.type === 'choose_start_checkpoint') sendChooseStartCheckpoint(action.checkpointTerritoryId as string);
    if (action.type === 'roll_dice') sendRollDice();
    if (action.type === 'move_to_territory') sendMove(action.territoryId as string);
    if (action.type === 'end_turn') sendEndTurn();
    if (action.type === 'invade_territory') sendAttack(action.fromTerritoryId as string, action.territoryId as string);
  }

  function requireLobbyFields(): boolean {
    if (!playerName.trim() || !effectiveRoomId) {
      setLobbyStatus({ message: 'Fyll inn navn og rom-ID', isError: true });
      return false;
    }
    return true;
  }

  function blockIfPlayerAlreadyInRoom(): boolean {
    if (!existingPlayerRoom) return false;
    setLobbyStatus({ message: `Du er allerede med i rom "${existingPlayerRoom.room}".`, isError: true });
    return true;
  }

  function handleCreateGame(): void {
    if (!requireLobbyFields()) return;
    if (blockIfPlayerAlreadyInRoom()) return;
    createGame({ url: DEFAULT_WS_URL, name: playerName, room: effectiveRoomId, handlers });
    setMyPlayerId(state.myPlayerId);
    localStorage.setItem('oslo-conquest-active-room', effectiveRoomId);
  }

  function handleJoinGame(): void {
    if (!requireLobbyFields()) return;
    if (blockIfPlayerAlreadyInRoom()) return;
    joinGame({ url: DEFAULT_WS_URL, name: playerName, room: effectiveRoomId, handlers });
    setMyPlayerId(state.myPlayerId);
    localStorage.setItem('oslo-conquest-active-room', effectiveRoomId);
  }

  function handleSelectRoom(room: string): void {
    setRoomId(room);
    setLobbyStatus({ message: `Valgt rom "${room}". Trykk "Bli med i spill".`, isError: false });
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
            existingPlayerRoom={existingPlayerRoom}
            handleCreateGame={handleCreateGame}
            handleJoinGame={handleJoinGame}
          />
          <LobbyRoomsColumn
            lobbyStatus={lobbyStatus}
            rooms={rooms}
            effectiveRoomId={effectiveRoomId}
            handleSelectRoom={handleSelectRoom}
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
  existingPlayerRoom: RoomInfo | null;
  handleCreateGame: () => void;
  handleJoinGame: () => void;
};

function LobbyConnectionColumn({ connectionStatus, playerName, setPlayerName, roomId, suggestedRoomId, setRoomId, existingPlayerRoom, handleCreateGame, handleJoinGame }: LobbyConnectionColumnProps) {
  const roomBlocked = Boolean(existingPlayerRoom);

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
      {existingPlayerRoom ? (
        <p className="lobby-help">Du er allerede med i rom "{existingPlayerRoom.room}".</p>
      ) : null}
      <button className="btn primary" type="button" disabled={roomBlocked} onClick={handleCreateGame}>Opprett spill</button>
      <button className="btn" type="button" disabled={roomBlocked} onClick={handleJoinGame}>Bli med i spill</button>
    </section>
  );
}

type LobbyRoomsColumnProps = {
  lobbyStatus: LobbyStatus;
  rooms: RoomInfo[];
  effectiveRoomId: string;
  handleSelectRoom: (room: string) => void;
};

function LobbyRoomsColumn({ lobbyStatus, rooms, effectiveRoomId, handleSelectRoom }: LobbyRoomsColumnProps) {
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
    </section>
  );
}
