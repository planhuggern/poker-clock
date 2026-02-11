import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const SERVER_ORIGIN = import.meta.env.VITE_SERVER_URL
  || globalThis.location?.origin
  || "http://localhost:3000";

const BASE_URL = import.meta.env.BASE_URL || "/";
const basePath = BASE_URL === "/" ? "" : BASE_URL.replace(/\/$/, "");
const SOCKET_PATH = `${basePath}/socket.io`;

function assetUrl(p) {
  // Vite BASE_URL inkluderer trailing slash.
  return `${BASE_URL}${p.replace(/^\//, "")}`;
}

export function usePokerSocket(token) {
  const [status, setStatus] = useState("disconnected");
  const [error, setError] = useState(null);
  const [snapshot, setSnapshot] = useState(null);

  const socket = useMemo(() => {
    if (!token) return null;
    return io(SERVER_ORIGIN, {
      auth: { token },
      path: SOCKET_PATH,
      transports: ["websocket", "polling"],
    });
  }, [token]);

  useEffect(() => {
    if (!socket) return;

    setStatus("connecting");
    setError(null);

    socket.on("connect", () => setStatus("connected"));
    socket.on("connect_error", (err) => {
      setStatus("error");
      const msg = err?.message || "connect_error";
      setError(msg);

      if (msg.toLowerCase().includes("invalid token")) {
        localStorage.removeItem("poker_token");
        localStorage.removeItem("poker_role");
      }
    });

    socket.on("snapshot", (snap) => setSnapshot(snap));
    socket.on("tick", (snap) => setSnapshot(snap));

    // Lydavspilling på play_sound-event
    socket.on("play_sound", ({ type }) => {
      let audio;
      switch (type) {
        case "start":
          audio = new Audio(assetUrl("sounds/start.mp3"));
          break;
        case "pause":
          audio = new Audio(assetUrl("sounds/pause.mp3"));
          break;
        case "reset_level":
          audio = new Audio(assetUrl("sounds/reset.mp3"));
          break;
        case "level_advance":
          audio = new Audio(assetUrl("sounds/new_level.mp3"));
          break;
        case "level_back":
          audio = new Audio(assetUrl("sounds/level-down.mp3"));
          break;
        case "level_jump":
          audio = new Audio(assetUrl("sounds/jump.mp3"));
          break;
        case "one_minute_left":
          audio = new Audio(assetUrl("sounds/one-minute.mp3"));
          break;
        default:
          return;
      }
      audio?.play();
    });

    return () => socket.disconnect();
  }, [socket]);

  const api = useMemo(() => {
    if (!socket) {
      return {
        emit: () => {},
        start: () => {},
        pause: () => {},
        reset: () => {},
        next: () => {},
        prev: () => {},
      };
    }
    return {
      emit: (event, payload) => socket.emit(event, payload),
      start: () => socket.emit("admin_start"),
      pause: () => socket.emit("admin_pause"),
      reset: () => socket.emit("admin_reset_level"),
      next: () => socket.emit("admin_next"),
      prev: () => socket.emit("admin_prev"),
      updateTournament: (t) => socket.emit("admin_update_tournament", t),
    };
  }, [socket]);

  return { status, error, snapshot, ...api };
}
