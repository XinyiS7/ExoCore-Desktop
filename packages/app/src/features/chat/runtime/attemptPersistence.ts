import type { MessagePage, MessageView } from '../types';
import type { AttemptPersistence } from './types';

function sameOrderedIds(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

/** Bind only by exact canonical attachment identity; never by text/time/latest. */
export function classifyAudioAttemptPersistence(
  rows: readonly MessageView[],
  attachmentIds: readonly number[],
  historyComplete: boolean,
): AttemptPersistence {
  if (attachmentIds.length === 0) {
    return { kind: 'unknown', reason: '恢复快照缺少附件编号，无法安全确认消息。' };
  }
  const matches = rows.filter(
    (row) => row.role === 'user' && sameOrderedIds(row.attachmentIds, attachmentIds),
  );
  if (matches.length === 1) {
    return {
      kind: 'exact_persisted',
      messageId: matches[0].id,
      indexInSession: matches[0].indexInSession,
    };
  }
  if (matches.length > 1) {
    return { kind: 'unknown', reason: '有多条消息携带相同附件，无法确定原始发送。' };
  }
  return historyComplete
    ? { kind: 'proven_absent' }
    : { kind: 'unknown', reason: '当前历史窗口无法证明该语音消息是否已保存。' };
}

export function classifyAudioAttemptPage(page: MessagePage, attachmentIds: readonly number[]): AttemptPersistence {
  const historyComplete = !page.hasMore && page.messages.length >= page.totalCount;
  return classifyAudioAttemptPersistence(page.messages, attachmentIds, historyComplete);
}
