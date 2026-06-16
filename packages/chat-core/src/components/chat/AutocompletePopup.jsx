import React, { useMemo, useEffect, useRef } from 'react';
import { Folder, FileText } from 'lucide-react';

/**
 * AutocompletePopup — panel rendered in normal flow above the textarea.
 * Shows file/directory matches when user types @ in the chat input.
 *
 * Matching: front-to-back (starts-with priority, contains as fallback)
 * against entry *names* at the resolved directory level.
 *
 * Props:
 * isOpen  — whether to show the panel
 * query  — text after @ (e.g. "src/ut")
 * fileTree  — { path, entries: [{ name, type, path, size? }] }
 * onSelect  — (path, type) => void
 * onClose  — () => void
 * onLoadDir — (dirPath) => void (lazy load)
 */
export default function AutocompletePopup({
 isOpen,
 query,
 fileTree,
 onSelect,
 onClose,
 onLoadDir,
}) {
 const panelRef = useRef(null);
 const [highlightIndex, setHighlightIndex] = React.useState(0);

 // Extract name filter from query (last segment after /)
 const nameFilter = useMemo(() => {
 if (!query) return '';
 const parts = query.split(/[/\\]/);
 return parts[parts.length - 1] || '';
 }, [query]);

 // Resolve which directory we're browsing + the name filter.
 // If query has NO "/" → GLOBAL recursive search across full tree.
 // If query HAS "/" → navigate into the specified directory, then filter.
 const { matches, dirDisplay } = useMemo(() => {
 if (!fileTree || !fileTree.entries) {
  return { matches: [], dirDisplay: '' };
 }

 const raw = query || '';
 const parts = raw.split(/[/\\]/);
 const filterLower = (parts[parts.length - 1] || '').toLowerCase();
 const navParts = parts.slice(0, -1).filter(Boolean);

 if (navParts.length > 0) {
  // ── Path navigation mode: resolve directory, then filter ──
  let currentEntries = fileTree.entries;
  let navigatedPath = '';
  for (const part of navParts) {
  const found = currentEntries?.find(
   e => e.type === 'dir' && e.name.toLowerCase() === part.toLowerCase()
  );
  if (!found) return { matches: [], dirDisplay: navParts.join('/') };
  navigatedPath = found.path;
  currentEntries = found.entries || [];
  }

  if (!currentEntries.length) {
  return { matches: [], dirDisplay: navigatedPath };
  }

  const results = filterAndScore(currentEntries, filterLower);
  return { matches: results, dirDisplay: navigatedPath };
 }

 // ── Global search mode: recursive search across full tree ──
 // Backend already handles exclude rules — we search everything we receive.
 function collectAll(entries, parentPath) {
  const results = [];
  for (const entry of entries) {
  results.push({ ...entry, _parentPath: parentPath });
  if (entry.type === 'dir' && entry.entries) {
   results.push(...collectAll(entry.entries, entry.path));
  }
  }
  return results;
 }

 const allEntries = collectAll(fileTree.entries, '');
 const results = filterAndScore(allEntries, filterLower);
 return { matches: results, dirDisplay: '' };
 }, [fileTree, query]);

 // Sort: score first, then dirs before files, then alphabetically
 const sorted = useMemo(() => {
 return [...matches].sort((a, b) => {
  if (a._score !== b._score) return a._score - b._score;
  if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
 });
 }, [matches]);

 // Reset highlight when results change
 useEffect(() => {
 setHighlightIndex(0);
 }, [query]);

 // Keyboard handler
 useEffect(() => {
 if (!isOpen) return;

 const handler = (e) => {
  switch (e.key) {
  case 'ArrowDown':
   e.preventDefault();
   setHighlightIndex(i => Math.min(i + 1, sorted.length - 1));
   break;
  case 'ArrowUp':
   e.preventDefault();
   setHighlightIndex(i => Math.max(i - 1, 0));
   break;
  case 'Enter':
   e.preventDefault();
   if (sorted[highlightIndex]) {
   onSelect(sorted[highlightIndex].path, sorted[highlightIndex].type);
   }
   break;
  case 'Escape':
   e.preventDefault();
   onClose();
   break;
  case 'Tab':
   e.preventDefault();
   if (sorted.length === 1) {
   onSelect(sorted[0].path, sorted[0].type);
   } else if (sorted[highlightIndex]) {
   onSelect(sorted[highlightIndex].path, sorted[highlightIndex].type);
   }
   break;
  default:
   break;
  }
 };

 window.addEventListener('keydown', handler, true);
 return () => window.removeEventListener('keydown', handler, true);
 }, [isOpen, sorted, highlightIndex, onSelect, onClose]);

 // Scroll highlighted item into view
 useEffect(() => {
 const el = panelRef.current?.querySelector(`[data-index="${highlightIndex}"]`);
 el?.scrollIntoView({ block: 'nearest' });
 }, [highlightIndex]);

 // Close on outside click
 useEffect(() => {
 if (!isOpen) return;
 const handler = (e) => {
  if (panelRef.current && !panelRef.current.contains(e.target)) {
  onClose();
  }
 };
 const id = setTimeout(() => document.addEventListener('mousedown', handler), 100);
 return () => {
  clearTimeout(id);
  document.removeEventListener('mousedown', handler);
 };
 }, [isOpen, onClose]);

 if (!isOpen) return null;

 return (
 <div
  ref={panelRef}
  className="w-full max-h-[40vh] overflow-y-auto bg-chat-panel border border-white/10 rounded-md shadow-lg"
 >
  {/* Header */}
  <div className="px-3 py-1.5 border-b border-white/5 flex items-center gap-2">
  <span className="text-[0.5625rem] font-mono tracking-[0.2em] text-chat-muted/40">
   {dirDisplay ? `@${dirDisplay}/` : '@'}
  </span>
  {nameFilter && (
   <span className="text-[0.625rem] font-mono text-chat-text/60">{nameFilter}</span>
  )}
  {!nameFilter && !dirDisplay && (
   <span className="text-[0.5625rem] text-chat-muted/30">Files in root</span>
  )}
  </div>

  {/* Results */}
  {sorted.length === 0 ? (
  <div className="px-3 py-3 text-xs text-chat-muted/30 italic text-center">
   {query ? `无匹配 "${query}"` : '无文件'}
  </div>
  ) : (
  <div className="py-0.5">
   {sorted.slice(0, 50).map((entry, i) => (
   <button
    key={entry.path}
    data-index={i}
    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
    i === highlightIndex ? 'bg-white/10' : 'hover:bg-exo-accent/[0.04]'
    }`}
    onMouseEnter={() => setHighlightIndex(i)}
    onMouseDown={(e) => {
    e.preventDefault();
    onSelect(entry.path, entry.type);
    }}
   >
    {entry.type === 'dir' ? (
    <>
     <Folder size={12} className="text-chat-accent/60 shrink-0" />
     <span className="text-xs text-chat-text/80 truncate">
     {highlightMatch(entry.name, query || '')}
     </span>
     {entry._parentPath && (
     <span className="text-[0.5625rem] text-chat-muted/20 truncate ml-1">
      {entry._parentPath}/
     </span>
     )}
     <span className="text-[0.5625rem] text-chat-muted/20 ml-auto shrink-0">/</span>
    </>
    ) : (
    <>
     <FileText size={12} className="text-chat-muted/40 shrink-0" />
     <span className="text-xs text-chat-text/70 truncate">
     {highlightMatch(entry.name, query || '')}
     </span>
     {/* Show parent directory for global search results */}
     {entry._parentPath && (
     <span className="text-[0.5625rem] text-chat-muted/30 truncate ml-auto shrink-0">
      {entry._parentPath}/
     </span>
     )}
     {entry.size != null && !entry._parentPath && (
     <span className="text-[0.5625rem] text-chat-muted/20 ml-auto shrink-0">
      {formatSize(entry.size)}
     </span>
     )}
    </>
    )}
   </button>
   ))}
   {sorted.length > 50 && (
   <div className="px-3 py-1.5 text-[0.5625rem] text-chat-muted/30 text-center">
    ... 还有 {sorted.length - 50} 个结果，输入更多字符缩小范围
   </div>
   )}
  </div>
  )}
 </div>
 );
}

/**
 * Filter entries by name: exact match → starts-with → contains.
 * Returns entries with _score: 0 (exact), 1 (starts-with), 2 (contains).
 * If filter is empty, returns all entries with _score 0.
 */
function filterAndScore(entries, filterLower) {
 if (!filterLower) {
 return entries.map(e => ({ ...e, _score: 0 }));
 }

 const exact = [];
 const startsWith = [];
 const contains = [];

 for (const entry of entries) {
 const nameLower = entry.name.toLowerCase();
 if (nameLower === filterLower) {
  exact.push({ ...entry, _score: 0 });
 } else if (nameLower.startsWith(filterLower)) {
  startsWith.push({ ...entry, _score: 1 });
 } else if (nameLower.includes(filterLower)) {
  contains.push({ ...entry, _score: 2 });
 }
 }

 return [...exact, ...startsWith, ...contains];
}

/** Wrap matching portions of text in a highlight span. */
function highlightMatch(name, query) {
 if (!query) return name;
 const lowerName = name.toLowerCase();
 const lowerQuery = query.toLowerCase();
 const idx = lowerName.indexOf(lowerQuery);
 if (idx === -1) return name;

 return (
 <>
  {name.slice(0, idx)}
  <span className="text-chat-accent">{name.slice(idx, idx + query.length)}</span>
  {name.slice(idx + query.length)}
 </>
 );
}

function formatSize(bytes) {
 if (bytes == null) return '';
 if (bytes < 1024) return `${bytes} B`;
 if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
 return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
