import type { AssistantRunTraceItem, VoiceToolError } from '../types';

/**
 * P1B Chat Runtime Types
 * Strictly implements Plan §5, §6.3, §6.5, §6.6.
 *
 * Invariants:
 * - Conversation.id is canonical route and history identity.
 * - Polling message_id is an opaque runtime token, NEVER a database Message.id.
 * - Runtime rows use client-prefixed string keys, NEVER fake server message IDs.
 * - TanStack Query owns persisted rows; runtime controller owns overlay and lifecycle.
 */

export type ChatTransport = 'sse' | 'async';

export type RuntimeOperationKind = 'send' | 'edit' | 'regenerate' | 'branch';

export type RetrySafetyClass =
  | 'safe'
  | 'uncertain'
  | 'terminal_persisted'
  | 'recoverable'
  | 'ambiguous_branch';

export type TerminalKind = 'done' | 'stopped' | 'error';

export type RuntimeStatus =
  | 'idle'
  | 'submitting'
  | 'streaming'
  | 'polling'
  | 'stopping'
  | 'terminal'
  | 'interrupted'
  | 'runtime_unavailable'
  | 'protocol_warning'
  | 'reconciling'
  | 'reconcile_error';

// ── Server Wire Events & Envelopes ──────────────────────────────────────────

export interface TelemetryPayload {
  platform?: string;
  model_name?: string;
  input_chars?: number;
  output_chars?: number;
  tool_calls?: unknown;
  cached_input_chars?: number;
}

export interface RuntimeTelemetry {
  platform?: string;
  modelName?: string;
  inputChars?: number;
  outputChars?: number;
  toolCalls?: number;
  cachedInputChars?: number;
}

export interface RuntimeTelemetryTotals {
  acceptedRuns: number;
  inputChars: number;
  outputChars: number;
  toolCalls: number;
  cachedInputChars: number;
}

/** Ephemeral telemetry for this Conversation page visit only. */
export interface ConversationTelemetryProjection {
  lastTurn: RuntimeTelemetry | null;
  totals: RuntimeTelemetryTotals;
}

export interface StoppedPayload {
  partial?: boolean;
}

export interface CacheSkippedPayload {
  reason: 'platform_not_supported' | 'remote_cache_unavailable' | string;
}

export interface TypedBackendErrorPayload {
  code?: string;
  message?: string;
  provider?: string;
  model?: string;
  endpoint_id?: number | null;
  retryable?: boolean;
}

export type AssistantTraceEvent =
  | {
      version: 1;
      runId: string;
      sequence: number;
      itemId: string;
      kind: 'thinking';
      lifecycle: 'delta';
      textDelta: string;
    }
  | {
      version: 1;
      runId: string;
      sequence: number;
      itemId: string;
      kind: 'tool';
      callId: string;
      lifecycle: 'started' | 'succeeded' | 'failed';
      toolName: string;
      argumentPreview?: string | null;
      resultSummary?: string | null;
      errorSummary?: string | null;
      durationMs?: number | null;
    };

export interface NormalizedSSEEvent {
  event:
    | 'status'
    | 'thinking'
    | 'content'
    | 'telemetry'
    | 'done'
    | 'stopped'
    | 'error'
    | 'cache_skipped'
    | 'assistant_trace'
    | 'voice_tool_error'
    | 'unknown'
    | 'malformed';
  data: string;
  parsedData?: unknown;
  /** Nonfatal protocol warning for unknown/malformed events (§5.2). */
  warning?: string;
}

export interface PollingEventItem {
  event_type: string;
  delta: unknown;
}

export interface PollingStatusResponse {
  status: 'processing' | 'done' | 'stopped' | 'error' | 'not_found';
  events: PollingEventItem[];
  cursor: number;
  error_message?: string | Record<string, unknown> | null;
}

/** Allowed wire statuses for polling (§5.3). */
export const POLLING_STATUSES = ['processing', 'done', 'stopped', 'error', 'not_found'] as const;

export type PollingStatus = (typeof POLLING_STATUSES)[number];

export interface AsyncAckResponse {
  /** Opaque 8-character runtime token (first 8 chars of uuid4). NOT a DB Message ID. */
  message_id: string;
  status: string;
}

export interface StopResponse {
  status: 'stop_requested';
}

export interface BranchRequest {
  branch_from_message_id: number;
}

export interface BranchResponse {
  conversation_id: number;
  session_id?: number;
  name: string;
}

// ── In-flight runtime marker (best-effort localStorage) ─────────────────────

export interface RuntimeMarker {
  conversationId: number;
  operation: RuntimeOperationKind;
  transport: ChatTransport;
  startedAt: number;
  /** Async run token, present once the backend acknowledged the POST. */
  asyncToken?: string;
}

// ── Error Modeling ─────────────────────────────────────────────────────────

export interface ChatRuntimeError {
  code: string;
  message: string;
  retryClass: RetrySafetyClass;
  status?: number | null;
  raw?: unknown;
}

// ── Runtime Overlay for UI ──────────────────────────────────────────────────

export interface OptimisticUserRow {
  kind: 'client_user';
  clientKey: string;
  content: string;
  createdAt: string;
  /** Honest local summary only; these are attachment IDs accepted for dispatch,
   * never fabricated persisted Message bindings. */
  pendingAttachmentIds: number[];
  /**
   * A+ exact ordinary-send correlation: exactly one UUID generated per POST
   * attempt and shared with that request's `client_turn_id`. The optimistic
   * row hands over only when a drawn canonical `role === 'user'` row carries
   * this exact value — never by content, timestamps, attachments or
   * `indexInSession`, and never via transport/GET/ACK ordering.
   */
  clientTurnId: string;
}

export interface RuntimeAssistantTrace {
  runId: string;
  lastSequence: number;
  items: AssistantRunTraceItem[];
}

export interface RuntimeAssistantRow {
  kind: 'client_assistant';
  clientKey: string;
  content: string;
  statusText?: string;
  /** Legacy fallback only; cleared/ignored once authoritative trace arrives. */
  thinking: string;
  /** Ordered authoritative realtime projection owned by this existing overlay. */
  assistantTrace?: RuntimeAssistantTrace;
  /**
   * CP-C `send_voice_msg` failures for this runtime turn, deduped by position.
   * Live-only evidence; the completed Message carries the durable copy.
   */
  voiceToolErrors?: VoiceToolError[];
  telemetry?: RuntimeTelemetry;
  cacheSkippedReason?: string;
  isStreaming: boolean;
  terminalKind?: TerminalKind;
  error?: ChatRuntimeError;
}

/** Immutable request-affecting values captured before a chat POST. */
export interface ConversationDispatchSettings {
  model: string;
  endpoint: number;
  thinkingLevel: string;
  cacheEnabled: boolean;
  sessionType: 'full' | 'lite';
  /** Present only for g045; non-g045 requests omit this field entirely. */
  memoryInjectionEnabled?: boolean;
}

/** Minimum typed ordinary-turn input added by P1C and extended by P1D. */
export interface ChatTurnInput {
  content: string;
  pendingAttachments?: number[];
  /**
   * Explicit Force Cache send (V3 parity): only the explicit composer entry
   * (Force Cache button / Ctrl+Shift+Enter with sendable attachments) sets
   * true. Ordinary sends omit/false and the client serializes
   * force_cache_rebuild=true solely for this flag.
   */
  forceCacheRebuild?: boolean;
  /** Uploaded-audio retry supplies its original settings instead of live HUD state. */
  dispatchSettings?: ConversationDispatchSettings;
  /** Present only for an uploaded-audio recovery snapshot. */
  attemptKey?: string;
}

export type AttemptPersistence =
  | { kind: 'exact_persisted'; messageId: number; indexInSession: number }
  | { kind: 'proven_absent' }
  | { kind: 'unknown'; reason: string };

export interface RuntimeAttemptOutcome {
  attemptKey: string;
  terminal: 'done' | 'stopped' | 'error' | 'interrupted' | 'rejected' | 'reconcile_failed';
  persistence: AttemptPersistence;
}

/** Action outcome returned by dispatch commands (accepted vs not). */
export type TurnAcceptance = 'accepted' | 'rejected';

// ── Route-runtime operation state ───────────────────────────────────────────
// One discriminated OperationState owns the in-tab write lock and recovery
// decision. `busy`, presentation `status`, stop visibility and banner actions
// are projections of this union only.

/** Stable owner of one operation; `startedAt` also keys the runtime marker. */
export interface StableOperationOwner {
  conversationId: number;
  operation: RuntimeOperationKind;
  transport: ChatTransport;
  startedAt: number;
}

/**
 * Ephemeral route epoch + stable owner + in-memory destructive fact.
 * The epoch is an in-memory callback guard.
 */
export interface CallbackIdentity {
  epoch: number;
  stableOwner: StableOperationOwner;
  /** In-memory destructive fact (edit/regenerate reset the message family). */
  destructive: boolean;
}

/** Transport payload of a live/stopping operation. */
export type TransportPayload =
  | { transport: 'sse'; readerId: number }
  | { transport: 'async'; token: string; cursor: number };

/** Request intent captured at dispatch. */
export interface DispatchIntent {
  operation: 'send' | 'edit' | 'regenerate' | 'branch';
  content: string;
  editMessageId?: number;
  branchFromMessageId?: number;
  /** P1D validated request snapshot. Branch has no chat dispatch settings. */
  dispatchSettings?: ConversationDispatchSettings;
  /** P1C ordinary/recovery turns only. Edit/regenerate never receive compose IDs. */
  pendingAttachments?: number[];
  /** Explicit Force Cache intent captured at dispatch; honored for `send` only. */
  forceCacheRebuild?: boolean;
  attemptKey?: string;
}

/** §8.1 scrolled-up reconciliation stages. */
export type ReconcileStage = 'idle' | 'fetching' | 'applying' | 'releasing';

export type ReconcileOutcome =
  | 'done'
  | 'stopped'
  | 'error'
  | 'interrupted'
  | 'not_found'
  | 'ack_refresh';

export interface ReconcileContext {
  outcome: ReconcileOutcome;
  waitForLatest: boolean;
  stage: ReconcileStage;
}

/** Data-only blocked reasons; each maps to exactly one recovery descriptor. */
export type BlockedReason =
  | 'uncertain_write'
  | 'not_found'
  | 'poll_failed'
  | 'reconcile_failed';

export type RecoveryDescriptor =
  | {
      kind: 'resume-poll';
      token: string;
      /** Phase was `stopping` when the pause was captured: resume stopping
       *  instead of live; 'accepted' blocks a duplicate Stop POST. */
      preserveStop?: 'accepted' | 'failed';
      /** A stop POST from the paused state is in flight. */
      stopPending?: boolean;
    }
  | { kind: 'ack' }
  | { kind: 'reconcile-retry'; context: ReconcileContext };

export type OperationState =
  | { phase: 'idle' }
  | {
      phase: 'predispatch';
      identity: CallbackIdentity;
      intent: DispatchIntent;
    }
  | {
      phase: 'live';
      identity: CallbackIdentity;
      payload: TransportPayload;
    }
  | {
      phase: 'stopping';
      identity: CallbackIdentity;
      payload: TransportPayload;
      stopOutcome: 'accepted' | 'failed';
    }
  | {
      phase: 'reconciling';
      identity: CallbackIdentity;
      reconcile: ReconcileContext;
    }
  | {
      phase: 'blocked';
      identity: CallbackIdentity;
      reason: BlockedReason;
      message: string;
      recovery: RecoveryDescriptor | null;
    };

export interface RuntimeOverlayState {
  optimisticUser?: OptimisticUserRow;
  runtimeAssistant?: RuntimeAssistantRow;
}
