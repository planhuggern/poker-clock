// Aktivt entrypoint for Oslo Conquest.
// React eier lobby, game UI og kartets livssyklus.

import ReactDOM from "react-dom/client";
import { App } from "./App.jsx";

const root = document.getElementById("oslo-conquest-root");

if (root) {
  ReactDOM.createRoot(root).render(<App />);
}
