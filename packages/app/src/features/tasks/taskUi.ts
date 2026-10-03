/**
 * CP3 Task UI presentation helpers — labels and error text only.
 *
 * This module deliberately contains no data access or payload logic: the real
 * `ScheduleEntrySerializer` fields live in `types.ts`, the allowlisted payload
 * mapping lives in `taskPayloads.ts` and the transport guards live in `api.ts`.
 * ReactSheet §4.1–4.4 is documented stale prose (see `types.ts`) and is not
 * consumed here.
 */

import { AppApiError } from '../chat/api';
import type { TaskStatus, TaskType } from './types';

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  todo: '待办',
  periodic: '周期任务',
  goal: '目标',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  active: '进行中',
  suspended: '已暂停',
  escalated: '已升级',
  archived: '已归档',
};

/** Human-readable error text; never claims success for an unknown outcome. */
export function errorMessage(cause: unknown, fallback = '请求失败，请稍后重试。'): string {
  if (cause instanceof Error && cause.message.trim() !== '') return cause.message;
  return fallback;
}

/** True when a write may have been accepted but its result cannot be confirmed. */
export function isUncertainWrite(cause: unknown): boolean {
  return cause instanceof AppApiError && cause.ambiguousWrite;
}
