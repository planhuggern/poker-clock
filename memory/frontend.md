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

**Current stack:** Preact + SVG.js + Immer + CSS, built with Vite as a separate entry point.

**Architecture:** Feature-based structure with clear boundaries between app shell, domains, transport, and UI.

| Fil | Ansvar |
|---|---|
| `index.html` | Entry point for Oslo Conquest; loads app bootstrap and stylesheet |
| `app/main.jsx` | Preact bootstrap and app mount |
| `app/App.jsx` | Lobby/game shell and top-level action dispatch |
| `app/style.css` | Oslo Conquest visual theme |
| `domains/game/model/game-data.js` | Konstanter: territorier, distrikter, adjacency, oppdrag, checkpoints |
| `domains/game/state/state.js` | Delt runtime state + pub/sub notifications |
| `domains/game/state/game-state.js` | Spillinitialisering og state queries (`getCurrentPlayer`, `isMyTurn`) |
| `domains/game/state/game-reducer.js` | Pure Immer reducer: `reduceGameAction(gameState, context, action)` |
| `domains/game/state/actions.js` | Action creators og reducer-re-export |
| `domains/map/map.json` | Forhåndsberegnet geometri for territorier/distrikter |
| `domains/map/map.js` | SVG.js-kartadapter (rendering/interaksjon) |
| `domains/map/MapView.jsx` | Preact wrapper rundt kartadapter |
| `domains/dice/dice.js` | Terning-symboler/hjelpere brukt av UI |
| `transport/websocket/websocket.js` | WebSocket-klient og melding/handler-orkestrering |
| `ui/components/GameUI.jsx` | HUD, action panel, logg, modaler og kartkobling |
| `tests/unit/*.test.js` | Enhetstester for reducer/regler, kartvalidering og websocket |

## Build

Vite bygger begge SPAene i én pass fra `client-react/vite.config.js`. Output går til `server/public/` (servert av WhiteNoise). For sub-path deployments sett `VITE_BASE_PATH` (f.eks. `/pokerklokke/`).
