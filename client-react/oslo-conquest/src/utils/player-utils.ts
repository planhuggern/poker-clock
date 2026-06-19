import { Player, PlayerRef } from '../domains/game/types';

export function playerMatchesRef(
  player: Player,
  playerRef: PlayerRef | null | undefined,
): boolean {
  if (!playerRef) return false;

  // TODO: MVP/server compatibility.
  // Server currently uses player.side as activePlayer/winner marker.
  // New game code should eventually use player.id only.
  return player.id === playerRef || player.side === playerRef;
}

export function findPlayerByRef(
  players: Player[],
  playerRef: PlayerRef | null | undefined,
): Player | null {
  return players.find((player) => playerMatchesRef(player, playerRef)) ?? null;
}