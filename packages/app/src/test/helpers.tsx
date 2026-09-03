import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import type { ReactElement } from 'react';
import { AppShell } from '../shell/AppShell';
import { ChatHomePage } from '../features/chat/ChatHomePage';
import { ConversationPage } from '../features/chat/ConversationPage';
import { NotFoundPage } from '../features/chat/NotFoundPage';

// ── fetch mock helpers ─────────────────────────────────────────────────────

export type RouteHandler = (url: URL, init?: RequestInit) => Response | Promise<Response>;

export interface MockRoute {
  /** string = exact pathname match; RegExp = pathname test. */
  test: string | RegExp;
  method?: string;
  handler: RouteHandler;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function installFetch(routes: MockRoute[], fallback?: RouteHandler) {
  const calls: { url: URL; init?: RequestInit }[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    calls.push({ url, init });
    for (const route of routes) {
      const methodOk = !route.method || (init?.method ?? 'GET') === route.method;
      const matched = typeof route.test === 'string' ? url.pathname === route.test : route.test.test(url.pathname);
      if (methodOk && matched) return route.handler(url, init);
    }
    const handler = fallback ?? (() => jsonResponse({ error: 'unmocked request' }, 404));
    return handler(url, init);
  });
  vi.stubGlobal('fetch', fn);
  return { fn, calls };
}

export function unmockFetch() {
  vi.unstubAllGlobals();
}

export function callsToPath(calls: { url: URL }[], pathPart: string): { url: URL; init?: RequestInit }[] {
  return calls.filter((c) => c.url.pathname.includes(pathPart));
}

// ── providers wrapper ──────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

/** Render any ui inside fresh QueryClient + MemoryRouter. */
export function renderV4(ui: ReactElement, initialEntries: string[] = ['/']) {
  const queryClient = makeQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Render the real route tree (shell + pages) with canonical paths. */
export function renderApp(initialEntries: string[] = ['/']) {
  const queryClient = makeQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<ChatHomePage />} />
            <Route path="chat" element={<Navigate to="/" replace />} />
            <Route path="chat/:conversationId" element={<ConversationPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
