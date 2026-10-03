import { apiFetch } from 'exo-shared/api';
import { AppApiError, contractError, toAppApiError } from '../chat/api';
import type { CanonicalDiary } from './types';

export function normalizeCanonicalDiary(raw: unknown, presetId: number, day: string): CanonicalDiary {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw contractError('日记格式异常', raw);
  const row = raw as Record<string, unknown>;
  if (row.preset_id !== presetId || row.day !== day || row.time_precision !== 'day' ||
      typeof row.content !== 'string' || typeof row.occurred_at !== 'string' || Number.isNaN(Date.parse(row.occurred_at))) {
    throw contractError('日记定位或内容格式异常', raw);
  }
  return { preset_id: presetId, day, time_precision: 'day', occurred_at: row.occurred_at, content: row.content };
}
export async function fetchCanonicalDiary(presetId: number, day: string, signal?: AbortSignal): Promise<CanonicalDiary> {
  try {
    return normalizeCanonicalDiary(await apiFetch(`/api/memory/diaries/${presetId}/${encodeURIComponent(day)}/`, { method: 'GET', signal }), presetId, day);
  } catch (cause) {
    const error = toAppApiError(cause);
    const body = error.body as { code?: unknown; error?: unknown } | null;
    throw new AppApiError(typeof body?.error === 'string' ? body.error : error.message, {
      status: error.status, body: error.body, code: typeof body?.code === 'string' ? body.code : error.code,
    });
  }
}
