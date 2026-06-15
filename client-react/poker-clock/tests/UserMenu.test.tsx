// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('@shared/auth/authClient.js', () => ({
  getCurrentPlayer: vi.fn(),
}));

import { getCurrentPlayer } from '@shared/auth/authClient.js';
import UserMenu from '../src/components/UserMenu';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('UserMenu – BH1: gjestidentitet vises', () => {
  it('viser display_name fra getCurrentPlayer()', () => {
    vi.mocked(getCurrentPlayer).mockReturnValue({
      id: 'uuid-1',
      display_name: 'Gjest 4231',
      is_guest: true,
    });

    render(<UserMenu />);

    expect(screen.getByText('Gjest 4231')).toBeInTheDocument();
  });

  it('viser "Gjest" som fallback når ingen spiller er autentisert', () => {
    vi.mocked(getCurrentPlayer).mockReturnValue(null);

    render(<UserMenu />);

    expect(screen.getByText('Gjest')).toBeInTheDocument();
  });

  it('viser forbokstaven til spillernavnet som avatar', () => {
    vi.mocked(getCurrentPlayer).mockReturnValue({
      id: 'uuid-2',
      display_name: 'Kjempe Kriger',
      is_guest: true,
    });

    render(<UserMenu />);

    expect(screen.getByText('K')).toBeInTheDocument();
  });
});
