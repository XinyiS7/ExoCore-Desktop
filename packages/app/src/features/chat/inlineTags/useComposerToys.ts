import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchMessagePage } from '../api';
import type { ActiveTurnCorrelation, ReconcileOutcome } from '../runtime/types';
import type { ConversationPinView, MessageView } from '../types';
import { createPhysicsDie, type PhysicsDie, type TrayBounds } from './dicePhysics';
import {
  buildPendingDiceState,
  clampDiceModifier,
  expandDiceExpr,
  orderDiceForExpr,
  type DieFaces,
  type PendingDiceState,
} from './diceTypes';
import { parseInlineTags } from './parse';
import type { RollReplayPayload } from './rollReplay';
import {
  assemblePinTag,
  hasUnsafePinClose,
  type CommittingPin,
  type DraftPin,
} from './pinColors';
import type { DiceRollOverlayData } from './DiceRollOverlay';
import type { PinDraftEditorState, ToyTab } from './ToyDrawer';

const DEFAULT_PIN_EDITOR: PinDraftEditorState = {
  editingDraftId: null,
  body: '',
  color: 'butter',
};

const DEFAULT_TRAY_BOUNDS: TrayBounds = { width: 320, height: 156, padding: 10 };
const PROBE_DELAYS_MS = [400, 700, 1200, 1800];

export interface ToySubmissionSnapshot {
  plainText: string;
  pendingDice: PendingDiceState | null;
  draftPins: DraftPin[];
  assembledText: string;
}

export interface UseComposerToysOptions {
  conversationId: number;
  activeTurnCorrelation: ActiveTurnCorrelation | null;
  persistedPins: readonly ConversationPinView[];
  runtimeAssistant?: { clientKey: string; content: string; isStreaming: boolean } | null;
  latestPersistedAssistantId?: number | null;
}

function makeUid(prefix: string, seq: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${seq}`;
}

export function extractRollResultFromMessage(
  content: string,
  expectedExpr: string,
  expectedDiceCount: number,
): { dice: number[]; total: number } | null {
  const tags = parseInlineTags(content).flatMap((seg) =>
    seg.type === 'tag' && seg.tag.kind === 'roll_result' && seg.tag.by === 'user' ? [seg.tag] : [],
  );
  if (tags.length === 0) return null;
  const normalizedTarget = expectedExpr.replace(/\s+/g, '');
  const exact = tags.find(
    (t) => t.expr.replace(/\s+/g, '') === normalizedTarget && t.dice.length === expectedDiceCount,
  );
  if (exact) return { dice: [...exact.dice], total: exact.total };
  const byCount = [...tags].reverse().find((t) => t.dice.length === expectedDiceCount);
  if (byCount) return { dice: [...byCount.dice], total: byCount.total };
  const fallback = tags[tags.length - 1];
  return { dice: [...fallback.dice], total: fallback.total };
}

function extractAssistantRollFromMessage(
  msg: MessageView,
  targetTagIndex?: number,
  expectedExpr?: string,
): { expr: string; dice: number[]; total: number } | null {
  const normalizedTarget = expectedExpr ? expectedExpr.replace(/\s+/g, '') : null;
  const rolls = msg.inlineRolls ?? [];
  if (rolls.length > 0) {
    const byIndex = targetTagIndex !== undefined ? rolls.find((r) => r.tagIndex === targetTagIndex) : undefined;
    const byExpr = normalizedTarget
      ? rolls.find((r) => r.expression.replace(/\s+/g, '') === normalizedTarget)
      : undefined;
    const picked = byIndex ?? byExpr ?? rolls[rolls.length - 1];
    if (picked) {
      return { expr: picked.expression, dice: [...picked.dice], total: picked.total };
    }
  }

  const fallbackTags = parseInlineTags(msg.content).flatMap((seg) =>
    seg.type === 'tag' && seg.tag.kind === 'roll_result' && seg.tag.by === 'assistant' ? [seg.tag] : [],
  );
  if (fallbackTags.length > 0) {
    const byExpr = normalizedTarget
      ? fallbackTags.find((t) => t.expr.replace(/\s+/g, '') === normalizedTarget)
      : undefined;
    const picked = byExpr ?? fallbackTags[fallbackTags.length - 1];
    if (picked) {
      return { expr: picked.expr, dice: [...picked.dice], total: picked.total };
    }
  }
  return null;
}

export function useComposerToys({
  conversationId,
  activeTurnCorrelation,
  persistedPins,
  runtimeAssistant = null,
  latestPersistedAssistantId = null,
}: UseComposerToysOptions) {
  const seqRef = useRef(0);
  const trayBoundsRef = useRef<TrayBounds>(DEFAULT_TRAY_BOUNDS);
  const stagedCounterRef = useRef(0);
  const seenStreamRollsRef = useRef<{ clientKey: string; count: number } | null>(null);
  const handledAssistantIdRef = useRef<number>(0);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ToyTab>('dice');
  const [physicsDice, setPhysicsDice] = useState<PhysicsDie[]>([]);
  const [modifier, setModifierState] = useState(0);
  const [draftPins, setDraftPins] = useState<DraftPin[]>([]);
  const [committingPins, setCommittingPins] = useState<CommittingPin[]>([]);
  const [pinEditor, setPinEditor] = useState<PinDraftEditorState>(DEFAULT_PIN_EDITOR);
  const [rollOverlay, setRollOverlay] = useState<DiceRollOverlayData | null>(null);

  // Track persisted pins signature & reconcile count so committingPins drops right after detail refresh
  const awaitingPinDetailRef = useRef(false);

  // Reset per-conversation toy drafts/overlays on route change
  useEffect(() => {
    awaitingPinDetailRef.current = false;
    seenStreamRollsRef.current = null;
    handledAssistantIdRef.current = 0;
    setDrawerOpen(false);
    setActiveTab('dice');
    setPhysicsDice([]);
    setModifierState(0);
    setDraftPins([]);
    setCommittingPins([]);
    setPinEditor(DEFAULT_PIN_EDITOR);
    setRollOverlay(null);
  }, [conversationId]);

  useEffect(() => {
    if (activeTurnCorrelation === null && latestPersistedAssistantId != null) {
      handledAssistantIdRef.current = Math.max(handledAssistantIdRef.current, latestPersistedAssistantId);
    }
  }, [activeTurnCorrelation, latestPersistedAssistantId]);

  const pendingDice = useMemo(
    () => buildPendingDiceState(physicsDice, modifier),
    [physicsDice, modifier],
  );

  const totalPendingToyCount = (pendingDice ? pendingDice.dice.length : 0) + draftPins.length;

  const addDie = useCallback(
    (faces: DieFaces, spawn?: { x?: number; y?: number; vx?: number; vy?: number }) => {
      seqRef.current += 1;
      const id = makeUid('die', seqRef.current);
      setPhysicsDice((prev) => {
        if (prev.length >= 8) return prev;
        return [...prev, createPhysicsDie(id, faces, trayBoundsRef.current, spawn)];
      });
    },
    [],
  );

  const removeDie = useCallback((id: string) => {
    setPhysicsDice((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const clearDice = useCallback(() => {
    setPhysicsDice([]);
    setModifierState(0);
  }, []);

  const setModifier = useCallback((next: number) => {
    setModifierState(clampDiceModifier(next));
  }, []);

  const commitPinEditor = useCallback((): { ok: true } | { ok: false; error: string } => {
    const trimmed = pinEditor.body.trim();
    if (!trimmed) {
      setPinEditor(DEFAULT_PIN_EDITOR);
      return { ok: true };
    }
    if (hasUnsafePinClose(trimmed)) {
      return { ok: false, error: '便利贴正文不能包含 </pin>' };
    }
    if (pinEditor.editingDraftId) {
      const targetId = pinEditor.editingDraftId;
      const nextColor = pinEditor.color;
      setDraftPins((prev) => {
        const exists = prev.some((d) => d.id === targetId);
        if (!exists) {
          return [{ id: targetId, body: trimmed, color: nextColor }, ...prev];
        }
        return prev.map((d) => (d.id === targetId ? { ...d, body: trimmed, color: nextColor } : d));
      });
    } else {
      seqRef.current += 1;
      const id = makeUid('draft-pin', seqRef.current);
      const nextColor = pinEditor.color;
      setDraftPins((prev) => [{ id, body: trimmed, color: nextColor }, ...prev]);
    }
    setPinEditor(DEFAULT_PIN_EDITOR);
    return { ok: true };
  }, [pinEditor]);

  const discardPinEditor = useCallback(() => {
    setPinEditor(DEFAULT_PIN_EDITOR);
  }, []);

  const editDraftPin = useCallback(
    (draftId: string) => {
      const target = draftPins.find((d) => d.id === draftId);
      if (!target) return;
      setPinEditor({ editingDraftId: target.id, body: target.body, color: target.color });
      setActiveTab('pin');
      setDrawerOpen(true);
    },
    [draftPins],
  );

  const removeDraftPin = useCallback((draftId: string) => {
    setDraftPins((prev) => prev.filter((d) => d.id !== draftId));
    setPinEditor((prev) => (prev.editingDraftId === draftId ? DEFAULT_PIN_EDITOR : prev));
  }, []);

  const prepareSubmission = useCallback(
    (basePlainText: string): { ok: true; snapshot: ToySubmissionSnapshot } | { ok: false; error: string } => {
      let effectiveDraftPins = [...draftPins];
      const pendingBody = pinEditor.body.trim();
      if (pendingBody.length > 0) {
        if (hasUnsafePinClose(pendingBody)) {
          return { ok: false, error: '便利贴正文不能包含 </pin>' };
        }
        if (pinEditor.editingDraftId) {
          const exists = effectiveDraftPins.some((d) => d.id === pinEditor.editingDraftId);
          effectiveDraftPins = exists
            ? effectiveDraftPins.map((d) =>
                d.id === pinEditor.editingDraftId ? { ...d, body: pendingBody, color: pinEditor.color } : d,
              )
            : [{ id: pinEditor.editingDraftId, body: pendingBody, color: pinEditor.color }, ...effectiveDraftPins];
        } else {
          seqRef.current += 1;
          effectiveDraftPins = [
            { id: makeUid('draft-pin', seqRef.current), body: pendingBody, color: pinEditor.color },
            ...effectiveDraftPins,
          ];
        }
      }

      const trimmed = basePlainText.trim();
      const parts: string[] = [];
      if (trimmed) parts.push(trimmed);
      if (pendingDice) parts.push(`<roll=${pendingDice.expr}>`);
      if (effectiveDraftPins.length > 0) {
        parts.push(effectiveDraftPins.map(assemblePinTag).join('\n'));
      }
      return {
        ok: true,
        snapshot: {
          plainText: basePlainText,
          pendingDice,
          draftPins: effectiveDraftPins,
          assembledText: parts.join('\n\n'),
        },
      };
    },
    [pendingDice, draftPins, pinEditor],
  );

  const noteStagedTurn = useCallback(() => {
    stagedCounterRef.current += 1;
  }, []);

  const completeAcceptedSubmission = useCallback(
    (snapshot: ToySubmissionSnapshot, stagedBeforeCount: number) => {
      const wasStaged = stagedCounterRef.current !== stagedBeforeCount;
      setDrawerOpen(false);
      setPinEditor(DEFAULT_PIN_EDITOR);
      setPhysicsDice([]);
      setModifierState(0);
      setDraftPins([]);

      if (wasStaged) {
        setCommittingPins([]);
        setRollOverlay(null);
        return;
      }

      if (snapshot.draftPins.length > 0) {
        awaitingPinDetailRef.current = false;
        setCommittingPins(snapshot.draftPins.map((d) => ({ id: d.id, body: d.body, color: d.color })));
      }

      if (snapshot.pendingDice) {
        seqRef.current += 1;
        const ordered = orderDiceForExpr(snapshot.pendingDice.dice).map((d) => ({
          id: d.id,
          faces: d.faces,
        }));
        setRollOverlay({
          rollKey: makeUid('roll', seqRef.current),
          by: 'user',
          conversationId,
          clientTurnId:
            activeTurnCorrelation?.conversationId === conversationId
              ? activeTurnCorrelation.clientTurnId
              : null,
          dice: ordered,
          modifier: snapshot.pendingDice.modifier,
          expr: snapshot.pendingDice.expr,
          startedAt: performance.now(),
          result: null,
        });
      }
    },
    [conversationId, activeTurnCorrelation],
  );

  const restoreToys = useCallback(
    (restoredDice: PendingDiceState | null, restoredPins: readonly DraftPin[]) => {
      awaitingPinDetailRef.current = false;
      setCommittingPins([]);
      setRollOverlay(null);
      if (restoredDice && restoredDice.dice.length > 0) {
        const bounds = trayBoundsRef.current;
        setPhysicsDice(
          restoredDice.dice.map((d, idx) =>
            createPhysicsDie(d.id, d.faces, bounds, {
              x: bounds.padding + 32 + (idx % 4) * 56,
              y: bounds.padding + 36 + Math.floor(idx / 4) * 52,
              vx: 0,
              vy: 0,
            }),
          ),
        );
        setModifierState(restoredDice.modifier);
      }
      if (restoredPins.length > 0) {
        setDraftPins([...restoredPins]);
      }
    },
    [],
  );

  const dismissRollOverlay = useCallback((rollKey: string) => {
    setRollOverlay((prev) => (prev && prev.rollKey === rollKey ? null : prev));
  }, []);

  const replayRoll = useCallback(
    (payload: RollReplayPayload) => {
      const expanded = expandDiceExpr(payload.expr, 'replay-die');
      if (!expanded || payload.dice.length === 0) return;
      seqRef.current += 1;
      setRollOverlay({
        rollKey: makeUid('roll-replay', seqRef.current),
        by: payload.by,
        conversationId,
        clientTurnId: null,
        dice: expanded.dice,
        modifier: expanded.modifier,
        expr: payload.expr,
        startedAt: performance.now(),
        result: { dice: [...payload.dice], total: payload.total },
      });
    },
    [conversationId],
  );

  // Trigger rolling overlay as soon as streaming assistant emits `<roll=...>`
  const streamClientKey = runtimeAssistant?.clientKey ?? null;
  const streamContent = runtimeAssistant?.content ?? '';
  const streamActive = Boolean(runtimeAssistant?.isStreaming);

  useEffect(() => {
    if (!streamClientKey || !streamContent) return;
    const rollSegs = parseInlineTags(streamContent, { streaming: streamActive }).flatMap((seg) =>
      seg.type === 'tag' && seg.tag.kind === 'roll' ? [{ index: seg.index, expr: seg.tag.expr }] : [],
    );
    if (seenStreamRollsRef.current?.clientKey !== streamClientKey) {
      seenStreamRollsRef.current = { clientKey: streamClientKey, count: 0 };
    }
    if (rollSegs.length <= seenStreamRollsRef.current.count) return;
    seenStreamRollsRef.current = { clientKey: streamClientKey, count: rollSegs.length };

    const latest = rollSegs[rollSegs.length - 1];
    const expanded = expandDiceExpr(latest.expr, 'ast-die');
    if (!expanded) return;

    seqRef.current += 1;
    const targetClientTurnId =
      activeTurnCorrelation?.conversationId === conversationId ? activeTurnCorrelation.clientTurnId : null;
    setRollOverlay({
      rollKey: makeUid('roll-ast', seqRef.current),
      by: 'assistant',
      conversationId,
      clientTurnId: targetClientTurnId,
      assistantTagIndex: latest.index,
      dice: expanded.dice,
      modifier: expanded.modifier,
      expr: latest.expr,
      startedAt: performance.now(),
      result: null,
    });
  }, [conversationId, streamClientKey, streamContent, streamActive, activeTurnCorrelation]);

  // Keep live unrevealed overlay bound to the active turn's clientTurnId if correlation arrived later
  useEffect(() => {
    if (
      rollOverlay &&
      rollOverlay.conversationId === conversationId &&
      rollOverlay.result === null &&
      rollOverlay.clientTurnId === null &&
      activeTurnCorrelation?.conversationId === conversationId
    ) {
      setRollOverlay((prev) =>
        prev && prev.rollKey === rollOverlay.rollKey
          ? { ...prev, clientTurnId: activeTurnCorrelation.clientTurnId }
          : prev,
      );
    }
  }, [conversationId, rollOverlay, activeTurnCorrelation]);

  // Clear committingPins once the conversation detail updates after reconciliation
  useEffect(() => {
    if (committingPins.length > 0 && awaitingPinDetailRef.current) {
      awaitingPinDetailRef.current = false;
      setCommittingPins([]);
    }
  }, [persistedPins, committingPins.length]);

  // Handle canonical reconcile callback from useChatRuntime
  const handleTurnReconciled = useCallback(
    (
      messages: readonly MessageView[],
      info: {
        conversationId: number;
        clientTurnId: string | null;
        outcome: ReconcileOutcome;
        shouldRestoreFailedTurn: boolean;
      },
    ) => {
      if (info.conversationId !== conversationId) return;

      if (info.shouldRestoreFailedTurn) {
        setCommittingPins([]);
        setRollOverlay(null);
        awaitingPinDetailRef.current = false;
        return;
      }

      if (committingPins.length > 0) {
        awaitingPinDetailRef.current = true;
      }

      const targetTurnId = rollOverlay?.clientTurnId ?? info.clientTurnId;
      const userIdx = targetTurnId
        ? messages.findIndex((m) => m.role === 'user' && m.clientTurnId === targetTurnId)
        : -1;
      const candidateScope = userIdx >= 0 ? messages.slice(userIdx + 1) : messages;
      const latestAssistantMsg = [...candidateScope].reverse().find((m) => m.role === 'assistant');

      if (rollOverlay && rollOverlay.conversationId === conversationId && rollOverlay.result === null) {
        if (rollOverlay.by === 'assistant') {
          if (latestAssistantMsg) {
            handledAssistantIdRef.current = Math.max(handledAssistantIdRef.current, latestAssistantMsg.id);
            const extracted = extractAssistantRollFromMessage(
              latestAssistantMsg,
              rollOverlay.assistantTagIndex,
              rollOverlay.expr,
            );
            if (extracted) {
              setRollOverlay((prev) =>
                prev && prev.rollKey === rollOverlay.rollKey
                  ? { ...prev, result: { dice: extracted.dice, total: extracted.total } }
                  : prev,
              );
              return;
            }
          }
          setRollOverlay(null);
          return;
        }

        const userMsg = userIdx >= 0 ? messages[userIdx] : undefined;
        const extracted = userMsg
          ? extractRollResultFromMessage(userMsg.content, rollOverlay.expr, rollOverlay.dice.length)
          : null;
        if (extracted) {
          setRollOverlay((prev) =>
            prev && prev.rollKey === rollOverlay.rollKey ? { ...prev, result: extracted } : prev,
          );
        } else {
          // User row never persisted or contained no roll_result -> converge cleanly
          setRollOverlay(null);
        }
      }

      // Catch-up: if streaming missed the assistant `<roll>` (e.g. reconnect / direct reconcile),
      // trigger the assistant roll reveal animation once for this newly persisted assistant turn.
      const streamAlreadySeen = Boolean(
        streamClientKey &&
          seenStreamRollsRef.current?.clientKey === streamClientKey &&
          seenStreamRollsRef.current.count > 0,
      );
      if (latestAssistantMsg && latestAssistantMsg.id > handledAssistantIdRef.current) {
        handledAssistantIdRef.current = latestAssistantMsg.id;
        if (!streamAlreadySeen && (!rollOverlay || rollOverlay.by !== 'assistant' || rollOverlay.result !== null)) {
          const extracted = extractAssistantRollFromMessage(latestAssistantMsg);
          if (extracted) {
            const expanded = expandDiceExpr(extracted.expr, 'ast-die');
            if (expanded) {
              seqRef.current += 1;
              setRollOverlay({
                rollKey: makeUid('roll-ast', seqRef.current),
                by: 'assistant',
                conversationId,
                clientTurnId: info.clientTurnId,
                dice: expanded.dice,
                modifier: expanded.modifier,
                expr: extracted.expr,
                startedAt: performance.now(),
                result: { dice: extracted.dice, total: extracted.total },
              });
            }
          }
        }
      }
    },
    [conversationId, committingPins.length, rollOverlay, streamClientKey],
  );

  // Fallback cleanup if committingPins waited past reconcile -> idle without persisted pin change
  useEffect(() => {
    if (committingPins.length === 0) return undefined;
    if (activeTurnCorrelation === null) {
      const timer = window.setTimeout(() => {
        awaitingPinDetailRef.current = false;
        setCommittingPins([]);
      }, 900);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [committingPins.length, activeTurnCorrelation]);

  // Read-only probe: extract persisted user `<roll_result>` as soon as turn reaches `live`
  // without ever touching TanStack Query cache (`applyFreshWindow` owns cache writes).
  useEffect(() => {
    if (
      !rollOverlay ||
      rollOverlay.by === 'assistant' ||
      rollOverlay.conversationId !== conversationId ||
      rollOverlay.result !== null
    ) {
      return undefined;
    }

    const corr =
      activeTurnCorrelation && activeTurnCorrelation.conversationId === conversationId
        ? activeTurnCorrelation
        : null;
    const targetClientTurnId = rollOverlay.clientTurnId ?? corr?.clientTurnId ?? null;
    const activeOverlayKey = rollOverlay.rollKey;
    const expectedExpr = rollOverlay.expr;
    const expectedCount = rollOverlay.dice.length;

    if (corr?.phase === 'blocked') {
      setRollOverlay((prev) => (prev && prev.rollKey === activeOverlayKey && prev.result === null ? null : prev));
      return undefined;
    }

    if (!corr) {
      const idleGrace = window.setTimeout(() => {
        setRollOverlay((prev) =>
          prev && prev.rollKey === activeOverlayKey && prev.result === null ? null : prev,
        );
      }, 160);
      return () => window.clearTimeout(idleGrace);
    }

    if (corr.phase !== 'live' && corr.phase !== 'stopping') {
      return undefined;
    }
    if (!targetClientTurnId) {
      return undefined;
    }

    let cancelled = false;
    let timerId = 0;

    const runProbeAttempt = async (retryIdx: number) => {
      if (cancelled) return;
      try {
        const page = await fetchMessagePage(conversationId, 0, 5);
        if (cancelled) return;
        const userMsg = page.messages.find(
          (m) => m.role === 'user' && m.clientTurnId === targetClientTurnId,
        );
        if (userMsg) {
          const extracted = extractRollResultFromMessage(userMsg.content, expectedExpr, expectedCount);
          if (extracted) {
            setRollOverlay((prev) =>
              prev && prev.rollKey === activeOverlayKey ? { ...prev, result: extracted } : prev,
            );
            return;
          }
        }
      } catch {
        // Read-only probe failure stays silent and retries on backoff or defers to reconcile
      }
      if (cancelled || retryIdx >= PROBE_DELAYS_MS.length) return;
      timerId = window.setTimeout(() => void runProbeAttempt(retryIdx + 1), PROBE_DELAYS_MS[retryIdx]);
    };

    const initialDelay = corr.firstWireEventSeen ? 0 : 350;
    timerId = window.setTimeout(() => void runProbeAttempt(0), initialDelay);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [conversationId, rollOverlay, activeTurnCorrelation]);

  const setTrayBounds = useCallback((bounds: TrayBounds) => {
    trayBoundsRef.current = bounds;
  }, []);

  const getStagedCounter = useCallback(() => stagedCounterRef.current, []);

  return {
    drawerOpen,
    setDrawerOpen,
    activeTab,
    setActiveTab,
    physicsDice,
    setPhysicsDice,
    addDie,
    removeDie,
    clearDice,
    modifier,
    setModifier,
    pendingDice,
    draftPins,
    committingPins,
    pinEditor,
    setPinEditor,
    commitPinEditor,
    discardPinEditor,
    editDraftPin,
    removeDraftPin,
    totalPendingToyCount,
    prepareSubmission,
    completeAcceptedSubmission,
    restoreToys,
    rollOverlay,
    dismissRollOverlay,
    replayRoll,
    handleTurnReconciled,
    noteStagedTurn,
    getStagedCounter,
    setTrayBounds,
  };
}

export type ComposerToysApi = ReturnType<typeof useComposerToys>;
