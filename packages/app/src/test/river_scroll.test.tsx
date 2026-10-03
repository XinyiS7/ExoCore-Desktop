import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AppearanceProvider } from '../app/AppearanceProvider';
import { AppShell } from '../shell/AppShell';
import { RiverPage } from '../features/river/RiverPage';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { diaryDetail, diaryItem, memoItem } from './river_fixtures';
import { ensureTestLocalStorage, installFetch, jsonResponse, unmockFetch } from './helpers';

// Vitest disables CSS loading, including ?raw CSS imports here. Read only these
// repository stylesheets so the assertions inspect actual source, not a stub.
// Package-native Vitest runs from packages/app; jsdom rewrites import.meta.url
// to http:, so use the runner's package cwd instead of a browser URL.
const baseCss = readFileSync(resolve(process.cwd(), 'src/styles/base.css'), 'utf8');
const shellCss = readFileSync(resolve(process.cwd(), 'src/styles/shell.css'), 'utf8');
const riverCss = readFileSync(resolve(process.cwd(), 'src/features/river/river.css'), 'utf8');

function renderInShell() {
  ensureTestLocalStorage();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AppearanceProvider>
    <MemoryRouter initialEntries={['/river']}><Routes><Route element={<AppShell />}>
      {/* Test-local route ONLY: no production router or navigation exposure. */}
      <Route path="river" element={<RiverPage />} />
    </Route></Routes></MemoryRouter>
  </AppearanceProvider></QueryClientProvider>);
}
function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
  expect(match, `Missing CSS rule ${selector}`).not.toBeNull();
  return match![1];
}
afterEach(() => { cleanup(); unmockFetch(); });

describe('CP1-F01 real shell scroll contract (structure, not jsdom layout)', () => {
  it('has a viewport-bounded scroll owner; shell reserves its real mobile bottom-bar height', () => {
    // jsdom does not apply Vite CSS or calculate viewport reachability. Verify the
    // production stylesheet constraint chain, not synthetic computed dimensions.
    expect(rule(baseCss, '#root')).toMatch(/height:\s*100%/);
    expect(rule(baseCss, 'body')).toMatch(/overflow:\s*hidden/);
    expect(rule(shellCss, '.app-shell')).toMatch(/height:\s*100%/);
    expect(rule(shellCss, '.app-main')).toMatch(/flex-direction:\s*column/);
    expect(rule(shellCss, '.app-main')).toMatch(/flex:\s*1/);
    expect(rule(shellCss, '.app-main')).toMatch(/min-height:\s*0/);
    const owner = rule(riverCss, '.river-page');
    expect(owner).toMatch(/flex:\s*1/);
    expect(owner).toMatch(/min-height:\s*0/);
    expect(owner).toMatch(/overflow-y:\s*auto/);
    expect(owner).toMatch(/min-width:\s*0/);
    expect(rule(shellCss, '.app-main--bb')).toContain('padding-bottom: calc(var(--v4-bb-offset) + env(safe-area-inset-bottom))');
    expect(rule(shellCss, '.app-bottombar')).toContain('height: calc(var(--v4-bb-offset) + env(safe-area-inset-bottom))');
    expect(shellCss).toMatch(/@media\s*\(min-width:\s*768px\)[\s\S]*?\.app-main--bb\s*\{\s*padding-bottom:\s*0/);
    expect(rule(riverCss, '.river-reading-body')).toMatch(/overflow-y:\s*auto/);
  });

  it('keeps a long stream, its last card and pagination inside the same scroller; drawer preserves its deep position', async () => {
    const rows = Array.from({ length: 39 }, (_, index) => ({ ...memoItem, source_id: String(index + 100), target: { type: 'memo', memo_id: index + 100 }, preview: `长流卡片 ${index + 1}` }));
    const { calls } = installFetch([
      { test: '/api/core/river/', handler: (url) => jsonResponse(url.searchParams.has('cursor')
        ? { items: [...rows.slice(20), diaryItem], next_cursor: 'third-page-cursor' }
        : { items: rows.slice(0, 20), next_cursor: 'long-stream-cursor' }) },
      { test: '/api/core/river/open-tasks/', handler: () => jsonResponse({ items: [] }) },
      { test: '/api/memory/diaries/6/2026-10-01/', handler: () => jsonResponse(diaryDetail) },
    ]);
    const { container } = renderInShell();
    fireEvent.click(await screen.findByRole('button', { name: '加载更早记录' }));
    await screen.findByText('长流卡片 39');
    const owner = container.querySelector<HTMLElement>('main.river-page')!;
    const main = container.querySelector('.app-main')!;
    expect(owner.parentElement).toBe(main);
    expect(main).toHaveClass('app-main--bb');
    expect(container.querySelector('.app-bottombar')).not.toBeNull();
    expect(container.querySelectorAll('main.river-page')).toHaveLength(1);
    expect(owner.querySelector('.app-scroll')).toBeNull();
    expect(owner).toContainElement(screen.getByText('长流卡片 39'));
    expect(owner).toContainElement(screen.getByRole('button', { name: '加载更早记录' }));
    // Model an already-scrolled DOM state only; these metrics are NOT a browser
    // layout test and do not claim Alicia visual acceptance or actual reachability.
    Object.defineProperties(owner, {
      scrollHeight: { configurable: true, value: 9000 },
      clientHeight: { configurable: true, value: 600 },
      scrollTop: { configurable: true, writable: true, value: 7300 },
    });
    const trigger = screen.getByRole('button', { name: '阅读全文' });
    trigger.focus(); fireEvent.click(trigger);
    await screen.findByRole('heading', { name: '日记全文' });
    expect(container.inert).toBe(true);
    expect(container).toHaveAttribute('aria-hidden', 'true');
    expect(document.body.style.overflow).toBe('hidden');
    expect(container.querySelector('main.river-page')).toBe(owner);
    expect(owner.scrollTop).toBe(7300);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(container.querySelector('main.river-page')).toBe(owner);
    expect(owner.scrollTop).toBe(7300);
    expect(container.inert).toBeFalsy();
    expect(container).not.toHaveAttribute('aria-hidden');
    expect(trigger).toHaveFocus();
    expect(owner).toContainElement(screen.getByRole('button', { name: '加载更早记录' }));
    expect(calls.filter((call) => call.url.pathname === '/api/core/river/')).toHaveLength(2);
  });

  it.each(['empty', 'error'])('keeps %s page/shelf states inside that same scroll owner', async (state) => {
    installFetch([
      { test: '/api/core/river/', handler: () => state === 'empty' ? jsonResponse({ items: [], next_cursor: null }) : jsonResponse({ error: 'source failed', code: 'source_unavailable', source_type: 'diary' }, 503) },
      { test: '/api/core/river/open-tasks/', handler: () => state === 'empty' ? jsonResponse({ items: [] }) : jsonResponse({ error: 'shelf failed' }, 503) },
    ]);
    const { container } = renderInShell();
    const owner = container.querySelector('main.river-page')!;
    if (state === 'empty') {
      expect(owner).toContainElement(await screen.findByText('这段时间流暂无记录。'));
      expect(owner).toContainElement(await screen.findByText('暂无未完成事项。'));
    } else {
      expect(owner).toContainElement(await screen.findByRole('button', { name: '重新刷新时间流' }));
      expect(owner).toContainElement(await screen.findByRole('button', { name: '重试任务条带' }));
    }
    expect(owner.parentElement).toHaveClass('app-main', 'app-main--bb');
  });
});
