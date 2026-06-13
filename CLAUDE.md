# CLAUDE.md

@AGENTS.md
@memory/frontend.md
@memory/oslo-conquest-spec.md

This file contains Claude-specific runtime optimisations and supplements the shared project instructions in `AGENTS.md`.

The primary workflow source of truth is:

```txt
.ai/workflows/
```

Preferred feature workflow:

```txt
.ai/workflows/feature.workflow.md
```

---

# Feature trigger

When the user's message contains any of these words or phrases (Norwegian or English), ALWAYS invoke the `/feature` skill before doing anything else — do not start implementing directly:

- implementer, implementere, implement
- lag, lage, lag en, lage en
- bygg, bygge, bygg en, bygge en
- legg til, legg til en
- opprett, opprett en
- skriv, skriv en (when referring to a feature, not a single file edit)
- add, create, build (when referring to a new feature or capability)

Do not invoke `/feature` for:
- bug fixes,
- one-line edits,
- configuration changes,
- refactoring of existing code,
- questions or explanations.

---

# Claude Runtime Guidance

If the runtime supports sub-agents:
- use separate agents for:
  - analysis,
  - architecture,
  - implementation,
  - review,
  - testing.

If the runtime supports parallel execution:
- parallelise independent tasks only after interfaces are agreed upon.

If the runtime supports dedicated review/refactoring skills:
- use them during the refactoring phase.

If `/simplify` is available:
- run it on changed files during the refactoring review phase.

Do not skip approval checkpoints defined in workflows.

---

# Development strategy

## Iterations

- Each task should produce something runnable.
- No half-finished features.
- A small thing that works beats a large thing that doesn't.
- Prefer vertical slices:
  - one complete feature end-to-end
  - backend + frontend + tests
  - per iteration.
- Commit after each green iteration when commit support exists.

## TDD

- Write the test first.
- Watch it fail.
- Implement the minimal required code.
- Run tests again.
- Iterate until green.

### Backend testing

Prefer:
- pytest-django integration tests,
- real DB access,
- real channel layer behaviour.

Avoid mocking unless isolation is necessary.

### Frontend testing

Prefer unit tests for:
- game rules,
- state mutations,
- reducers,
- actions,
- derived state logic.

Current frontend-focused modules include:
- `client-react/oslo-conquest/domains/game/model/game-data.js`
- `client-react/oslo-conquest/domains/game/state/game-state.js`
- `client-react/oslo-conquest/domains/game/state/actions.js`
- `client-react/oslo-conquest/domains/game/state/game-reducer.js`
- `client-react/oslo-conquest/transport/websocket/websocket.js`
- `client-react/oslo-conquest/ui/components/GameUI.jsx`

Tests should live close to the code they cover.

A feature is not complete until relevant tests are green.

---

# Agents

Use parallel agents only for independent subtasks.

Examples:
- backend consumer,
- frontend component,
- tests,
- websocket protocol implementation.

Before parallelisation:
- define interfaces first,
- agree on:
  - websocket message shapes,
  - function signatures,
  - component props,
  - shared contracts.

Avoid splitting work before interfaces are stable.

Agents should:
- produce working code,
- produce tested code,
- avoid research-only output unless the problem is genuinely unknown.

After parallel work completes:
- integrate changes,
- run the full relevant test suite,
- verify behaviour end-to-end before continuing.

---

# Architecture expectations

Prefer:
- explicit boundaries,
- modular code,
- low coupling,
- readable state transitions,
- deterministic websocket behaviour,
- minimal hidden state.

Avoid:
- large rewrites,
- speculative abstractions,
- duplicated websocket logic,
- mixing transport logic with domain logic,
- blocking async consumers.

Keep:
- websocket protocols explicit,
- state mutation paths understandable,
- server/client responsibilities clearly separated.
