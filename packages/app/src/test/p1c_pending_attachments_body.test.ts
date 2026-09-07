import { afterEach, describe, expect, it } from 'vitest';
import { fetchChatSSEStream, postChatAsync } from '../features/chat/runtime/client';
import { installFetch, jsonResponse, unmockFetch } from './helpers';

afterEach(() => unmockFetch());

describe('P1C chat body — pending_attachments serialization (Task 1.5, Gate D)', () => {
  it('emits pending_attachments only after integer/positive validation (SSE)', async () => {
    const { calls } = installFetch([
      {
        test: '/api/agents/chat/42/',
        method: 'POST',
        handler: () =>
          new Response('data: {"event":"done"}\n\n', {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }),
      },
    ]);
    await fetchChatSSEStream({ conversationId: 42, content: 'text', pendingAttachments: [11, 22] });
    const body = JSON.parse(String(calls[0].init?.body)) as Record<string, unknown>;
    expect(body.pending_attachments).toEqual([11, 22]);
    expect(body.content).toBe('text');
  });

  it('rejects non-integer or non-positive ids with VALIDATION before dispatch (SSE)', async () => {
    const { calls } = installFetch([
      {
        test: '/api/agents/chat/42/',
        method: 'POST',
        handler: () =>
          new Response('data: {"event":"done"}\n\n', {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }),
      },
    ]);
    await expect(
      fetchChatSSEStream({ conversationId: 42, content: 'x', pendingAttachments: [0] }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(
      fetchChatSSEStream({ conversationId: 42, content: 'x', pendingAttachments: [1.5] }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(
      fetchChatSSEStream({ conversationId: 42, content: 'x', pendingAttachments: [Number.NaN] }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(calls).toHaveLength(0);
  });

  it('omits the field entirely for text-only sends (no C1B regression)', async () => {
    const { calls } = installFetch([
      {
        test: '/api/agents/chat/42/', // pathname match; query ?mode=async is separate
        method: 'POST',
        handler: () =>
          jsonResponse({ message_id: 'abcd1234', status: 'processing' }),
      },
    ]);
    await postChatAsync({ conversationId: 42, content: 'plain text' });
    const body = JSON.parse(String(calls[0].init?.body)) as Record<string, unknown>;
    expect('pending_attachments' in body).toBe(false);
  });

  it('carries an empty-text body with attachments (backend allows legal empty content)', async () => {
    const { calls } = installFetch([
      {
        test: '/api/agents/chat/42/',
        method: 'POST',
        handler: () =>
          new Response('data: {"event":"done"}\n\n', {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }),
      },
    ]);
    await fetchChatSSEStream({ conversationId: 42, content: '', pendingAttachments: [7] });
    const body = JSON.parse(String(calls[0].init?.body)) as Record<string, unknown>;
    expect(body.content).toBe('');
    expect(body.pending_attachments).toEqual([7]);
  });
});