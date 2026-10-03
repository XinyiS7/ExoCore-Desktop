import type { Memo } from '../features/memo/types';
import { memoItem } from './river_fixtures';
import { installFetch, jsonResponse } from './helpers';

/** Synthetic, memory-only HTTP fixture. Never uses a database or real fetch. */
export function installMemoServer() {
  const root: Memo = { id: 7, author: 'agent:2', content: '**根正文**', parent_id: null, created_at: '2026-10-02T12:00:00Z', tags: ['old'] };
  const memos = new Map<number, Memo>([
    [7, root],
    [8, { ...root, id: 8, parent_id: 7, content: '一级回复', tags: [] }],
    [9, { ...root, id: 9, parent_id: 8, content: '二级回复', tags: [] }],
    [10, { ...root, id: 10, parent_id: 7, content: '同时间兄弟', tags: [] }],
    [11, { ...root, id: 11, parent_id: 9, content: '三级回复', tags: [] }],
  ]);
  const server: {
    memos: Map<number, Memo>; nextId: number;
    patch?: (id: number, tags: string[]) => Response | Promise<Response> | undefined;
    post?: (parentId: number | null, content: string) => Response | Promise<Response> | undefined;
    readError?: number;
    river?: (url: URL, payload: { items: unknown[]; next_cursor: string | null }) => Response | Promise<Response> | undefined;
  } = { memos, nextId: 100 };
  const { calls } = installFetch([
    { test: '/api/core/river/', handler: async (url) => {
      const payload = { items: [...memos.values()].filter((memo) => memo.parent_id === null).sort((a, b) => b.id - a.id).map((memo) => ({
        ...memoItem, source_id: String(memo.id), occurred_at: memo.created_at, preview: memo.content,
        target: { type: 'memo', memo_id: memo.id }, source_specific: { author: memo.author, tags: memo.tags, reply_count: [...memos.values()].filter((reply) => reply.parent_id === memo.id).length },
      })), next_cursor: null };
      return await server.river?.(url, payload) ?? jsonResponse(payload);
    } },
    { test: '/api/core/river/open-tasks/', handler: () => jsonResponse({ items: [] }) },
    { test: /^\/api\/core\/memos\/(?:\d+\/replies\/)?$/, method: 'POST', handler: async (url, init) => {
      const match = url.pathname.match(/memos\/(\d+)\/replies/);
      const parentId = match ? Number(match[1]) : null;
      const body = JSON.parse(String(init?.body)) as { content: string };
      const override = await server.post?.(parentId, body.content);
      if (override) return override;
      const memo: Memo = { ...root, id: server.nextId++, parent_id: parentId, content: body.content.trim(), tags: [], created_at: '2026-10-03T12:00:00Z' };
      memos.set(memo.id, memo);
      return jsonResponse(memo, 201);
    } },
    { test: /^\/api\/core\/memos\/\d+\/tags\/$/, method: 'PATCH', handler: async (url, init) => {
      const id = Number(url.pathname.split('/')[4]);
      const tags = (JSON.parse(String(init?.body)) as { tags: string[] }).tags;
      const override = await server.patch?.(id, tags);
      if (override) return override;
      const memo = { ...memos.get(id)!, tags: [...tags].sort() };
      memos.set(id, memo);
      return jsonResponse(memo);
    } },
    { test: /^\/api\/core\/memos\/\d+\/$/, method: 'GET', handler: (url) => {
      if (server.readError) return jsonResponse({ detail: 'thread denied' }, server.readError);
      const id = Number(url.pathname.split('/')[4]);
      const belongs = (reply: Memo) => {
        let parent = reply.parent_id;
        while (parent !== null) { if (parent === id) return true; parent = memos.get(parent)?.parent_id ?? null; }
        return false;
      };
      return jsonResponse({ memo: memos.get(id), replies: [...memos.values()].filter(belongs) });
    } },
  ]);
  return { server, calls };
}
