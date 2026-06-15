// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@shared/auth/authClient.js', () => ({
  getAccessToken: vi.fn(),
}));

import { getAccessToken } from '@shared/auth/authClient.js';
import { useTournamentApi } from '../src/lib/useTournamentApi';

const FAKE_TOKEN = 'test-access-token';

function mockFetchOk(body: unknown = []) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getAccessToken).mockResolvedValue(FAKE_TOKEN);
});

describe('useTournamentApi – BH2: bruker ikke ekstern token-prop', () => {
  it('tar ingen token-parameter', () => {
    vi.stubGlobal('fetch', mockFetchOk([]));

    // Kompilerer uten token-argument — TypeScript vil feile ved kompilering
    // dersom signaturen har en obligatorisk token-param
    const { result } = renderHook(() => useTournamentApi());

    expect(result.current.tournaments).toBeDefined();
  });
});

describe('useTournamentApi – BH3: bruker getAccessToken()', () => {
  it('sender Authorization-header med token fra getAccessToken()', async () => {
    const mockFetch = mockFetchOk([]);
    vi.stubGlobal('fetch', mockFetch);

    renderHook(() => useTournamentApi());

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe(`Bearer ${FAKE_TOKEN}`);
  });

  it('kaller getAccessToken() én gang per fetch', async () => {
    vi.stubGlobal('fetch', mockFetchOk([]));

    renderHook(() => useTournamentApi());

    await waitFor(() => expect(vi.mocked(getAccessToken)).toHaveBeenCalled());

    expect(vi.mocked(getAccessToken)).toHaveBeenCalledTimes(1);
  });

  it('sender request uten auth-header dersom getAccessToken() kaster', async () => {
    vi.mocked(getAccessToken).mockRejectedValue(new Error('no token'));
    const mockFetch = mockFetchOk([]);
    vi.stubGlobal('fetch', mockFetch);

    renderHook(() => useTournamentApi());

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBeNull();
  });
});
