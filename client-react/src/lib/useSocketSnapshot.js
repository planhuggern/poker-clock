import { useEffect, useRef, useState } from "react";

const SERVER_ORIGIN = import.meta.env.VITE_SERVER_URL
  || globalThis.location?.origin
  || "http://localhost:8000";

const BASE_URL = import.meta.env.BASE_URL || "/";
const basePath = BASE_URL === "/" ? "" : BASE_URL.replace(/\/$/, "");

function toWsOrigin(origin) {
  return origin.replace(/^https/, "wss").replace(/^http/, "ws");
}

function buildWsUrl(token) {
  const ws = toWsOrigin(SERVER_ORIGIN);
  return `${ws}${basePath}/ws/clock/?token=${encodeURIComponent(token)}`;
}

const RECONNECT_DELAY_MS = [1000, 2000, 4000, 8000, 15000];

export function useSocketSnapshot(token) {
  const [status, setStatus] = useState("disconnected");
  const [error, setError] = useState(null);
  const [snapshot, setSnapshot] = useState(null);

  const attemptsRef = useRef(0);
  const unmountedRef = useRef(false);
  const reconnectTimerRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    unmountedRef.current = false;

    function connect() {
      if (unmountedRef.current) return;
      setStatus("connecting");
      setError(null);

      const ws = new WebSocket(buildWsUrl(token));

      ws.onopen = () => {
        attemptsRef.current = 0;
        setStatus("connected");
        ws.send(JSON.stringify({ type: "get_snapshot" }));
      };

      ws.onmessage = (evt) => {
        let data;
        try { data = JSON.parse(evt.data); } catch { return; }
        if (data.type === "snapshot" || data.type === "tick") {
          setSnapshot(data);
        }
      };

      ws.onerror = () => {
        setStatus("error");
        setError("WebSocket error");
      };

      ws.onclose = (evt) => {
        if (unmountedRef.current) return;
        if (evt.code === 4001) {
          setStatus("error");
          setError("invalid token");
          return;
        }
        setStatus("disconnected");
        const delay = RECONNECT_DELAY_MS[
          Math.min(attemptsRef.current, RECONNECT_DELAY_MS.length - 1)
        ];
        attemptsRef.current += 1;
        reconnectTimerRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      unmountedRef.current = true;
      clearTimeout(reconnectTimerRef.current);
    };
  }, [token]);

  return { status, error, snapshot };
}

