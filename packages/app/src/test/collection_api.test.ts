import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectMessage, CollectionApiError } from '../features/collection/api';
import { installFetch, jsonResponse } from './helpers';

describe('V4 Collection API adapter (Issue #32 Step 1B)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('posts to /api/collection/items/ preserving trailing slash and canonical content verbatim', async () => {
    const rawContent = '  First line with leading space\n\nSecond line with trailing space   ';
    let capturedBody: any = null;

    const { calls } = installFetch([
      {
        test: '/api/collection/items/',
        method: 'POST',
        handler: async (_url, init) => {
          capturedBody = JSON.parse(String(init?.body));
          return jsonResponse(
            {
              id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
              collect_outcome: 'created',
              source: { type: 'message', key: '101' },
            },
            201,
          );
        },
      },
    ]);

    const result = await collectMessage({
      messageId: 101,
      content: rawContent,
      context: '  my note for alicia  ',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url.pathname).toBe('/api/collection/items/');
    expect(calls[0].init?.method).toBe('POST');

    // Strict verifications: canonical content MUST NOT be trimmed or rewritten
    expect(capturedBody).toEqual({
      source: {
        type: 'message',
        message_id: 101,
        text: rawContent,
      },
      collection_context: 'my note for alicia',
    });

    expect(result).toEqual({
      id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      collectOutcome: 'created',
    });
  });

  it('omits collection_context when note is absent or empty whitespace', async () => {
    let capturedBody: any = null;

    installFetch([
      {
        test: '/api/collection/items/',
        method: 'POST',
        handler: async (_url, init) => {
          capturedBody = JSON.parse(String(init?.body));
          return jsonResponse({
            id: 'item-uuid-1',
            collect_outcome: 'created',
          }, 201);
        },
      },
    ]);

    await collectMessage({
      messageId: 202,
      content: 'hello world',
      context: '   ',
    });

    expect(capturedBody).toEqual({
      source: {
        type: 'message',
        message_id: 202,
        text: 'hello world',
      },
    });
    expect(capturedBody.collection_context).toBeUndefined();
  });

  it('returns already_collected outcome on repeat collect (HTTP 200)', async () => {
    installFetch([
      {
        test: '/api/collection/items/',
        method: 'POST',
        handler: async () => {
          return jsonResponse({
            id: 'item-uuid-existing',
            collect_outcome: 'already_collected',
          }, 200);
        },
      },
    ]);

    const result = await collectMessage({
      messageId: 303,
      content: 'existing content',
      context: 'second comment',
    });

    expect(result).toEqual({
      id: 'item-uuid-existing',
      collectOutcome: 'already_collected',
    });
  });

  it('normalizes backend error and code on failure', async () => {
    installFetch([
      {
        test: '/api/collection/items/',
        method: 'POST',
        handler: async () => {
          return jsonResponse(
            { error: 'Source text does not match message', code: 'source_mismatch' },
            400,
          );
        },
      },
    ]);

    await expect(
      collectMessage({
        messageId: 404,
        content: 'mismatched content',
      }),
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(CollectionApiError);
      const apiErr = err as CollectionApiError;
      expect(apiErr.message).toBe('Source text does not match message');
      expect(apiErr.code).toBe('source_mismatch');
      expect(apiErr.status).toBe(400);
      return true;
    });
  });

  it('fails closed when backend returns a malformed envelope without collect_outcome', async () => {
    installFetch([
      {
        test: '/api/collection/items/',
        method: 'POST',
        handler: async () => {
          return jsonResponse({ id: 'item-1', outcome: 'unknown' }, 200);
        },
      },
    ]);

    await expect(
      collectMessage({
        messageId: 505,
        content: 'some text',
      }),
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(CollectionApiError);
      const apiErr = err as CollectionApiError;
      expect(apiErr.message).toContain('collect_outcome');
      return true;
    });
  });
});
