````md
# Poker-Clock – Project

Multi-app portal: `poker-clock` (tournament clock) and `oslo-conquest` (strategy game) share the same Django backend and static file server.

---

# Agent Instructions

## Workflow system

Workflows are located in:

```txt
.ai/workflows/
```

When implementing features, prefer using:

```txt
.ai/workflows/feature.workflow.md
```

Follow workflows as strict state machines.

Rules:
- Do not skip phases.
- Do not implement before required approval checkpoints.
- Explicitly state the current phase before acting.
- Stop when the workflow says STOP.
- If sub-agents are supported by the environment, they may be used.
- Otherwise simulate roles sequentially.
- Prefer small, safe iterations over large rewrites.
- Avoid scope creep unless explicitly approved by the user.

Before implementation:
1. Read the workflow file.
2. Identify the current phase.
3. Summarise the goal briefly.
4. Continue only if the previous phase has been approved.

## Coding philosophy

Prioritise:
- readability,
- simplicity,
- modularity,
- explicitness,
- testability,
- maintainability.

Avoid:
- premature abstractions,
- hidden coupling,
- over-engineering,
- duplicated logic,
- large unsafe refactors.

Prefer modifying existing patterns consistently over introducing new architectural styles.

## Refactoring expectations

After implementation:
- perform a refactoring review,
- reduce duplication,
- improve naming,
- simplify complexity,
- improve module boundaries,
- remove dead code where safe.

If the environment supports a dedicated refactoring/review skill, it may be used.

## Testing expectations

Prefer TDD where practical:
1. Write or update tests first.
2. Confirm relevant tests fail when expected.
3. Implement minimal code.
4. Run tests again.
5. Iterate until green.

Do not claim tests pass unless they were actually run.

Prefer:
- integration tests,
- behavioural tests,
- realistic websocket flows,
- end-to-end state transitions.

Avoid excessive mocking unless isolation is necessary.

---

# Commands

## Frontend (`client-react/`)

```bash
npm run dev       # Vite dev server on port 8081 with hot reload
npm run build     # Production build → server/public/
npm run lint      # ESLint
npm run preview   # Preview production build locally
```

## Backend (`server/`)

```bash
python manage.py migrate
DEBUG=true python manage.py runserver "[::]:8000"
pytest
```

## Local dev auth (no Google OAuth needed)

```txt
http://localhost:8000/auth/dev?role=admin
```

---

# Architecture

## Backend (`server/`)

### `portal/`

Django project container.

Files:
- `asgi.py` — Routes HTTP and WebSocket traffic
- `urls.py` — `register_spa()` mounts each SPA under its own path prefix
- `settings.py` — Reads secrets from `config.json`; WhiteNoise serves `server/public/`

### `clock/`

Poker-clock Django app.

Key files:
- `models.py`
  - `Tournament`
  - `Player`
  - `TournamentEntry`
  - `AppState`

- `consumers.py`
  - Async WebSocket `ClockConsumer`
  - JWT verification
  - Per-tournament channel groups

- `state.py`
  - Thread-safe in-memory state registry
  - Debounce-persisted to SQLite every 250 ms

- `tick.py`
  - Background thread broadcasting `tick` ~1/sec

- `views.py`
  - Google OAuth
  - Dev-login auth endpoints

### `oslo_conquest/`

Second Django app.

Characteristics:
- WebSocket consumer
- In-memory game state (`_rooms`)
- No DB persistence

---

# Real-time data flow

1. Client connects via WebSocket with JWT authentication
2. Consumer sends initial `snapshot`
3. `tick.py` broadcasts `tick` events ~1/sec
4. Admin actions mutate shared state
5. Updated state is broadcast to all clients in the channel group

---

# Build

Vite builds both SPAs in a single pass from:

```txt
client-react/vite.config.js
```

Output:

```txt
server/public/
```

Sub-path deployments use:

```txt
VITE_BASE_PATH
```

Example:

```txt
/pokerklokke/
```

---

# Deployment

GitHub Actions:

```txt
.github/workflows/deploy.yml
```

Deploys on push to `main` via SSH to a VPS running:
- Traefik
- Daphne
- systemd

---

# Configuration

File:

```txt
server/config.json
```

Gitignored.

Use:

```txt
config.example.json
```

as template.

Example:

```json
{
  "jwtSecret": "...",
  "djangoSecret": "...",
  "clientOrigin": "http://localhost:8081",
  "serverOrigin": "http://localhost:8000",
  "basePath": "",
  "google": {
    "clientID": "...",
    "clientSecret": "...",
    "callbackURL": "..."
  },
  "adminEmails": ["..."],
  "sqlite_file": "./data/pokerclock.sqlite"
}
```

---

# Backend conventions

## DRF

- Use DRF serializers for all JSON input/output.
- Validate at the serializer layer.
- Prefer `@api_view` for simple endpoints.
- Use `APIView` or `ModelViewSet` for CRUD-heavy resources.
- Keep views thin.
- Put business logic in models or service functions.
- Use `select_related` / `prefetch_related` to avoid N+1 queries.

## Django Channels

- Consumers must remain async.
- Use `database_sync_to_async` for ORM access.
- Authenticate during `connect()`.
- Reject unauthenticated connections immediately.
- Never block the event loop.

## General

- Follow PEP 8.
- Use `lowercase_with_underscores`.
- Prefer Django ORM over raw SQL.
- Follow Django security defaults.
- Use pytest-django.
- Prefer integration tests over mocks for DB and channel behaviour.
````
