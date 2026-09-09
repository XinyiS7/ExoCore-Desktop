import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installFetch, jsonResponse, renderApp, unmockFetch } from './helpers';

const preset = {
  id: 5, name: 'Ecki', description: null, agent_type: 'standard',
  default_model: 'deepseek-v4-flash', system_prompt: null, is_visible: true,
};
const catalog = {
  models: [{
    name: 'deepseek-v4-flash', family: 'deepseek', abilities: [], compatible_endpoint_ids: [7],
  }],
  endpoints: [{
    id: 7, name: 'DeepSeek', provider: 'deepseek', execution_type: 'direct_api',
    execution_adapter: 'internal_http', payload_format: 'openai', cache_transport: 'inline_chunk',
    attachment_transports: [], configured: true, enabled: true,
  }],
  roles: { main: [{ model: 'deepseek-v4-flash', default_endpoint: 7 }], support: {} },
  providers: [],
};
const conversation = (id: number, project = 0) => ({
  id, name: `Conversation ${id}`, created_at: '2026-09-01T00:00:00Z', frozen_project_ids: [],
  project, project_name: project ? 'Project Three' : null, agent_type: 'standard', agent_preset_id: 5,
  last_message_at: null, thinking_level: 'auto', memory_injection_enabled: null,
});
const cache = { active: false, platform: null, has_snapshot: false };

function pageBase(id: number, project = 0) {
  return [
    { test: '/api/agents/presets/', handler: () => jsonResponse([preset]) },
    { test: '/api/core/model-catalog/', handler: () => jsonResponse(catalog) },
    { test: `/api/agents/conversations/${id}/`, handler: () => jsonResponse(conversation(id, project)) },
    { test: `/api/agents/conversations/${id}/cache/`, handler: () => jsonResponse(cache) },
  ];
}

afterEach(() => {
  cleanup();
  unmockFetch();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('P1D final frontend integration', () => {
  it('mounts one page-owned Aura in the stage and controlled HUD', async () => {
    installFetch([
      ...pageBase(90),
      { test: '/api/agents/chat/90/', method: 'GET', handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }) },
    ]);
    const { container } = renderApp(['/chat/90']);
    await screen.findByRole('textbox', { name: '消息输入框' });
    const stage = container.querySelector<HTMLElement>('[data-testid="v4-aura"]');
    expect(stage).not.toBeNull();
    const before = stage?.style.getPropertyValue('--aura-mid');
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem');

    fireEvent.click(screen.getByRole('button', { name: '战术面板' }));
    fireEvent.click(await screen.findByRole('button', { name: '选择 Deep Ocean' }));
    await waitFor(() => expect(stage?.style.getPropertyValue('--aura-mid')).not.toBe(before));
    expect(screen.getByTitle('氛围：Deep Ocean')).toHaveTextContent('Deep Ocean');
    expect(storageSpy.mock.calls.filter(([key]) => key === 'exo:v4:pref:aura:90')).toHaveLength(1);
  });

  it('shares shell-loaded Project children with autocomplete and blocks duplicate drawer insertion', async () => {
    installFetch([
      ...pageBase(91, 3),
      { test: '/api/agents/chat/91/', method: 'GET', handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }) },
      { test: '/api/core/projects/3/', handler: () => jsonResponse({ id: 3, name: 'Project Three', work_dir: 'D:/work' }) },
      { test: '/api/core/projects/3/files/', handler: () => jsonResponse([]) },
      {
        test: '/api/core/projects/3/tree/',
        handler: (url) => url.searchParams.get('path') === 'src'
          ? jsonResponse({ path: 'src', entries: [
              { name: 'deep.ts', type: 'file', path: 'src/deep.ts', size: 1 },
              { name: 'other.ts', type: 'file', path: 'src/other.ts', size: 1 },
            ] })
          : jsonResponse({ path: '', entries: [{ name: 'src', type: 'dir', path: 'src', entries: null }] }),
      },
    ]);
    renderApp(['/chat/91']);
    const textbox = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: '消息输入框' });
    fireEvent.change(textbox, { target: { value: 'hello world', selectionStart: 11 } });
    textbox.setSelectionRange(5, 5);
    fireEvent.click(textbox);

    fireEvent.click(screen.getByRole('button', { name: '打开项目文件' }));
    fireEvent.click(await screen.findByRole('button', { name: /src.*展开加载/ }));
    const deep = await screen.findByRole('button', { name: 'deep.ts' });
    fireEvent.click(deep);
    await waitFor(() => expect(textbox.value).toBe('hello@[src/deep.ts]  world'));

    fireEvent.click(screen.getByRole('button', { name: '打开项目文件' }));
    fireEvent.click(await screen.findByRole('button', { name: 'deep.ts' }));
    expect(textbox.value.match(/@\[src\/deep\.ts\]/g)).toHaveLength(1);

    fireEvent.change(textbox, { target: { value: '@other', selectionStart: 6 } });
    const suggestion = await screen.findByRole('option', { name: 'src/other.ts' });
    fireEvent.keyDown(textbox, { key: 'Enter', isComposing: true });
    expect(textbox.value).toBe('@other');
    expect(suggestion).toBeInTheDocument();
    fireEvent.keyDown(textbox, { key: 'Enter' });
    expect(textbox.value).toBe('@[src/other.ts] ');
  });

  it('renders ordered runtime trace, honest telemetry, then canonical history trace after terminal', async () => {
    const encoder = new TextEncoder();
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    let canonical = false;
    const historicalTrace = {
      version: 1, availability: 'available',
      items: [{
        item_id: 'tool-history', order: 0, kind: 'tool', call_id: 'call-history',
        lifecycle: 'succeeded', tool_name: 'canonical_tool', duration_ms: 8,
      }],
    };
    installFetch([
      ...pageBase(92),
      {
        test: '/api/agents/chat/92/', method: 'POST',
        handler: () => new Response(new ReadableStream({
          start(streamController) {
            controller = streamController;
            controller.enqueue(encoder.encode(
              'event: assistant_trace\ndata: {"version":1,"run_id":"run","sequence":0,"item_id":"tool-runtime","kind":"tool","call_id":"call","lifecycle":"started","tool_name":"memory_search"}\n\n' +
              'event: telemetry\ndata: {"input_chars":12,"output_chars":3,"tool_calls":1}\n\n' +
              'event: content\ndata: answer\n\n',
            ));
          },
        }), { headers: { 'Content-Type': 'text/event-stream' } }),
      },
      {
        test: '/api/agents/chat/92/', method: 'GET',
        handler: () => jsonResponse(canonical ? {
          messages: [{
            id: 8, role: 'assistant', content: 'answer', reasoning_content: null,
            assistant_run_trace: historicalTrace, platform: 'test', model_version: 'm', token_count: 1,
            index_in_session: 0, attachment_ids: [], attachments_meta: [], created_at: '2026-09-01T00:00:00Z',
          }], total_count: 1, has_more: false,
        } : { messages: [], total_count: 0, has_more: false }),
      },
    ]);
    const { container } = renderApp(['/chat/92']);
    const textbox = await screen.findByRole('textbox', { name: '消息输入框' });
    fireEvent.change(textbox, { target: { value: 'hello' } });
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });
    await screen.findByText('memory_search');
    expect(container.querySelector<HTMLDetailsElement>('.v4-trace')?.open).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: '战术面板' }));
    expect(await screen.findByText(/已收到 1 次运行用量上报；这不代表所有已接受请求/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '关闭战术面板' }));

    canonical = true;
    act(() => {
      controller.enqueue(encoder.encode('event: done\ndata: [DONE]\n\n'));
      controller.close();
    });
    await screen.findByText('canonical_tool');
    await waitFor(() => expect(screen.queryByText('memory_search')).toBeNull());
    expect(screen.getByText('answer')).toBeInTheDocument();
    expect(container.querySelector<HTMLDetailsElement>('.v4-trace')?.open).toBe(false);
  });
});
