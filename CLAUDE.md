# CLAUDE.md

@AGENTS.md
@memory/frontend/CLAUDE.md
@memory/spec/CLAUDE.md

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
