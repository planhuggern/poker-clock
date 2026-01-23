import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const SERVER = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

export function usePokerSocket(token) {
  const [status, setStatus] = useState("disconnected");
  const [error, setError] = useState(null);
  const [snapshot, setSnapshot] = useState(null);

  const socket = useMemo(() => {
    if (!token) return null;
    return io(SERVER, {
      auth: { token },
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
