// Base URL for API requests. Empty string means relative URLs — Vite proxy handles routing.
// In Tauri production, this will point to http://localhost:8000.
const API_BASE_URL = '';

export const baseUrl = API_BASE_URL.replace(/\/+$/, '');

export const getCsrfToken = () =>
  document.cookie.split('; ').find(r => r.startsWith('csrftoken='))?.split('=')[1] ?? '';

// Model registry is fetched dynamically from GET /api/core/models/ (see config.js endpoint).
// Static fallback for offline/bootstrap scenarios — always prefer the API response.
export const MODEL_REGISTRY = [
  { provider: 'gemini',   id: 'gemini-3.1-pro-preview', roles: ['main'] },
  { provider: 'gemini',   id: 'gemini-2.5-flash',       roles: ['sub_agent'] },
  { provider: 'deepseek', id: 'deepseek-v4-pro',        roles: ['main'] },
  { provider: 'deepseek', id: 'deepseek-v4-flash',      roles: ['sub_agent'] },
];

export const AVAILABLE_MODELS = MODEL_REGISTRY.map(m => m.id);

/** Safely extract project ID from a conversation object, handling number, string, or nested object forms. */
export const getConvProjectId = (conv) => {
  if (conv.project === null || conv.project === undefined) return null;
  return typeof conv.project === 'object' ? Number(conv.project.id) : Number(conv.project);
};

/**
 * Base fetch wrapper. Adds CSRF header for mutating requests and credentials.
 * Returns parsed JSON or throws with a normalized error.
 */
export async function apiFetch(path, options = {}) {
  const { method, body, params, ...rest } = options;
  const url = new URL(`${baseUrl}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  const headers = { ...rest.headers };
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const isMutating = method && method !== 'GET' && method !== 'HEAD';
  if (isMutating) {
    headers['X-CSRFToken'] = getCsrfToken();
  }
  const res = await fetch(url.toString(), {
    ...rest,
    method: method || 'GET',
    headers,
    credentials: 'include',
    body: body instanceof FormData
      ? body
      : body && typeof body === 'object'
        ? JSON.stringify(body)
        : body,
  });
  if (!res.ok) {
    const err = new Error(`API ${res.status}: ${res.statusText}`);
    err.status = res.status;
    try { err.body = await res.json(); } catch (_) { err.body = await res.text().catch(() => ''); }
    throw err;
  }
  const text = await res.text();
  try { return JSON.parse(text); } catch (_) { return text; }
}
