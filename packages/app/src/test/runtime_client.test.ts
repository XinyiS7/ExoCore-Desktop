import { afterEach, describe, expect, it } from 'vitest';
import {
  classifyRuntimeError,
  fetchChatSSEStream,
  pollChatStatus,
  postChatAsync,
  postChatStop,
  postConversationBranch,
} from '../features/chat/runtime/client';
import { installFetch, jsonResponse, unmockFetch } from './helpers';

afterEach(() => unmockFetch());

describe('P1B Runtime Client & Error Classification (§5, §6.6)', () => {
  describe('classifyRuntimeError', () => {
    it('classifies synchronous 4xx errors as safe retryable', () => {
      const err = { status: 400, message: '内容不能为空' };
      const classified = classifyRuntimeError(err);
      expect(classified.retryClass).toBe('safe');
    });

    it('classifies network error or TypeError as uncertain', () => {
      const classified = classifyRuntimeError(new TypeError('Failed to fetch'), 'uncertain');
      expect(classified.code).toBe('NETWORK_ERROR');
      expect(classified.retryClass).toBe('uncertain');
    });

    it('classifies abort error as safe', () => {
      const abortErr = new Error('The user aborted a request.');
      abortErr.name = 'AbortError';
      const classified = classifyRuntimeError(abortErr);
      expect(classified.code).toBe('ABORTED');
      expect(classified.retryClass).toBe('safe');
    });
  });

  describe('fetchChatSSEStream', () => {
    it('returns response with readable stream on successful SSE response', async () => {
      installFetch([
        {
          test: /^\/api\/agents\/chat\/10\/$/,
          handler: () =>
            new Response('event: done\ndata: [DONE]\n\n', {
              status: 200,
              headers: { 'Content-Type': 'text/event-stream' },
            }),
        },
      ]);

      const res = await fetchChatSSEStream({ conversationId: 10, content: 'test stream' });
      expect(res.ok).toBe(true);
      expect(res.body).toBeTruthy();
    });

    it('rejects if server returns non-event-stream content type', async () => {
      installFetch([
        {
          test: /^\/api\/agents\/chat\/10\/$/,
          handler: () => jsonResponse({ message: 'plain json' }),
        },
      ]);

      await expect(
        fetchChatSSEStream({ conversationId: 10, content: 'test' }),
      ).rejects.toThrow('非流式响应类型');
    });
  });

  describe('postChatAsync', () => {
    it('returns opaque 8-character token upon success', async () => {
      installFetch([
        {
          test: /^\/api\/agents\/chat\/10\/$/,
          handler: () => jsonResponse({ message_id: 'a1b2c3d4', status: 'processing' }),
        },
      ]);

      const res = await postChatAsync({ conversationId: 10, content: 'test turn' });
      expect(res.message_id).toBe('a1b2c3d4');
      expect(res.status).toBe('processing');
    });

    it('throws ambiguousWrite error if 200 response lacks message_id', async () => {
      installFetch([
        {
          test: /^\/api\/agents\/chat\/10\/$/,
          handler: () => jsonResponse({ status: 'processing' }), // missing message_id
        },
      ]);

      await expect(
        postChatAsync({ conversationId: 10, content: 'test turn' }),
      ).rejects.toThrow('未返回有效的恢复凭据');
    });
  });

  describe('pollChatStatus', () => {
    it('returns status, monotonic cursor, and events', async () => {
      installFetch([
        {
          test: /^\/api\/agents\/chat\/10\/status\//,
          handler: () =>
            jsonResponse({
              status: 'processing',
              events: [{ event_type: 'content', delta: 'chunk text' }],
              cursor: 1, // requested 0 + 1 returned event (event-count advance)
              error_message: null,
            }),
        },
      ]);

      const res = await pollChatStatus(10, 'a1b2c3d4', 0);
      expect(res.status).toBe('processing');
      expect(res.cursor).toBe(1);
      expect(res.events).toHaveLength(1);
    });

    it('rejects an unknown status as CONTRACT', async () => {
      installFetch([
        {
          test: /^\/api\/agents\/chat\/10\/status\//,
          handler: () =>
            jsonResponse({ status: 'lunchtime', events: [], cursor: 0, error_message: null }),
        },
      ]);
      await expect(pollChatStatus(10, 'tok', 0)).rejects.toThrow('未知的轮询状态');
    });

    it('rejects a negative cursor as CONTRACT', async () => {
      installFetch([
        {
          test: /^\/api\/agents\/chat\/10\/status\//,
          handler: () =>
            jsonResponse({ status: 'processing', events: [], cursor: -1, error_message: null }),
        },
      ]);
      await expect(pollChatStatus(10, 'tok', 0)).rejects.toThrow('非负整数');
    });

    it('rejects a regressing cursor (below the requested one) as CONTRACT', async () => {
      installFetch([
        {
          test: /^\/api\/agents\/chat\/10\/status\//,
          handler: () =>
            jsonResponse({ status: 'processing', events: [], cursor: 3, error_message: null }),
        },
      ]);
      await expect(pollChatStatus(10, 'tok', 5)).rejects.toThrow('cursor 出现回退');
    });

    it('rejects an event item missing delta as CONTRACT', async () => {
      installFetch([
        {
          test: /^\/api\/agents\/chat\/10\/status\//,
          handler: () =>
            jsonResponse({ status: 'processing', events: [{ event_type: 'content' }], cursor: 1, error_message: null }),
        },
      ]);
      await expect(pollChatStatus(10, 'tok', 0)).rejects.toThrow('缺少 delta');
    });

    it('rejects a nonempty event list whose cursor did not advance by its count', async () => {
      installFetch([
        {
          test: /^\/api\/agents\/chat\/10\/status\//,
          handler: () =>
            jsonResponse({
              status: 'processing',
              events: [{ event_type: 'content', delta: 'x' }],
              cursor: 1, // requested 0 + 1 event => expected 1 is fine
              error_message: null,
            }),
        },
        {
          test: /^\/api\/agents\/chat\/11\/status\//,
          handler: () =>
            jsonResponse({
              status: 'processing',
              events: [{ event_type: 'content', delta: 'x' }, { event_type: 'content', delta: 'y' }],
              cursor: 3, // expected 2 (0 + 2) — advanced too far
              error_message: null,
            }),
        },
      ]);
      await expect(pollChatStatus(10, 'tok', 0)).resolves.toBeTruthy();
      await expect(pollChatStatus(11, 'tok', 0)).rejects.toThrow('超前于事件数');
    });

    it('rejects a non-object/string error_message type as CONTRACT', async () => {
      installFetch([
        {
          test: /^\/api\/agents\/chat\/10\/status\//,
          handler: () =>
            jsonResponse({
              status: 'error',
              events: [],
              cursor: 0,
              error_message: ['not', 'allowed'],
            }),
        },
      ]);
      await expect(pollChatStatus(10, 'tok', 0)).rejects.toThrow('error_message 类型异常');
    });

    it('rejects an async ack whose status is not processing as an uncertain write', async () => {
      installFetch([
        {
          test: /^\/api\/agents\/chat\/10\/$/,
          method: 'POST',
          handler: () => jsonResponse({ message_id: 'abc12345', status: 'done' }, 200),
        },
      ]);
      await expect(postChatAsync({ conversationId: 10, content: 'x' })).rejects.toMatchObject({
        ambiguousWrite: true,
      });
    });

    it('never invents acceptance from a malformed stop 200 body', async () => {
      installFetch([
        {
          test: '/api/agents/chat/10/stop/',
          handler: () => new Response('<html>oops</html>', { status: 200 }),
        },
      ]);
      await expect(postChatStop(10)).rejects.toMatchObject({ ambiguousWrite: true });
    });

    it('preserves the backend machine code from HTTP error bodies', async () => {
      installFetch([
        {
          test: /^\/api\/agents\/chat\/10\/$/,
          method: 'POST',
          handler: () =>
            jsonResponse({ error: { code: 'rate_limited', message: '慢一点' } }, 429),
        },
      ]);
      let classified: ReturnType<typeof classifyRuntimeError> | null = null;
      try {
        await fetchChatSSEStream({ conversationId: 10, content: 'x' });
      } catch (e) {
        classified = classifyRuntimeError(e, 'uncertain');
      }
      expect(classified?.code).toBe('rate_limited');
      expect(classified?.status).toBe(429);
    });

    it('rejects an event item missing event_type as CONTRACT', async () => {
      installFetch([
        {
          test: /^\/api\/agents\/chat\/10\/status\//,
          handler: () =>
            jsonResponse({ status: 'processing', events: [{ delta: 'x' }], cursor: 1, error_message: null }),
        },
      ]);
      await expect(pollChatStatus(10, 'tok', 0)).rejects.toThrow('缺少 event_type');
    });

    it('retains typed backend error codes (stream_crashed) through classification', () => {
      const classified = classifyRuntimeError({ code: 'stream_crashed', message: 'generator path failed' }, 'terminal_persisted');
      expect(classified.code).toBe('stream_crashed');
      expect(classified.message).toBe('generator path failed');
      expect(classified.retryClass).toBe('terminal_persisted');
    });
  });

  describe('postChatStop', () => {
    it('handles 200 stop_requested cleanly', async () => {
      installFetch([
        {
          test: '/api/agents/chat/10/stop/',
          handler: () => jsonResponse({ status: 'stop_requested' }),
        },
      ]);

      const res = await postChatStop(10);
      expect(res.ok).toBe(true);
      expect(res.status).toBe('stop_requested');
    });

    it('handles 404 terminal race as honest not_found without throwing', async () => {
      installFetch([
        {
          test: '/api/agents/chat/10/stop/',
          handler: () => new Response(JSON.stringify({ error: 'no active generation' }), { status: 404 }),
        },
      ]);

      const res = await postChatStop(10);
      expect(res.ok).toBe(false);
      expect(res.status).toBe('not_found');
    });
  });

  describe('postConversationBranch', () => {
    it('validates canonical positive conversation_id and never consumes session_id alias', async () => {
      installFetch([
        {
          test: '/api/agents/conversations/10/branch/',
          handler: () =>
            jsonResponse(
              { conversation_id: 88, session_id: 88, name: 'Branch from 10' },
              201,
            ),
        },
      ]);

      const res = await postConversationBranch({ conversationId: 10, branchFromMessageId: 101 });
      expect(res.conversationId).toBe(88);
      expect(res.name).toBe('Branch from 10');
    });

    it('locks repeated submission if 2xx response contains malformed or non-positive conversation_id', async () => {
      installFetch([
        {
          test: '/api/agents/conversations/10/branch/',
          handler: () => jsonResponse({ session_id: 88 }, 201), // missing conversation_id!
        },
      ]);

      await expect(
        postConversationBranch({ conversationId: 10, branchFromMessageId: 101 }),
      ).rejects.toThrow('缺少有效的会话编号');
    });
  });
});
