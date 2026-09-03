/**
 * TypeScript declaration surface for `exo-shared/api` (V4, P1A).
 *
 * The generic transport remains plain JavaScript and is shared with V3.
 * This file only *declares* the consumed surface so strict TS consumers can
 * call it safely; runtime behavior is unchanged (P1A Detailed Plan §6.1).
 * V4 wraps every call with its own envelope guards — these types do not
 * promise any response shape.
 */

export type ApiFetchOptions = {
  method?: string;
  body?: unknown;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

/** Relative base URL (same-origin; Vite dev proxy / nginx handle routing). */
export const baseUrl: string;

/** Read csrftoken cookie. */
export function getCsrfToken(): string;

/**
 * Generic fetch wrapper: adds CSRF header for mutating requests, credentials,
 * JSON serialization and normalized non-2xx errors (throws Error with
 * `status` and `body` attached). Resolves parsed JSON.
 */
export function apiFetch(path: string, options?: ApiFetchOptions): Promise<any>;

/** Safely extract project id from a conversation row (number|string|nested). */
export function getConvProjectId(conv: { project: unknown }): number | null;
