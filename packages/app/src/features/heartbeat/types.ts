/**
 * Heartbeat Types and DTOs (Plan §2.2 / §3.1).
 */

export type CadenceMode = 'normal' | 'quiet' | 'deep_quiet';
export type HeartbeatEventStatus = 'pending' | 'running' | 'succeeded' | 'failed';
export type HeartbeatLaunchSource = 'auto' | 'agent' | 'notification' | 'user';
export type HeartbeatTaskStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'retryable_failed'
  | 'dead'
  | 'cancelled';
export type FinalizationReason = 'explicit' | 'max_segments';

export interface HeartbeatNextAuto {
  taskId: number;
  targetUtc: string;
  effectiveUtc: string;
  effectiveLocal: string;
  message: string;
  resumeCheck: boolean;
  status: HeartbeatTaskStatus;
}

export interface HeartbeatPendingNote {
  id: number;
  message: string;
  createdAt: string;
  createdLocal: string;
}

export interface HeartbeatExplicitWakeup {
  taskId: number;
  targetUtc: string;
  effectiveUtc: string;
  effectiveLocal: string;
  message: string;
  resumeCheck: boolean;
  status: HeartbeatTaskStatus;
}

export interface HeartbeatQueueSummary {
  presetId: number;
  autoEnabled: boolean;
  cadenceMode: CadenceMode;
  pausedUntilUtc: string | null;
  pausedUntilLocal: string | null;
  nextAuto: HeartbeatNextAuto | null;
  pendingNotes: HeartbeatPendingNote[];
  explicitWakeups: HeartbeatExplicitWakeup[];
  unshownExplicitCount: number;
}

export interface HeartbeatEventListItem {
  sessionUuid: string;
  presetId: number;
  presetName: string;
  launchSource: HeartbeatLaunchSource;
  domain: string;
  status: HeartbeatEventStatus;
  content: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface HeartbeatEventsResponse {
  events: HeartbeatEventListItem[];
  totalCount: number;
  hasMore: boolean;
}

export interface HeartbeatEventDetail extends HeartbeatEventListItem {
  seedMessage: string;
  toolHistory: unknown[];
  errorSummary: string;
  finalizationReason: FinalizationReason | null;
  attemptNumber: number;
  wakeUpTaskId: number | null;
  sourceConversationId: number | null;
  acknowledgedAt: string | null;
}
