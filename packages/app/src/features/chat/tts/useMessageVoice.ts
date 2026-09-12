/**
 * P2T message-voice lifecycle state machine (Plan §7 CP 2T-2, D1/D2/D3).
 *
 * One hook instance owns exactly one Message row's voice lifecycle:
 * - the five-state lifecycle lives in local React state, never in the
 *   `queryKeys.messages` family and never in a new Query key (D1);
 * - a click is the only trigger: POST, then observe GET per the backend's
 *   `retry_after_ms` until a terminal truth (D2/D3) — GET never starts work
 *   and the client never invents a state;
 * - the observation window is bounded (90s from the click); when it expires
 *   the flow stops observing and stays truthfully retryable;
 * - every async continuation carries its flow id: message-identity changes
 *   and unmount abort the controller and drop late responses, so a stale
 *   conversation can never write into the current one (D1/T5);
 * - `playToken` marks click-originated arrivals at `playable` so the control
 *   attempts playback exactly once per user intent (D3, INV-4).
 *
 * The adapter pair is injectable so construction tests can drive the loop
 * directly; production always uses the frozen TTS transport in `./api`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceProjection } from '../types';
import { readMessageVoiceRender, startMessageVoiceRender } from './api';
import type { TtsOutcome, TtsPhase } from './types';

export interface MessageVoiceAdapters {
  start: (conversationId: number, messageId: number, signal?: AbortSignal) => Promise<TtsOutcome>;
  read: (conversationId: number, messageId: number, signal?: AbortSignal) => Promise<TtsOutcome>;
}

/** Client observation bound measured from the click (D3). */
export const MESSAGE_VOICE_OBSERVATION_LIMIT_MS = 90_000;

export interface UseMessageVoiceOptions {
  conversationId: number;
  messageId: number;
  /** Read-model projection for this row (`available` decides the entry state). */
  voice: VoiceProjection;
  /** Injectable transport pair (tests); defaults to the frozen TTS adapters. */
  adapters?: MessageVoiceAdapters;
  /** Overrides the observation bound (tests only). */
  observationLimitMs?: number;
  /** Injectable clock (tests only). */
  now?: () => number;
}

export interface MessageVoiceApi {
  phase: TtsPhase;
  /** Latest truthful outcome; `null` before the first observed truth. */
  outcome: TtsOutcome | null;
  /** True while the click-initiated request/observation flow is open. */
  inFlight: boolean;
  /** Increments on every click-originated arrival at `playable`. */
  playToken: number;
  /** Click entry: `idle`/`failed_retryable` start one request; others no-op. */
  request: () => void;
  /** Media-element failure: `playable` → retryable artifact truth (T6). */
  reportMediaFailure: () => void;
}

interface VoiceState {
  phase: TtsPhase;
  outcome: TtsOutcome | null;
  playToken: number;
}

const DEFAULT_ADAPTERS: MessageVoiceAdapters = {
  start: startMessageVoiceRender,
  read: readMessageVoiceRender,
};

function abortError(): DOMException {
  return new DOMException('message voice flow aborted', 'AbortError');
}

function isAbortCause(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    (cause as { name?: unknown }).name === 'AbortError'
  );
}

function timeoutOutcome(): TtsOutcome {
  return { phase: 'failed_retryable', code: 'generation_timeout', message: null };
}

/** Observable delay: resolves after `ms` unless the flow aborts first. */
function delay(
  ms: number,
  signal: AbortSignal,
  registerTimer: (id: number | null) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const id = window.setTimeout(() => {
      registerTimer(null);
      resolve();
    }, Math.max(0, ms));
    registerTimer(id);
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(id);
        registerTimer(null);
        reject(abortError());
      },
      { once: true },
    );
  });
}

export function useMessageVoice(options: UseMessageVoiceOptions): MessageVoiceApi {
  const {
    conversationId,
    messageId,
    voice,
    adapters = DEFAULT_ADAPTERS,
    observationLimitMs = MESSAGE_VOICE_OBSERVATION_LIMIT_MS,
    now = Date.now,
  } = options;
  const available = voice.available;

  const [state, setState] = useState<VoiceState>(() => ({
    phase: available ? 'idle' : 'unavailable',
    outcome: null,
    playToken: 0,
  }));
  const [inFlight, setInFlight] = useState(false);

  const flowIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const deadlineTimerRef = useRef<number | null>(null);
  // Synchronous phase truth for same-tick click guards.
  const phaseRef = useRef(state.phase);
  phaseRef.current = state.phase;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearDeadlineTimer = useCallback(() => {
    if (deadlineTimerRef.current !== null) {
      window.clearTimeout(deadlineTimerRef.current);
      deadlineTimerRef.current = null;
    }
  }, []);

  const finishFlow = useCallback(() => {
    inFlightRef.current = false;
    setInFlight(false);
    clearTimer();
    clearDeadlineTimer();
  }, [clearDeadlineTimer, clearTimer]);

  /** Invalidate the open flow: bump the id, abort transport, drop timers. */
  const abortFlow = useCallback(() => {
    flowIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    clearTimer();
    clearDeadlineTimer();
  }, [clearDeadlineTimer, clearTimer]);

  // Identity-keyed reset (D1): a new row identity or unmount invalidates any
  // open flow, and late responses can never write into the next identity.
  useEffect(() => {
    abortFlow();
    inFlightRef.current = false;
    setInFlight(false);
    setState({ phase: available ? 'idle' : 'unavailable', outcome: null, playToken: 0 });
    return () => abortFlow();
  }, [abortFlow, available, conversationId, messageId]);

  const reportMediaFailure = useCallback(() => {
    // A DOM media error cannot reveal an HTTP body: it stays a retryable
    // artifact failure, never endpoint-404 unavailability (T6, spec §4).
    setState((prev) =>
      prev.phase === 'playable'
        ? {
            phase: 'failed_retryable',
            outcome: {
              phase: 'failed_retryable',
              code: 'audio_artifact_missing',
              message: null,
            },
            playToken: prev.playToken,
          }
        : prev,
    );
  }, []);

  const request = useCallback(() => {
    if (!available || inFlightRef.current) return;
    const phase = phaseRef.current;
    if (phase !== 'idle' && phase !== 'failed_retryable') return;

    inFlightRef.current = true;
    setInFlight(true);
    const flowId = ++flowIdRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    const deadline = now() + observationLimitMs;

    // The click is the user's intent: stay in `generating` until the backend
    // reports a terminal truth or the observation bound expires.
    setState((prev) => ({ ...prev, phase: 'generating', outcome: null }));

    const settle = (outcome: TtsOutcome) => {
      if (flowIdRef.current !== flowId) return;
      setState((prev) => ({
        phase: outcome.phase,
        outcome,
        playToken: outcome.phase === 'playable' ? prev.playToken + 1 : prev.playToken,
      }));
    };

    // Hard observation bound (D3): even a transport that never settles must
    // end as a truthful retryable timeout, not as an eternal `generating`.
    deadlineTimerRef.current = window.setTimeout(() => {
      deadlineTimerRef.current = null;
      if (flowIdRef.current !== flowId) return;
      settle(timeoutOutcome());
      finishFlow();
      controller.abort();
      // Close the flow: a transport that ignores the abort must never be able
      // to write a late truth over the settled timeout.
      flowIdRef.current += 1;
    }, Math.max(0, observationLimitMs));

    void (async () => {
      try {
        let outcome = await adapters.start(conversationId, messageId, controller.signal);
        for (;;) {
          if (flowIdRef.current !== flowId) return;
          settle(outcome);
          if (outcome.phase !== 'generating') return;
          if (now() >= deadline) {
            settle(timeoutOutcome());
            return;
          }
          await delay(Math.min(outcome.retryAfterMs, deadline - now()), controller.signal, (id) => {
            timerRef.current = id;
          });
          if (flowIdRef.current !== flowId) return;
          if (now() >= deadline) {
            settle(timeoutOutcome());
            return;
          }
          outcome = await adapters.read(conversationId, messageId, controller.signal);
        }
      } catch (cause) {
        // Adapters only throw for aborts (own control flow) — anything else
        // observed here is an unexpected transport failure, kept retryable.
        if (!isAbortCause(cause)) {
          settle({ phase: 'failed_retryable', code: 'network', message: null });
        }
      } finally {
        if (flowIdRef.current === flowId) finishFlow();
      }
    })();
  }, [adapters, available, conversationId, finishFlow, messageId, now, observationLimitMs]);

  return {
    phase: state.phase,
    outcome: state.outcome,
    inFlight,
    playToken: state.playToken,
    request,
    reportMediaFailure,
  };
}
