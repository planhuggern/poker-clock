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

**Current stack:** Vanilla ES modules + native DOM/SVG APIs + CSS, built with Vite as a separate entry point.

**Desired architecture:** Preact + SVG.js, JSX, CSS — still built with Vite as its own entry point.

**Migration status:** Preact, `@preact/preset-vite`, and SVG.js are installed. `index.html` now loads `main.jsx`; lobby and game UI are rendered by Preact, while the map still uses the existing imperative native SVG module.

The desired direction is to migrate Oslo Conquest from imperative DOM rendering to a small Preact app:
- Preact owns application shell, lobby, HUD, panels, modals, and render state.
- SVG.js owns map construction and SVG interaction primitives: pan/zoom, territory groups, labels, hit targets, and visual updates.
- Game rules stay in plain testable service modules, separate from rendering.
- WebSocket code stays isolated behind a small client module/hook that emits typed state updates/actions.
- `map.json` remains the source for precomputed territory and district geometry.
- Avoid mixing Preact render ownership with manual `innerHTML` updates in the same UI subtree.

| Fil | Ansvar |
|---|---|
| `index.html` | Entry point; mounts Preact lobby and keeps the existing game container |
| `main.jsx` | Active bootstrap: mounts the Preact app and keeps map resize handling |
| `main.js` | Legacy bootstrap kept temporarily for reference |
| `state.js` | Shared mutable game state plus subscription/modal notifications for Preact |
| `game-data.js` | Konstanter: 16 bydeler, 35 territorier, 11 oppdrag, 6 spillerfarger, adjacency-graf, checkpoints |
| `game-state.js` | Spillinitialisering, tur-/spillerqueries |
| `actions.js` | Spillmutasjoner; still mutates shared state and notifies Preact through adapters |
| `missions.js` | Seiersvilkår — kalles etter hver handling |
| `map.js` | Current native SVG render; desired replacement is SVG.js map adapter/component |
| `map.json` | Forhåndsberegnet polygon-data for territorier og bydelsgrenser |
| `GameUI.jsx` | Preact-rendered HUD, action panel, log, mission card, checkpoints, and modal host |
| `ui.js` | Transitional adapter for logging and notifying Preact; no active HUD DOM rendering |
| `dice.js` | Dice modal state adapter |
| `modals.js` | Rent/win modal state adapters |
| `websocket.js` | WebSocket client; lobby reports status/rooms through callbacks to Preact |
| `style.css` | Mørkt tema (`#0d0d0f` bakgrunn, `#c9a84c` gull-aksenter), Cinzel Decorative + Crimson Pro |
| `map-editor.html` | Dev-verktøy for å tegne territoriepolygoner |

## Build

Vite bygger begge SPAene i én pass fra `client-react/vite.config.js`. Output går til `server/public/` (servert av WhiteNoise). For sub-path deployments sett `VITE_BASE_PATH` (f.eks. `/pokerklokke/`).
