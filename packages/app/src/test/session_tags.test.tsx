import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { CreateConversationDialog } from '../features/chat/CreateConversationDialog';
import { ConversationDeleteMenu } from '../features/chat/ConversationDeleteMenu';
import { createConversation, getConversation } from '../features/chat/api';
import { canonicalTag, addTag, specialTagConflict, tagErrorMessage } from '../features/tags/rules';
import { callsToPath, installFetch, jsonResponse, renderV4, unmockFetch, type MockRoute, type RouteHandler } from './helpers';

const PRESETS = [
  { id: 5, name: 'Ecki', description: null, agent_type: 'standard', default_model: null, system_prompt: null, is_visible: true },
];
const PROJECT = { id: 10, name: '剧场', description: null, prompt: null, work_dir: null, tags: ['theater'], created_at: 'x' };

const convRow = (over: Record<string, unknown> = {}) => ({
  id: 101,
  name: 'Alpha',
  created_at: '2026-10-01T00:00:00Z',
  frozen_project_ids: [],
  project: 10,
  project_name: '剧场',
  agent_type: 'g045',
  agent_preset_id: 6,
  last_message_at: null,
  thinking_level: 'auto',
  memory_injection_enabled: null,
  is_prime: false,
  tags: ['theater', '雨夜'],
  session_prompt: '夜之城 AU',
  ...over,
});

const initOk = () => jsonResponse({ data: { conversation_id: 88, session_name: '新会话' } }, 201);

function routes(initHandler: RouteHandler = initOk): MockRoute[] {
  return [
    { test: '/api/agents/presets/', handler: () => jsonResponse(PRESETS) },
    { test: '/api/core/projects/', handler: () => jsonResponse([PROJECT]) },
    { test: '/api/core/tags/suggest/', handler: () => jsonResponse({ tags: ['story', 'theater', '雨夜'] }) },
    { test: '/api/agents/sessions/init/', method: 'POST', handler: initHandler },
  ];
}

const initBodies = (calls: { url: URL; init?: RequestInit }[]) =>
  callsToPath(calls, '/sessions/init/').map((call) => JSON.parse(String(call.init?.body)));

afterEach(() => unmockFetch());

describe('tag rules mirror the backend contract', () => {
  it('canonicalizes, dedupes and reports special conflicts with the backend copy', () => {
    expect(canonicalTag('  #Theater ')).toBe('theater');
    expect(canonicalTag('#AU')).toBe('AU');
    expect(canonicalTag(' # ')).toBeNull();
    expect(addTag(['theater'], 'THEATER')).toEqual(['theater']);
    expect(specialTagConflict(['story', 'AU', 'theater'])).toBe('不可同时存在 #story 和 #theater。请至少删除一个。');
    expect(specialTagConflict(['theater', 'AU'])).toBeNull();
    expect(tagErrorMessage({ tags: { code: 'invalid_tags', message: 'bad' } })).toBe('bad');
    expect(tagErrorMessage({ name: ['x'] })).toBeNull();
  });
});

describe('conversation tag adapters', () => {
  it('init omits empty tags / prompt and sends them when present', async () => {
    const { calls } = installFetch(routes());
    await createConversation({ presetId: 5, projectId: 0, tags: [], sessionPrompt: '  ' });
    await createConversation({ presetId: 5, projectId: 10, tags: ['theater'], sessionPrompt: 'AU' });
    expect(initBodies(calls)).toEqual([
      { preset_id: 5, project_id: 0, thinking_level: 'auto' },
      { preset_id: 5, project_id: 10, thinking_level: 'auto', tags: ['theater'], session_prompt: 'AU' },
    ]);
  });

  it('detail rows read tags and session prompt; legacy rows read as empty', async () => {
    installFetch([
      { test: '/api/agents/conversations/101/', handler: () => jsonResponse(convRow()) },
      { test: '/api/agents/conversations/102/', handler: () => jsonResponse(convRow({ id: 102, tags: undefined, session_prompt: undefined })) },
    ]);
    expect(await getConversation(101)).toMatchObject({ tags: ['theater', '雨夜'], sessionPrompt: '夜之城 AU' });
    expect(await getConversation(102)).toMatchObject({ tags: [], sessionPrompt: '' });
  });
});

describe('CreateConversationDialog tags + session prompt', () => {
  const open = () =>
    renderV4(
      <CreateConversationDialog fixedProject={{ id: 10, name: '剧场' }} onClose={() => {}} onCreated={() => {}} />,
    );

  it('prefills the project tags and submits tags with the session prompt', async () => {
    const { calls } = installFetch(routes());
    open();
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('#theater')).toBeTruthy();
    fireEvent.click(await within(dialog).findByLabelText(/Ecki/));
    const tagField = within(dialog).getByLabelText(/Tag/);
    fireEvent.change(tagField, { target: { value: '#雨夜' } });
    fireEvent.keyDown(tagField, { key: 'Enter' });
    // Enter adds a chip and never submits the form.
    expect(callsToPath(calls, '/sessions/init/')).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText(/会话设定/), { target: { value: '夜之城 AU' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '创建会话' }));
    await waitFor(() => expect(initBodies(calls)).toHaveLength(1));
    expect(initBodies(calls)[0]).toEqual({
      preset_id: 5,
      project_id: 10,
      thinking_level: 'auto',
      tags: ['theater', '雨夜'],
      session_prompt: '夜之城 AU',
    });
  });

  it('blocks submit on a special-tag conflict with the backend copy', async () => {
    const { calls } = installFetch(routes());
    open();
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('#theater');
    fireEvent.click(await within(dialog).findByLabelText(/Ecki/));
    const tagField = within(dialog).getByLabelText(/Tag/);
    fireEvent.change(tagField, { target: { value: 'Story' } });
    fireEvent.keyDown(tagField, { key: 'Enter' });
    fireEvent.click(within(dialog).getByRole('button', { name: '创建会话' }));
    const message = '不可同时存在 #theater 和 #story。请至少删除一个。';
    await waitFor(() => expect(within(dialog).getAllByText(message).length).toBeGreaterThan(0));
    expect(callsToPath(calls, '/sessions/init/')).toHaveLength(0);
  });

  it('shows the backend tag error body when the server rejects', async () => {
    installFetch(routes(() => jsonResponse({ tags: { code: 'invalid_tags', message: 'tag 过长' } }, 400)));
    open();
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('#theater');
    fireEvent.click(await within(dialog).findByLabelText(/Ecki/));
    fireEvent.click(within(dialog).getByRole('button', { name: '创建会话' }));
    expect(await within(dialog).findByText('tag 过长')).toBeTruthy();
  });
});

describe('row menu minimal edit entry', () => {
  it('edits tags and session prompt through one PATCH', async () => {
    const { calls } = installFetch([
      { test: '/api/core/tags/suggest/', handler: () => jsonResponse({ tags: [] }) },
      {
        test: '/api/agents/conversations/101/',
        method: 'PATCH',
        handler: (_url, init) => jsonResponse(convRow({ ...JSON.parse(String(init?.body)) })),
      },
      { test: '/api/agents/conversations/101/', handler: () => jsonResponse(convRow()) },
    ]);
    renderV4(<ConversationDeleteMenu conversationId={101} conversationName="Alpha" />);
    fireEvent.click(screen.getByLabelText(/会话操作/));
    fireEvent.click(await screen.findByRole('menuitem', { name: /会话设定/ }));
    const dialog = await screen.findByRole('dialog', { name: '会话设定' });
    fireEvent.click(await within(dialog).findByLabelText('删除 #雨夜'));
    fireEvent.change(within(dialog).getByLabelText('会话设定'), { target: { value: '' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '会话设定' })).toBeNull());
    const patch = calls.find((call) => call.init?.method === 'PATCH');
    expect(JSON.parse(String(patch?.init?.body))).toEqual({ tags: ['theater'], session_prompt: '' });
  });
});
