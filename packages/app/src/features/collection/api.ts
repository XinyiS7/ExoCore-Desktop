import { apiFetch } from 'exo-shared/api';
import { AppApiError, contractError, toAppApiError } from '../chat/api';
import type { CollectMessageInput, CollectMessagePayload, CollectMessageResult, CollectOutcome } from './types';

/**
 * Domain error for Collection API interactions, preserving backend error message and code.
 */
export class CollectionApiError extends AppApiError {
  constructor(cause: AppApiError) {
    const body = cause.body;
    const fields =
      typeof body === 'object' && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const message =
      typeof fields.error === 'string'
        ? fields.error
        : typeof fields.message === 'string'
          ? fields.message
          : cause.message;
    const code = typeof fields.code === 'string' ? fields.code : cause.code;
    super(message, {
      status: cause.status,
      body,
      code,
    });
  }
}

/**
 * Collect a message by creating a new collection item (201 created) or incrementing
 * the collect count on an existing collection item (200 already_collected).
 *
 * Contract requirements (Issue #32 Step 1B):
 * - Endpoint: POST /api/collection/items/ (strictly preserve trailing slash)
 * - Source text: canonical MessageView.content verbatim (NEVER trim or rewrite)
 * - Note: optional collection_context (sent if non-empty)
 */
export async function collectMessage(input: CollectMessageInput): Promise<CollectMessageResult> {
  const payload: CollectMessagePayload = {
    source: {
      type: 'message',
      message_id: input.messageId,
      text: input.content,
    },
  };

  const trimmedContext = input.context?.trim();
  if (trimmedContext) {
    payload.collection_context = trimmedContext;
  }

  try {
    const res = await apiFetch('/api/collection/items/', {
      method: 'POST',
      body: payload,
    });

    if (typeof res !== 'object' || res === null || Array.isArray(res)) {
      throw contractError('收藏响应格式异常', res);
    }

    const row = res as Record<string, unknown>;
    const outcome = row.collect_outcome;
    if (outcome !== 'created' && outcome !== 'already_collected') {
      throw contractError('收藏响应缺少合法的 collect_outcome', res);
    }

    if (!Number.isInteger(row.id)) {
      throw contractError('收藏响应缺少合法的整数 id', res);
    }
    return {
      id: row.id as number,
      collectOutcome: outcome as CollectOutcome,
    };
  } catch (err: unknown) {
    const appError = toAppApiError(err);
    throw new CollectionApiError(appError);
  }
}
