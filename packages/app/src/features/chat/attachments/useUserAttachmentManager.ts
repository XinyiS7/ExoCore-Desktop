import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { deleteConversationAttachment, listConversationAttachments } from './api';
import type { AttachmentListRow } from './types';
import { queryKeys } from '../queries';

/**
 * P1C Narrow User-Attachment Manager (Task 2.5/2.6, §5.6).
 *
 * Deliberately narrower than the V3 mixed panel: lists ONLY user-uploaded
 * rows (`source === 'user'`), supports single delete with frozen-cache 409
 * guidance, and never exposes `storage_path` or tool_collection controls.
 *
 * Delete exclusion (bidirectional, reusing existing operation state):
 * - while a delete request is unresolved, ordinary send / retry is disabled
 *   via `deletePending` surfaced by the owner;
 * - while the C1B operation is active/uncertain, delete is disabled (owner
 *   passes `busy`).
 * On 204 the local row is purged BEFORE list/history refresh; a refresh
 * failure stays visible but can never resurrect the deleted id. On 409 or
 * any failure nothing is mutated — only the message changes.
 */
export interface UserAttachmentManagerApi {
  rows: AttachmentListRow[];
  loading: boolean;
  /** First user-visible load/refresh/delete error (frozen message included). */
  notice: string | null;
  frozenInCache: boolean;
  /** True while a delete request is in flight (blocks send/retry). */
  deletePending: boolean;
  /** Same-tick authoritative guard for click/Delete → immediate Send races. */
  isDeletePending: () => boolean;
  refresh: () => Promise<void>;
  remove: (row: AttachmentListRow) => Promise<void>;
  dismissNotice: () => void;
}

export function useUserAttachmentManager(
  conversationId: number,
  options: {
    /** Runs synchronously after 204 and before any list/history refresh. */
    onDeleted?: (attachmentId: number) => void;
    /** Pending target upload blocks delete without creating another lock owner. */
    isDeleteBlocked?: () => boolean;
  } = {},
): UserAttachmentManagerApi {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<AttachmentListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [frozenInCache, setFrozenInCache] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const deletePendingRef = useRef(false);
  const epochRef = useRef(0);
  const lifecycleEpochRef = useRef(0);
  const routeOwnerRef = useRef<{ conversationId: number }>({ conversationId });
  if (routeOwnerRef.current.conversationId !== conversationId) {
    // Object identity distinguishes A → B → A from the departed A lifetime.
    routeOwnerRef.current = { conversationId };
  }
  const deletedIdsRef = useRef<Set<number>>(new Set());
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const refresh = useCallback(async () => {
    const convId = conversationId;
    const routeOwner = routeOwnerRef.current;
    const lifecycleEpoch = lifecycleEpochRef.current;
    const routeIsCurrent = () =>
      routeOwnerRef.current === routeOwner && lifecycleEpochRef.current === lifecycleEpoch;
    // A list read must never supersede an unresolved DELETE. The component
    // also disables Refresh, but this ref-backed guard protects same-tick and
    // direct hook callers.
    if (deletePendingRef.current || !Number.isInteger(convId) || convId <= 0) return;
    const epoch = ++epochRef.current;
    setLoading(true);
    try {
      const all = await listConversationAttachments(convId);
      if (!routeIsCurrent() || epochRef.current !== epoch) return;
      // Narrow to user rows only; tool_collection rows are parsed but never
      // exposed as P1C project-file controls (§3.2).
      setRows(
        all.filter(
          (r) =>
            r.source === 'user' &&
            typeof r.id === 'number' &&
            Number.isInteger(r.id) &&
            r.id > 0 &&
            !deletedIdsRef.current.has(r.id),
        ),
      );
      setNotice(null);
      setFrozenInCache(false);
    } catch (cause) {
      if (!routeIsCurrent() || epochRef.current !== epoch) return;
      setNotice((cause as Error)?.message ?? '附件列表加载失败');
    } finally {
      if (routeIsCurrent() && epochRef.current === epoch) setLoading(false);
    }
  }, [conversationId]);

  // Route switch resets the manager so old rows can never leak into a new
  // Conversation (recovery/list isolation, Gate C). Loading is LAZY: the
  // panel fetches on open (component-owned), so an unopened manager issues
  // zero requests and cannot disturb unrelated flows.
  useEffect(() => {
    const lifecycleEpoch = ++lifecycleEpochRef.current;
    epochRef.current += 1;
    setRows([]);
    setNotice(null);
    setFrozenInCache(false);
    deletedIdsRef.current = new Set();
    deletePendingRef.current = false;
    setDeletePending(false);
    setLoading(false);
    return () => {
      // Invalidate every continuation on route departure or unmount. The
      // setup increment keeps this safe under React Strict Mode replay.
      if (lifecycleEpochRef.current === lifecycleEpoch) lifecycleEpochRef.current += 1;
      epochRef.current += 1;
      deletePendingRef.current = false;
    };
  }, [conversationId]);

  const remove = useCallback(
    async (row: AttachmentListRow) => {
      const convId = conversationId;
      if (
        !Number.isInteger(convId) ||
        convId <= 0 ||
        deletePendingRef.current ||
        optionsRef.current.isDeleteBlocked?.() ||
        typeof row.id !== 'number' ||
        !Number.isInteger(row.id) ||
        row.id <= 0
      ) return;
      const epoch = epochRef.current;
      const routeOwner = routeOwnerRef.current;
      const lifecycleEpoch = lifecycleEpochRef.current;
      const routeIsCurrent = () =>
        routeOwnerRef.current === routeOwner && lifecycleEpochRef.current === lifecycleEpoch;
      deletePendingRef.current = true;
      setDeletePending(true);
      setNotice(null);
      setFrozenInCache(false);
      const id = row.id;
      try {
        const outcome = await deleteConversationAttachment(convId, { source: 'user', id });
        if (!routeIsCurrent() || epochRef.current !== epoch) return;
        if (outcome.ok) {
          // 204: purge every local sendable owner synchronously BEFORE either
          // canonical refresh starts. A failed refresh cannot restore the ID.
          deletedIdsRef.current.add(id);
          optionsRef.current.onDeleted?.(id);
          setRows((prev) => prev.filter((r) => !(r.source === 'user' && r.id === id)));
          // The DELETE request has settled. Release its bidirectional gate
          // before refresh increments the manager epoch.
          deletePendingRef.current = false;
          setDeletePending(false);
          let historyRefreshFailed = false;
          try {
            await queryClient.invalidateQueries({ queryKey: queryKeys.messages(convId) });
          } catch {
            historyRefreshFailed = true;
          }
          if (!routeIsCurrent()) return;
          await refresh();
          if (routeIsCurrent() && historyRefreshFailed) {
            setNotice('附件已删除，但消息历史刷新失败；可重试加载消息。');
          }
        } else if (outcome.frozen) {
          // 409: mutate NO list/history/compose state; show guidance only.
          setFrozenInCache(true);
          setNotice(outcome.message);
        } else {
          // 400/404/network: retain canonical state, keep error visible.
          setNotice(outcome.message);
        }
      } catch (cause) {
        if (routeIsCurrent() && epochRef.current === epoch) {
          setNotice((cause as Error)?.message ?? '删除失败');
        }
      } finally {
        if (routeIsCurrent() && epochRef.current === epoch) {
          deletePendingRef.current = false;
          setDeletePending(false);
        }
      }
    },
    [conversationId, queryClient, refresh],
  );

  const dismissNotice = useCallback(() => {
    setNotice(null);
    setFrozenInCache(false);
  }, []);

  const isDeletePending = useCallback(() => deletePendingRef.current, []);

  return { rows, loading, notice, frozenInCache, deletePending, isDeletePending, refresh, remove, dismissNotice };
}