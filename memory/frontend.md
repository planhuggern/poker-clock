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

**Migration scaffold:** Preact, `@preact/preset-vite`, and SVG.js are installed. `main.jsx`/`App.jsx` exist as an unused scaffold; the active Oslo Conquest entrypoint is still `index.html` loading `main.js`.

The desired direction is to migrate Oslo Conquest from imperative DOM rendering to a small Preact app:
- Preact owns application shell, lobby, HUD, panels, modals, and render state.
- SVG.js owns map construction and SVG interaction primitives: pan/zoom, territory groups, labels, hit targets, and visual updates.
- Game rules stay in plain testable service modules, separate from rendering.
- WebSocket code stays isolated behind a small client module/hook that emits typed state updates/actions.
- `map.json` remains the source for precomputed territory and district geometry.
- Avoid mixing Preact render ownership with manual `innerHTML` updates in the same UI subtree.

| Fil | Ansvar |
|---|---|
| `index.html` | Entry point |
| `main.js` | Current bootstrap; desired replacement is `main.jsx` mounting the Preact app |
| `state.js` | Current global mutable object; desired replacement is Preact state/context plus small pure state helpers |
| `game-data.js` | Konstanter: 16 bydeler, 35 territorier, 11 oppdrag, 6 spillerfarger, adjacency-graf, checkpoints |
| `game-state.js` | Spillinitialisering, tur-/spillerqueries |
| `actions.js` | Spillmutasjoner; should remain UI-independent and easy to test |
| `missions.js` | Seiersvilkår — kalles etter hver handling |
| `map.js` | Current native SVG render; desired replacement is SVG.js map adapter/component |
| `map.json` | Forhåndsberegnet polygon-data for territorier og bydelsgrenser |
| `ui.js` | Current imperative HUD rendering; desired replacement is Preact components |
| `dice.js` | Kamptærning-modal |
| `modals.js` | Leie-modal, seiersskjerm-modal |
| `websocket.js` | WebSocket tilkobling/frakobling, lobby (opprett/bli med/lokal) |
| `style.css` | Mørkt tema (`#0d0d0f` bakgrunn, `#c9a84c` gull-aksenter), Cinzel Decorative + Crimson Pro |
| `map-editor.html` | Dev-verktøy for å tegne territoriepolygoner |

## Build

Vite bygger begge SPAene i én pass fra `client-react/vite.config.js`. Output går til `server/public/` (servert av WhiteNoise). For sub-path deployments sett `VITE_BASE_PATH` (f.eks. `/pokerklokke/`).
