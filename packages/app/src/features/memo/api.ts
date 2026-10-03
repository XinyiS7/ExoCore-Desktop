import { apiFetch } from 'exo-shared/api';
import { AppApiError, contractError, toAppApiError } from '../chat/api';
import type { Memo, MemoThreadData } from './types';

export function normalizeMemo(value: unknown): Memo {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw contractError('Memo 格式异常', value);
  const row = value as Record<string, unknown>;
  const positiveId = (id: unknown): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0;
  if (!positiveId(row.id) || typeof row.author !== 'string' || typeof row.content !== 'string' ||
      !(row.parent_id === null || positiveId(row.parent_id)) || typeof row.created_at !== 'string' || Number.isNaN(Date.parse(row.created_at)) ||
      !Array.isArray(row.tags) || !row.tags.every((tag) => typeof tag === 'string')) throw contractError('Memo 字段异常', value);
  return { id: row.id, author: row.author, content: row.content, parent_id: row.parent_id, created_at: row.created_at, tags: [...row.tags] as string[] };
}
function memoError(cause: unknown, post = false): AppApiError {
  const error = toAppApiError(cause);
  const body = error.body as { error?: unknown; detail?: unknown } | null;
  const message = typeof body?.error === 'string' ? body.error : typeof body?.detail === 'string' ? body.detail : error.message;
  return new AppApiError(message, { status: error.status, body: error.body, code: error.code,
    ambiguousWrite: post && (error.status === null || error.status >= 500 || error.code === 'CONTRACT'),
  });
}
async function postMemo(path: string, content: string, parentId: number | null): Promise<Memo> {
  try {
    const memo = normalizeMemo(await apiFetch(path, { method: 'POST', body: { content } }));
    if (memo.parent_id !== parentId) throw contractError('Memo 返回的回复对象不一致', memo);
    return memo;
  } catch (cause) { throw memoError(cause, true); }
}
export const createMemo = (content: string) => postMemo('/api/core/memos/', content, null);
export const createMemoReply = (parentId: number, content: string) => postMemo(`/api/core/memos/${parentId}/replies/`, content, parentId);
export async function fetchMemoThread(rootId: number, signal?: AbortSignal): Promise<MemoThreadData> {
  try {
    const raw: unknown = await apiFetch(`/api/core/memos/${rootId}/`, { method: 'GET', signal });
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw contractError('Memo 讨论格式异常', raw);
    const row = raw as Record<string, unknown>;
    const memo = normalizeMemo(row.memo);
    if (memo.id !== rootId || memo.parent_id !== null || !Array.isArray(row.replies)) throw contractError('Memo 根讨论定位异常', raw);
    const replies = row.replies.map(normalizeMemo);
    const byId = new Map(replies.map((reply) => [reply.id, reply]));
    if (byId.size !== replies.length || byId.has(rootId)) throw contractError('Memo 讨论身份重复', raw);
    for (const reply of replies) {
      let parent = reply.parent_id;
      const seen = new Set([reply.id]);
      while (parent !== rootId) {
        if (parent === null || seen.has(parent) || !byId.has(parent)) throw contractError('Memo 回复关系异常', raw);
        seen.add(parent);
        parent = byId.get(parent)!.parent_id;
      }
    }
    return { memo, replies };
  } catch (cause) { throw memoError(cause); }
}
export async function replaceMemoTags(id: number, tags: string[]): Promise<Memo> {
  try {
    const memo = normalizeMemo(await apiFetch(`/api/core/memos/${id}/tags/`, { method: 'PATCH', body: { tags } }));
    if (memo.id !== id) throw contractError('Memo 标签返回身份不一致', memo);
    return memo;
  } catch (cause) { throw memoError(cause); }
}
