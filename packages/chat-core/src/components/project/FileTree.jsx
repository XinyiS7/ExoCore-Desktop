import React from 'react';
import { ChevronRight, Folder, FolderOpen, FileText } from 'lucide-react';

/**
 * FileTree — recursive file/directory tree component.
 *
 * Props:
 *   entries       — array of { name, type, path, size?, entries? }
 *   indent        — current indentation level (default 0)
 *   onFileClick   — (relPath, type) => void
 *   onExpand      — (dirPath) => void  (lazy load callback)
 *   expandedDirs  — Set of expanded directory paths
 *   onToggleDir   — (dirPath) => void
 */
export default function FileTree({
  entries,
  indent = 0,
  onFileClick,
  onExpand,
  expandedDirs = new Set(),
  onToggleDir,
}) {
  if (!entries || entries.length === 0) {
    return (
      <div className="text-xs text-chat-muted/30 italic py-1" style={{ paddingLeft: indent * 12 + 8 }}>
        (empty)
      </div>
    );
  }

  // Backend handles exclude rules — sort what we receive
  const sorted = [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return (
    <div>
      {sorted.map(entry => (
        <TreeNode
          key={entry.path}
          entry={entry}
          indent={indent}
          onFileClick={onFileClick}
          onExpand={onExpand}
          expandedDirs={expandedDirs}
          onToggleDir={onToggleDir}
        />
      ))}
    </div>
  );
}

function TreeNode({ entry, indent, onFileClick, onExpand, expandedDirs, onToggleDir }) {
  const isDir = entry.type === 'dir';
  const isExpanded = expandedDirs.has(entry.path);

  const handleClick = () => {
    if (isDir) {
      // Toggle expand/collapse
      if (!isExpanded && onExpand) {
        onExpand(entry.path);
      }
      onToggleDir?.(entry.path);
    } else {
      onFileClick?.(entry.path, 'file');
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className="w-full flex items-center gap-1 py-0.5 text-left hover:bg-white/5 transition-colors rounded-[2px] group"
        style={{ paddingLeft: indent * 12 + 4 }}
      >
        {/* Expand/collapse chevron for dirs */}
        {isDir ? (
          <ChevronRight
            size={10}
            className={`shrink-0 text-chat-muted/30 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
        ) : (
          <span className="w-[10px] shrink-0" />
        )}

        {/* Icon */}
        {isDir ? (
          isExpanded ? (
            <FolderOpen size={13} className="text-chat-accent/60 shrink-0" />
          ) : (
            <Folder size={13} className="text-chat-accent/50 shrink-0" />
          )
        ) : (
          <FileText size={13} className="text-chat-muted/40 shrink-0" />
        )}

        {/* Name */}
        <span className={`text-[11px] truncate font-mono ${isDir ? 'text-chat-text/70' : 'text-chat-text/60'}`}>
          {entry.name}
        </span>

        {/* Size for files */}
        {!isDir && entry.size != null && (
          <span className="text-[9px] text-chat-muted/20 ml-auto shrink-0 hidden group-hover:inline">
            {formatSize(entry.size)}
          </span>
        )}
      </button>

      {/* Children (if expanded dir and has loaded entries) */}
      {isDir && isExpanded && entry.entries && (
        <FileTree
          entries={entry.entries}
          indent={indent + 1}
          onFileClick={onFileClick}
          onExpand={onExpand}
          expandedDirs={expandedDirs}
          onToggleDir={onToggleDir}
        />
      )}
    </div>
  );
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
