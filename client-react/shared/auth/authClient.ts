/// <reference types="vite/client" />
/**
 * Portal-level guest JWT auth — shared across all SPAs.
 *
 * Storage strategy:
 *   refresh token → localStorage ("portal.refreshToken")
 *   player info   → localStorage ("portal.player")
 *   access token  → in-memory only (lost on reload, re-obtained via refresh)
 *
 * All SPAs on the same origin share these keys automatically.
 *
 * TODO: server-side refresh token revocation when logout/recovery is implemented.
 */

export type Player = {
  id: string;
  display_name: string;
  is_guest: boolean;
};

const REFRESH_KEY = 'portal.refreshToken';
const PLAYER_KEY  = 'portal.player';

// In-memory token state — intentionally not persisted.
let _accessToken: string | null = null;
let _tokenExpiresAt = 0;
let _player: Player | null = null;

// ── API base ──────────────────────────────────────────────────────────────────

// In dev, the backend runs on a different port than the frontend (8000 vs 8081).
// Set VITE_SERVER_URL to override; falls back to same-origin for production.
const _serverOrigin: string =
  (import.meta.env.VITE_SERVER_URL as string | undefined)
  || globalThis.location?.origin
  || 'http://localhost:8000';

async function _post<T>(path: string, body?: object): Promise<T> {
  const res = await fetch(`${_serverOrigin}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Token helpers ─────────────────────────────────────────────────────────────

function _parseExpiry(token: string): number {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64)) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

function _storeAccess(token: string): void {
  _accessToken = token;
  _tokenExpiresAt = _parseExpiry(token);
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Return the currently authenticated player from memory or localStorage. */
export function getCurrentPlayer(): Player | null {
  if (_player) return _player;
  try {
    const raw = localStorage.getItem(PLAYER_KEY);
    if (raw) _player = JSON.parse(raw) as Player;
  } catch { /* ignore */ }
  return _player;
}

/** Create a new guest player, store tokens, and return player info. */
export async function guestLogin(): Promise<Player> {
  const data = await _post<{ access: string; refresh: string; player: Player }>('/auth/guest/');
  _storeAccess(data.access);
  _player = data.player;
  localStorage.setItem(REFRESH_KEY, data.refresh);
  localStorage.setItem(PLAYER_KEY, JSON.stringify(data.player));
  return data.player;
}

/**
 * Exchange the stored refresh token for a new access token.
 * Throws if no refresh token is stored or the server rejects it.
 */
export async function refreshAccessToken(): Promise<string> {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) throw new Error('No refresh token in storage');
  const data = await _post<{ access: string }>('/auth/refresh/', { refresh });
  _storeAccess(data.access);
  return data.access;
}

/**
 * Return a valid access token, refreshing silently if expired or missing.
 * Throws only when both in-memory and refresh token fail.
 */
export async function getAccessToken(): Promise<string> {
  if (_accessToken && Date.now() < _tokenExpiresAt - 60_000) {
    return _accessToken;
  }
  return refreshAccessToken();
}

/**
 * Ensure the user is authenticated.
 * - If a refresh token exists → refresh and return stored player.
 * - Otherwise (or on refresh failure) → create a new guest.
 */
export async function ensureAuthenticated(): Promise<Player> {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (refresh) {
    try {
      await refreshAccessToken();
      const stored = getCurrentPlayer();
      if (stored) return stored;
    } catch { /* fall through */ }
  }
  return guestLogin();
}

/** Clear all auth state locally without touching the server. */
export function logoutLocalOnly(): void {
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(PLAYER_KEY);
  _accessToken = null;
  _tokenExpiresAt = 0;
  _player = null;
}

/**
 * Fetch wrapper that injects Authorization header and handles a single
 * token-expired retry (401 → refresh → retry once).
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = async (token: string): Promise<Response> => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(`${_serverOrigin}${path}`, { ...init, headers });
  };

  const token = await getAccessToken();
  const res = await doFetch(token);

  if (res.status === 401) {
    try {
      const fresh = await refreshAccessToken();
      return doFetch(fresh);
    } catch {
      throw new Error('Authentication failed — could not refresh token');
    }
  }

  return res;
}
