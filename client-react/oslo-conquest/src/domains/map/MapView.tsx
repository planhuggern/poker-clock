import { useEffect, useRef } from 'react';
import { GameState } from '../game/types.js';
import { createMapAdapter } from './map.js';

type MapAdapter = ReturnType<typeof createMapAdapter>;

type Props = {
  gameState: GameState | null;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  localPlayerId?: string | null;
};

export function MapView({ gameState, selectedNodeId: selectedNodeId, onSelectNode: onSelectNode, localPlayerId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<MapAdapter | null>(null);
  const onSelectNodeRef = useRef(onSelectNode);

  useEffect(() => {
    onSelectNodeRef.current = onSelectNode;
  }, [onSelectNode]);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    adapterRef.current = createMapAdapter(containerRef.current, {
      onSelectNode: (nodeId) => onSelectNodeRef.current?.(nodeId),
    });

    return () => {
      adapterRef.current?.destroy();
      adapterRef.current = null;
    };
  }, []);

  useEffect(() => {
    adapterRef.current?.update({ gameState, selectedNodeId: selectedNodeId, localPlayerId });
  }, [gameState, selectedNodeId, localPlayerId]);

  return <div id="map-container" ref={containerRef} />;
}
