/**
 * P2T message-voice transport adapters (B5 wire contract, Plan D2/D3/D10).
 *
 * - One action pair: POST starts or joins a Message's lazy render, GET only
 *   observes the current state (never triggers generation).
 * - The request carries Message identity only — body is exactly `{}`, never
 *   text, emotion, profile, seed or a client cache key.
 * - Outcomes are truthful data (`TtsOutcome`), not thrown errors. Only an
 *   abort propagates: cancellation is control flow owned by the caller's
 *   route/mount epoch and must never be painted as a message state.
 * - HTTP status is the primary discriminator because B5 error bodies use
 *   `error` for 404/422 and `code` for `failed_retryable`. `machineCodeOf`
 *   is deliberately NOT reused (it ignores the string `error` key).
 * - A `generating` body must carry a positive finite `retry_after_ms`; when
 *   the required timing is malformed the 2xx fails closed as `contract`
 *   (D3) — the client never invents an observation schedule.
 */
import { apiFetch } from 'exo-shared/api';
import { toAppApiError } from '../api';
import type { TtsErrorCode, TtsOutcome } from './types';

/** POST and GET share one Message-scoped status resource. */
const ttsPath = (conversationId: number, messageId: number) =>
  `/api/agents/conversations/${conversationId}/messages/${messageId}/tts/`;

/** The bounded taxonomy this adapter is allowed to surface. */
const TTS_ERROR_CODES: ReadonlySet<string> = new Set([
  'not_found',
  'ineligible_message',
  'no_active_profile',
  'runtime_offline',
  'generation_timeout',
  'generation_failed',
  'audio_artifact_missing',
  'contract',
  'network',
]);

function isAbortError(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    (cause as { name?: unknown }).name === 'AbortError'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Bounded code from an error body: `code` first, then the string `error`. */
function codeFromBody(body: unknown): TtsErrorCode | null {
  if (!isRecord(body)) return null;
  for (const candidate of [body.code, body.error]) {
    if (typeof candidate === 'string' && TTS_ERROR_CODES.has(candidate)) {
      return candidate as TtsErrorCode;
    }
  }
  return null;
}

/** Backend whitelist copy, never parsed to choose state. */
function messageOf(body: unknown): string | null {
  if (!isRecord(body)) return null;
  const message = body.message;
  return typeof message === 'string' && message.trim() !== '' ? message : null;
}

/** Advisory duration metadata: anything but a finite nonnegative number → null. */
function durationOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Required generating timing: only a positive finite number is valid backend
 * truth. Unlike advisory `duration_ms`, a malformed value is a contract
 * failure (`null`), never a client-side polling default (D3, T3).
 */
function retryAfterOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function retryable(code: TtsErrorCode, message: string | null): TtsOutcome {
  return { phase: 'failed_retryable', code, message };
}

/** A malformed 2xx is never silently treated as success (D3). */
function contractFailure(): TtsOutcome {
  return retryable('contract', null);
}

function outcomeFromHttpError(status: number, body: unknown): TtsOutcome {
  const explicit = codeFromBody(body);
  if (status === 404) return { phase: 'unavailable', code: explicit ?? 'not_found' };
  if (status === 422) return { phase: 'unavailable', code: explicit ?? 'contract' };
  if (status === 503) return retryable(explicit ?? 'runtime_offline', messageOf(body));
  if (status === 504) return retryable(explicit ?? 'generation_timeout', messageOf(body));
  if (status >= 500) return retryable(explicit ?? 'generation_failed', messageOf(body));
  // Unexpected non-2xx (no invented permission state — Plan §3.1).
  return retryable(explicit ?? 'contract', messageOf(body));
}

function outcomeFromSuccessBody(body: unknown): TtsOutcome {
  if (!isRecord(body)) return contractFailure();
  switch (body.status) {
    case 'playable': {
      const contentUrl = body.content_url;
      // No fabricated resource identity: without a backend URL there is
      // nothing to play, so this is a failure — never a fake playable state.
      if (typeof contentUrl !== 'string' || contentUrl.trim() === '') return contractFailure();
      return {
        phase: 'playable',
        playable: { contentUrl: contentUrl.trim(), durationMs: durationOf(body.duration_ms) },
      };
    }
    case 'idle':
      return { phase: 'idle' };
    case 'generating': {
      const retryAfterMs = retryAfterOf(body.retry_after_ms);
      return retryAfterMs === null
        ? contractFailure()
        : { phase: 'generating', retryAfterMs };
    }
    case 'failed_retryable':
      return retryable(codeFromBody(body) ?? 'generation_failed', messageOf(body));
    default:
      return contractFailure();
  }
}

async function requestTts(
  path: string,
  method: 'GET' | 'POST',
  signal?: AbortSignal,
): Promise<TtsOutcome> {
  let raw: unknown;
  try {
    raw =
      method === 'POST'
        ? await apiFetch(path, { method: 'POST', body: {}, signal })
        : await apiFetch(path, { signal });
  } catch (cause) {
    if (isAbortError(cause)) throw cause;
    const err = toAppApiError(cause);
    if (err.status === null) return retryable('network', err.message);
    return outcomeFromHttpError(err.status, err.body);
  }
  return outcomeFromSuccessBody(raw);
}

/** POST …/tts/ — start (or join) this Message's render. Body is exactly `{}`. */
export function startMessageVoiceRender(
  conversationId: number,
  messageId: number,
  signal?: AbortSignal,
): Promise<TtsOutcome> {
  return requestTts(ttsPath(conversationId, messageId), 'POST', signal);
}

/** GET …/tts/ — read-only observation; never triggers a new render. */
export function readMessageVoiceRender(
  conversationId: number,
  messageId: number,
  signal?: AbortSignal,
): Promise<TtsOutcome> {
  return requestTts(ttsPath(conversationId, messageId), 'GET', signal);
}
