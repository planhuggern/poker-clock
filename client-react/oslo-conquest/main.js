// Inngangspunkt for appen. Gjør tre ting:
//   1. Eksponerer spillfunksjoner globalt (window.*) slik at onclick-attributter i HTML fungerer.
//   2. Kobler til klikk-lytteren på oppdragskortet.
//   3. Passer på at kartet skaleres riktig når vinduet endrer størrelse.

import { connectWS, createGame, joinGame, startLocalGame } from './websocket.js';
import { rollDice, buyTerritory, invadeTerritory, reinforceTerritory, moveToTerritory, payRent, endTurn } from './actions.js';
import { closeDice } from './dice.js';
import { fitMapToContainer } from './map.js';
import { state } from './state.js';
import { MISSIONS } from './game-data.js';

// ES-moduler er isolert fra det globale scopet, så onclick="rollDice()" i HTML-en
// ville feilet uten dette. Vi putter de nødvendige funksjonene på window manuelt.
Object.assign(window, {
  connectWS, createGame, joinGame, startLocalGame,
  rollDice, buyTerritory, invadeTerritory, reinforceTerritory, moveToTerritory, payRent, endTurn,
  closeDice,
});

// Mission card toggle
document.getElementById('mission-card').addEventListener('click', () => {
  const el = document.getElementById('mission-text');
  const myPlayer = state.gameState?.players.find(p => p.id === state.myPlayerId);
  if (!myPlayer) return;

  if (!state.missionRevealed) {
    state.missionRevealed = true;
    const mission = MISSIONS.find(m => m.id === myPlayer.mission);
    el.classList.remove('mission-hidden');
    el.textContent = `${mission?.emoji} ${mission?.title}: ${mission?.desc}`;
    if (mission?.id === 'm8' && myPlayer.target) {
      const target = state.gameState.players.find(p => p.id === myPlayer.target);
      el.textContent += ` (Mål: ${target?.name})`;
    }
  } else {
    state.missionRevealed = false;
    el.classList.add('mission-hidden');
    el.textContent = 'Klikk for å se';
  }
});

window.addEventListener('resize', () => {
  if (state.svgEl) fitMapToContainer();
});
