import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  changeTargetModel,
  getCompatibleEndpoints,
  getMainRoles,
  resolveInitialSessionTarget,
  type InitialSessionTarget,
  type ModelCatalog,
  type ModelCatalogEndpoint,
} from 'exo-shared/models';
import { getConversation, toAppApiError } from '../api';
import { patchConversationThinkingLevel } from '../control/api';
import { isThinkingLevel, type ThinkingLevel } from '../control/types';
import { queryKeys } from '../queries';
import type { AgentPresetRow, ConversationSummary } from '../types';
import type { ConversationDispatchSettings } from '../runtime/types';
import {
  readCacheEnabled,
  readMemoryInjection,
  readSessionType,
  writeCacheEnabled,
  writeMemoryInjection,
  writeSessionType,
} from '../control/prefs';

export type SessionHistoryMode = 'full' | 'lite';
export interface ConversationLocalControls {
  cacheEnabled: boolean;
  sessionType: SessionHistoryMode;
  memoryInjectionEnabled: boolean;
}

function readLocalControls(conversationId: number): ConversationLocalControls {
  return {
    cacheEnabled: readCacheEnabled(conversationId),
    sessionType: readSessionType(conversationId),
    memoryInjectionEnabled: readMemoryInjection(conversationId),
  };
}

export type ThinkingSaveState =
  | { kind: 'idle' }
  | { kind: 'saving'; requested: ThinkingLevel }
  | { kind: 'rejected'; requested: ThinkingLevel; message: string }
  | { kind: 'uncertain'; requested: ThinkingLevel; message: string };

interface TargetOwnerState {
  conversationId: number;
  target: InitialSessionTarget;
  initialized: boolean;
  userSelected: boolean;
}

interface ThinkingMutationVariables {
  conversationId: number;
  level: ThinkingLevel;
  invocation: number;
}

export interface ConversationControls {
  target: InitialSessionTarget;
  targetReady: boolean;
  targetNotice: string | null;
  selectableModels: string[];
  compatibleEndpoints: ModelCatalogEndpoint[];
  setTarget: (target: InitialSessionTarget) => void;
  setModel: (model: string) => void;
  setEndpoint: (endpoint: number) => void;
  thinkingLevel: ThinkingLevel;
  thinkingSaveState: ThinkingSaveState;
  saveThinkingLevel: (level: ThinkingLevel) => void;
  retryThinkingSave: () => void;
  preferences: ConversationLocalControls;
  setCacheEnabled: (enabled: boolean) => void;
  setSessionType: (mode: SessionHistoryMode) => void;
  setMemoryInjectionEnabled: (enabled: boolean) => void;
  storageWarning: string | null;
  dismissStorageWarning: () => void;
  dispatchSettings: ConversationDispatchSettings | null;
}

function validEndpointId(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function targetIsSendable(catalog: ModelCatalog | null | undefined, target: InitialSessionTarget): boolean {
  if (!target.model || !validEndpointId(target.endpoint)) return false;
  return getCompatibleEndpoints(catalog, target.model).some((endpoint) => endpoint.id === target.endpoint);
}

function resolveTarget(
  catalog: ModelCatalog | null | undefined,
  preset: AgentPresetRow | null | undefined,
): InitialSessionTarget {
  if (!catalog) return { model: '', endpoint: null };
  const resolved = resolveInitialSessionTarget(catalog, preset);
  if (targetIsSendable(catalog, resolved)) return resolved;
  const candidates = getCompatibleEndpoints(catalog, resolved.model);
  return { model: resolved.model, endpoint: candidates.length === 1 ? candidates[0].id : null };
}

export function useConversationControls(options: {
  conversationId: number;
  conversation: ConversationSummary | null | undefined;
  preset: AgentPresetRow | null | undefined;
  /** True only after preset lookup for this Conversation can be decided. */
  presetReady?: boolean;
  catalog: ModelCatalog | null | undefined;
  /** Synchronous runtime/audio guard supplied by the page owner. */
  lockedRef?: RefObject<boolean>;
  /** Cache action guard, shared at command boundaries. */
  externalOperationPendingRef?: RefObject<boolean>;
  /** Mutable thinking guard, set before PATCH starts and released on settle. */
  thinkingOperationPendingRef?: MutableRefObject<boolean>;
}): ConversationControls {
  const {
    conversationId,
    conversation,
    preset,
    presetReady: presetReadyOption,
    catalog,
    lockedRef,
    externalOperationPendingRef,
    thinkingOperationPendingRef: suppliedThinkingPendingRef,
  } = options;
  const queryClient = useQueryClient();
  const presetReady =
    presetReadyOption ?? (preset != null || conversation?.agentPresetId == null);
  const localThinkingPendingRef = useRef(false);
  const thinkingOperationPendingRef = suppliedThinkingPendingRef ?? localThinkingPendingRef;
  const [targetOwner, setTargetOwner] = useState<TargetOwnerState>({
    conversationId,
    target: { model: '', endpoint: null },
    initialized: false,
    userSelected: false,
  });
  const initialStored = useMemo(() => readLocalControls(conversationId), [conversationId]);
  const [preferences, setPreferences] = useState<ConversationLocalControls>(initialStored);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [thinkingSaveState, setThinkingSaveState] = useState<ThinkingSaveState>({ kind: 'idle' });
  const activeConversationRef = useRef(conversationId);
  activeConversationRef.current = conversationId;
  const invocationRef = useRef(0);
  const latestInvocationByConversationRef = useRef(new Map<number, number>());
  const pendingThinkingOwnersRef = useRef(new Map<number, number>());
  thinkingOperationPendingRef.current = [...pendingThinkingOwnersRef.current.values()]
    .some((ownerConversationId) => ownerConversationId === conversationId);

  const commandLocked = useCallback(
    () =>
      Boolean(lockedRef?.current) ||
      Boolean(externalOperationPendingRef?.current) ||
      thinkingOperationPendingRef.current,
    [externalOperationPendingRef, lockedRef, thinkingOperationPendingRef],
  );

  useEffect(() => {
    setPreferences(readLocalControls(conversationId));
    setStorageWarning(null);
    setThinkingSaveState({ kind: 'idle' });
    setTargetOwner({
      conversationId,
      target: { model: '', endpoint: null },
      initialized: false,
      userSelected: false,
    });
  }, [conversationId]);

  // Initialization waits until Conversation + catalog + preset lookup are all
  // decidable. A transient fallback can therefore never become an apparent
  // user selection when the preset arrives later.
  useEffect(() => {
    if (!conversation || !catalog || !presetReady) return;
    setTargetOwner((current) => {
      if (current.conversationId !== conversationId || !current.initialized) {
        return {
          conversationId,
          target: resolveTarget(catalog, preset),
          initialized: true,
          userSelected: false,
        };
      }
      if (current.userSelected && targetIsSendable(catalog, current.target)) return current;
      if (targetIsSendable(catalog, current.target)) return current;
      return { ...current, target: resolveTarget(catalog, preset), userSelected: false };
    });
  }, [catalog, conversation, conversationId, preset, presetReady]);

  const target =
    targetOwner.conversationId === conversationId && targetOwner.initialized
      ? targetOwner.target
      : { model: '', endpoint: null };

  const selectableModels = useMemo(() => {
    if (!catalog) return [];
    const names = new Set<string>();
    for (const role of getMainRoles(catalog)) {
      if (typeof role.model !== 'string' || role.model.length === 0) continue;
      if (getCompatibleEndpoints(catalog, role.model).length > 0) names.add(role.model);
    }
    return [...names];
  }, [catalog]);

  const compatibleEndpoints = useMemo(
    () => (target.model ? getCompatibleEndpoints(catalog, target.model) : []),
    [catalog, target.model],
  );

  const setModel = useCallback(
    (model: string) => {
      if (commandLocked() || !selectableModels.includes(model)) return;
      setTargetOwner((current) => ({
        conversationId,
        target: changeTargetModel(catalog, current.target, model),
        initialized: true,
        userSelected: true,
      }));
    },
    [catalog, commandLocked, conversationId, selectableModels],
  );

  const setEndpoint = useCallback(
    (endpoint: number) => {
      if (commandLocked() || !compatibleEndpoints.some((candidate) => candidate.id === endpoint)) return;
      setTargetOwner((current) => ({
        conversationId,
        target: { ...current.target, endpoint },
        initialized: true,
        userSelected: true,
      }));
    },
    [commandLocked, compatibleEndpoints, conversationId],
  );

  const setCachePreference = useCallback((enabled: boolean) => {
    setPreferences((current) => ({ ...current, cacheEnabled: enabled }));
    const outcome = writeCacheEnabled(conversationId, enabled);
    if (outcome.state === 'unavailable') setStorageWarning(outcome.reason);
  }, [conversationId]);

  const setSessionPreference = useCallback((sessionType: SessionHistoryMode) => {
    setPreferences((current) => ({ ...current, sessionType }));
    const outcome = writeSessionType(conversationId, sessionType);
    if (outcome.state === 'unavailable') setStorageWarning(outcome.reason);
  }, [conversationId]);

  const setMemoryPreference = useCallback((memoryInjectionEnabled: boolean) => {
    setPreferences((current) => ({ ...current, memoryInjectionEnabled }));
    const outcome = writeMemoryInjection(conversationId, memoryInjectionEnabled);
    if (outcome.state === 'unavailable') setStorageWarning(outcome.reason);
  }, [conversationId]);

  const isLatestInvocation = useCallback(
    (variables: ThinkingMutationVariables) =>
      latestInvocationByConversationRef.current.get(variables.conversationId) === variables.invocation,
    [],
  );
  const ownsCurrentPage = useCallback(
    (variables: ThinkingMutationVariables) =>
      activeConversationRef.current === variables.conversationId && isLatestInvocation(variables),
    [isLatestInvocation],
  );

  const mutation = useMutation({
    mutationFn: (variables: ThinkingMutationVariables) =>
      patchConversationThinkingLevel(variables.conversationId, variables.level),
    onSuccess: (updated, variables) => {
      if (!isLatestInvocation(variables)) return;
      queryClient.setQueryData<ConversationSummary>(
        queryKeys.conversation(variables.conversationId),
        (current) => current ? { ...current, thinkingLevel: updated.confirmedLevel } : current,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
      if (ownsCurrentPage(variables)) setThinkingSaveState({ kind: 'idle' });
    },
    onError: async (cause, variables) => {
      if (!isLatestInvocation(variables)) return;
      const error = toAppApiError(cause);
      const definiteRejection =
        error.status !== null && error.status >= 400 && error.status < 500 && !error.ambiguousWrite;
      if (definiteRejection) {
        if (ownsCurrentPage(variables)) {
          setThinkingSaveState({
            kind: 'rejected',
            requested: variables.level,
            message: error.message,
          });
        }
        return;
      }
      if (ownsCurrentPage(variables)) {
        setThinkingSaveState({
          kind: 'uncertain',
          requested: variables.level,
          message: '保存状态待确认，正在重新读取当前会话。',
        });
      }
      try {
        const confirmed = await getConversation(variables.conversationId);
        if (!isLatestInvocation(variables)) return;
        queryClient.setQueryData(queryKeys.conversation(variables.conversationId), confirmed);
        if (ownsCurrentPage(variables)) setThinkingSaveState({ kind: 'idle' });
      } catch {
        if (ownsCurrentPage(variables)) {
          setThinkingSaveState({
            kind: 'uncertain',
            requested: variables.level,
            message: '保存状态仍无法确认，请重试保存或稍后重新读取。',
          });
        }
      }
    },
    onSettled: (_data, _error, variables) => {
      pendingThinkingOwnersRef.current.delete(variables.invocation);
      thinkingOperationPendingRef.current = [...pendingThinkingOwnersRef.current.values()]
        .some((ownerConversationId) => ownerConversationId === activeConversationRef.current);
    },
  });

  const beginThinkingSave = useCallback(
    (ownerConversationId: number, level: ThinkingLevel) => {
      const invocation = ++invocationRef.current;
      latestInvocationByConversationRef.current.set(ownerConversationId, invocation);
      pendingThinkingOwnersRef.current.set(invocation, ownerConversationId);
      if (activeConversationRef.current === ownerConversationId) {
        thinkingOperationPendingRef.current = true;
      }
      if (activeConversationRef.current === ownerConversationId) {
        setThinkingSaveState({ kind: 'saving', requested: level });
      }
      mutation.mutate({ conversationId: ownerConversationId, level, invocation });
    },
    [mutation, thinkingOperationPendingRef],
  );

  const saveThinkingLevel = useCallback(
    (level: ThinkingLevel) => {
      if (commandLocked() || !isThinkingLevel(level)) return;
      beginThinkingSave(conversationId, level);
    },
    [beginThinkingSave, commandLocked, conversationId],
  );

  const retryThinkingSave = useCallback(() => {
    if (
      commandLocked() ||
      thinkingSaveState.kind === 'idle' ||
      thinkingSaveState.kind === 'saving'
    ) return;
    beginThinkingSave(conversationId, thinkingSaveState.requested);
  }, [beginThinkingSave, commandLocked, conversationId, thinkingSaveState]);

  const thinkingLevel = isThinkingLevel(conversation?.thinkingLevel) ? conversation.thinkingLevel : 'auto';
  const targetReady =
    targetOwner.conversationId === conversationId &&
    targetOwner.initialized &&
    targetIsSendable(catalog, target);
  const targetNotice = !catalog
    ? '模型目录尚未就绪。'
    : selectableModels.length === 0
      ? '没有可用的主模型与端点。'
      : !target.model
        ? '请选择模型。'
        : !targetReady
          ? '请选择兼容且已启用的端点。'
          : null;

  const dispatchSettings = targetReady
    ? {
        model: target.model,
        endpoint: target.endpoint as number,
        thinkingLevel,
        cacheEnabled: preferences.cacheEnabled,
        sessionType: preferences.sessionType,
        ...(conversation?.agentType === 'g045'
          ? { memoryInjectionEnabled: preferences.memoryInjectionEnabled }
          : {}),
      }
    : null;

  const setValidatedTarget = useCallback(
    (next: InitialSessionTarget) => {
      if (commandLocked()) return;
      const endpoints = getCompatibleEndpoints(catalog, next.model);
      if (!selectableModels.includes(next.model)) return;
      if (next.endpoint !== null && !endpoints.some((candidate) => candidate.id === next.endpoint)) return;
      setTargetOwner({
        conversationId,
        target: { model: next.model, endpoint: next.endpoint },
        initialized: true,
        userSelected: true,
      });
    },
    [catalog, commandLocked, conversationId, selectableModels],
  );

  return {
    target,
    targetReady,
    setTarget: setValidatedTarget,
    targetNotice,
    selectableModels,
    compatibleEndpoints,
    setModel,
    setEndpoint,
    thinkingLevel,
    thinkingSaveState,
    saveThinkingLevel,
    retryThinkingSave,
    preferences,
    setCacheEnabled: (enabled) => {
      if (!commandLocked()) setCachePreference(enabled);
    },
    setSessionType: (sessionType) => {
      if (!commandLocked()) setSessionPreference(sessionType);
    },
    setMemoryInjectionEnabled: (memoryInjectionEnabled) => {
      if (!commandLocked()) setMemoryPreference(memoryInjectionEnabled);
    },
    storageWarning,
    dismissStorageWarning: () => setStorageWarning(null),
    dispatchSettings,
  };
}
