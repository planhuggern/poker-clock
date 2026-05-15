# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development strategy

### Iterations
- Each task should produce something runnable. No half-finished features — a small thing that works beats a large thing that doesn't.
- Prefer vertical slices: one complete feature end-to-end (backend + frontend + test) per iteration rather than horizontal layers.
- Commit after each green iteration.

### TDD
- Write the test first, watch it fail, then implement.
- For Django: pytest-django integration tests that hit the real DB and channel layer — no mocking.
- For frontend logic (game rules, state mutations): unit tests against pure functions in `game-data.js`, `game-state.js`, `actions.js`, `missions.js`.
- Tests live next to the code they cover. A feature is done when the tests are green.

### Agents
- Use parallel agents for independent subtasks: one agent per layer (backend consumer, frontend component, tests) when the interfaces are already agreed on.
- Always define the interface (WebSocket message shape, function signature, component props) before splitting into parallel agents — otherwise agents block each other.
- Agents should produce working, tested code. No research-only agents unless the problem is genuinely unknown.
- After parallel agents finish, integrate and run the full test suite before moving on.

## Project Overview

Poker-Clock is a poker tournament management app with a real-time synchronized countdown clock. It runs as a multi-app portal: `poker-clock` (main app) and `oslo-conquest` (a separate SPA) share the same Django backend and static file server.

## Commands

### Frontend (`client-react/`)
```bash
npm run dev       # Vite dev server on port 8081 with hot reload
npm run build     # Production build → server/public/
npm run lint      # ESLint
npm run preview   # Preview production build locally
```

### Backend (`server/`)

**Stack:** Django + Django REST Framework (API) + Django Channels (WebSockets) + SQLite + Redis (channel layer) + WhiteNoise (static files).

**DRF**
- Use DRF serializers for all JSON input/output; validate at the serializer layer.
- Prefer function-based API views (`@api_view`) for simple endpoints; use `APIView` or `ModelViewSet` for CRUD-heavy resources.
- Keep views thin — business logic belongs in models or dedicated service functions.
- Use `select_related` / `prefetch_related` to avoid N+1 queries.

**Django Channels / WebSockets**
- Consumers are async (`AsyncWebsocketConsumer`); use `database_sync_to_async` for any ORM access inside a consumer.
- Authenticate on `connect()` — reject unauthenticated connections immediately.
- Scope mutations to channel groups so all connected clients stay in sync.
- Do not block the event loop; offload any synchronous work with `sync_to_async` or `database_sync_to_async`.

**General**
- Follow PEP 8; use lowercase_with_underscores for functions and variables.
- Use Django’s ORM; avoid raw SQL unless profiling proves it necessary.
- Apply Django security defaults (CSRF, XSS prevention, parameterised queries).
- Test with pytest-django; prefer integration tests over mocks for DB and channel layer behaviour.


```bash
python manage.py migrate
DEBUG=true python manage.py runserver "[::]:8000"
pytest            # Run tests
```

### Local Dev Auth (no Google OAuth needed)
```
http://localhost:8000/auth/dev?role=admin
```

## Architecture

### Backend (`server/`)

**`portal/`** — Django project container:
- `asgi.py` — Routes HTTP and WebSocket traffic (Django Channels)
- `urls.py` — `register_spa()` helper mounts each SPA under its own path prefix
- `settings.py` — Reads secrets from `config.json`; `BASE_PATH` env/config key controls URL prefix; WhiteNoise serves `server/public/`

**`clock/`** — Main poker-clock Django app:
- `models.py` — `Tournament`, `Player`, `TournamentEntry`, `AppState`
- `consumers.py` — Async WebSocket `ClockConsumer`; verifies JWT, manages per-tournament channel groups
- `state.py` — Thread-safe in-memory state registry (one dict + `RLock` per tournament); state is debounce-persisted to SQLite every 250 ms
- `tick.py` — Background thread that broadcasts a `tick` message ~1/sec to all connected clients
- `views.py` — Google OAuth + dev-login auth endpoints

**`oslo_conquest/`** — Second Django app with the same general structure.

@memory/frontend/CLAUDE.md

@memory/spec/CLAUDE.md

### Real-Time Data Flow

1. React connects via `usePokerSocket` → WebSocket authenticated with JWT
2. Consumer sends an initial `snapshot` with full tournament state
3. Background `tick.py` thread broadcasts `tick` ~1/sec
4. Admin actions (start, pause, next level) are sent as WebSocket messages from the client; the consumer mutates state and broadcasts updated state to all clients in the channel group

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

### Multi-App Build

`vite.config.js` builds both SPAs in a single pass. Output goes to `server/public/` (served by WhiteNoise). For sub-path deployments set `VITE_BASE_PATH` (e.g., `/pokerklokke/`).

### Deployment

GitHub Actions (`.github/workflows/deploy.yml`) deploys on push to `main` via SSH to a VPS running Traefik + Daphne under systemd. The build sets `VITE_BASE_PATH=/pokerklokke/` automatically.
