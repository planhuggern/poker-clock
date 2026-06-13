import { useEffect, useMemo, useRef, useState } from "react";
import type { Players, Snapshot, Tournament } from "./types";

const SERVER_ORIGIN = import.meta.env.VITE_SERVER_URL
  || globalThis.location?.origin
  || "http://localhost:8000";

const BASE_URL = import.meta.env.BASE_URL || "/";
const basePath = BASE_URL === "/" ? "" : BASE_URL.replace(/\/$/, "");

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

function toWsOrigin(origin: string): string {
  return origin.replace(/^https/, "wss").replace(/^http/, "ws");
}

function buildWsUrl(token: string, tournamentId: number): string {
  const ws = toWsOrigin(SERVER_ORIGIN);
  return `${ws}${basePath}/ws/clock/${tournamentId}/?token=${encodeURIComponent(token)}`;
}

const RECONNECT_DELAY_MS = [1000, 2000, 4000, 8000, 15000];

export function usePokerSocket(token: string | null, tournamentId = 1) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const unmountedRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!token) return;
    unmountedRef.current = false;

    function connect() {
      if (unmountedRef.current) return;
      setStatus("connecting");
      setError(null);

      const ws = new WebSocket(buildWsUrl(token!, tournamentId));
      wsRef.current = ws;

      ws.onopen = () => {
        attemptsRef.current = 0;
        setStatus("connected");
        ws.send(JSON.stringify({ type: "get_snapshot" }));
      };

      ws.onmessage = (evt: MessageEvent) => {
        let data: { type: string; soundType?: string; message?: string } & Partial<Snapshot>;
        try { data = JSON.parse(evt.data as string); } catch { return; }

        switch (data.type) {
          case "snapshot":
          case "tick":
            setSnapshot(data as Snapshot);
            break;
          case "play_sound":
            _playSound(data.soundType ?? "");
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

      ws.onclose = (evt: CloseEvent) => {
        if (unmountedRef.current) return;
        if (evt.code === 4001) {
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
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [token, tournamentId]);

  const api = useMemo(() => {
    const send = (type: string, extra: Record<string, unknown> = {}) => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, ...extra }));
      }
    };
    return {
      emit: (type: string, payload?: Record<string, unknown>) => send(type, payload ?? {}),
      start: () => send("admin_start"),
      pause: () => send("admin_pause"),
      reset: () => send("admin_reset_level"),
      next: () => send("admin_next"),
      prev: () => send("admin_prev"),
      jump: (index: number) => send("admin_jump", { index }),
      updateTournament: (tournament: Partial<Tournament>) => send("admin_update_tournament", { tournament }),
      addTime: (seconds: number) => send("admin_add_time", { seconds }),
      setPlayers: (patch: Partial<Players>) => send("admin_set_players", patch),
      rebuy: () => send("admin_rebuy"),
      addOn: () => send("admin_add_on"),
      bustout: () => send("admin_bustout"),
    };
  }, []);

  return { status, error, snapshot, ...api };
}

function _playSound(type: string): void {
  let src: string;
  switch (type) {
    case "start":           src = "sounds/start.mp3";      break;
    case "pause":           src = "sounds/pause.mp3";      break;
    case "reset_level":     src = "sounds/reset.mp3";      break;
    case "level_advance":   src = "sounds/new_level.mp3";  break;
    case "level_back":      src = "sounds/level-down.mp3"; break;
    case "level_jump":      src = "sounds/jump.mp3";       break;
    case "one_minute_left": src = "sounds/one-minute.mp3"; break;
    default: return;
  }
  new Audio(`${BASE_URL}${src}`).play().catch(() => {});
}
