/**
 * Hook for the player profile REST API.
 * Auto-fetches on mount, exposes updateNickname() for PATCH.
 */
import { useCallback, useEffect, useState } from "react";

const SERVER_ORIGIN =
  import.meta.env.VITE_SERVER_URL ||
  globalThis.location?.origin ||
  "http://localhost:8000";

const BASE_URL = import.meta.env.BASE_URL || "/";
const basePath = BASE_URL === "/" ? "" : BASE_URL.replace(/\/$/, "");

function apiUrl(path) {
  return `${SERVER_ORIGIN}${basePath}${path}`;
}

/** Decode the JWT payload without verifying (we trust the server issued it). */
export function parseJwtPayload(token) {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

export function usePlayerApi(token) {
  const [profile, setProfile] = useState(null);   // { username, nickname, registered }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(apiUrl("/clock/api/me/"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`${r.status}`);
      setProfile(await r.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const updateNickname = useCallback(
    async (nickname) => {
      const r = await fetch(apiUrl("/clock/api/me/"), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nickname }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `${r.status}`);
      }
      const updated = await r.json();
      setProfile(updated);
      return updated;
    },
    [token],
  );

const register = useCallback(
    async (tournamentId = 1) => {
      const r = await fetch(apiUrl("/clock/api/me/register/"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tournament_id: tournamentId }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `${r.status}`);
      }
      await fetchProfile();
      return r.json();
    },
    [token, fetchProfile],
  );

  return { profile, loading, error, updateNickname, register, refresh: fetchProfile };
}
