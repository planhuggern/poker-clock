# Frontend

## poker-clock (`client-react/src/`)

**Stack:** React + React Router, built with Vite.

**Routing:** `App.jsx` defines React Router routes; `main.jsx` is the entry point (theme init + Router setup).

**Key hooks (`lib/`):**
- `usePokerSocket.js` — Opens `ws://.../ws/clock/{id}/?token=<jwt>`, handles reconnect, dispatches incoming messages
- `useTournamentApi.js` — REST calls for tournament CRUD
- `usePlayerApi.js` — Player profile/registration

**Pages:** `Home.jsx` (main tournament view), `Tv.jsx` (TV display mode), `TournamentList.jsx`, `Login.jsx`, `Callback.jsx` (OAuth redirect).

## oslo-conquest (`client-react/oslo-conquest/`)

**Stack:** Preact + SVG.js, JSX, CSS — bygget med Vite som eget entry point.

| Fil | Ansvar |
|---|---|
| `index.html` | Entry point |
| `main.js` | Bootstrap, eksponerer globale funksjoner |
| `state.js` | Globalt mutable objekt: `gameState`, `myPlayerId`, `selectedTerritory`, `svgEl`, `mapTransform` |
| `game-data.js` | Konstanter: 16 bydeler, 35 territorier, 11 oppdrag, 6 spillerfarger, adjacency-graf, checkpoints |
| `game-state.js` | Spillinitialisering, tur-/spillerqueries |
| `actions.js` | Alle spillmutasjoner: `rollDice`, `buyTerritory`, `invadeTerritory`, `reinforceTerritory`, `payRent`, `moveToTerritory`, `endTurn` |
| `missions.js` | Seiersvilkår — kalles etter hver handling |
| `map.js` | SVG.js-render, pan/zoom/drag, territorievalg, visuell oppdatering |
| `map.json` | Forhåndsberegnet polygon-data for territorier og bydelsgrenser |
| `ui.js` | HUD: spillerbrikker, handlingspanel, checkpoint-bar, hendelseslogg |
| `dice.js` | Kamptærning-modal |
| `modals.js` | Leie-modal, seiersskjerm-modal |
| `websocket.js` | WebSocket tilkobling/frakobling, lobby (opprett/bli med/lokal) |
| `style.css` | Mørkt tema (`#0d0d0f` bakgrunn, `#c9a84c` gull-aksenter), Cinzel Decorative + Crimson Pro |
| `map-editor.html` | Dev-verktøy for å tegne territoriepolygoner |

## Build

Vite bygger begge SPAene i én pass fra `client-react/vite.config.js`. Output går til `server/public/` (servert av WhiteNoise). For sub-path deployments sett `VITE_BASE_PATH` (f.eks. `/pokerklokke/`).
