import { afterEach, describe, expect, it } from 'vitest';
import {
  callsToPath,
  installFetch,
  jsonResponse,
  unmockFetch,
} from './helpers';
import {
  createConversation,
  extractFieldErrors,
  fetchMessagePage,
  getConversation,
  listConversations,
  listProjects,
  listVisiblePresets,
  toAppApiError,
} from '../features/chat/api';
import { mergeMessagePages } from '../features/chat/queries';
import type { MessagePageEnvelope } from '../features/chat/types';

afterEach(() => unmockFetch());

describe('api adapters — method/path/query/body', () => {
  it('lists conversations from the canonical GET path and normalizes the 0 sentinel without mutation', async () => {
    const rows = [
      { id: 7, name: 'drift conv', created_at: '2026-09-01T10:00:00Z', frozen_project_ids: [], project: 0, project_name: null, agent_type: 'standard', agent_preset_id: 5, last_message_at: null, thinking_level: 'auto', memory_injection_enabled: null },
      { id: 8, name: 'project conv', created_at: '2026-09-01T11:00:00Z', frozen_project_ids: [], project: 10, project_name: 'A Project', agent_type: 'standard', agent_preset_id: 5, last_message_at: '2026-09-01T12:00:00Z', thinking_level: 'auto', memory_injection_enabled: null },
    ];
    const frozen = structuredClone(rows);
    const { calls } = installFetch([
      { test: '/api/agents/conversations/', handler: () => jsonResponse(rows) },
    ]);

    const result = await listConversations();

    expect(calls).toHaveLength(1);
    expect(calls[0].url.pathname).toBe('/api/agents/conversations/');
    expect(calls[0].init?.method ?? 'GET').toBe('GET');
    expect(result[0].projectId).toBeNull();
    expect(result[0].projectName).toBeNull();
    expect(result[1].projectId).toBe(10);
    expect(result[1].projectName).toBe('A Project');
    expect(result[1].lastMessageAt).toBe('2026-09-01T12:00:00Z');
    // Server DTO array untouched (still sentinel 0).
    expect(rows).toEqual(frozen);
  });

  it('gets conversation detail by id', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/conversations/9/', handler: () => jsonResponse({ id: 9, name: 'x', created_at: '2026-09-01T10:00:00Z', frozen_project_ids: [], project: 0, project_name: null, agent_type: 'standard', agent_preset_id: 5, last_message_at: null, thinking_level: 'auto', memory_injection_enabled: null }) },
    ]);
    const conv = await getConversation(9);
    expect(calls[0].url.pathname).toBe('/api/agents/conversations/9/');
    expect(conv.id).toBe(9);
  });

  it('create targets sessions/init with canonical body and never conversations POST', async () => {
    const { calls } = installFetch([
      {
        test: '/api/agents/sessions/init/',
        method: 'POST',
        handler: () => jsonResponse({ msg: '会话已建立，权限已锁定。', data: { conversation_id: 77, session_id: 77, session_name: '新会话' } }, 201),
      },
    ]);
    const result = await createConversation({ presetId: 5, projectId: 0, name: '  my conv  ' });
    expect(calls).toHaveLength(1);
    expect(calls[0].url.pathname).toBe('/api/agents/sessions/init/');
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body).toEqual({ preset_id: 5, project_id: 0, name: 'my conv', thinking_level: 'auto' });
    expect(result.conversationId).toBe(77);
    expect(result.sessionName).toBe('新会话');
    // No call to the stale conversations create target.
    expect(callsToPath(calls, '/conversations/').filter((c) => (c.init?.method ?? 'GET') === 'POST')).toHaveLength(0);
  });

  it('does not depend on the deprecated session_id alias', async () => {
    // P1A-B0: conversation_id is canonical; alias may exist but V4 must not read it.
    const { calls } = installFetch([
      {
        test: '/api/agents/sessions/init/',
        method: 'POST',
        handler: () =>
          jsonResponse({ msg: 'ok', data: { conversation_id: 7, session_name: 'x' } }, 201),
      },
    ]);
    const result = await createConversation({ presetId: 5, projectId: 0 });
    expect(result.conversationId).toBe(7);
    expect(calls).toHaveLength(1);
  });

  it('omits blank name and adds frozen ids only when provided', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/sessions/init/', method: 'POST', handler: () => jsonResponse({ msg: 'ok', data: { conversation_id: 1, session_name: 'x' } }, 201) },
    ]);
    await createConversation({ presetId: 3, projectId: 0, name: '   ' });
    let body = JSON.parse(String(calls[0].init?.body));
    expect(body).not.toHaveProperty('name');
    expect(body).not.toHaveProperty('frozen_project_ids');

    await createConversation({ presetId: 1, projectId: 10, frozenProjectIds: [20, 30] });
    body = JSON.parse(String(calls[1].init?.body));
    expect(body.frozen_project_ids).toEqual([20, 30]);
    expect(body.project_id).toBe(10);
    expect(body.thinking_level).toBe('auto');
  });

  it('throws CONTRACT error when canonical conversation_id is absent and never falls back to list inference', async () => {
    // Regression pin for the deleted name/max-id discovery path.
    const { calls } = installFetch([
      {
        test: '/api/agents/sessions/init/',
        method: 'POST',
        handler: () =>
          jsonResponse({ msg: 'ok', data: { session_name: 'probe-x' } }, 201),
      },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
    ]);
    await expect(createConversation({ presetId: 5, projectId: 0 })).rejects.toMatchObject({
      code: 'CONTRACT',
      ambiguousWrite: true,
    });
    // Exactly one write was attempted; no identity-inference list fetch happened.
    expect(calls).toHaveLength(1);
    expect(callsToPath(calls, '/conversations/')).toHaveLength(0);
  });

  it.each([
    ['missing', undefined],
    ['zero', 0],
    ['negative', -5],
    ['fractional', 3.5],
  ])('rejects %s canonical id as ambiguous-write CONTRACT (positive integer required)', async (_label, value) => {
    // C1A-R2-01: only a positive integer is an acceptable created identity.
    const body = { data: { conversation_id: value, session_name: 'x' } };
    if (value === undefined) delete (body.data as { conversation_id?: number }).conversation_id;
    installFetch([
      { test: '/api/agents/sessions/init/', method: 'POST', handler: () => jsonResponse({ msg: 'ok', ...body }, 201) },
    ]);
    await expect(createConversation({ presetId: 5, projectId: 0 })).rejects.toMatchObject({
      code: 'CONTRACT',
      ambiguousWrite: true,
    });
  });

  it('adds the CSRF header for POST', async () => {
    document.cookie = 'csrftoken=token-123; path=/';
    const { calls } = installFetch([
      { test: '/api/agents/sessions/init/', method: 'POST', handler: () => jsonResponse({ msg: 'ok', data: { conversation_id: 1, session_name: 'x' } }, 201) },
    ]);
    await createConversation({ presetId: 5, projectId: 0 });
    const headers = calls[0].init?.headers as Record<string, string> | undefined;
    expect(headers?.['X-CSRFToken']).toBe('token-123');
    document.cookie = 'csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });

  it('presets/projects hit their canonical paths', async () => {
    const { calls } = installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse([{ id: 5, name: 'Ecki', description: null, agent_type: 'standard', default_model: 'deepseek-v4-flash', system_prompt: null, is_visible: true }]) },
      { test: '/api/core/projects/', handler: () => jsonResponse([{ id: 10, name: 'A', description: null, prompt: null, work_dir: null, created_at: 'x' }]) },
    ]);
    const presets = await listVisiblePresets();
    const projects = await listProjects();
    expect(calls[0].url.pathname).toBe('/api/agents/presets/');
    expect(calls[1].url.pathname).toBe('/api/core/projects/');
    expect(presets[0].name).toBe('Ecki');
    expect(projects[0].name).toBe('A');
  });

  it('message page uses limit/offset params and normalizes rows', async () => {
    const page: MessagePageEnvelope = {
      messages: [
        { id: 11, role: 'assistant', content: 'hi', reasoning_content: null, platform: 'deepseek', model_version: 'v4', token_count: 10, index_in_session: 4, attachment_ids: [], attachments_meta: null, created_at: '2026-09-01T10:00:00Z' },
      ],
      total_count: 11,
      has_more: true,
    };
    const { calls } = installFetch([
      { test: /^\/api\/agents\/chat\/\d+\/$/, handler: () => jsonResponse(page) },
    ]);
    const result = await fetchMessagePage(42, 50, 50);
    expect(calls[0].url.searchParams.get('limit')).toBe('50');
    expect(calls[0].url.searchParams.get('offset')).toBe('50');
    expect(result.messages[0].modelVersion).toBe('v4');
    expect(result.hasMore).toBe(true);
    expect(result.totalCount).toBe(11);
    expect(result.offset).toBe(50);
  });
});

describe('envelope guards & error model', () => {
  it('throws CONTRACT error for malformed conversation list instead of empty success', async () => {
    installFetch([{ test: '/api/agents/conversations/', handler: () => jsonResponse({ messages: [] }) }]);
    await expect(listConversations()).rejects.toMatchObject({ code: 'CONTRACT' });
  });

  it('throws CONTRACT error when init envelope misses canonical conversation_id (alias presence does not satisfy)', async () => {
    installFetch([{ test: '/api/agents/sessions/init/', method: 'POST', handler: () => jsonResponse({ msg: 'x', data: { session_id: 1, session_name: 'y' } }, 201) }]);
    await expect(createConversation({ presetId: 5, projectId: 0 })).rejects.toMatchObject({ code: 'CONTRACT' });
  });

  it('throws CONTRACT error for malformed message envelope', async () => {
    installFetch([{ test: /^\/api\/agents\/chat\/\d+\/$/, handler: () => jsonResponse({ messages: 'nope' }) }]);
    await expect(fetchMessagePage(1, 0)).rejects.toMatchObject({ code: 'CONTRACT' });
  });

  it('maps HTTP 400 DRF field body into fieldErrors', async () => {
    installFetch([
      {
        test: '/api/agents/sessions/init/',
        method: 'POST',
        handler: () => jsonResponse({ preset_id: ['指定的预设ID不存在。'], non_field_errors: ['其他'] }, 400),
      },
    ]);
    try {
      await createConversation({ presetId: 999, projectId: 0 });
      throw new Error('should have thrown');
    } catch (cause) {
      const error = toAppApiError(cause);
      expect(error.status).toBe(400);
      expect(error.fieldErrors.preset_id).toBe('指定的预设ID不存在。');
      expect(error.code).toBe('ERROR');
    }
  });

  it('maps network TypeError to status-null UI-safe error', () => {
    const error = toAppApiError(new TypeError('Failed to fetch'));
    expect(error.status).toBeNull();
    expect(error.message).toContain('网络连接失败');
  });

  it('extractFieldErrors only picks string-first arrays and strings', () => {
    expect(extractFieldErrors({ preset_id: ['a'], project_id: 'b', weird: [1, 2] })).toEqual({
      preset_id: 'a',
      project_id: 'b',
    });
  });
});

describe('mergeMessagePages — paging invariant', () => {
  const msg = (id: number, indexInSession: number) => ({
    id,
    role: 'assistant' as const,
    content: `m${id}`,
    reasoningContent: null,
    platform: null,
    modelVersion: null,
    tokenCount: null,
    indexInSession,
    attachmentIds: [],
    attachmentsMeta: null,
    createdAt: '2026-09-01T10:00:00Z',
    clientTurnId: null,
  });

  it('merges newest-first pages into ascending unique rows', () => {
    const merged = mergeMessagePages([
      { messages: [msg(10, 9), msg(11, 10)], totalCount: 12, hasMore: true, offset: 0 },
      { messages: [msg(8, 7), msg(9, 8)], totalCount: 12, hasMore: false, offset: 2 },
    ]);
    expect(merged.rows.map((m) => m.id)).toEqual([8, 9, 10, 11]);
    expect(merged.hasOlder).toBe(false);
    expect(merged.totalCount).toBe(12);
  });

  it('deduplicates overlapping/refetched rows by id', () => {
    const merged = mergeMessagePages([
      { messages: [msg(5, 4), msg(6, 5)], totalCount: 6, hasMore: true, offset: 0 },
      { messages: [msg(4, 3), msg(5, 4)], totalCount: 6, hasMore: true, offset: 2 },
      { messages: [msg(3, 2), msg(4, 3)], totalCount: 6, hasMore: false, offset: 4 },
    ]);
    expect(merged.rows.map((m) => m.id)).toEqual([3, 4, 5, 6]);
    expect(merged.hasOlder).toBe(false);
  });

  it('hasOlder reflects the newest-page terminal state', () => {
    const merged = mergeMessagePages([{ messages: [msg(1, 0)], totalCount: 1, hasMore: false, offset: 0 }]);
    expect(merged.rows.map((m) => m.id)).toEqual([1]);
    expect(merged.hasOlder).toBe(false);
  });

  it('treats empty page list as empty', () => {
    const merged = mergeMessagePages([]);
    expect(merged.rows).toEqual([]);
    expect(merged.hasOlder).toBe(false);
    expect(merged.totalCount).toBe(0);
  });
});
