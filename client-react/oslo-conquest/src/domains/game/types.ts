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