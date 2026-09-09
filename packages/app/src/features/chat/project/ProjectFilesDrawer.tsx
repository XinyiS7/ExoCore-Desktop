/**
 * P1D Project files drawer (Plan Task 5, §6.6) — read-only.
 *
 * - enabled only for a positive `projectId`; Drift (null/0) renders nothing
 *   and issues zero project requests (queries are enabled-gated);
 * - uploaded ProjectFile rows render as read-only references, separate from
 *   the work-directory tree; no edit/delete/upload affordance exists;
 * - the root recursive tree is fetched ONCE through the root Query owner and
 *   is shared by the drawer and the composer autocomplete through the single
 *   combined-tree owner `useProjectTree` (same key family). A directory shell
 *   triggers one exact `?path=` level fetch; on success the result lands in
 *   the Query-owned levels record via ONE immutable `setQueryData`, and the
 *   shared owner re-derives the combined tree for every consumer. No generic
 *   tree synchronizer / local overlay.
 * - every level command is bound to its originating `{projectId, path}`;
 *   a late completion that no longer matches the current binding is
 *   rejected before any cache/UI mutation (cross-Conversation barrier).
 * - file clicks call `onInsertPath` at the boundary — the composer owner
 *   (pane 5) applies duplicate/token checks via `project/paths.ts`.
 * - malformed tree rows are CONTRACT errors shown explicitly (retryable);
 *   single-level failures are visible per-shell with a retry affordance.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toAppApiError, type AppApiError } from '../api';
import {
  controlQueryKeys,
  useProjectDetailQuery,
  useProjectFilesQuery,
  useProjectTree,
  useProjectTreeLevelQuery,
} from '../control/queries';
import type { ProjectTreeEntry } from '../control/types';
import { isSafeRelativePath } from './paths';
import { FileTree } from './FileTree';
import { useDialogA11y } from '../dialogA11y';
import './project.css';

export interface ProjectFilesDrawerProps {
  /** Conversation-bound project id; null/0 (Drift) disables everything. */
  projectId: number | null;
  isOpen: boolean;
  onClose: () => void;
  /** File selection callback — the composer owner inserts `@[path]`. */
  onInsertPath: (path: string) => void;
}

export function ProjectFilesDrawer({ projectId, isOpen, onClose, onInsertPath }: ProjectFilesDrawerProps) {
  const dialogRef = useDialogA11y(isOpen, onClose);
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  /** The single directory shell currently loading (one exact level fetch). */
  const [levelPath, setLevelPath] = useState<string | null>(null);
  /** Directory shells whose level fetch failed (visible level error). */
  const [levelErrorPaths, setLevelErrorPaths] = useState<Set<string>>(new Set());
  /** Originating command binding: the {projectId, path} a level fetch was
   * issued for. A late result that does not match the CURRENT binding or
   * project is rejected before root-cache/UI mutation (Plan Task 5
   * cross-boundary proof). */
  const issuedRef = useRef<{ projectId: number; path: string } | null>(null);

  const detailQuery = useProjectDetailQuery(isOpen ? projectId : null);
  const filesQuery = useProjectFilesQuery(isOpen ? projectId : null);
  const workDirReady = Boolean(detailQuery.data?.workDir);
  // Tree request is gated on a loaded detail row with a work_dir: a project
  // without work_dir (or a failed detail fetch) issues zero tree requests.
  const projectTree = useProjectTree(isOpen ? projectId : null, {
    enabled: !detailQuery.isError && workDirReady,
  });

  // One exact single-level fetch for directory shells (Plan §6.6), owned by
  // the same Query family as the root tree (`useProjectTreeLevelQuery`, keyed
  // project + exact path). HOOK INPUTS ARE GATED BY THE ISSUED BINDING: while
  // a stale `levelPath` from project A is pending, a render under project B
  // must NOT issue a B/Apath request before the reset effect cleans up.
  const levelGate =
    issuedRef.current !== null &&
    issuedRef.current.projectId === (projectId ?? 0) &&
    issuedRef.current.path === levelPath;
  const levelQuery = useProjectTreeLevelQuery(
    levelGate ? projectId : null,
    levelGate ? levelPath : null,
  );

  /** Safe project-change boundary (post-render): clears drawer-local UI
   * state when the conversation-bound project changes. No render-time
   * setState; the level binding is dropped so stale completions die. */
  const drawerKey = projectId ?? 0;
  const prevKeyRef = useRef(drawerKey);
  useEffect(() => {
    if (prevKeyRef.current === drawerKey) return;
    prevKeyRef.current = drawerKey;
    setExpanded(new Set());
    setLevelErrorPaths(new Set());
    setLevelPath(null);
    issuedRef.current = null;
  }, [drawerKey]);

  useEffect(() => {
    if (levelQuery.isError) {
      const failed = levelPath;
      if (failed !== null && issuedRef.current?.path === failed) {
        setLevelErrorPaths((prev) => new Set(prev).add(failed));
        issuedRef.current = null;
        setLevelPath(null); // unblock other shells; retry re-issues the fetch
      }
      return;
    }
    const envelope = levelQuery.data;
    const binding = issuedRef.current;
    // Reject late/stale completions BEFORE any cache or UI mutation: the
    // result must match the path we asked for AND the project that asked.
    if (
      !envelope ||
      levelPath === null ||
      binding === null ||
      binding.path !== levelPath ||
      binding.projectId !== (projectId ?? 0) ||
      envelope.path !== levelPath
    ) {
      return;
    }
    // ONE immutable update of the Query-owned combined-tree source: the
    // matched path's children land in the levels record. `useProjectTree`
    // (the single shared owner) re-derives the combined tree for every
    // consumer — drawer and autocomplete see the exact same merge.
    queryClient.setQueryData<Record<string, ProjectTreeEntry[]>>(
      controlQueryKeys.projectTreeLevels(projectId ?? 0),
      (prev) => ({ ...prev, [envelope.path]: envelope.entries }),
    );
    issuedRef.current = null;
    setLevelPath(null);
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(envelope.path);
      return next;
    });
    setLevelErrorPaths((prev) => {
      const next = new Set(prev);
      next.delete(envelope.path);
      return next;
    });
  }, [levelQuery.data, levelQuery.isError, levelPath, projectId, queryClient]);

  /** Combined tree rendered DIRECTLY from the single Query owner. */
  const rootEntries = projectTree.entries;

  const workDirPresent = Boolean(detailQuery.data?.workDir);
  const project404 = toAppApiError(detailQuery.error).status === 404 && detailQuery.isError;
  const loadingPaths = useMemo(
    () => (levelPath !== null && levelQuery.isLoading ? new Set([levelPath]) : new Set<string>()),
    [levelPath, levelQuery.isLoading],
  );

  const handleToggleDir = useCallback(
    (path: string, isShell: boolean) => {
      if (isShell) {
        if (levelPath !== null) return; // one exact level fetch at a time
        if (projectId === null) return;
        issuedRef.current = { projectId, path };
        setLevelErrorPaths((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
        setLevelPath(path);
        return;
      }
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
    },
    [levelPath, projectId],
  );

  const handleRetryLevel = useCallback(
    (path: string) => {
      if (projectId === null) return;
      // Clear the failed key first so the exact-path fetch really re-runs.
      void queryClient.resetQueries({
        queryKey: controlQueryKeys.projectTreeLevel(projectId, path),
      });
      issuedRef.current = { projectId, path };
      setLevelErrorPaths((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
      setLevelPath(path);
    },
    [queryClient, projectId],
  );

  const handleSelectFile = useCallback(
    (path: string) => {
      if (!isSafeRelativePath(path)) return; // boundary guard, never reached from validated rows
      onInsertPath(path);
    },
    [onInsertPath],
  );

  if (projectId === null || !isOpen) return null;

  const treeError = projectTree.rootError ? toAppApiError(projectTree.rootError) : null;
  const filesError = filesQuery.isError ? toAppApiError(filesQuery.error) : null;

  return (
    <div className="v4-drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        ref={dialogRef}
        className="v4-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="项目文件"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="v4-drawer-head">
          <h2 className="app-h2">{detailQuery.data?.name ?? '项目文件'}</h2>
          <button type="button" className="app-icon-btn" onClick={onClose} aria-label="关闭项目文件抽屉">
            ✕
          </button>
        </header>

        <div className="v4-drawer-body">
          {detailQuery.isPending ? (
            <p className="app-muted">正在加载项目…</p>
          ) : project404 ? (
            <div className="v4-drawer-state" role="alert">
              <p className="app-error-hint">项目不存在或已被删除（404）。</p>
              <button type="button" className="app-btn app-btn-ghost app-btn-sm" onClick={() => void detailQuery.refetch()}>
                重试
              </button>
            </div>
          ) : detailQuery.isError ? (
            <div className="v4-drawer-state" role="alert">
              <p className="app-error-hint">{backendErrorText(toAppApiError(detailQuery.error))}</p>
              <button type="button" className="app-btn app-btn-ghost app-btn-sm" onClick={() => void detailQuery.refetch()}>
                重试
              </button>
            </div>
          ) : !workDirPresent ? (
            <div className="v4-drawer-state" role="alert">
              <p className="app-error-hint">项目未绑定工作目录（work_dir 为空），无法浏览目录树。</p>
            </div>
          ) : null}

          {/* Work-directory tree section */}
          {workDirPresent ? (
            <section aria-label="工作目录文件树" className="v4-drawer-section">
              <h3 className="v4-drawer-section-title">工作目录</h3>
              {projectTree.rootPending ? (
                <p className="app-muted">正在扫描目录树…</p>
              ) : treeError ? (
                <div className="v4-drawer-state" role="alert">
                  <p className="app-error-hint">{backendErrorText(treeError)}</p>
                  <button type="button" className="app-btn app-btn-ghost app-btn-sm" onClick={() => void projectTree.refetchRoot()}>
                    重试
                  </button>
                </div>
              ) : rootEntries.length === 0 ? (
                <p className="app-muted">工作目录为空</p>
              ) : (
                <FileTree
                  entries={rootEntries}
                  expandedPaths={expanded}
                  loadingPaths={loadingPaths}
                  errorPaths={levelErrorPaths}
                  onToggleDir={handleToggleDir}
                  onSelectFile={handleSelectFile}
                  onRetryDir={handleRetryLevel}
                />
              )}
            </section>
          ) : null}

          {/* Uploaded ProjectFile references — read-only, separate from the tree */}
          <section aria-label="项目参考文件" className="v4-drawer-section">
            <h3 className="v4-drawer-section-title">项目参考文件</h3>
            {filesQuery.isPending ? (
              <p className="app-muted">正在加载…</p>
            ) : filesError ? (
              <div className="v4-drawer-state" role="alert">
                <p className="app-error-hint">{backendErrorText(filesError)}</p>
                <button type="button" className="app-btn app-btn-ghost app-btn-sm" onClick={() => void filesQuery.refetch()}>
                  重试
                </button>
              </div>
            ) : (filesQuery.data ?? []).length === 0 ? (
              <p className="app-muted">暂无参考文件</p>
            ) : (
              <ul className="v4-projfiles">
                {(filesQuery.data ?? []).map((file) => (
                  <li key={file.id} className="v4-projfile" title={`${file.name}（上传引用，只读）`}>
                    <span className="v4-projfile-name">{file.name}</span>
                    <span className="v4-projfile-meta">
                      {file.fileType || 'file'}
                      {file.size > 0 ? ` · ${formatSize(file.size)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

/**
 * Backend DRF bodies carry `{error: string}`; surface it instead of the
 * generic transport line. Status-coded fallbacks keep 403/404 actionable
 * even when the body is not JSON.
 */
function backendErrorText(err: AppApiError | null): string {
  if (!err) return '';
  const body = err.body as { error?: unknown } | null;
  if (body && typeof body.error === 'string' && body.error !== '') return body.error;
  if (err.status === 403) return '没有权限读取该目录。';
  if (err.status === 404) return '目录或项目不存在。';
  return err.message;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}