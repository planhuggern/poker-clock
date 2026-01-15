let token = null;
let role = null;
let username = null;
let socket = null;
let lastSnapshot = null;

const el = (id) => document.getElementById(id);

function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, "0");
  const rr = String(r).padStart(2, "0");
  return `${mm}:${rr}`;
}

function render(snapshot) {
  lastSnapshot = snapshot;
  const t = snapshot.tournament;
  const lvl = t.levels[snapshot.currentIndex];

  el("tName").textContent = t.name ?? "Pokerturnering";
  el("timeLeft").textContent = fmtTime(snapshot.timing.remaining);
  el("levelTitle").textContent = `${lvl.type === "break" ? "PAUSE" : "NIVÅ"}: ${lvl.title ?? ""}`.trim();

  if (lvl.type === "level") {
    el("blinds").textContent = `Blinds: ${lvl.sb}/${lvl.bb}  Ante: ${lvl.ante ?? 0}`;
  } else {
    el("blinds").textContent = `Pause: ${fmtTime(snapshot.timing.total)}`;
  }

  el("levelIndex").textContent = `#${snapshot.currentIndex + 1} / ${t.levels.length}  •  ${snapshot.running ? "KJØRER" : "PAUSEt"}`;

  // admin json editor
  if (role === "admin") {
    el("tournamentJson").value = JSON.stringify(t, null, 2);
    const jump = el("jumpSelect");
    jump.innerHTML = "";
    t.levels.forEach((L, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `${i + 1}. ${L.type === "break" ? "Pause" : "Level"} – ${L.title ?? ""}`.trim();
      if (i === snapshot.currentIndex) opt.selected = true;
      jump.appendChild(opt);
    });
  }
}

function addEvent(text) {
  const box = el("events");
  const line = document.createElement("div");
  const ts = new Date().toLocaleTimeString();
  line.textContent = `[${ts}] ${text}`;
  box.prepend(line);
}

async function login() {
  el("loginError").textContent = "";
  const u = el("username").value.trim();
  const p = el("password").value;

  try {
    const res = await fetch("http://localhost:3000/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Login feilet");

    token = data.token;
    role = data.role;
    username = data.username;

    el("loginCard").classList.add("hidden");
    el("mainCard").classList.remove("hidden");
    el("whoami").textContent = `${username} (${role})`;

    connectSocket();
  } catch (e) {
    el("loginError").textContent = e.message;
  }
}

function connectSocket() {
  socket = io("http://localhost:3000", { auth: { token } });

  socket.on("connect_error", (err) => {
    addEvent(`Socket error: ${err.message}`);
  });

  socket.on("snapshot", (snap) => {
    render(snap);
  });

  socket.on("tick", (snap) => {
    // tick for smooth time display
    render(snap);
  });

  socket.on("system_event", (ev) => {
    if (ev === "LEVEL_ADVANCED") addEvent("Nivå ferdig → neste nivå");
    if (ev === "TOURNAMENT_ENDED") addEvent("Turnering avsluttet");
  });

  socket.on("error_msg", (msg) => {
    addEvent(`Feil: ${msg}`);
  });

  // admin panel visibility
  if (role === "admin") el("adminPanel").classList.remove("hidden");
}

function logout() {
  token = null; role = null; username = null;
  if (socket) socket.disconnect();
  socket = null;
  el("mainCard").classList.add("hidden");
  el("loginCard").classList.remove("hidden");
}

function fullscreen() {
  const elem = document.documentElement;
  if (!document.fullscreenElement) elem.requestFullscreen?.();
  else document.exitFullscreen?.();
}

// Wire up UI
el("loginBtn").addEventListener("click", login);
el("logoutBtn").addEventListener("click", logout);
el("fullscreenBtn").addEventListener("click", fullscreen);

// Admin buttons
el("startBtn").addEventListener("click", () => socket?.emit("admin_start"));
el("pauseBtn").addEventListener("click", () => socket?.emit("admin_pause"));
el("resetBtn").addEventListener("click", () => socket?.emit("admin_reset_level"));
el("nextBtn").addEventListener("click", () => socket?.emit("admin_next"));
el("prevBtn").addEventListener("click", () => socket?.emit("admin_prev"));

el("jumpBtn").addEventListener("click", () => {
  const idx = el("jumpSelect").value;
  socket?.emit("admin_jump", Number(idx));
});

el("applyJsonBtn").addEventListener("click", () => {
  el("adminError").textContent = "";
  try {
    const t = JSON.parse(el("tournamentJson").value);
    socket?.emit("admin_update_tournament", t);
    addEvent("Oppdatert struktur sendt");
  } catch (e) {
    el("adminError").textContent = "Ugyldig JSON";
  }
});
