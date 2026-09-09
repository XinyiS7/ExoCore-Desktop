import { afterEach, describe, expect, it } from 'vitest';
import { patchConversationThinkingLevel } from '../features/chat/control/api';
import { AppApiError } from '../features/chat/api';
import { installFetch, jsonResponse, unmockFetch } from './helpers';

describe('P1D thinking PATCH adapter (Plan Task 1 / §6.3)', () => {
  afterEach(() => unmockFetch());

  it('confirms a valid PATCH echo with matching conversation id', async () => {
    installFetch([
      {
        test: '/api/agents/conversations/7/',
        method: 'PATCH',
        handler: () => jsonResponse({ id: 7, thinking_level: 'high' }),
      },
    ]);
    await expect(patchConversationThinkingLevel(7, 'high')).resolves.toEqual({
      confirmedLevel: 'high',
    });
  });

  it('rejects non-enum levels before any network call', async () => {
    await expect(patchConversationThinkingLevel(7, 'ultra' as never)).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });

  it('surfaces a definite 4xx rejection with the backend message', async () => {
    installFetch([
      {
        test: '/api/agents/conversations/7/',
        method: 'PATCH',
        handler: () => jsonResponse({ non_field_errors: ['invalid thinking_level'] }, 400),
      },
    ]);
    const err = await patchConversationThinkingLevel(7, 'max').then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(AppApiError);
    expect((err as AppApiError).status).toBe(400);
    expect((err as AppApiError).fieldErrors.non_field_errors).toBe('invalid thinking_level');
    expect((err as AppApiError).code).not.toBe('CONTRACT');
  });

  it('marks a malformed 2xx as an unknown save (ambiguousWrite)', async () => {
    installFetch([
      {
        test: '/api/agents/conversations/7/',
        method: 'PATCH',
        handler: () => jsonResponse({ id: 999, thinking_level: 'high' }),
      },
    ]);
    await expect(patchConversationThinkingLevel(7, 'high')).rejects.toMatchObject({
      ambiguousWrite: true,
      code: 'CONTRACT',
    });
  });

  it('marks a network failure as an unknown save outcome', async () => {
    installFetch([], () => {
      throw new TypeError('Failed to fetch');
    });
    const err = await patchConversationThinkingLevel(7, 'auto').then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(AppApiError);
    expect((err as AppApiError).code).toBe('UNKNOWN_SAVE');
    expect((err as AppApiError).status).toBeNull();
  });

  it('accepts the backend-confirmed level even when normalized differently', async () => {
    installFetch([
      {
        test: '/api/agents/conversations/7/',
        method: 'PATCH',
        handler: () => jsonResponse({ id: 7, thinking_level: 'low' }),
      },
    ]);
    // Backend may normalize/echo a validated enum; the adapter confirms the
    // response, not a text-equality contract.
    await expect(patchConversationThinkingLevel(7, 'max')).resolves.toEqual({
      confirmedLevel: 'low',
    });
  });
});