import { useEffect, useRef } from "preact/hooks";
import { SVG } from "@svgdotjs/svg.js";

export function App() {
  const svgMountRef = useRef(null);

  useEffect(() => {
    if (!svgMountRef.current) return undefined;

    const draw = SVG().addTo(svgMountRef.current).size(1, 1);

    return () => {
      draw.remove();
    };
  }, []);

  return (
    <div data-oslo-conquest-preact-scaffold>
      <div ref={svgMountRef} hidden />
    </div>
  );
}
