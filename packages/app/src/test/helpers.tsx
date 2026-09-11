import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import type { ReactElement } from 'react';
import { AppShell } from '../shell/AppShell';
import { ChatHomePage } from '../features/chat/ChatHomePage';
import { ConversationPage } from '../features/chat/ConversationPage';
import { NotFoundPage } from '../features/chat/NotFoundPage';
import { AgentHubPage } from '../features/agents/AgentHubPage';
import { AgentProfilePage } from '../features/agents/AgentProfilePage';
import { ProjectHubPage } from '../features/projects/ProjectHubPage';
import { ProjectDetailPage } from '../features/projects/ProjectDetailPage';

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

export const RUNTIME_TEST_MODEL_CATALOG = {
  models: [{
    name: 'deepseek-v4-flash',
    family: 'deepseek',
    abilities: ['fc'],
    compatible_endpoint_ids: [7],
  }],
  endpoints: [{
    id: 7,
    name: 'DeepSeek',
    provider: 'deepseek',
    execution_type: 'direct_api',
    execution_adapter: 'internal_http',
    payload_format: 'openai',
    cache_transport: 'inline_chunk',
    attachment_transports: ['inline_text'],
    configured: true,
    enabled: true,
  }],
  roles: { main: [{ model: 'deepseek-v4-flash', default_endpoint: 7 }], support: {} },
  providers: [],
};

export function runtimeTestPreset(id: number) {
  return {
    id,
    name: `Runtime preset ${id}`,
    description: null,
    agent_type: 'standard',
    default_model: 'deepseek-v4-flash',
    system_prompt: null,
    is_visible: true,
  };
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

export function installRuntimeFetch(routes: MockRoute[], fallback?: RouteHandler) {
  return installFetch([
    ...routes,
    { test: '/api/core/model-catalog/', handler: () => jsonResponse(RUNTIME_TEST_MODEL_CATALOG) },
  ], fallback);
}

/** Select transport through the production-owned Tactical HUD control. */
export async function selectRuntimeTransport(transport: 'sse' | 'async') {
  fireEvent.click(await screen.findByRole('button', { name: '战术面板' }));
  fireEvent.change(await screen.findByRole('combobox', { name: '选择传输模式' }), {
    target: { value: transport },
  });
  fireEvent.click(screen.getByRole('button', { name: '关闭战术面板' }));
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
            <Route path="agents" element={<AgentHubPage />} />
            <Route path="agents/:presetId" element={<AgentProfilePage />} />
            <Route path="projects" element={<ProjectHubPage />} />
            <Route path="projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
