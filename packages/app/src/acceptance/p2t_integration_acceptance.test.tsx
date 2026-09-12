import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { ConversationPage } from '../features/chat/ConversationPage';
import { globalAudioPlaybackManager } from '../features/chat/audio/audioPlaybackManager';
import { installFetch, jsonResponse, type MockRoute } from '../test/helpers';

const preset = { id: 5, name: 'Fixture', description: null, agent_type: 'standard', default_model: 'deepseek-v4-flash', system_prompt: null, is_visible: true };
const catalog = { models: [{ name: 'deepseek-v4-flash', family: 'deepseek', abilities: [], compatible_endpoint_ids: [7] }], endpoints: [{ id: 7, name: 'Fixture', provider: 'deepseek', execution_type: 'direct_api', execution_adapter: 'internal_http', payload_format: 'openai', cache_transport: 'inline_chunk', attachment_transports: [], configured: true, enabled: true }], roles: { main: [{ model: 'deepseek-v4-flash', default_endpoint: 7 }], support: {} }, providers: [] };
const conversation = (id: number) => ({ id, name: `C${id}`, created_at: '2026-09-01T00:00:00Z', frozen_project_ids: [], project: 0, project_name: null, agent_type: 'standard', agent_preset_id: 5, last_message_at: null, thinking_level: 'auto', memory_injection_enabled: null });
const row = (id: number, text: string) => ({ id, role: 'assistant', content: text, reasoning_content: null, platform: 'deepseek', model_version: 'v4-flash', token_count: null, index_in_session: 0, attachment_ids: [], attachments_meta: null, created_at: '2026-09-12T10:00:00Z', voice: { available: true, directed: false, cached: false } });
const page = (id: number, messageId: number, text: string): MockRoute[] => [
  { test: '/api/agents/presets/', handler: () => jsonResponse([preset]) },
  { test: '/api/core/model-catalog/', handler: () => jsonResponse(catalog) },
  { test: `/api/agents/conversations/${id}/`, handler: () => jsonResponse(conversation(id)) },
  { test: `/api/agents/conversations/${id}/cache/`, handler: () => jsonResponse({ active: false, platform: null, has_snapshot: false }) },
  { test: `/api/agents/chat/${id}/`, handler: () => jsonResponse({ messages: [row(messageId, text)], total_count: 1, has_more: false }) },
];
function app(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Link to="/chat/92">go B</Link><Routes><Route path="chat/:conversationId" element={<ConversationPage />} /></Routes></MemoryRouter></QueryClientProvider>);
}
function media() {
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) { this.dispatchEvent(new Event('pause')); });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) { this.dispatchEvent(new Event('play')); return Promise.resolve(); });
  Object.defineProperty(HTMLMediaElement.prototype, 'duration', { configurable: true, get: () => 30 });
  return pause;
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); globalAudioPlaybackManager.play('__integration_reset__', () => undefined); globalAudioPlaybackManager.stop('__integration_reset__'); localStorage.clear(); });

it('real ConversationPage route departure physically stops A and exposes only B state', async () => {
  const pause = media();
  const ownership: (string|null)[] = [];
  const unsubscribe = globalAudioPlaybackManager.subscribe(id => ownership.push(id));
  installFetch([
    ...page(91, 901, 'route A answer'), ...page(92, 902, 'route B answer'),
    { test: '/api/agents/conversations/91/messages/901/tts/', method: 'POST', handler: () => jsonResponse({ status: 'playable', content_url: '/api/agents/conversations/91/messages/901/tts/content/', duration_ms: 30000 }) },
  ]);
  const view = app('/chat/91');
  fireEvent.click(await screen.findByRole('button', { name: '朗读此条消息' }));
  await screen.findByRole('button', { name: '暂停朗读' });
  const owned = view.container.querySelector('audio');
  expect(owned).not.toBeNull();
  pause.mockClear();
  fireEvent.click(screen.getByRole('link', { name: 'go B' }));
  const b = (await screen.findByText('route B answer')).closest('article') as HTMLElement;
  expect(within(b).getByRole('button', { name: '朗读此条消息' })).toBeTruthy();
  expect(view.container.querySelector('audio')).toBeNull();
  expect(pause.mock.instances).toContain(owned);
  await waitFor(() => expect(ownership.at(-1)).toBeNull());
  unsubscribe();
});

it('offline TTS remains row-local and leaves the real page composer and message read untouched', async () => {
  media();
  const { calls } = installFetch([
    ...page(93, 903, 'canonical answer'),
    { test: '/api/agents/conversations/93/messages/903/tts/', method: 'POST', handler: () => jsonResponse({ status: 'failed_retryable', code: 'runtime_offline', message: 'do not render raw backend prose' }, 503) },
  ]);
  app('/chat/93');
  fireEvent.click(await screen.findByRole('button', { name: '朗读此条消息' }));
  const retry = await screen.findByRole('button', { name: '重试生成语音' });
  expect(retry.textContent).toContain('语音服务未就绪');
  expect(document.body.textContent).not.toContain('do not render raw backend prose');
  expect(screen.getByText('canonical answer')).toBeTruthy();
  const box = screen.getByRole<HTMLTextAreaElement>('textbox', { name: '消息输入框' });
  fireEvent.change(box, { target: { value: 'still usable' } });
  expect(box.value).toBe('still usable');
  expect(calls.filter(c => c.url.pathname === '/api/agents/chat/93/')).toHaveLength(1);
});