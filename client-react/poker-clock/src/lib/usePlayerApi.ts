import { useCallback, useEffect, useState } from "react";
import type { PlayerProfile } from "./types";

const SERVER_ORIGIN =
  import.meta.env.VITE_SERVER_URL ||
  globalThis.location?.origin ||
  "http://localhost:8000";

const BASE_URL = import.meta.env.BASE_URL || "/";
const basePath = BASE_URL === "/" ? "" : BASE_URL.replace(/\/$/, "");

function apiUrl(path: string): string {
  return `${SERVER_ORIGIN}${basePath}${path}`;
}

export function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function usePlayerApi(token: string | null) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(apiUrl("/clock/api/me/"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`${r.status}`);
      setProfile(await r.json() as PlayerProfile);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void fetchProfile(); }, [fetchProfile]);

  const updateNickname = useCallback(
    async (nickname: string): Promise<PlayerProfile> => {
      const r = await fetch(apiUrl("/clock/api/me/"), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nickname }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || `${r.status}`);
      }
      const updated = await r.json() as PlayerProfile;
      setProfile(updated);
      return updated;
    },
    [token],
  );

  const register = useCallback(
    async (tournamentId = 1): Promise<PlayerProfile> => {
      const r = await fetch(apiUrl("/clock/api/me/register/"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tournament_id: tournamentId }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || `${r.status}`);
      }
      await fetchProfile();
      return r.json() as Promise<PlayerProfile>;
    },
    [token, fetchProfile],
  );

  return { profile, loading, error, updateNickname, register, refresh: fetchProfile };
}
