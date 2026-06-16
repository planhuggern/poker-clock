// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('@shared/auth/useCurrentPlayer.js', () => ({
  useCurrentPlayer: vi.fn(),
}));

import { useCurrentPlayer } from '@shared/auth/useCurrentPlayer.js';
import UserMenu from '../src/components/UserMenu';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('UserMenu – BH1: gjestidentitet vises', () => {
  it('viser display_name fra useCurrentPlayer()', () => {
    vi.mocked(useCurrentPlayer).mockReturnValue({
      id: 'uuid-1',
      display_name: 'Gjest 4231',
      is_guest: true,
    });

    render(<UserMenu />);

    expect(screen.getByText('Gjest 4231')).toBeInTheDocument();
  });

  it('viser "Gjest" som fallback når ingen spiller er autentisert', () => {
    vi.mocked(useCurrentPlayer).mockReturnValue(null);

    render(<UserMenu />);

    expect(screen.getByText('Gjest')).toBeInTheDocument();
  });

  it('viser forbokstaven til spillernavnet som avatar', () => {
    vi.mocked(useCurrentPlayer).mockReturnValue({
      id: 'uuid-2',
      display_name: 'Kjempe Kriger',
      is_guest: true,
    });

    render(<UserMenu />);

    expect(screen.getByText('K')).toBeInTheDocument();
  });
});

describe('UserMenu – BH2: reaktivitet', () => {
  it('oppdaterer visningsnavn når spiller endres', () => {
    vi.mocked(useCurrentPlayer).mockReturnValue(null);
    const { rerender } = render(<UserMenu />);
    expect(screen.getByText('Gjest')).toBeInTheDocument();

    vi.mocked(useCurrentPlayer).mockReturnValue({
      id: 'uuid-3',
      display_name: 'Ny Spiller',
      is_guest: true,
    });
    act(() => rerender(<UserMenu />));

    expect(screen.getByText('Ny Spiller')).toBeInTheDocument();
  });
});
