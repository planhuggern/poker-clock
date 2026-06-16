import { useState, useEffect } from 'react';
import { getCurrentPlayer, subscribe } from './authClient.js';
import type { Player } from './authClient.js';

export function useCurrentPlayer(): Player | null {
  const [player, setPlayer] = useState<Player | null>(() => getCurrentPlayer());
  useEffect(() => subscribe(setPlayer), []);
  return player;
}
