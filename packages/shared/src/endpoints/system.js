import { apiFetch } from '../api';

/** Health check — Tauri sidecar readiness detection. */
export function healthCheck() {
  return apiFetch('/api/health/', { method: 'GET' });
}

/** Fetch recent log lines (if Django exposes the endpoint). */
export function getRecentLogs(lines = 200) {
  return apiFetch('/api/v1/system/logs/', { method: 'GET', params: { lines } });
}
