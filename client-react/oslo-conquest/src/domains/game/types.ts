export type Player = {
  id: string;
  name: string;
  side?: string;
  color: string;
  colorName: string;
  money: number;
  units: number;
  mission: string;
  target: string | null;
  position: string;
  checkpoints: { [key: string]: boolean };
  roundComplete: boolean;
  diceRoll: number | null;
  diceUsed: number;
  eliminated: boolean;
  conquests: { [key: string]: number };
  validMoves?: string[];
  nextCheckpoint?: string | null;
}

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
  room?: string;
  currentPlayerIdx: number;
  players: Player[];
  territories: Record<string, TerritoryState>;
  phase: 'setup' | 'playing' | 'finished';
  round: number;
  log: LogEntry[];
  activePlayer?: string;
  winner?: string;
}

export type District = {
  name: string;
  bonus: { money: number; units: number };
  color: string;
}

export type Territory = {
  type: 'territory';
  id: string;
  name: string;
  district: string;
  price: number;
  neutralUnits: number;
  x: number;
  y: number;
};

export type Checkpoint = {
  type: 'checkpoint';
  id: string;
  name: string;
  checkpoint: string;
  x: number;
  y: number;
};

export type MapNode = Territory | Checkpoint;


export type TerritoryState = {
  territoryId: string;
  owner: string | null;
  units: number;
  checkpoint?: string;
}

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
  territoryId: string;
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
  room: string;
  playerCount: number;
  maxPlayers: number;
  started: boolean;
  ownerId?: string | null;
  playerIds?: string[];
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
