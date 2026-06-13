import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ensureAuthenticated,
  getCurrentPlayer,
  guestLogin,
  logoutLocalOnly,
} from '@shared/auth/authClient.js';

// ── localStorage mock ──────────────────────────────────────────────────────────

const _store: Record<string, string> = {};
const mockLocalStorage = {
  getItem:    (k: string) => _store[k] ?? null,
  setItem:    (k: string, v: string) => { _store[k] = v; },
  removeItem: (k: string) => { delete _store[k]; },
  clear:      () => { Object.keys(_store).forEach((k) => { delete _store[k]; }); },
};

// ── JWT helper ─────────────────────────────────────────────────────────────────

function makeJwt(extra: Record<string, unknown> = {}): string {
  const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    player_id:  'test-uuid-1234',
    token_type: 'access',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900,
    ...extra,
  }));
  return `${header}.${payload}.fake_sig`;
}

const FAKE_PLAYER = { id: 'test-uuid-1234', display_name: 'Gjest 1234', is_guest: true };

function guestResponse() {
  return {
    ok: true,
    json: async () => ({
      access:  makeJwt({ token_type: 'access' }),
      refresh: makeJwt({ token_type: 'refresh', exp: Math.floor(Date.now() / 1000) + 86400 }),
      player:  FAKE_PLAYER,
    }),
  };
}

// ── Test setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockLocalStorage.clear();
  vi.stubGlobal('localStorage', mockLocalStorage);
  logoutLocalOnly();
  vi.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('guestLogin', () => {
  it('stores refresh token and player info in localStorage', async () => {
    const mockFetch = vi.fn().mockResolvedValue(guestResponse());
    vi.stubGlobal('fetch', mockFetch);

    const player = await guestLogin();

    expect(player.id).toBe(FAKE_PLAYER.id);
    expect(mockLocalStorage.getItem('portal.refreshToken')).toBeTruthy();
    const stored = JSON.parse(mockLocalStorage.getItem('portal.player') ?? 'null');
    expect(stored?.id).toBe(FAKE_PLAYER.id);
  });
});

describe('ensureAuthenticated', () => {
  it('calls POST /auth/guest/ when no refresh token is stored', async () => {
    const mockFetch = vi.fn().mockResolvedValue(guestResponse());
    vi.stubGlobal('fetch', mockFetch);

    const player = await ensureAuthenticated();

    expect(player.id).toBe(FAKE_PLAYER.id);
    expect((mockFetch.mock.calls[0][0] as string)).toContain('/auth/guest/');
  });

  it('calls POST /auth/refresh/ when a stored refresh token exists', async () => {
    mockLocalStorage.setItem('portal.refreshToken', 'stored-refresh');
    mockLocalStorage.setItem('portal.player', JSON.stringify(FAKE_PLAYER));

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access: makeJwt() }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const player = await ensureAuthenticated();

    expect(player.id).toBe(FAKE_PLAYER.id);
    expect((mockFetch.mock.calls[0][0] as string)).toContain('/auth/refresh/');
  });

  it('falls back to guestLogin when stored refresh token is rejected by server', async () => {
    mockLocalStorage.setItem('portal.refreshToken', 'expired-refresh');

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce(guestResponse());
    vi.stubGlobal('fetch', mockFetch);

    const player = await ensureAuthenticated();

    expect(player.id).toBe(FAKE_PLAYER.id);
    // Second call must be to /auth/guest/
    expect((mockFetch.mock.calls[1][0] as string)).toContain('/auth/guest/');
    // New refresh token must be stored
    expect(mockLocalStorage.getItem('portal.refreshToken')).toBeTruthy();
  });
});

describe('logoutLocalOnly', () => {
  it('clears localStorage and in-memory player', async () => {
    const mockFetch = vi.fn().mockResolvedValue(guestResponse());
    vi.stubGlobal('fetch', mockFetch);
    await guestLogin();

    logoutLocalOnly();

    expect(mockLocalStorage.getItem('osloConquest.refreshToken')).toBeNull();
    expect(mockLocalStorage.getItem('osloConquest.player')).toBeNull();
    expect(getCurrentPlayer()).toBeNull();
  });
});
