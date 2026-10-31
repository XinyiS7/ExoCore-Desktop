import { apiFetch } from 'exo-shared/api';
import { contractError } from '../chat/api';
import { readTagNames } from './rules';

/** GET /api/core/tags/suggest/?q=<prefix> → `{tags: string[]}` (ReactSheet §3.8). */
export async function suggestTags(prefix: string): Promise<string[]> {
  const raw = await apiFetch(`/api/core/tags/suggest/?q=${encodeURIComponent(prefix)}`);
  if (typeof raw !== 'object' || raw === null || !Array.isArray((raw as Record<string, unknown>).tags)) {
    throw contractError('tag 联想接口返回格式异常', raw);
  }
  return readTagNames((raw as Record<string, unknown>).tags);
}
