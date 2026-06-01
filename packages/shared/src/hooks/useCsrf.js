import { getCsrfToken } from '../api';

/**
 * Hook that provides the current CSRF token.
 * The token is read from the csrftoken cookie — it's set by Django on first response.
 * Returns null if not yet available.
 */
export function useCsrf() {
  const token = getCsrfToken();
  return { csrfToken: token || null, ready: !!token };
}
