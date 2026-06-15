import { useCallback, useEffect, useState } from "react";
import type { TournamentItem } from "./types";
import { getAccessToken } from "@shared/auth/authClient.js";

const SERVER_ORIGIN =
  import.meta.env.VITE_SERVER_URL || globalThis.location?.origin || "http://localhost:8000";

const BASE_URL = import.meta.env.BASE_URL || "/";
const basePath = BASE_URL === "/" ? "" : BASE_URL.replace(/\/$/, "");

function apiUrl(path: string): string {
  return `${SERVER_ORIGIN}${basePath}${path}`;
}

async function authHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  try {
    h["Authorization"] = `Bearer ${await getAccessToken()}`;
  } catch {
    // No token available — send request without auth header
  }
  return h;
}

export function useTournamentApi(status = "") {
  const [tournaments, setTournaments] = useState<TournamentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : "";
      const res = await fetch(apiUrl(`/clock/api/tournaments/${qs}`), {
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTournaments(await res.json() as TournamentItem[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { void fetchList(); }, [fetchList]);

  const createTournament = useCallback(async (name: string, stateJson: object | null = null): Promise<TournamentItem> => {
    const body: Record<string, unknown> = { name };
    if (stateJson) body.state_json = stateJson;
    const res = await fetch(apiUrl("/clock/api/tournaments/"), {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const created = await res.json() as TournamentItem;
    await fetchList();
    return created;
  }, [fetchList]);

  const renameTournament = useCallback(async (id: number, name: string): Promise<void> => {
    const res = await fetch(apiUrl(`/clock/api/tournaments/${id}/`), {
      method: "PATCH",
      headers: await authHeaders(),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    await fetchList();
  }, [fetchList]);

  const finishTournament = useCallback(async (id: number): Promise<void> => {
    const res = await fetch(apiUrl(`/clock/api/tournaments/${id}/finish/`), {
      method: "POST",
      headers: await authHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    await fetchList();
  }, [fetchList]);

  return {
    tournaments,
    loading,
    error,
    refetch: fetchList,
    createTournament,
    renameTournament,
    finishTournament,
  };
}
