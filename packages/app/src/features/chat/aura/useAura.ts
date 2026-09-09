/**
 * V4 Aura page-owner hook (Plan Task 4 / §6.7 — Solaire leaf B).
 *
 * Moves selection + custom-palette library ownership OUT of the picker DOM
 * into page-owned state: `useAura` is the single in-memory source for both,
 * storage writes are side effects with an explicit outcome channel.
 *
 * - storage failure KEEPS the in-memory selection/library for the current
 *   page and reports `onStorageWarning` (no modal, no reset);
 * - `palettes` is the full library projection (built-ins + validated custom
 *   list, capped at MAX_CUSTOM_PALETTES);
 * - the component (AuraPicker) becomes a controlled projection of this
 *   state, or keeps its legacy internal mode via `useAura` for existing
 *   consumers (pane-5 TacticalHud still uses `conversationId`).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { readAuraSelection, writeAuraSelection, type PrefWriteOutcome } from '../control/prefs';
import {
  MAX_CUSTOM_PALETTES,
  deleteCustomPalette,
  getAllPalettes,
  readCustomPalettes,
  saveCustomPalette,
  updateCustomPalette,
  type AuraKeypoints,
  type AuraPalette,
  type CustomPaletteMutation,
} from './palettes';

export type AuraUpdateOutcome =
  | { ok: true; palette: AuraPalette }
  | { ok: false; reason: 'not_found' | 'invalid_keypoints' | 'storage_unavailable' };

export interface UseAuraOptions {
  theme: 'dark' | 'light';
  /** Non-blocking warning channel for local preference storage failures. */
  onStorageWarning?: (message: string) => void;
}

export interface UseAuraResult {
  /** Conversation-local selection id; null → theme default. */
  selectedId: string | null;
  /** Full library projection (built-ins + custom, in order). */
  palettes: AuraPalette[];
  customCount: number;
  atCapacity: boolean;
  /** Apply a selection; persists when possible, keeps memory state on failure. */
  select: (id: string | null) => void;
  /** Create a new custom palette and select it on success. */
  saveNew: (label: string, keypoints: AuraKeypoints) => CustomPaletteMutation;
  /** Update an existing custom palette in place. */
  update: (id: string, label: string, keypoints: AuraKeypoints) => AuraUpdateOutcome;
  /** Delete a custom palette; clears selection if it was selected. */
  remove: (id: string) => PrefWriteOutcome;
}

export function useAura(
  conversationId: number,
  options: UseAuraOptions,
): UseAuraResult {
  const { theme, onStorageWarning } = options;
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    readAuraSelection(conversationId),
  );
  const [customList, setCustomList] = useState<AuraPalette[]>(() => readCustomPalettes());

  // Conversation-local identity: when the owning conversation changes, the
  // selection/library are re-read for the NEW id without touching the state
  // while the HUD is merely closed (same conversation → no effect).
  useEffect(() => {
    setSelectedId(readAuraSelection(conversationId));
    setCustomList(readCustomPalettes());
  }, [conversationId]);

  const palettes = useMemo(() => getAllPalettes(), [customList]); // eslint-disable-line react-hooks/exhaustive-deps
  const customCount = customList.length;
  const atCapacity = customCount >= MAX_CUSTOM_PALETTES;

  const select = useCallback(
    (id: string | null) => {
      // Page-owned in-memory truth first; storage is a side effect whose
      // failure is reported but never reverts the running page (Plan §6.7).
      setSelectedId(id);
      const outcome = writeAuraSelection(conversationId, id);
      if (outcome.state === 'unavailable') onStorageWarning?.(outcome.reason);
    },
    [conversationId, onStorageWarning],
  );

  const saveNew = useCallback(
    (label: string, keypoints: AuraKeypoints): CustomPaletteMutation => {
      const mutation = saveCustomPalette(label, keypoints, theme);
      if (mutation.ok) {
        setCustomList(readCustomPalettes());
        select(mutation.palette.id);
      } else if (mutation.reason === 'storage_unavailable') {
        onStorageWarning?.(mutation.message);
      }
      return mutation;
    },
    [theme, select, onStorageWarning],
  );

  const update = useCallback(
    (id: string, label: string, keypoints: AuraKeypoints): AuraUpdateOutcome => {
      const outcome = updateCustomPalette(id, { label, keypoints });
      if (outcome.ok) {
        setCustomList(readCustomPalettes());
      } else if (outcome.reason === 'storage_unavailable') {
        onStorageWarning?.('无法保存自定义色板修改');
      }
      return outcome;
    },
    [onStorageWarning],
  );

  const remove = useCallback(
    (id: string): PrefWriteOutcome => {
      const outcome = deleteCustomPalette(id);
      if (outcome.state === 'unavailable') {
        onStorageWarning?.(outcome.reason);
        return outcome;
      }
      setCustomList(readCustomPalettes());
      if (selectedId === id) {
        // Deterministic fallback: theme default, and persist the cleanup.
        select(null);
      }
      return outcome;
    },
    [selectedId, select, onStorageWarning],
  );

  return useMemo(
    () => ({
      selectedId,
      palettes,
      customCount,
      atCapacity,
      select,
      saveNew,
      update,
      remove,
    }),
    [selectedId, palettes, customCount, atCapacity, select, saveNew, update, remove],
  );
}