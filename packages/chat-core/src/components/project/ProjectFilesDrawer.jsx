import React, { useState } from 'react';
import { X, FolderOpen, FileText } from 'lucide-react';
import FileTree from './FileTree';

/**
 * ProjectFilesDrawer — right slide-out panel showing:
 * - Work Directory files (if project.work_dir is set) — interactive FileTree
 * - Project Files (uploaded / vectorized reference files)
 */
export default function ProjectFilesDrawer({
 isOpen,
 onClose,
 project,
 projectFiles = [],
 fileTree,
 treeLoading,
 onLoadDirectory,
 onFileClick,
}) {
 const [expandedDirs, setExpandedDirs] = useState(new Set());

 if (!isOpen) return null;

 const hasWorkDir = project?.work_dir;

 const handleToggleDir = (dirPath) => {
 setExpandedDirs(prev => {
  const next = new Set(prev);
  if (next.has(dirPath)) {
  next.delete(dirPath);
  } else {
  next.add(dirPath);
  // Lazy load if entries not yet loaded
  const entry = findEntry(fileTree?.entries, dirPath);
  if (entry && !entry.entries && onLoadDirectory) {
   onLoadDirectory(dirPath);
  }
  }
  return next;
 });
 };

 const handleFileClick = (path, type) => {
 onFileClick?.(path, type);
 onClose?.();
 };

 return (
 <>
  {/* Backdrop */}
  <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

  {/* Drawer */}
  <div className="fixed top-0 right-0 h-full w-[350px] max-w-[90vw] bg-chat-panel border-l border-white/5 shadow-2xl z-50 flex flex-col animate-fade-in overflow-hidden">
  {/* Header */}
  <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
   <div className="flex items-center gap-2">
   <FolderOpen size={14} className="text-chat-accent/60" />
   <span className="text-xs font-medium text-chat-text truncate">
    {project?.name || 'Project'}
   </span>
   </div>
   <button onClick={onClose} className="p-1 text-chat-muted hover:text-chat-text transition-colors">
   <X size={14} />
   </button>
  </div>

  <div className="flex-1 overflow-y-auto p-4 space-y-6">
   {/* ── Work Directory ── */}
   <div>
   <h3 className="text-[0.625rem] font-mono tracking-[0.2em] text-chat-muted/50 mb-2">
    Work Directory
   </h3>
   {hasWorkDir ? (
    <div>
    <p className="text-[0.625rem] font-mono text-chat-muted/30 mb-2 truncate">{project.work_dir}</p>
    {treeLoading && !fileTree ? (
     <div className="flex items-center gap-2 text-xs text-chat-muted/40 italic py-2">
     <div className="w-3 h-3 border-2 border-chat-accent/30 border-t-chat-accent rounded-full animate-spin" />
     Loading directory...
     </div>
    ) : fileTree && fileTree.entries ? (
     <FileTree
     entries={fileTree.entries}
     indent={0}
     onFileClick={handleFileClick}
     onExpand={onLoadDirectory}
     expandedDirs={expandedDirs}
     onToggleDir={handleToggleDir}
     />
    ) : (
     <div className="text-xs text-chat-muted/40 italic">无法读取目录</div>
    )}
    </div>
   ) : (
    <p className="text-xs text-chat-muted/30 italic">未绑定工作目录</p>
   )}
   </div>

   {/* ── Project Files ── */}
   <div>
   <h3 className="text-[0.625rem] font-mono tracking-[0.2em] text-chat-muted/50 mb-2">
    Project Files
    {projectFiles.length > 0 && (
    <span className="ml-1 text-chat-muted/30">· {projectFiles.length}</span>
    )}
   </h3>
   {projectFiles.length === 0 ? (
    <p className="text-xs text-chat-muted/30 italic">无参考文件</p>
   ) : (
    <div className="space-y-1">
    {projectFiles.map(f => (
     <div
     key={f.id || f.name}
     className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-exo-accent/[0.04] transition-colors text-xs text-chat-muted/70"
     >
     <FileText size={12} className="text-chat-muted/40 shrink-0" />
     <span className="truncate">{f.display_name || f.original_filename || f.name}</span>
     </div>
    ))}
    </div>
   )}
   </div>
  </div>
  </div>
 </>
 );
}

/** Walk file tree to find an entry by path. */
function findEntry(entries, targetPath) {
 if (!entries) return null;
 for (const entry of entries) {
 if (entry.path === targetPath) return entry;
 if (entry.type === 'dir' && entry.entries) {
  const found = findEntry(entry.entries, targetPath);
  if (found) return found;
 }
 }
 return null;
}
