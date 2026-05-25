import { render } from "preact";
import { App } from "./App.jsx";

const root = document.getElementById("oslo-conquest-preact-root");

if (root) {
  render(<App />, root);
}
