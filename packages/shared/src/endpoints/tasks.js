import { apiFetch } from '../api';

// ── ScheduleEntry CRUD (§6.1) ──
export function listTasks(params = {}) {
  // params: status, entry_type, is_pinned
  return apiFetch('/api/tasks/entries/', { method: 'GET', params });
}
export function getTask(taskId) {
  return apiFetch(`/api/tasks/entries/${taskId}/`, { method: 'GET' });
}
export function createTask(data) {
  // entry_type (required): "todo" | "periodic" | "goal"; plus type-specific fields
  return apiFetch('/api/tasks/entries/', { method: 'POST', body: data });
}
export function updateTask(taskId, data) {
  return apiFetch(`/api/tasks/entries/${taskId}/`, { method: 'PATCH', body: data });
}
export function deleteTask(taskId) {
  // Soft-delete: status → "archived"
  return apiFetch(`/api/tasks/entries/${taskId}/`, { method: 'DELETE' });
}

// ── Entry Actions (§6.2) ──
export function completeTask(taskId, note) {
  return apiFetch(`/api/tasks/entries/${taskId}/complete/`, { method: 'POST', body: note ? { note } : {} });
}
export function suspendTask(taskId) {
  return apiFetch(`/api/tasks/entries/${taskId}/suspend/`, { method: 'POST' });
}
export function resumeTask(taskId) {
  return apiFetch(`/api/tasks/entries/${taskId}/resume/`, { method: 'POST' });
}

// ── GCal Sync (§6.3) ──
export function syncTaskToGCal(taskId) {
  return apiFetch(`/api/tasks/entries/${taskId}/gcal/`, { method: 'POST' });
}
export function unlinkTaskGCal(taskId) {
  return apiFetch(`/api/tasks/entries/${taskId}/gcal/`, { method: 'DELETE' });
}

// ── Completions (§6.5) ──
export function listCompletions(entryId) {
  return apiFetch('/api/tasks/completions/', { method: 'GET', params: { entry: entryId } });
}

// ── Calendar Snapshots (§6.4) ──
export function getCalendarSnapshot() {
  // 90-day full snapshot: GET /api/tasks/calendar/
  return apiFetch('/api/tasks/calendar/', { method: 'GET' });
}
export function getTodaySnapshot() {
  // 48h window: GET /api/tasks/calendar/today/
  return apiFetch('/api/tasks/calendar/today/', { method: 'GET' });
}
