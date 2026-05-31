// Aktivt entrypoint for Oslo Conquest.
// Preact eier lobby, game UI og kartets livssyklus.

import { render } from "preact";
import { App } from "./App.jsx";

const root = document.getElementById("oslo-conquest-root");

if (root) {
  render(<App />, root);
}
