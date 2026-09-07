import { useCallback, useEffect, useRef, useState } from 'react';
import { AppApiError } from '../api';
import { uploadAttachments } from './api';
import type {
  AttachmentDiagnostic,
  AttachmentUploadOutcome,
  ComposeAttachmentEntry,
} from './types';

/**
 * P1C Compose Attachment Coordinator (Task 2, §5.3).
 *
 * Owns: selected File objects, per-input upload states, successful IDs,
 * upload abort/epoch, preview object URLs, remove-from-turn and route
 * isolation. It deliberately does NOT own the send/stop/reconciliation
 * controller (that stays in the C1B runtime; Task 4 wires the bridge).
 *
 * Race invariants:
 * - results are mapped by validated `input_index`, never by filename or
 *   post-mutation array position;
 * - batch epoch + Conversation id are re-checked before any UI write;
 * - a removed entry can never be resurrected by a late callback;
 * - route departure aborts in-flight uploads, clears entries, revokes
 *   previews and ignores late responses.
 */

function imagePreviewFor(file: File): string | null {
  if (!file.type.startsWith('image/')) return null;
  try {
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

function revokePreview(entry: ComposeAttachmentEntry): void {
  if (entry.preview) {
    try {
      URL.revokeObjectURL(entry.preview);
    } catch {
      /* ignore revoke failures */
    }
  }
}

/** One upload batch: stable client ids in exact input order. */
interface ActiveBatch {
  epoch: number;
  controller: AbortController;
  clientIds: number[];
}

let nextClientId = 1;

export interface ComposeAttachmentApi {
  entries: ComposeAttachmentEntry[];
  /** True while any retained entry is still uploading (blocks turn submit). */
  anyUploading: boolean;
  /** Positive validated IDs eligible for `pending_attachments`. */
  successfulIds: number[];
  /** Same-tick authoritative read (filters IDs purged by a 204 callback). */
  getSuccessfulIds: () => number[];
  /** Count of entries still uploading (for UI copy). */
  uploadingCount: number;
  /** Select new files (image or generic) and start one multipart upload. */
  addFiles: (files: File[]) => Promise<void>;
  /** Remove from turn; late callbacks can never resurrect it. */
  removeEntry: (clientId: number) => void;
  /** Purge a backend-deleted ID before canonical refresh begins. */
  purgeAttachmentId: (attachmentId: number) => void;
  /** Clear compose state after an accepted ordinary send (Task 4 hook). */
  clearCompose: () => void;
}

export function useComposeAttachments(conversationId: number): ComposeAttachmentApi {
  const [entries, setEntries] = useState<ComposeAttachmentEntry[]>([]);
  const epochRef = useRef(0);
  const batchRef = useRef<ActiveBatch | null>(null);
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;
  const purgedIdsRef = useRef<Set<number>>(new Set());

  const clearAll = useCallback(() => {
    epochRef.current += 1;
    batchRef.current?.controller.abort();
    batchRef.current = null;
    setEntries((prev) => {
      for (const entry of prev) revokePreview(entry);
      return [];
    });
  }, []);

  // Route switch / unmount: abort in-flight, clear and revoke everything.
  // Old callbacks check epoch + conversationId and become no-ops.
  useEffect(() => {
    epochRef.current += 1; // invalidate any pending batch from a previous route
    purgedIdsRef.current = new Set();
    return () => {
      epochRef.current += 1;
      batchRef.current?.controller.abort();
      batchRef.current = null;
      setEntries((prev) => {
        for (const entry of prev) revokePreview(entry);
        return [];
      });
    };
  }, [conversationId, clearAll]);

  const addFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const convId = conversationIdRef.current;
      if (!Number.isInteger(convId) || convId <= 0) return;

      // Snapshot the epoch BEFORE creating entries so a route switch that
      // lands between entry creation and response arrival invalidates us.
      const epoch = epochRef.current;
      const controller = new AbortController();
      batchRef.current?.controller.abort(); // one upload at a time per compose
      batchRef.current = { epoch, controller, clientIds: [] };

      const clientIds = files.map(() => nextClientId++);
      batchRef.current.clientIds = clientIds;

      const now = Date.now();
      void now; // reserved for future per-entry timestamps
      const newEntries: ComposeAttachmentEntry[] = files.map((file, i) => ({
        clientId: clientIds[i],
        file,
        preview: imagePreviewFor(file),
        name: file.name || `file-${i + 1}`,
        type: file.type || 'application/octet-stream',
        size: file.size,
        status: 'uploading',
        attachmentId: null,
        diagnostics: [],
      }));
      setEntries((prev) => [...prev, ...newEntries]);

      const target = null; // compose-level ordinary files; audio goes via recorder path
      let outcome: AttachmentUploadOutcome;
      try {
        outcome = await uploadAttachments(convId, files, target, controller.signal);
      } catch (cause) {
        if (epochRef.current !== epoch || conversationIdRef.current !== convId) return;
        // Transport-level failure: mark every retained entry of this batch failed.
        const code = (cause as AppApiError)?.code ?? 'NETWORK_ERROR';
        const message =
          code === 'ABORTED' ? '上传已取消' : '上传失败，请检查网络后重试';
        const diag: AttachmentDiagnostic = {
          stage: 'transfer',
          code,
          level: 'error',
          message,
        };
        setEntries((prev) =>
          prev.map((entry) =>
            clientIds.includes(entry.clientId)
              ? { ...entry, status: 'failed' as const, attachmentId: null, diagnostics: [diag] }
              : entry,
          ),
        );
        return;
      }

      if (epochRef.current !== epoch || conversationIdRef.current !== convId) return;

      const results = outcome.payload.results ?? null;
      const batchSize = files.length;
      const ownerCounts = new Map<number, number>();
      if (Array.isArray(results)) {
        for (const rawItem of results as unknown[]) {
          if (typeof rawItem !== 'object' || rawItem === null) continue;
          const inputIndex = (rawItem as { input_index?: unknown }).input_index;
          if (!Number.isInteger(inputIndex)) continue;
          const index = inputIndex as number;
          ownerCounts.set(index, (ownerCounts.get(index) ?? 0) + 1);
        }
      }
      const resultOwnershipValid =
        Array.isArray(results) &&
        results.length === batchSize &&
        (results as unknown[]).every((rawItem) => {
          if (typeof rawItem !== 'object' || rawItem === null) return false;
          const inputIndex = (rawItem as { input_index?: unknown }).input_index;
          return (
            Number.isInteger(inputIndex) &&
            (inputIndex as number) >= 0 &&
            (inputIndex as number) < batchSize &&
            ownerCounts.get(inputIndex as number) === 1
          );
        });

      setEntries((prev) =>
        prev.map((entry) => {
          const batchIdx = clientIds.indexOf(entry.clientId);
          if (batchIdx === -1) return entry; // removed mid-flight: never resurrect
          const inputIndex = batchIdx; // authoritative per-batch position

          if (!resultOwnershipValid) {
            // Every selected input must have exactly one in-range owner.
            // Duplicate, missing, extra or malformed ownership invalidates
            // the batch contract before any success can become sendable.
            return {
              ...entry,
              status: 'failed' as const,
              attachmentId: null,
              diagnostics: [
                {
                  stage: 'contract',
                  code: 'results_ownership_invalid',
                  level: 'error' as const,
                  message: '上传结果归属异常，请重试',
                },
              ],
            };
          }

          const item = results.find((r) => r.input_index === inputIndex);
          if (!item) {
            return {
              ...entry,
              status: 'failed' as const,
              attachmentId: null,
              diagnostics: [
                {
                  stage: 'contract',
                  code: 'result_missing',
                  level: 'error' as const,
                  message: '上传结果缺失，请重试',
                },
              ],
            };
          }

          if (item.status === 'ok' || item.status === 'ok_degraded') {
            const id = item.attachment?.id;
            if (!Number.isInteger(id) || (id as number) <= 0) {
              return {
                ...entry,
                status: 'failed' as const,
                attachmentId: null,
                diagnostics: [
                  {
                    stage: 'contract',
                    code: 'invalid_attachment_id',
                    level: 'error' as const,
                    message: '上传成功但返回无效的附件编号',
                  },
                ],
              };
            }
            return {
              ...entry,
              status: item.status,
              attachmentId: id as number,
              diagnostics: Array.isArray(item.diagnostics) ? item.diagnostics : [],
            };
          }

          return {
            ...entry,
            status: 'failed' as const,
            attachmentId: null,
            diagnostics: Array.isArray(item.diagnostics) && item.diagnostics.length
              ? item.diagnostics
              : [
                  {
                    stage: 'upload',
                    code: 'upload_failed',
                    level: 'error' as const,
                    message: '上传失败',
                  },
                ],
          };
        }),
      );

    },
    [],
  );

  const removeEntry = useCallback((clientId: number) => {
    // Do NOT bump the batch epoch here: other entries of the same in-flight
    // batch must still be able to complete. The removed clientId simply
    // disappears from `entries`, so a late result for it is a no-op map hit
    // (cannot resurrect) while siblings keep their legitimate callbacks.
    setEntries((prev) => {
      const target = prev.find((e) => e.clientId === clientId);
      if (target) revokePreview(target);
      return prev.filter((e) => e.clientId !== clientId);
    });
  }, []);

  const purgeAttachmentId = useCallback((attachmentId: number) => {
    purgedIdsRef.current.add(attachmentId);
    setEntries((prev) => {
      const removed = prev.filter((entry) => entry.attachmentId === attachmentId);
      for (const entry of removed) revokePreview(entry);
      return prev.filter((entry) => entry.attachmentId !== attachmentId);
    });
  }, []);

  const clearCompose = useCallback(() => {
    epochRef.current += 1;
    purgedIdsRef.current = new Set();
    batchRef.current?.controller.abort();
    batchRef.current = null;
    setEntries((prev) => {
      for (const entry of prev) revokePreview(entry);
      return [];
    });
  }, []);

  const anyUploading = entries.some((e) => e.status === 'uploading');
  const uploadingCount = entries.reduce((n, e) => (e.status === 'uploading' ? n + 1 : n), 0);
  const successfulIds = entries
    .filter(
      (e) =>
        (e.status === 'ok' || e.status === 'ok_degraded') &&
        e.attachmentId !== null &&
        !purgedIdsRef.current.has(e.attachmentId),
    )
    .map((e) => e.attachmentId as number);
  const successfulIdsRef = useRef<number[]>(successfulIds);
  successfulIdsRef.current = successfulIds;
  const getSuccessfulIds = useCallback(
    () => successfulIdsRef.current.filter((id) => !purgedIdsRef.current.has(id)),
    [],
  );

  return {
    entries,
    anyUploading,
    successfulIds,
    getSuccessfulIds,
    uploadingCount,
    addFiles,
    removeEntry,
    purgeAttachmentId,
    clearCompose,
  };
}