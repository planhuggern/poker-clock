// Aktivt entrypoint for Oslo Conquest.
// Preact eier lobby og game UI; kartet er fortsatt eksisterende native SVG.

import { render } from "preact";
import { App } from "./App.jsx";
import { fitMapToContainer } from "./map.js";
import { state } from "./state.js";

const root = document.getElementById("oslo-conquest-root");

if (root) {
  render(<App />, root);
}

window.addEventListener("resize", () => {
  if (state.svgEl) fitMapToContainer();
});
