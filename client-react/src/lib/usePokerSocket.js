import { useEffect, useMemo, useRef, useState } from "react";

const SERVER_ORIGIN = import.meta.env.VITE_SERVER_URL
  || globalThis.location?.origin
  || "http://localhost:8000";

const BASE_URL = import.meta.env.BASE_URL || "/";
const basePath = BASE_URL === "/" ? "" : BASE_URL.replace(/\/$/, "");

function assetUrl(p) {
  return `${BASE_URL}${p.replace(/^\//, "")}`;
}

/** Convert an http(s) origin to ws(s). */
function toWsOrigin(origin) {
  return origin.replace(/^https/, "wss").replace(/^http/, "ws");
}

function buildWsUrl(token) {
  const ws = toWsOrigin(SERVER_ORIGIN);
  return `${ws}${basePath}/ws/clock/?token=${encodeURIComponent(token)}`;
}

const RECONNECT_DELAY_MS = [1000, 2000, 4000, 8000, 15000];

export function usePokerSocket(token) {
  const [status, setStatus] = useState("disconnected");
  const [error, setError] = useState(null);
  const [snapshot, setSnapshot] = useState(null);

  const wsRef = useRef(null);
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
      wsRef.current = ws;

      ws.onopen = () => {
        attemptsRef.current = 0;
        setStatus("connected");
        ws.send(JSON.stringify({ type: "get_snapshot" }));
      };

      ws.onmessage = (evt) => {
        let data;
        try { data = JSON.parse(evt.data); } catch { return; }

        switch (data.type) {
          case "snapshot":
          case "tick":
            setSnapshot(data);
            break;
          case "play_sound":
            _playSound(data.soundType);
            break;
          case "error_msg":
            console.warn("[ws]", data.message);
            break;
          default:
            break;
        }
      };

      ws.onerror = () => {
        setStatus("error");
        setError("WebSocket error");
      };

      ws.onclose = (evt) => {
        if (unmountedRef.current) return;
        if (evt.code === 4001) {
          // Auth failed
          setStatus("error");
          setError("invalid token");
          localStorage.removeItem("poker_token");
          localStorage.removeItem("poker_role");
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
      wsRef.current?.close();
    };
  }, [token]);

  const api = useMemo(() => {
    const send = (type, extra = {}) => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, ...extra }));
      }
    };
    return {
      emit: (type, payload) => send(type, payload ? { ...payload } : {}),
      start: () => send("admin_start"),
      pause: () => send("admin_pause"),
      reset: () => send("admin_reset_level"),
      next: () => send("admin_next"),
      prev: () => send("admin_prev"),
      jump: (index) => send("admin_jump", { index }),
      updateTournament: (tournament) => send("admin_update_tournament", { tournament }),
    };
  }, []);

  return { status, error, snapshot, ...api };
}

function _playSound(type) {
  let src;
  switch (type) {
    case "start":          src = "sounds/start.mp3";      break;
    case "pause":          src = "sounds/pause.mp3";      break;
    case "reset_level":    src = "sounds/reset.mp3";      break;
    case "level_advance":  src = "sounds/new_level.mp3";  break;
    case "level_back":     src = "sounds/level-down.mp3"; break;
    case "level_jump":     src = "sounds/jump.mp3";       break;
    case "one_minute_left":src = "sounds/one-minute.mp3"; break;
    default: return;
  }
  new Audio(`${BASE_URL}${src}`).play().catch(() => {});
}

