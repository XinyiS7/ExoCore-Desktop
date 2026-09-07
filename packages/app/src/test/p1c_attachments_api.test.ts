import { afterEach, describe, expect, it } from 'vitest';
import { installFetch, jsonResponse, unmockFetch } from './helpers';
import {
  deleteConversationAttachment,
  listConversationAttachments,
  uploadAttachments,
} from '../features/chat/attachments/api';

const ROUTE = (id = 42) => `/api/agents/conversations/${id}/attachments/`;

const fileOf = (name: string, type = 'image/png') =>
  new File(['x'.repeat(16)], name, { type });

// Expose FormData body for assertions.
function formDataOf(init?: RequestInit): FormData {
  const body = init?.body as FormData;
  expect(body).toBeInstanceOf(FormData);
  return body;
}

afterEach(() => unmockFetch());

describe('P1C attachment wire — upload (Task 1, Gate B)', () => {
  const resultsBody = (over: unknown) => ({
    attachments: [{ id: 11, display_name: 'a.png', original_filename: 'a.png', mime_type: 'image/png', file_size: 16 }],
    failures: [],
    results: [
      { input_index: 0, status: 'ok', attachment: { id: 11, display_name: 'a.png', original_filename: 'a.png', mime_type: 'image/png', file_size: 16 }, diagnostics: [] },
    ],
    ...(over ?? {}),
  });

  it('POSTs one multipart request with files + CSRF and keeps a 201 body whole', async () => {
    const { calls } = installFetch([
      { test: ROUTE(), method: 'POST', handler: () => jsonResponse(resultsBody(null), 201) },
    ]);
    const outcome = await uploadAttachments(42, [fileOf('a.png')], null);
    expect(outcome.status).toBe(201);
    expect(outcome.payload.results?.[0].status).toBe('ok');
    expect(calls).toHaveLength(1);
    expect(calls[0].url.pathname).toBe(ROUTE());
    expect(calls[0].init?.method).toBe('POST');
    expect(calls[0].init?.credentials).toBe('include');
    expect((calls[0].init?.headers as Record<string, string>)?.['X-CSRFToken']).toBeDefined();
    const fd = formDataOf(calls[0].init);
    expect(fd.get('files') instanceof File).toBe(true);
    expect(fd.get('model')).toBeNull(); // no audio target → no model/endpoint fields
    expect(fd.get('endpoint')).toBeNull();
  });

  it('sends model + endpoint fields when an audio target is provided', async () => {
    const { calls } = installFetch([
      { test: ROUTE(), method: 'POST', handler: () => jsonResponse(resultsBody(null), 201) },
    ]);
    await uploadAttachments(42, [fileOf('v.webm', 'audio/webm')], { model: 'gemini-2.5-flash', endpoint: 2 });
    const fd = formDataOf(calls[0].init);
    expect(fd.get('model')).toBe('gemini-2.5-flash');
    expect(fd.get('endpoint')).toBe('2');
  });

  it('preserves a 422 all-failed body with ordered results', async () => {
    const body = {
      attachments: [],
      failures: [{ input_index: 0, display_name: 'a.png', mime_type: 'image/png', stage: 'preflight', code: 'audio_mime_unsupported', message: 'audio MIME not allowed', reason: 'audio MIME not allowed', diagnostics: [{ stage: 'preflight', code: 'audio_mime_unsupported', level: 'error', message: 'audio MIME not allowed' }] }],
      results: [{ input_index: 0, status: 'failed', attachment: null, diagnostics: [{ stage: 'preflight', code: 'audio_mime_unsupported', level: 'error', message: 'audio MIME not allowed' }] }],
      error: 'all attachments failed',
    };
    installFetch([{ test: ROUTE(), method: 'POST', handler: () => jsonResponse(body, 422) }]);
    const outcome = await uploadAttachments(42, [fileOf('a.webm', 'audio/webm')], { model: 'm', endpoint: 1 });
    expect(outcome.status).toBe(422);
    expect(outcome.payload.results?.[0].status).toBe('failed');
    expect(outcome.payload.error).toBe('all attachments failed');
  });

  it('throws AppApiError for non-201/422 statuses (never a manufactured success)', async () => {
    installFetch([{ test: ROUTE(), method: 'POST', handler: () => jsonResponse({ error: '会话不存在' }, 404) }]);
    await expect(uploadAttachments(42, [fileOf('a.png')], null)).rejects.toMatchObject({
      status: 404,
      code: 'UPLOAD_ERROR',
    });
  });

  it('rejects empty file lists and invalid conversation ids before any request', async () => {
    const { calls } = installFetch([{ test: ROUTE(), method: 'POST', handler: () => jsonResponse({}, 201) }]);
    await expect(uploadAttachments(0, [fileOf('a.png')], null)).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(uploadAttachments(42, [], null)).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(calls).toHaveLength(0);
  });

  it('aborts the upload when the signal fires', async () => {
    const controller = new AbortController();
    let capturedSignal: AbortSignal | null = null;
    installFetch([
      {
        test: ROUTE(),
        method: 'POST',
        handler: (_url, init) => {
          capturedSignal = init?.signal ?? null;
          return new Promise<Response>((_resolve, reject) => {
            capturedSignal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
          });
        },
      },
    ]);
    const pending = uploadAttachments(42, [fileOf('a.png')], null, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'ABORTED' });
  });
});

describe('P1C attachment wire — list (Task 1)', () => {
  it('returns the bare mixed-source array with user + tool_collection rows', async () => {
    const body = [
      { source: 'user', id: 11, display_name: 'a.png', original_filename: 'a.png', storage_path: '/srv/x/a.png', mime_type: 'image/png', file_size: 16, created_at: '2026-09-01T10:00:00Z' },
      { source: 'tool_collection', id: 'doc/x.md', display_name: 'x.md', char_count: 10, is_summary: false, is_expired: false, created_at: null },
    ];
    installFetch([{ test: ROUTE(), handler: () => jsonResponse(body) }]);
    const rows = await listConversationAttachments(42);
    expect(rows).toHaveLength(2);
    expect(rows[0].source).toBe('user');
    expect(rows[1].source).toBe('tool_collection');
    expect(rows[1].id).toBe('doc/x.md');
  });

  it('rejects a non-array body as a contract error', async () => {
    installFetch([{ test: ROUTE(), handler: () => jsonResponse({ error: 'x' }) }]);
    await expect(listConversationAttachments(42)).rejects.toMatchObject({ code: 'CONTRACT' });
  });
});

describe('P1C attachment wire — single delete (Task 2.5, Gate H)', () => {
  const DELETE_ROUTE = '/api/agents/conversations/42/attachments/delete/';

  it('uses the exact trailing /delete/ route with one {source,id} body and maps 204', async () => {
    const { calls } = installFetch([
      { test: DELETE_ROUTE, method: 'DELETE', handler: () => new Response(null, { status: 204 }) },
    ]);
    const outcome = await deleteConversationAttachment(42, { source: 'user', id: 11 });
    expect(outcome).toEqual({ ok: true, status: 204 });
    expect(calls[0].url.pathname).toBe(DELETE_ROUTE);
    const body = JSON.parse(String(calls[0].init?.body)) as { source: string; id: number };
    expect(body).toEqual({ source: 'user', id: 11 });
  });

  it('preserves the full 409 frozen-in-cache body', async () => {
    const frozen = {
      error: '此附件已冻结在远端缓存中，无法删除。',
      detail: '请先清除缓存后再删除附件，或重新发送消息（🧊 缓存发送）触发缓存重建。',
      frozen_in_cache: true,
      cache_name: 'conv-42-snap',
    };
    installFetch([{ test: DELETE_ROUTE, method: 'DELETE', handler: () => jsonResponse(frozen, 409) }]);
    const outcome = await deleteConversationAttachment(42, { source: 'user', id: 11 });
    expect(outcome.ok).toBe(false);
    expect(outcome.status).toBe(409);
    if (!outcome.ok && outcome.status === 409 && outcome.frozen) {
      expect(outcome.body.detail).toContain('缓存');
      expect(outcome.body.cache_name).toBe('conv-42-snap');
      expect(outcome.message).toContain('缓存');
    }
  });

  it('keeps 400/404/network failures visible without pretending success', async () => {
    installFetch([
      { test: DELETE_ROUTE, method: 'DELETE', handler: () => jsonResponse({ error: '附件不存在' }, 404) },
    ]);
    const outcome = await deleteConversationAttachment(42, { source: 'user', id: 999 });
    if (outcome.ok === false) {
      expect(outcome.status).toBe(404);
      expect(outcome.frozen).toBe(false);
      expect(outcome.message).toBe('附件不存在');
    } else {
      throw new Error('expected a failed delete outcome');
    }
  });

  it('rejects invalid source/id before any request', async () => {
    const { calls } = installFetch([{ test: DELETE_ROUTE, method: 'DELETE', handler: () => new Response(null, { status: 204 }) }]);
    await expect(deleteConversationAttachment(42, { source: 'bad' as never, id: 1 })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(deleteConversationAttachment(42, { source: 'user', id: '' })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(calls).toHaveLength(0);
  });
});