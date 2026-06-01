import { apiFetch } from '../api';

// ── Usage Statistics (§7.1-7.4) ──

/** Daily usage for charts. mode: "week" (7d) | "month" (30d). from: YYYY-MM-DD. */
export function getDailyUsage(params = {}) {
  return apiFetch('/api/telemetry/usage/', { method: 'GET', params });
}

/** Weekly aggregated usage. params: weeks, from (Monday). */
export function getWeeklyUsage(params = {}) {
  return apiFetch('/api/telemetry/weekly/', { method: 'GET', params });
}

/** Monthly aggregated usage. params: months, from (YYYY-MM). */
export function getMonthlyUsage(params = {}) {
  return apiFetch('/api/telemetry/monthly/', { method: 'GET', params });
}

/** Raw daily_summary.json snapshot (debug). */
export function getDailyRaw() {
  return apiFetch('/api/telemetry/daily/', { method: 'GET' });
}
