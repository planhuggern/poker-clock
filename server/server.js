import express from "express";
import http from "http";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";
import bcrypt from "bcryptjs";

import { loadConfig, buildUserDb, signToken, verifyToken } from "./auth.js";
import {
  createState,
  computeRemainingSeconds,
  stopIfFinishedAndAdvance
} from "./state.js";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const config = loadConfig();
const users = await buildUserDb(config);

let state = createState();

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

// --- REST: login ---
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) return res.status(400).json({ error: "Mangler brukernavn/passord" });

  const u = users.find(x => x.username === username);
  if (!u) return res.status(401).json({ error: "Feil innlogging" });

  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) return res.status(401).json({ error: "Feil innlogging" });

  const token = signToken(config, u);
  res.json({ token, role: u.role, username: u.username });
});

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
      io.emit("snapshot", publicSnapshot());
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
      io.emit("snapshot", publicSnapshot());
    }
  });

  socket.on("admin_reset_level", () => {
    if (!requireAdmin(socket)) return;
    state.elapsedInCurrentSeconds = 0;
    state.startedAtMs = state.running ? Date.now() : null;
    io.emit("snapshot", publicSnapshot());
  });

  socket.on("admin_next", () => {
    if (!requireAdmin(socket)) return;
    if (state.currentIndex < state.tournament.levels.length - 1) {
      state.currentIndex += 1;
      state.elapsedInCurrentSeconds = 0;
      state.startedAtMs = state.running ? Date.now() : null;
      io.emit("snapshot", publicSnapshot());
    }
  });

  socket.on("admin_prev", () => {
    if (!requireAdmin(socket)) return;
    if (state.currentIndex > 0) {
      state.currentIndex -= 1;
      state.elapsedInCurrentSeconds = 0;
      state.startedAtMs = state.running ? Date.now() : null;
      io.emit("snapshot", publicSnapshot());
    }
  });

  socket.on("admin_jump", (index) => {
    if (!requireAdmin(socket)) return;
    const i = Number(index);
    if (Number.isInteger(i) && i >= 0 && i < state.tournament.levels.length) {
      state.currentIndex = i;
      state.elapsedInCurrentSeconds = 0;
      state.startedAtMs = state.running ? Date.now() : null;
      io.emit("snapshot", publicSnapshot());
    }
  });

  socket.on("admin_update_tournament", (tournament) => {
    if (!requireAdmin(socket)) return;

    // Minimal validering
    if (!tournament || !Array.isArray(tournament.levels) || tournament.levels.length === 0) {
      socket.emit("error_msg", "Ugyldig turneringsstruktur");
      return;
    }

    state.tournament = tournament;
    // clamp index
    state.currentIndex = Math.min(state.currentIndex, tournament.levels.length - 1);
    state.elapsedInCurrentSeconds = 0;
    state.startedAtMs = state.running ? Date.now() : null;
    io.emit("snapshot", publicSnapshot());
  });
});

// Tick-loop: auto-advance når nivå går til 0
setInterval(() => {
  if (!state.running) return;
  const now = Date.now();
  const { changed, event } = stopIfFinishedAndAdvance(state, now);
  if (changed) {
    io.emit("snapshot", publicSnapshot(now));
    io.emit("system_event", event);
  } else {
    // send lettvekts tick av og til (1s) for smooth klient
    io.emit("tick", publicSnapshot(now));
  }
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
