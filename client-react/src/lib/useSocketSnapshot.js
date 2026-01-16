import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const SERVER = import.meta.env.VITE_SERVER_URL;

export function useSocketSnapshot(token) {
  const [status, setStatus] = useState("disconnected"); // "connecting" | "connected" | "error"
  const [error, setError] = useState(null);
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    if (!token) return;

    setStatus("connecting");
    setError(null);

    const socket = io(SERVER, {
      auth: { token },
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
