import { useEffect, useRef } from "preact/hooks";
import { createMapAdapter } from "./map.js";

export function MapView({ gameState, selectedTerritory, onSelectTerritory }) {
  const containerRef = useRef(null);
  const adapterRef = useRef(null);
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
    adapterRef.current?.update({ gameState, selectedTerritory });
  }, [gameState, selectedTerritory]);

  return <div id="map-container" ref={containerRef} />;
}
