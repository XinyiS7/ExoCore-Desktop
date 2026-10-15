import { afterEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { isLibraryActive } from '../shell/navigation';
import { installFetch, jsonResponse, renderApp, unmockFetch } from './helpers';

afterEach(unmockFetch);

describe('Library navigation (UI-A1)', () => {
  it('matches /library and its item routes only', () => {
    expect(isLibraryActive('/library')).toBe(true);
    expect(isLibraryActive('/library/items/7')).toBe(true);
    expect(isLibraryActive('/libraryx')).toBe(false);
    expect(isLibraryActive('/river')).toBe(false);
  });

  it('is an enabled first-level entry, active on /library, with no Memory child', async () => {
    installFetch([], () => jsonResponse({ items: [], next_cursor: null }));
    renderApp(['/library']);
    const nav = await screen.findByRole('navigation', { name: '主导航' });
    const link = within(nav).getByRole('link', { name: 'Library' });
    expect(link).toHaveAttribute('href', '/library');
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Chat' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByText(/Memory|记忆/)).toBeNull();
    expect(screen.queryByText('P4/P5')).toBeNull();
  });
});
