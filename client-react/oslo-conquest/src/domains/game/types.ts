// ID types. Makes it easier to change underlying type if needed,
// and provides better readability.
export type PlayerId = string;
export type PlayerSide = string;
export type PlayerRef = PlayerId | PlayerSide;
export type TerritoryId = string;
export type DistrictId = string;
export type CheckpointId = string;
export type RoomId = string;
export type ColorName = string;

export type GamePhase = 'setup' | 'playing' | 'finished';

export type Player = {
  id: PlayerId;
  name: string;
// TODO: Server/MVP compatibility.
// Server currently uses player.side as turn/winner marker.
// New game code should use player.id.
  side?: PlayerSide;
  color: string;
  colorName: ColorName;
  money: number;
  units: number;
  mission: string;
  target: PlayerId | null;
  position: TerritoryId | CheckpointId | null;
  checkpoints: Record<CheckpointId, boolean>;
  roundComplete: boolean;
  diceRoll: number | null;
  diceUsed: number;
  eliminated: boolean;
  conquests: Record<TerritoryId, number>;
  validMoves?: Array<TerritoryId | CheckpointId>;
  nextCheckpoint?: CheckpointId | null;
};

export type LogEntry = {
  msg: string;
  type: string;
  time: string;
};

export type Mission = {
  id: string;
  emoji: string;
  title: string;
  secret?: boolean;
  check: (player: Player, gameState: GameState) => boolean;
};

export type GameState = {
  room?: RoomId;
  currentPlayerIdx: number;
  players: Player[];
  territories: Record<TerritoryId, TerritoryState>;
  phase: GamePhase;
  round: number;
  log: LogEntry[];
  activePlayer?: PlayerRef;
  winner?: PlayerRef;
};

export type District = {
  name: string;
  bonus: { money: number; units: number };
  color: string;
};

export type Territory = {
  type: 'territory';
  id: TerritoryId;
  name: string;
  district: DistrictId;
  price: number;
  neutralUnits: number;
  x: number;
  y: number;
};

export type Checkpoint = {
  type: 'checkpoint';
  id: CheckpointId;
  name: string;
  checkpoint: string;
  x: number;
  y: number;
};

export type MapNode = Territory | Checkpoint;

export type TerritoryState = {
  territoryId: TerritoryId;
  owner: PlayerId | null;
  units: number;
  checkpoint?: CheckpointId | null;
};

// --- Modal types (shared between game-reducer, state, App, GameUI) ---

export type DiceModal = {
  type: 'dice';
  result: {
    attackerDice: number[];
    defenderDice: number[];
    attackerName: string;
    defenderName: string;
    attackerWins: boolean;
    attackerLost: number;
    defenderLost: number;
  };
};

export type RentModal = {
  type: 'rent';
  territoryId: TerritoryId;
  rent: number;
  territoryName: string;
  canPay: boolean;
};

export type WinModal = {
  type: 'win';
  player: Player;
  mission: Pick<Mission, 'title' | 'emoji'>;
};

export type GameModal = DiceModal | RentModal | WinModal;

// --- Websocket / lobby types ---

export type RoomInfo = {
  room: RoomId;
  playerCount: number;
  maxPlayers: number;
  started: boolean;
  ownerId?: PlayerId | null;
  playerIds?: PlayerId[];
  players?: string[];
};

export type Handlers = {
  onConnectionChange?: (status: string) => void;
  onLobbyStatus?: (message: string, isError?: boolean) => void;
  onRooms?: (rooms: RoomInfo[]) => void;
  onGameStarted?: (gameState: GameState) => void;
  onGameState?: (gameState: GameState) => void;
  onModal?: (modal: GameModal) => void;
  onError?: (message: string) => void;
};

export function isTerritory(node: MapNode): node is Territory {
  return node.type === 'territory';
}

export function isCheckpoint(node: MapNode): node is Checkpoint {
  return node.type === 'checkpoint';
}