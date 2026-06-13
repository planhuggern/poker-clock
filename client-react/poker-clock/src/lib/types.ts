export interface Level {
  type: "level" | "break";
  title?: string;
  durationSeconds?: number;
  seconds?: number;
  sb?: number;
  bb?: number;
  ante?: number;
}

export interface Tournament {
  id?: number;
  name: string;
  status?: string;
  levels?: Level[];
  buyIn?: number;
  rebuyAmount?: number;
  addOnAmount?: number;
  startingStack?: number;
  admin?: { username: string };
  playerCount?: number;
}

export interface Players {
  registered: number;
  active: number;
  busted: number;
  rebuyCount: number;
  addOnCount: number;
  prizePool: number;
}

export interface Timing {
  remaining: number;
  total: number;
}

export interface Snapshot {
  type?: string;
  tournament: Tournament;
  currentIndex: number;
  running: boolean;
  timing?: Timing;
  players?: Players;
}

export interface PlayerProfile {
  username: string;
  nickname?: string;
  activeTournamentId?: number | null;
}

export interface TournamentItem {
  id: number;
  name: string;
  status: string;
  playerCount?: number;
  buyIn?: number;
}
