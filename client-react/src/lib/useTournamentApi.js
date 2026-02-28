import { useCallback, useEffect, useState } from "react";

const SERVER_ORIGIN =
  import.meta.env.VITE_SERVER_URL || globalThis.location?.origin || "http://localhost:8000";

const BASE_URL = import.meta.env.BASE_URL || "/";
const basePath = BASE_URL === "/" ? "" : BASE_URL.replace(/\/$/, "");

function apiUrl(path) {
  return `${SERVER_ORIGIN}${basePath}${path}`;
}

function authHeaders(token) {
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

/**
 * Hook exposing tournament list + CRUD helpers.
 *
 * @param {string|null} token  - JWT token (for write operations)
 * @param {string}      status - optional status filter ("pending"|"running"|"finished"|"")
 */
export function useTournamentApi(token, status = "") {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : "";
      const res = await fetch(apiUrl(`/clock/api/tournaments/${qs}`), {
        headers: authHeaders(token),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTournaments(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, status]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const createTournament = useCallback(async (name, stateJson = null) => {
    const body = { name };
    if (stateJson) body.state_json = stateJson;
    const res = await fetch(apiUrl("/clock/api/tournaments/"), {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const created = await res.json();
    await fetchList();
    return created;
  }, [token, fetchList]);

  const renameTournament = useCallback(async (id, name) => {
    const res = await fetch(apiUrl(`/clock/api/tournaments/${id}/`), {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    await fetchList();
  }, [token, fetchList]);

  const finishTournament = useCallback(async (id) => {
    const res = await fetch(apiUrl(`/clock/api/tournaments/${id}/finish/`), {
      method: "POST",
      headers: authHeaders(token),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    await fetchList();
  }, [token, fetchList]);

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
