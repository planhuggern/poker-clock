import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const SERVER_ORIGIN = import.meta.env.VITE_SERVER_URL
  || globalThis.location?.origin
  || "http://localhost:3000";

const BASE_URL = import.meta.env.BASE_URL || "/";
const basePath = BASE_URL === "/" ? "" : BASE_URL.replace(/\/$/, "");
const SOCKET_PATH = `${basePath}/socket.io`;

export function useSocketSnapshot(token) {
  const [status, setStatus] = useState("disconnected"); // "connecting" | "connected" | "error"
  const [error, setError] = useState(null);
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    if (!token) return;

    setStatus("connecting");
    setError(null);

    const socket = io(SERVER_ORIGIN, {
      auth: { token },
      path: SOCKET_PATH,
      transports: ["websocket", "polling"]
    });

    socket.on("connect", () => setStatus("connected"));
    socket.on("connect_error", (err) => {
      setStatus("error");
      setError(err?.message || "connect_error");
    });

    socket.on("snapshot", (snap) => setSnapshot(snap));
    socket.on("tick", (snap) => setSnapshot(snap));

    return () => {
      socket.disconnect();
    };
  }, [token]);

  return { status, error, snapshot };
}
