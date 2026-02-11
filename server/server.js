import express from "express";
import http from "http";
import cors from "cors";
import passport from "passport";  
import { Server as SocketIOServer } from "socket.io";
import {
  initDb,
  loadStateFromDb,
  scheduleSave
} from "./persist_sqlite.js";

import path from "path";
import { fileURLToPath } from "url";



import { loadConfig, signToken, verifyToken } from "./auth.js";
import { setupPassport } from "./oauth.js";
import {
  createState,
  computeRemainingSeconds,
  stopIfFinishedAndAdvance
} from "./state.js";

const config = loadConfig();            // ✅ MÅ være før app.use(session(...))
initDb();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function normalizeBasePath(value) {
  if (!value) return "";
  let base = String(value).trim();
  if (!base) return "";
  if (!base.startsWith("/")) base = `/${base}`;
  // Remove trailing slash (except root)
  if (base.length > 1 && base.endsWith("/")) base = base.slice(0, -1);
  return base;
}

const BASE_PATH = normalizeBasePath(process.env.BASE_PATH ?? config.basePath);
const withBase = (p) => `${BASE_PATH}${p}`;
const socketPath = `${BASE_PATH}/socket.io`;

const app = express();
app.use(cors());
app.use(express.json());


setupPassport(app, config);             // ✅ passport etter session

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  path: socketPath,
  cors: { origin: "*", methods: ["GET", "POST"] }
});

let state = loadStateFromDb(createState());

// Normaliser state (DB kan inneholde gamle/ugyldige verdier som gir NaN-timing)
function normalizeStateInPlace(s) {
  if (!s || typeof s !== "object") return;

  // currentIndex
  if (!Number.isInteger(s.currentIndex)) {
    const idx = Number(s.currentIndex);
    s.currentIndex = Number.isInteger(idx) ? idx : 0;
  }

  const maxIndex = Array.isArray(s.tournament?.levels) ? s.tournament.levels.length - 1 : 0;
  s.currentIndex = Math.max(0, Math.min(s.currentIndex, Math.max(0, maxIndex)));

  // startedAtMs
  if (!Number.isFinite(s.startedAtMs)) s.startedAtMs = null;

  // elapsedInCurrentSeconds
  if (!Number.isFinite(s.elapsedInCurrentSeconds) || s.elapsedInCurrentSeconds < 0) {
    s.elapsedInCurrentSeconds = 0;
  }

  // running
  s.running = !!s.running;

  // tournament defaults
  if (!Number.isFinite(s.tournament?.defaultLevelSeconds) || s.tournament.defaultLevelSeconds < 0) {
    if (s.tournament) s.tournament.defaultLevelSeconds = 15 * 60;
  }

  // normalize level seconds
  if (Array.isArray(s.tournament?.levels)) {
    s.tournament.levels = s.tournament.levels.map((lvl) => {
      if (!lvl || typeof lvl !== "object") return lvl;

      // Allow alternative fields
      const minutes = Number.isFinite(lvl.durationMinutes)
        ? lvl.durationMinutes
        : (Number.isFinite(lvl.minutes) ? lvl.minutes : null);

      if (Number.isFinite(minutes) && minutes >= 0) {
        lvl.seconds = minutes * 60;
      } else if (Number.isFinite(lvl.durationSeconds) && lvl.durationSeconds >= 0) {
        lvl.seconds = lvl.durationSeconds;
      }

      // Clean up invalid seconds
      if (!Number.isFinite(lvl.seconds) || lvl.seconds < 0) {
        delete lvl.seconds;
      }

      return lvl;
    });
  }
}

normalizeStateInPlace(state);

// Hvis klokka kjørte før restart, fortsett pent
if (state.running) {
  state.startedAtMs = Date.now();
}

function publicSnapshot(nowMs = Date.now()) {
  const timing = computeRemainingSeconds(state, nowMs);
  return {
    tournament: state.tournament,
    running: state.running,
    currentIndex: state.currentIndex,
    timing,
    serverNowMs: nowMs
  };
}

function requireAdmin(socket) {
  if (!socket.user || socket.user.role !== "admin") {
    socket.emit("error_msg", "Ikke autorisert (admin kreves).");
    return false;
  }
  return true;
}

function roleFromEmail(email) {
  if (!email) return "viewer";
  return (config.adminEmails ?? []).includes(email.toLowerCase()) ? "admin" : "viewer";
}

function clientBase() {
  // Hvis client og server kjører på samme origin (én container), bruk relative redirects.
  const sameOrigin = (config.clientOrigin && config.serverOrigin && config.clientOrigin === config.serverOrigin);
  const origin = sameOrigin ? "" : (config.clientOrigin ?? "");
  if (!origin) return "";
  return origin.endsWith("/") ? origin.slice(0, -1) : origin;
}

function clientRedirectBase() {
  // origin (optional) + base path
  return `${clientBase()}${BASE_PATH}`;
}

app.get(withBase("/auth/google"),
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
    session: false
  })
);

app.get(withBase("/auth/google/callback"),
  passport.authenticate("google", { failureRedirect: `${clientRedirectBase()}/?login=fail`, session: false }),
  (req, res) => {
    const email = req.user?.email?.toLowerCase() ?? "";
    const admins = (config.adminEmails ?? []).map(x => x.toLowerCase());
    const role = admins.includes(email) ? "admin" : "viewer";
    const token = signToken(config, { username: email || "google-user", role });

    //logg
    const base = clientRedirectBase();
    const redirectUrl = `${base}/callback?token=${encodeURIComponent(token)}&role=${encodeURIComponent(role)}`;
    res.redirect(redirectUrl);
  }
);

// Serve ferdigbygde statiske filer i production (én container)
if (process.env.NODE_ENV === "production") {
  const staticDir = path.join(__dirname, "public");
  if (BASE_PATH) {
    app.use(BASE_PATH, express.static(staticDir));

    // Støtt /basepath uten trailing slash
    app.get(BASE_PATH, (req, res) => {
      return res.sendFile(path.join(staticDir, "index.html"));
    });
  } else {
    app.use(express.static(staticDir));
  }

  // SPA fallback (ikke fang /auth eller /socket.io)
  const spaRoute = BASE_PATH ? `${BASE_PATH}/*` : "*";
  const authPrefix = `${BASE_PATH}/auth`;
  const socketPrefix = `${BASE_PATH}/socket.io`;

  app.get(spaRoute, (req, res, next) => {
    if (req.path.startsWith(authPrefix) || req.path.startsWith(socketPrefix)) return next();
    return res.sendFile(path.join(staticDir, "index.html"));
  });
}

// --- Socket auth middleware ---
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("No token"));
  try {
    const payload = verifyToken(config, token);
    socket.user = payload; // {username, role}
    next();
  } catch (e) {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  socket.emit("snapshot", publicSnapshot());

  socket.on("get_snapshot", () => {
    socket.emit("snapshot", publicSnapshot());
  });

  // Admin controls
  socket.on("admin_start", () => {
    if (!requireAdmin(socket)) return;
    if (!state.running) {
      state.running = true;
      state.startedAtMs = Date.now();
      scheduleSave(state);
      io.emit("snapshot", publicSnapshot());
      io.emit("play_sound", { type: "start" });
    }
  });

  socket.on("admin_pause", () => {
    if (!requireAdmin(socket)) return;
    if (state.running) {
      const now = Date.now();
      const { elapsed } = computeRemainingSeconds(state, now);
      // computeRemainingSeconds returnerer elapsed i "elapsed"; men vi vil lagre brukt tid:
      state.elapsedInCurrentSeconds = elapsed;
      state.running = false;
      state.startedAtMs = null;
      scheduleSave(state);
      io.emit("snapshot", publicSnapshot());
      io.emit("play_sound", { type: "pause" });
    }
  });

  socket.on("admin_reset_level", () => {
    if (!requireAdmin(socket)) return;
    state.elapsedInCurrentSeconds = 0;
    state.startedAtMs = state.running ? Date.now() : null;
    scheduleSave(state);
    io.emit("snapshot", publicSnapshot());
    io.emit("play_sound", { type: "reset_level" });
  });

  socket.on("admin_next", () => {
    if (!requireAdmin(socket)) return;
    if (state.currentIndex < state.tournament.levels.length - 1) {
      state.currentIndex += 1;
      state.elapsedInCurrentSeconds = 0;
      state.startedAtMs = state.running ? Date.now() : null;
      scheduleSave(state);
      io.emit("snapshot", publicSnapshot());
      io.emit("play_sound", { type: "level_advance" });
    }
  });

  socket.on("admin_prev", () => {
    if (!requireAdmin(socket)) return;
    if (state.currentIndex > 0) {
      state.currentIndex -= 1;
      state.elapsedInCurrentSeconds = 0;
      state.startedAtMs = state.running ? Date.now() : null;
      scheduleSave(state);
      io.emit("snapshot", publicSnapshot());
      io.emit("play_sound", { type: "level_back" });
    }
  });

  socket.on("admin_jump", (index) => {
    if (!requireAdmin(socket)) return;
    const i = Number(index);
    if (Number.isInteger(i) && i >= 0 && i < state.tournament.levels.length) {
      state.currentIndex = i;
      state.elapsedInCurrentSeconds = 0;
      state.startedAtMs = state.running ? Date.now() : null;
      scheduleSave(state);
      io.emit("snapshot", publicSnapshot());
      io.emit("play_sound", { type: "level_jump" });
    }
  });

  socket.on("admin_update_tournament", (tournament) => {
    if (!requireAdmin(socket)) return;

    // Minimal validering
    if (!tournament || !Array.isArray(tournament.levels) || tournament.levels.length === 0) {
      socket.emit("error_msg", "Ugyldig turneringsstruktur");
      return;
    }

    // Normaliser innkommende tournament-format (aksepter durationMinutes/durationSeconds/minutes)
    if (tournament && Array.isArray(tournament.levels)) {
      tournament.levels = tournament.levels.map((lvl) => {
        if (!lvl || typeof lvl !== "object") return lvl;

        const minutes = Number.isFinite(lvl.durationMinutes)
          ? lvl.durationMinutes
          : (Number.isFinite(lvl.minutes) ? lvl.minutes : null);

        if (Number.isFinite(minutes) && minutes >= 0) {
          lvl.seconds = minutes * 60;
        } else if (Number.isFinite(lvl.durationSeconds) && lvl.durationSeconds >= 0) {
          lvl.seconds = lvl.durationSeconds;
        }

        if (!Number.isFinite(lvl.seconds) || lvl.seconds < 0) {
          delete lvl.seconds;
        }

        return lvl;
      });
    }

    state.tournament = tournament;
    // clamp index
    state.currentIndex = Math.min(state.currentIndex, tournament.levels.length - 1);
    state.elapsedInCurrentSeconds = 0;
    state.startedAtMs = state.running ? Date.now() : null;
    scheduleSave(state);  
    io.emit("snapshot", publicSnapshot());
  });
});

// Tick-loop: auto-advance når nivå går til 0
setInterval(() => {
  if (!state.running) return;
  const now = Date.now();
  const { changed, event } = stopIfFinishedAndAdvance(state, now);
  if (changed) {
    scheduleSave(state);
    io.emit("snapshot", publicSnapshot(now));
    io.emit("system_event", event);
    io.emit("play_sound", { type: "level_advance" });
  } else {
    // send lettvekts tick av og til (1s) for smooth klient
    io.emit("tick", publicSnapshot(now));
    // Sjekk om det er 60 sekunder igjen av nivået, og send lydvarsel
    const timing = computeRemainingSeconds(state, now);
    if (timing && timing.remaining === 60) {
      io.emit("play_sound", { type: "one_minute_left" });
    }
  }
}, 1000);

const PORT = process.env.PORT || config.port || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

app.use((err, req, res, next) => {
  console.error("EXPRESS ERROR:", err);
  res.status(500).send("Auth error: " + (err?.message ?? "unknown"));
});

