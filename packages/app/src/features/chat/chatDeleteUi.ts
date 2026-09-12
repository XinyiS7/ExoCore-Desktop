/**
 * Pure UI helpers for the single-conversation delete flow.
 * Kept OUT of the component module so fast-refresh stays valid and the
 * helpers remain unit-testable without mounting React.
 */
import type { QueryClient } from '@tanstack/react-query';
import { readRuntimeLease } from './runtime/storage';
import { queryKeys } from './queries';
import { controlQueryKeys } from './control/queries';
import type { ConversationDeleteOutcome } from './chatDelete';

/** What the UI displays for each settled outcome. */
export interface DeleteDisplayState {
  verdict:
    | 'idle'
    | 'confirming'
    | 'busy'
    | 'protected'
    | 'success'
    | 'absent'
    | 'safety_failed'
    | 'ambiguous';
  /** Human explanation for busy/protected/error states. */
  message: string;
}

/**
 * Local busy gate. Lease dispositions pending/active/uncertain (or a
 * quarantined/unavailable storage state) block deletion. Lease ABSENCE is
 * NOT idle proof — the backend 409 remains authoritative; this check is a
 * local fast-path explanation over the same rule.
 */
export function deleteBusyReason(conversationId: number): string | null {
  const outcome = readRuntimeLease(conversationId);
  if (outcome.state === 'valid') {
    return outcome.lease.disposition === 'uncertain'
      ? '该会话有未确认的运行状态（结果不确定）。请先打开会话确认结果，再回来删除。'
      : '该会话正在进行或等待中的操作（正在生成/等待确认）。请先打开会话等待完成或停止。';
  }
  if (outcome.state === 'quarantined') {
    return '存在损坏的运行记录，已隔离。请重新打开会话以恢复。';
  }
  if (outcome.state === 'unavailable') {
    return '无法读取运行状态（存储不可用）。请稍后重试。';
  }
  return null;
}

/** Pure mapping of a settled attempt to UI copy — exported for unit tests. */
export function deriveDeleteDisplay(
  attempt: ConversationDeleteOutcome,
): DeleteDisplayState {
  switch (attempt.kind) {
    case 'confirmed':
      return { verdict: 'success', message: '会话已永久删除。' };
    case 'absent':
      return {
        verdict: 'absent',
        message: '该会话已不存在（可能已删除），列表已同步。',
      };
    case 'protected':
      return {
        verdict: 'protected',
        message:
          '此会话受保护（Council 或 Bridge 特别归属），不能从这里删除。如需归档请使用项目归档功能。',
      };
    case 'busy':
      return {
        verdict: 'busy',
        message:
          '该会话正在运行中，无法删除。请先打开会话等待完成或停止，再回来删除。',
      };
    case 'safety_failed':
      return {
        verdict: 'safety_failed',
        message: '删除安全检查未能完成，会话未被删除。请关闭此窗口后重试。',
      };
  }
}

/**
 * Retire ONLY this conversation's server-owned families.
 * Caller refreshes the canonical list; detail/messages/cache are removed
 * exactly for the submitted id. Never bulk-clear; drafts/prefs untouched.
 */
export function retireConversationCaches(
  queryClient: QueryClient,
  conversationId: number,
): void {
  queryClient.removeQueries({
    queryKey: queryKeys.conversation(conversationId),
  });
  queryClient.removeQueries({
    queryKey: queryKeys.messages(conversationId),
  });
  queryClient.removeQueries({
    queryKey: controlQueryKeys.cache(conversationId),
  });
}

/**
 * Canonical post-delete list reconciliation: refresh the single conversations
 * collection; stale in-flight GETs cannot reintroduce the row afterwards
 * because the collection owner refetches from the backend.
 */
export async function reconcileConversationList(
  queryClient: QueryClient,
  conversationId: number,
): Promise<void> {
  retireConversationCaches(queryClient, conversationId);
  await queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
}