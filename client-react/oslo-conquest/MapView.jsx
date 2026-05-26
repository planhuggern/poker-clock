import { useEffect, useRef } from "preact/hooks";
import { createMapAdapter } from "./map.js";

export function MapView({ gameState, selectedTerritory, onSelectTerritory }) {
  const containerRef = useRef(null);
  const adapterRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    adapterRef.current = createMapAdapter(containerRef.current, { onSelectTerritory });

    return () => {
      adapterRef.current?.destroy();
      adapterRef.current = null;
    };
  }, [onSelectTerritory]);

  useEffect(() => {
    adapterRef.current?.update({ gameState, selectedTerritory });
  }, [gameState, selectedTerritory]);

  return <div id="map-container" ref={containerRef} />;
}
