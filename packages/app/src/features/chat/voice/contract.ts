import type { VoiceToolError } from '../types';

/**
 * CP-C `send_voice_msg` failure projection contract (backend Plan REVISE-7
 * §5.3/§8). One bounded frontend-safe shape is consumed from two sources:
 *
 * - live chat SSE / polling `voice_tool_error` `{position, error_code}`;
 * - the durable Message read projection `voice_tool_errors[]`.
 *
 * `error_code` is an opaque bounded snake_case token: the client never maps it
 * to prose, never merges it with tool args, and never surfaces content/style.
 * The owning assistant row supplies the turn identity, so a repeated position
 * is idempotent (first outcome wins).
 */

export const VOICE_TOOL_ERROR_CODE_MAX = 64;
const VOICE_TOOL_ERROR_CODE_PATTERN = /^[a-z0-9_]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Strict per-entry validator; anything malformed is dropped, never rendered. */
export function normalizeVoiceToolError(value: unknown): VoiceToolError | null {
  if (!isRecord(value)) return null;
  const position = value.position;
  const errorCode = value.error_code;
  if (
    typeof position !== 'number' ||
    !Number.isInteger(position) ||
    position < 0 ||
    typeof errorCode !== 'string' ||
    errorCode.length === 0 ||
    errorCode.length > VOICE_TOOL_ERROR_CODE_MAX ||
    !VOICE_TOOL_ERROR_CODE_PATTERN.test(errorCode)
  ) {
    return null;
  }
  return { position, errorCode };
}

/** Fail-closed list normalization + `(turn, position)` dedupe, ordered by position. */
export function normalizeVoiceToolErrorList(value: unknown): VoiceToolError[] {
  if (!Array.isArray(value)) return [];
  const entries: VoiceToolError[] = [];
  for (const candidate of value) {
    const entry = normalizeVoiceToolError(candidate);
    if (entry) entries.push(entry);
  }
  return dedupeVoiceToolErrors(entries);
}

/** Dedupe already-normalized camel entries; first outcome wins, ordered by position. */
export function dedupeVoiceToolErrors(entries: readonly VoiceToolError[]): VoiceToolError[] {
  const seen = new Set<number>();
  const out: VoiceToolError[] = [];
  for (const entry of entries) {
    if (seen.has(entry.position)) continue;
    seen.add(entry.position);
    out.push(entry);
  }
  return out.sort((a, b) => a.position - b.position);
}

/** Append one live outcome to the owning runtime turn. */
export function mergeVoiceToolErrors(
  current: readonly VoiceToolError[] | undefined,
  incoming: VoiceToolError,
): VoiceToolError[] {
  return dedupeVoiceToolErrors([...(current ?? []), incoming]);
}
