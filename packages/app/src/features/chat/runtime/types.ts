import type { AssistantRunTraceItem } from '../types';

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

// ── V4 Storage Lease & Uncertainty ──────────────────────────────────────────

export interface V4RuntimeLease {
  version: 1;
  operation: RuntimeOperationKind;
  conversationId: number;
  transport: ChatTransport;
  asyncToken?: string;
  cursor?: number;
  startedAt: number;
  updatedAt: number;
  disposition: 'pending' | 'active' | 'uncertain';
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

// ── Authoritative route-runtime operation state (C1B intervention §3) ──────
// One discriminated OperationState owns every write lock / lease / recovery
// decision. `busy`, presentation `status`, `locked`, `hasPendingReconcile`,
// stop visibility and modal confirm availability are PROJECTIONS of this
// union only — no parallel mutable safety truth may exist.

/** Durable lease owner fields — already present in V4RuntimeLease. */
export interface StableOperationOwner {
  conversationId: number;
  operation: RuntimeOperationKind;
  transport: ChatTransport;
  startedAt: number;
}

/**
 * Ephemeral route epoch + stable owner + in-memory destructive fact.
 * The epoch is an in-memory callback guard: never durable, never part of
 * lease matching (§3.1).
 */
export interface CallbackIdentity {
  epoch: number;
  stableOwner: StableOperationOwner;
  /** In-memory destructive fact (edit/regenerate reset the message family). */
  destructive: boolean;
}

/**
 * Transport payload of a live/stopping operation.
 * `live_async` always carries the complete durable token + cursor snapshot.
 */
export type TransportPayload =
  | { transport: 'sse'; readerId: number }
  | { transport: 'async'; token: string; cursor: number };

/** Request intent retained by predispatch/storage-blocked suspension (§4.2). */
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

/** Suspended in-memory operation context (never proof of storage ownership). */
export interface SuspendedOperation {
  identity: CallbackIdentity;
  intent: DispatchIntent;
  pendingSnapshot: V4RuntimeLease;
  /** True when the POST already left this tab before the storage failure. */
  postSent: boolean;
  /**
   * R5: captured constrained continuation for an ACCEPTED operation whose
   * durable upgrade never landed. Reread-absent must re-attach the captured
   * token-bearing lease and continue (begin-poll/continue-live/resume-poll),
   * never collapse to uncertain or release idle (§10.1 B3).
   */
  onPersisted?: ConstrainedAfter;
}

/** §8.1 scrolled-up reconciliation stages — four separated effects (§7). */
export type ReconcileStage = 'idle' | 'fetching' | 'applying' | 'clearing' | 'releasing';

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
  | 'storage_unavailable'
  | 'clear_blocked'
  | 'poll_failed'
  | 'reconcile_failed';

/**
 * Exact, data-only recovery actions (§4.1). Only `persisted`/`cleared` may
 * execute the constrained success continuation; the transition owner
 * revalidates identity + storage ownership before applying it.
 */
export type ConstrainedAfter =
  | { kind: 'continue-live'; preserveStop?: 'accepted' | 'failed' }
  | { kind: 'begin-poll'; preserveStop?: 'accepted' | 'failed' }
  | {
      kind: 'resume-poll';
      /** R5-B4/R6-01: phase was `stopping` when the recovery was captured —
       *  restore stopping (with its stopOutcome) instead of live; stopOutcome
       *  'accepted' blocks a duplicate Stop POST. */
      preserveStop?: 'accepted' | 'failed';
    }
  | { kind: 'ack-refresh' }
  | {
      kind: 'branch-navigate';
      conversationId: number;
      /** R5-A2: per-invocation caller token; explicit modal close/replacement
       *  or route switch revokes it — a revoked caller never navigates, even
       *  after a later clear-retry succeeds. */
      callerToken?: { revoked: boolean };
    }
  | {
      kind: 'unlock';
      /** D-F01: sanitized in-memory stopped trace projection carried across
       *  clear-retry; applied only after successful clear. */
      retainedTrace?: RuntimeAssistantTrace;
    };

export type RecoveryDescriptor =
  | { kind: 'reread' }
  | {
      kind: 'persist-retry';
      expectedPrior: V4RuntimeLease | null;
      next: V4RuntimeLease;
      onPersisted: ConstrainedAfter;
      /** R5-B2: a stop POST has already been accepted from the blocked state;
       *  Stop is hidden until the durability retry resumes. */
      stopPending?: boolean;
    }
  | { kind: 'clear-retry'; expectedPrior: V4RuntimeLease; onCleared: ConstrainedAfter }
  | { kind: 'resume-poll'; preserveStop?: 'accepted' | 'failed'; stopPending?: boolean }
  | { kind: 'ack' }
  | { kind: 'reconcile-retry'; context: ReconcileContext };

/**
 * The ONE authoritative route-runtime union (intervention §3.1).
 * Names are local; ownership is binding: every lock/lease/recovery decision
 * reads THIS state and nothing else.
 */
export type OperationState =
  | { phase: 'idle' }
  | {
      phase: 'storage_blocked_read';
      conversationId: number;
      reason: string;
      suspendedOperation: SuspendedOperation | null;
    }
  | {
      phase: 'predispatch';
      identity: CallbackIdentity;
      intent: DispatchIntent;
      pendingSnapshot: V4RuntimeLease;
    }
  | {
      phase: 'live';
      identity: CallbackIdentity;
      payload: TransportPayload;
      snapshot: V4RuntimeLease;
    }
  | {
      phase: 'stopping';
      identity: CallbackIdentity;
      payload: TransportPayload;
      snapshot: V4RuntimeLease;
      stopOutcome: 'accepted' | 'failed';
    }
  | {
      phase: 'reconciling';
      identity: CallbackIdentity;
      snapshot: V4RuntimeLease;
      reconcile: ReconcileContext;
    }
  | {
      phase: 'blocked';
      identity: CallbackIdentity;
      reason: BlockedReason;
      snapshot: V4RuntimeLease;
      message: string;
      recovery: RecoveryDescriptor | null;
    };

export interface RuntimeOverlayState {
  optimisticUser?: OptimisticUserRow;
  runtimeAssistant?: RuntimeAssistantRow;
}
