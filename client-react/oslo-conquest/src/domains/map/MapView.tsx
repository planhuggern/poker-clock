import { useEffect, useRef } from 'react';
import { GameState } from '../game/types.js';
import { createMapAdapter } from './map.js';

type MapAdapter = ReturnType<typeof createMapAdapter>;

type Props = {
  gameState: GameState | null;
  selectedNodeId: string | null;
  onSelectTerritory: (territoryId: string) => void;
  localPlayerId?: string | null;
};

export function MapView({ gameState, selectedNodeId: selectedNodeId, onSelectTerritory, localPlayerId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<MapAdapter | null>(null);
  const onSelectTerritoryRef = useRef(onSelectTerritory);

  useEffect(() => {
    onSelectTerritoryRef.current = onSelectTerritory;
  }, [onSelectTerritory]);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    adapterRef.current = createMapAdapter(containerRef.current, {
      onSelectTerritory: (territoryId) => onSelectTerritoryRef.current?.(territoryId),
    });

    return () => {
      adapterRef.current?.destroy();
      adapterRef.current = null;
    };
  }, []);

  useEffect(() => {
    adapterRef.current?.update({ gameState, selectedTerritory: selectedNodeId, localPlayerId });
  }, [gameState, selectedNodeId, localPlayerId]);

  return <div id="map-container" ref={containerRef} />;
}
