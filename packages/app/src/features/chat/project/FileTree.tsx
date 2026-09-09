/**
 * P1D work-directory tree (Plan Task 5, §6.6) — presentation only.
 *
 * Rendering rules:
 * - a dir carrying nested `entries` (root recursive response) expands
 *   directly, no network;
 * - a dir WITHOUT `entries` is a shell — its open triggers one exact
 *   single-level fetch owned by the drawer; this component only reports it.
 * - file rows are the only insertable items; dir rows navigate/expand only.
 */
import type { ProjectTreeEntry } from '../control/types';

export interface FileTreeProps {
  entries: ProjectTreeEntry[];
  /** Directory paths currently expanded (children may come from root or level fetch). */
  expandedPaths: ReadonlySet<string>;
  /** Directory paths whose single-level fetch is in flight. */
  loadingPaths: ReadonlySet<string>;
  /** Directory paths whose single-level fetch failed (visible level error). */
  errorPaths?: ReadonlySet<string>;
  onToggleDir: (path: string, isShell: boolean) => void;
  onSelectFile: (path: string) => void;
  /** Retry a failed single-level shell load. */
  onRetryDir?: (path: string) => void;
  depth?: number;
}

export function FileTree({
  entries,
  expandedPaths,
  loadingPaths,
  errorPaths = new Set<string>(),
  onToggleDir,
  onSelectFile,
  onRetryDir,
  depth = 0,
}: FileTreeProps) {
  return (
    <ul className="v4-tree" role="tree" aria-label="工作目录文件树">
      {entries.map((entry) => {
        const isDir = entry.type === 'dir';
        const isShell = isDir && entry.entries === null;
        const isError = isShell && errorPaths.has(entry.path);
        const expanded = isDir && expandedPaths.has(entry.path);
        const isLoading = isDir && loadingPaths.has(entry.path);

        return (
          <li key={entry.path} role="treeitem" aria-expanded={isDir ? expanded : undefined}>
            {isDir ? (
              <button
                type="button"
                className={`v4-tree-row v4-tree-row--dir${isError ? ' v4-tree-row--error' : ''}`}
                onClick={() => onToggleDir(entry.path, isShell)}
                style={{ paddingLeft: `${depth * 14 + 8}px` }}
              >
                <span className="v4-tree-chevron" aria-hidden="true">
                  {isLoading ? '…' : isError ? '!' : expanded ? '▾' : '▸'}
                </span>
                <span className="v4-tree-name">{entry.name}</span>
                {isShell ? (
                  <span className="v4-tree-note">
                    {isError ? '加载失败' : '（展开加载）'}
                  </span>
                ) : null}
              </button>
            ) : (
              <button
                type="button"
                className="v4-tree-row v4-tree-row--file"
                onClick={() => onSelectFile(entry.path)}
                style={{ paddingLeft: `${depth * 14 + 8}px` }}
                title={`插入 @[${entry.path}]`}
              >
                <span className="v4-tree-chevron" aria-hidden="true" />
                <span className="v4-tree-name">{entry.name}</span>
              </button>
            )}
            {isDir && isError && onRetryDir ? (
              <button
                type="button"
                className="v4-tree-retry"
                onClick={() => onRetryDir(entry.path)}
                style={{ marginLeft: `${depth * 14 + 22}px` }}
              >
                重试
              </button>
            ) : null}
            {isDir && expanded && entry.entries && entry.entries.length > 0 ? (
              <FileTree
                entries={entry.entries}
                expandedPaths={expandedPaths}
                loadingPaths={loadingPaths}
                errorPaths={errorPaths}
                onToggleDir={onToggleDir}
                onSelectFile={onSelectFile}
                onRetryDir={onRetryDir}
                depth={depth + 1}
              />
            ) : null}
            {isDir && expanded && entry.entries && entry.entries.length === 0 ? (
              <li className="v4-tree-empty" role="treeitem">
                空目录
              </li>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}