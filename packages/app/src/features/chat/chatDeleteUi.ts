/**
 * Pure UI helpers for the single-conversation delete flow.
 * Kept OUT of the component module so fast-refresh stays valid and the
 * helpers remain unit-testable without mounting React.
 */
import type { QueryClient } from '@tanstack/react-query';
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
    | 'prime_transfer_required'
    | 'ambiguous';
  /** Human explanation for busy/protected/error states. */
  message: string;
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
    case 'prime_transfer_required':
      return {
        verdict: 'prime_transfer_required',
        message: '当前主会话不可删除。若需删除，请先将其他会话设为主会话。',
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