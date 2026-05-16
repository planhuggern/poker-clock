# Poker-Clock – Project

> Kilde: AGENTS.md er autoritativ — hold disse to filene i sync.

Multi-app portal: `poker-clock` (tournament clock) and `oslo-conquest` (strategy game) share the same Django backend and static file server.

## Commands

### Frontend (`client-react/`)
```bash
npm run dev       # Vite dev server on port 8081 with hot reload
npm run build     # Production build → server/public/
npm run lint      # ESLint
npm run preview   # Preview production build locally
```

### Backend (`server/`)
```bash
python manage.py migrate
DEBUG=true python manage.py runserver "[::]:8000"
pytest
```

### Local dev auth (no Google OAuth needed)
```
http://localhost:8000/auth/dev?role=admin
```

## Architecture

### Backend (`server/`)

**`portal/`** — Django project container:
- `asgi.py` — Routes HTTP and WebSocket traffic
- `urls.py` — `register_spa()` mounts each SPA under its own path prefix
- `settings.py` — Reads secrets from `config.json`; WhiteNoise serves `server/public/`

**`clock/`** — poker-clock Django app:
- `models.py` — `Tournament`, `Player`, `TournamentEntry`, `AppState`
- `consumers.py` — Async WebSocket `ClockConsumer`; verifies JWT, manages per-tournament channel groups
- `state.py` — Thread-safe in-memory state registry; debounce-persisted to SQLite every 250 ms
- `tick.py` — Background thread broadcasting `tick` ~1/sec
- `views.py` — Google OAuth + dev-login auth endpoints

**`oslo_conquest/`** — Second Django app. WebSocket consumer with in-memory game state (`_rooms` dict), no DB persistence.

### Frontend

**poker-clock** (`client-react/src/`): React + React Router. Key hooks: `usePokerSocket.js`, `useTournamentApi.js`, `usePlayerApi.js`. Pages: `Home.jsx`, `Tv.jsx`, `TournamentList.jsx`, `Login.jsx`.

**oslo-conquest** (`client-react/oslo-conquest/`): Preact + SVG.js. Multiplayer strategy game — see `memory/spec/CLAUDE.md` for full game spec.

### Real-time data flow

1. Client connects via WebSocket, authenticated with JWT
2. Consumer sends initial `snapshot` with full state
3. `tick.py` broadcasts `tick` ~1/sec
4. Admin actions are sent as WebSocket messages; consumer mutates state and broadcasts to all clients in the channel group

### Build

Vite builds both SPAs in a single pass from `client-react/vite.config.js`. Output → `server/public/`. Sub-path deployments: set `VITE_BASE_PATH` (e.g. `/pokerklokke/`).

### Deployment

GitHub Actions (`.github/workflows/deploy.yml`) deploys on push to `main` via SSH to a VPS running Traefik + Daphne under systemd.

### Configuration

`server/config.json` (gitignored; use `config.example.json` as template):
```json
{
  "jwtSecret": "...",
  "djangoSecret": "...",
  "clientOrigin": "http://localhost:8081",
  "serverOrigin": "http://localhost:8000",
  "basePath": "",
  "google": { "clientID": "...", "clientSecret": "...", "callbackURL": "..." },
  "adminEmails": ["..."],
  "sqlite_file": "./data/pokerclock.sqlite"
}
```

## Backend conventions

**DRF**
- Use DRF serializers for all JSON input/output; validate at the serializer layer.
- Prefer `@api_view` for simple endpoints; use `APIView` or `ModelViewSet` for CRUD-heavy resources.
- Keep views thin — business logic belongs in models or service functions.
- Use `select_related` / `prefetch_related` to avoid N+1 queries.

**Django Channels**
- Consumers are async (`AsyncWebsocketConsumer`); use `database_sync_to_async` for ORM access.
- Authenticate on `connect()` — reject unauthenticated connections immediately.
- Do not block the event loop.

**General**
- Follow PEP 8; lowercase_with_underscores for functions and variables.
- Use Django's ORM; avoid raw SQL unless profiling proves it necessary.
- Apply Django security defaults (CSRF, XSS prevention, parameterised queries).
- Test with pytest-django; prefer integration tests over mocks for DB and channel layer behaviour.
