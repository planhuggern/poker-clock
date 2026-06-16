// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const _listeners = new Set<(p: unknown) => void>();

vi.mock('@shared/auth/authClient.js', () => ({
  getCurrentPlayer: vi.fn(() => null),
  subscribe: vi.fn((listener: (p: unknown) => void) => {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  }),
}));

import { useCurrentPlayer } from '../../shared/auth/useCurrentPlayer.js';
import { getCurrentPlayer } from '@shared/auth/authClient.js';

function notifyListeners(player: unknown) {
  _listeners.forEach(fn => fn(player));
}

beforeEach(() => {
  vi.resetAllMocks();
  _listeners.clear();
  vi.mocked(getCurrentPlayer).mockReturnValue(null);
});

describe('useCurrentPlayer', () => {
  it('returnerer initialverdi fra getCurrentPlayer()', () => {
    vi.mocked(getCurrentPlayer).mockReturnValue({ id: '1', display_name: 'Alice', is_guest: true });
    const { result } = renderHook(() => useCurrentPlayer());
    expect(result.current?.display_name).toBe('Alice');
  });

  it('oppdateres når subscriber varsles', () => {
    const { result } = renderHook(() => useCurrentPlayer());
    expect(result.current).toBeNull();

    act(() => notifyListeners({ id: '2', display_name: 'Bob', is_guest: true }));

    expect(result.current?.display_name).toBe('Bob');
  });

  it('melder seg av ved unmount', () => {
    const { unmount } = renderHook(() => useCurrentPlayer());
    expect(_listeners.size).toBe(1);
    unmount();
    expect(_listeners.size).toBe(0);
  });
});
