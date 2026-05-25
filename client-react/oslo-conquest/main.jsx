// Aktivt entrypoint for Oslo Conquest.
// Preact eier lobbyen; eksisterende imperative game view beholdes foreløpig.

import { render } from "preact";
import { App } from "./App.jsx";
import {
  rollDice,
  buyTerritory,
  invadeTerritory,
  reinforceTerritory,
  moveToTerritory,
  payRent,
  endTurn,
} from "./actions.js";
import { closeDice } from "./dice.js";
import { fitMapToContainer } from "./map.js";
import { state } from "./state.js";
import { MISSIONS } from "./game-data.js";

Object.assign(window, {
  rollDice,
  buyTerritory,
  invadeTerritory,
  reinforceTerritory,
  moveToTerritory,
  payRent,
  endTurn,
  closeDice,
});

const root = document.getElementById("oslo-conquest-root");

if (root) {
  render(<App />, root);
}

const missionCard = document.getElementById("mission-card");

if (missionCard) {
  missionCard.addEventListener("click", () => {
    const el = document.getElementById("mission-text");
    const myPlayer = state.gameState?.players.find((p) => p.id === state.myPlayerId);
    if (!el || !myPlayer) return;

    if (!state.missionRevealed) {
      state.missionRevealed = true;
      const mission = MISSIONS.find((m) => m.id === myPlayer.mission);
      el.classList.remove("mission-hidden");
      el.textContent = `${mission?.emoji} ${mission?.title}: ${mission?.desc}`;
      if (mission?.id === "m8" && myPlayer.target) {
        const target = state.gameState.players.find((p) => p.id === myPlayer.target);
        el.textContent += ` (Mål: ${target?.name})`;
      }
    } else {
      state.missionRevealed = false;
      el.classList.add("mission-hidden");
      el.textContent = "Klikk for å se";
    }
  });
}

window.addEventListener("resize", () => {
  if (state.svgEl) fitMapToContainer();
});
