import { apiFetch } from '../api';

/**
 * 第九篇 Heartbeat (心跳会话) API (§9.1 - §9.4)
 */

/**
 * 9.1 Event 只读账本 — 列表
 * GET /api/heartbeat/events/?preset_id=<int>&limit=<int>&offset=<int>
 * @param {Object} params - { preset_id: number (required), limit?: number, offset?: number }
 */
export function listEvents(params = {}) {
  return apiFetch('/api/heartbeat/events/', { method: 'GET', params });
}

/**
 * 9.2 Event 只读账本 — 详情
 * GET /api/heartbeat/events/<session_uuid>/
 * @param {string} sessionUuid - Session UUID
 */
export function getEventDetail(sessionUuid) {
  return apiFetch(`/api/heartbeat/events/${sessionUuid}/`, { method: 'GET' });
}
