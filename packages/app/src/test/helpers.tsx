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
import { AccountPage } from '../features/account/AccountPage';
import { AppearanceProvider } from '../app/AppearanceProvider';
import { SettingsLayout } from '../features/settings/SettingsLayout';
import { AppearancePanel } from '../features/settings/AppearancePanel';
import { RoutinePanel } from '../features/settings/RoutinePanel';
import { NotificationsPlaceholder } from '../features/settings/NotificationsPlaceholder';
import { KeysPanel } from '../features/settings/KeysPanel';
import { ModelRolesPanel } from '../features/settings/ModelRolesPanel';
import { McpPanel } from '../features/settings/McpPanel';

// ── fetch mock helpers ─────────────────────────────────────────────────────

export type RouteHandler = (url: URL, init?: RequestInit) => Response | Promise<Response>;

export interface MockRoute {
  /** string = exact pathname match; RegExp = pathname test. */
  test: string | RegExp;
  method?: string;
  handler: RouteHandler;
}

export function jsonResponse(body: unknown, status: number | ResponseInit = 200): Response {
  const init: ResponseInit = typeof status === 'number' ? { status } : status;
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
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
  roles: {
    main: [{ model: 'deepseek-v4-flash', default_endpoint: 7 }],
    support: {
      general_sub_agent: { model: 'deepseek-v4-flash', default_endpoint: 7 },
      vision_helper: { model: 'deepseek-v4-flash', default_endpoint: 7 },
      grounding: { model: 'deepseek-v4-flash', default_endpoint: 7 },
      image_gen: { model: 'deepseek-v4-flash', default_endpoint: 7 },
    },
  },
  providers: [
    {
      id: 'deepseek',
      display_name: 'DeepSeek',
      execution_type: 'direct_api',
      execution_adapter: 'internal_http',
      requires_endpoint_api_key: true,
    },
  ],
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

/**
 * Test-environment guard for conda Node ≥25: Node's experimental WebStorage
 * global shadows jsdom's localStorage under vitest 4 (its getWindowKeys skips
 * keys already present on the node global), leaving a broken empty Storage
 * without clear(). Healthy environments pass through untouched; broken ones
 * get an in-memory Storage with the full Web Storage contract.
 */
export function ensureTestLocalStorage(): void {
  const ls = window.localStorage as Storage | null | undefined;
  if (ls && typeof ls.clear === 'function') return;
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => {
      store.clear();
    },
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true, writable: true });
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
      <AppearanceProvider>
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </AppearanceProvider>
    </QueryClientProvider>,
  );
}

/** Render the real route tree (shell + pages) with canonical paths. */
export function renderApp(
  initialEntries: string[] = ['/'],
  { redirectSettings = false }: { redirectSettings?: boolean } = {},
) {
  const queryClient = makeQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AppearanceProvider>
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
              <Route path="account" element={<AccountPage />} />
              <Route path="user" element={<Navigate to="/account" replace />} />
              <Route path="settings" element={<SettingsLayout />}>
                {redirectSettings && <Route index element={<Navigate to="/settings/keys" replace />} />}
                <Route path="keys" element={<KeysPanel />} />
                <Route path="models" element={<ModelRolesPanel />} />
                <Route path="mcp" element={<McpPanel />} />
                <Route path="appearance" element={<AppearancePanel />} />
                <Route path="routine" element={<RoutinePanel />} />
                <Route path="notifications" element={<NotificationsPlaceholder />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AppearanceProvider>
    </QueryClientProvider>,
  );
}
