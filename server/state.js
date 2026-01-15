export function defaultTournament() {
  return {
    name: "Pokerturnering",
    // default nivå-lengde (sekunder); hvert nivå kan override
    defaultLevelSeconds: 15 * 60,
    // nivåer: type = "level" | "break"
    levels: [
      { type: "level", title: "Level 1", sb: 50, bb: 100, ante: 0, seconds: 15 * 60 },
      { type: "level", title: "Level 2", sb: 75, bb: 150, ante: 0, seconds: 15 * 60 },
      { type: "break", title: "Pause", seconds: 5 * 60 },
      { type: "level", title: "Level 3", sb: 100, bb: 200, ante: 25, seconds: 15 * 60 }
    ]
  };
}

export function createState() {
  const t = defaultTournament();
  return {
    tournament: t,
    running: false,
    // index i levels
    currentIndex: 0,
    // når nivået startet (ms epoch). null hvis ikke running.
    startedAtMs: null,
    // akkumulert tid brukt i gjeldende nivå før pause (sekunder)
    elapsedInCurrentSeconds: 0
  };
}

export function getCurrentLevel(state) {
  return state.tournament.levels[state.currentIndex] ?? null;
}

export function levelTotalSeconds(state) {
  const lvl = getCurrentLevel(state);
  if (!lvl) return 0;
  return typeof lvl.seconds === "number" ? lvl.seconds : state.tournament.defaultLevelSeconds;
}

export function computeRemainingSeconds(state, nowMs = Date.now()) {
  const total = levelTotalSeconds(state);
  let elapsed = state.elapsedInCurrentSeconds;

  if (state.running && state.startedAtMs != null) {
    elapsed += Math.floor((nowMs - state.startedAtMs) / 1000);
  }

  const remaining = Math.max(0, total - elapsed);
  return { total, elapsed, remaining };
}

export function stopIfFinishedAndAdvance(state, nowMs = Date.now()) {
  const lvl = getCurrentLevel(state);
  if (!lvl) return { changed: false, event: null };

  const { remaining } = computeRemainingSeconds(state, nowMs);
  if (remaining > 0) return { changed: false, event: null };

  // nivå ferdig -> auto neste (hvis finnes)
  if (state.currentIndex < state.tournament.levels.length - 1) {
    state.currentIndex += 1;
    state.elapsedInCurrentSeconds = 0;
    state.startedAtMs = state.running ? nowMs : null;
    return { changed: true, event: "LEVEL_ADVANCED" };
  } else {
    // slutt
    state.running = false;
    state.startedAtMs = null;
    state.elapsedInCurrentSeconds = levelTotalSeconds(state); // fullført
    return { changed: true, event: "TOURNAMENT_ENDED" };
  }
}
