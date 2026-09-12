import { afterEach, describe, expect, it } from 'vitest';
import { fetchMessagePage, normalizeVoiceProjection } from '../features/chat/api';
import { installFetch, jsonResponse, unmockFetch } from './helpers';

afterEach(() => unmockFetch());

/** Full wire row so projection tests exercise the real read adapter. */
function messageRow(over: Record<string, unknown> = {}) {
  return {
    id: 7,
    role: 'assistant',
    content: '台词正文',
    reasoning_content: null,
    platform: null,
    model_version: null,
    token_count: null,
    index_in_session: 1,
    attachment_ids: [],
    attachments_meta: null,
    created_at: '2026-09-12T00:00:00Z',
    ...over,
  };
}

function respondWith(row: Record<string, unknown>) {
  installFetch([
    {
      test: '/api/agents/chat/5/',
      handler: () =>
        jsonResponse({ messages: [row], total_count: 1, has_more: false }),
    },
  ]);
}

describe('P2T voice projection — normalizeVoiceProjection fail-closed rules', () => {
  it('keeps a valid boolean projection and ignores unknown extra keys', () => {
    const view = normalizeVoiceProjection({
      available: true,
      directed: false,
      cached: true,
      // Private authoring details must never survive into the UI model.
      emotion: 'whisper',
      target: 'last',
      segments: 3,
    });
    expect(view).toEqual({ available: true, directed: false, cached: true });
    expect(Object.keys(view as object).sort()).toEqual(['available', 'cached', 'directed']);
  });

  it('keeps a truthful unavailable projection (available=false is valid data)', () => {
    expect(normalizeVoiceProjection({ available: false, directed: false, cached: false })).toEqual({
      available: false,
      directed: false,
      cached: false,
    });
  });

  it.each([
    { label: 'null', value: null },
    { label: 'string', value: 'available' },
    { label: 'number', value: 1 },
    { label: 'array', value: [{ available: true, directed: false, cached: false }] },
    { label: 'missing directed', value: { available: true, cached: false } },
    { label: 'missing cached', value: { available: true, directed: false } },
    { label: 'missing available', value: { directed: false, cached: false } },
    { label: 'string boolean', value: { available: 'true', directed: false, cached: false } },
    { label: 'numeric boolean', value: { available: 1, directed: 0, cached: 0 } },
    { label: 'nested boolean', value: { available: { ok: true }, directed: false, cached: false } },
  ])('rejects malformed voice payload ($label) to null', ({ value }) => {
    expect(normalizeVoiceProjection(value)).toBeNull();
  });
});

describe('P2T voice projection — read adapter boundary', () => {
  it('projects a valid assistant voice row through fetchMessagePage', async () => {
    respondWith(messageRow({ voice: { available: true, directed: true, cached: false } }));
    const page = await fetchMessagePage(5, 0);
    expect(page.messages).toHaveLength(1);
    expect(page.messages[0].voice).toEqual({ available: true, directed: true, cached: false });
  });

  it('keeps voice null for an assistant row without the field (legacy payload)', async () => {
    respondWith(messageRow());
    const page = await fetchMessagePage(5, 0);
    expect(page.messages[0].voice).toBeNull();
  });

  it('drops malformed assistant voice without altering canonical content', async () => {
    respondWith(
      messageRow({ content: '纯净正文', voice: { available: 'yes', directed: null, cached: 3 } }),
    );
    const page = await fetchMessagePage(5, 0);
    expect(page.messages[0].voice).toBeNull();
    expect(page.messages[0].content).toBe('纯净正文');
    expect(page.messages[0].role).toBe('assistant');
  });

  it('never projects voice onto user or system rows', async () => {
    installFetch([
      {
        test: '/api/agents/chat/5/',
        handler: () =>
          jsonResponse({
            messages: [
              messageRow({ id: 1, role: 'user', content: '你好', voice: { available: true, directed: true, cached: true } }),
              messageRow({ id: 2, role: 'system', content: 'sys', voice: { available: false, directed: false, cached: false } }),
              messageRow({ id: 3, voice: null }),
            ],
            total_count: 3,
            has_more: false,
          }),
      },
    ]);
    const page = await fetchMessagePage(5, 0);
    expect(page.messages.map((m) => m.voice)).toEqual([null, null, null]);
    expect(page.messages.map((m) => m.content)).toEqual(['你好', 'sys', '台词正文']);
  });

  it('isolates one malformed voice row from its neighbours in the same page', async () => {
    installFetch([
      {
        test: '/api/agents/chat/5/',
        handler: () =>
          jsonResponse({
            messages: [
              messageRow({ id: 1, content: '第一条', voice: { available: true, directed: false, cached: true } }),
              messageRow({ id: 2, content: '第二条', voice: 'garbage' }),
              messageRow({ id: 3, content: '第三条', voice: { available: false, directed: false, cached: false } }),
            ],
            total_count: 3,
            has_more: false,
          }),
      },
    ]);
    const page = await fetchMessagePage(5, 0);
    expect(page.messages[0].voice).toEqual({ available: true, directed: false, cached: true });
    expect(page.messages[1].voice).toBeNull();
    expect(page.messages[1].content).toBe('第二条');
    expect(page.messages[2].voice).toEqual({ available: false, directed: false, cached: false });
  });
});
