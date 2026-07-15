import React, { useState, useEffect, useCallback } from 'react';
import { conversationsApi } from 'exo-shared';
import {
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  Edit3,
  Check,
  X,
  Filter,
  MessageSquare,
  RefreshCw,
  Database,
} from 'lucide-react';

// ── helpers ──

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function formatKeywords(input) {
  if (Array.isArray(input)) return input.filter(Boolean);
  if (typeof input === 'string') return input.split(',').map((k) => k.trim()).filter(Boolean);
  return [];
}

function chunkRangeLabel(start, end) {
  const s = typeof start === 'number' ? start : 0;
  const e = typeof end === 'number' ? end : 0;
  return `${s} – ${e}`;
}

// ── sub-components ──

function ConversationRow({ conv, isSelected, isLoading, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(conv.id)}
      className={cn(
        'w-full text-left px-3 py-3 flex items-center gap-2.5 transition-colors duration-150',
        'border-b',
        isSelected
          ? ''
          : 'hover:bg-[rgba(255,74,8,0.04)]',
      )}
      style={{
        borderColor: 'var(--cinder-line)',
        background: isSelected ? 'rgba(255,74,8,0.06)' : 'transparent',
      }}
    >
      <span className="flex-shrink-0 opacity-60" style={{ color: 'var(--cinder-text-dim)' }}>
        {isSelected ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </span>
      <MessageSquare size={14} style={{ color: 'var(--cinder-text-dim)', flexShrink: 0 }} />
      <span
        className="truncate text-sm font-light"
        style={{ color: isSelected ? 'var(--cinder-flame)' : 'var(--cinder-text)' }}
      >
        {conv.name || conv.session_name || `Session ${conv.id}`}
      </span>
      {isLoading && (
        <span className="ml-auto flex-shrink-0">
          <RefreshCw size={12} className="animate-spin" style={{ color: 'var(--cinder-text-faint)' }} />
        </span>
      )}
    </button>
  );
}

function ChunkCard({ chunk, isEditing, editValues, onEditStart, onEditValues, onSave, onCancel, savedChunkId }) {
  const keywords = formatKeywords(chunk.keywords);
  const isUnresolved = chunk.unresolved === true;
  const showSaved = savedChunkId === chunk.id;

  if (isEditing) {
    return (
      <div
        className="p-4 mb-3 rounded-sm flex flex-col gap-3"
        style={{
          background: 'var(--cinder-glass-heavy)',
          border: `1px solid var(--cinder-line-glow)`,
          borderLeft: isUnresolved ? `3px solid var(--cinder-flame)` : `3px solid var(--cinder-line)`,
        }}
      >
        {/* topic label */}
        <div>
          <label className="block text-[0.625rem] font-bold tracking-[0.15em] mb-1" style={{ color: 'var(--cinder-text-dim)' }}>
            TOPIC LABEL
          </label>
          <input
            type="text"
            value={editValues.topic_label ?? ''}
            onChange={(e) => onEditValues({ ...editValues, topic_label: e.target.value })}
            className="w-full px-2 py-1.5 rounded-sm text-sm outline-none"
            style={{
              background: 'var(--cinder-glass)',
              border: `1px solid var(--cinder-line)`,
              color: 'var(--cinder-text)',
            }}
          />
        </div>

        {/* keywords */}
        <div>
          <label className="block text-[0.625rem] font-bold tracking-[0.15em] mb-1" style={{ color: 'var(--cinder-text-dim)' }}>
            KEYWORDS (comma separated)
          </label>
          <input
            type="text"
            value={editValues.keywords ?? ''}
            onChange={(e) => onEditValues({ ...editValues, keywords: e.target.value })}
            className="w-full px-2 py-1.5 rounded-sm text-sm outline-none"
            style={{
              background: 'var(--cinder-glass)',
              border: `1px solid var(--cinder-line)`,
              color: 'var(--cinder-text)',
            }}
          />
        </div>

        {/* unresolved toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={editValues.unresolved ?? false}
            onChange={(e) => onEditValues({ ...editValues, unresolved: e.target.checked })}
            className="accent-[var(--cinder-flame)]"
          />
          <span className="text-xs font-light" style={{ color: 'var(--cinder-text-dim)' }}>
            Unresolved
          </span>
        </label>

        {/* actions */}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs transition-colors"
            style={{ color: 'var(--cinder-text-dim)', border: `1px solid var(--cinder-line)` }}
          >
            <X size={12} />
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-medium transition-colors"
            style={{ background: 'var(--cinder-flame)', color: '#fff' }}
          >
            <Check size={12} />
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-4 mb-3 rounded-sm flex flex-col gap-2.5 group transition-colors"
      style={{
        background: 'var(--cinder-panel)',
        border: `1px solid var(--cinder-line)`,
        borderLeft: isUnresolved ? `3px solid var(--cinder-flame)` : `3px solid var(--cinder-line)`,
      }}
    >
      {/* header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate" style={{ color: 'var(--cinder-text)' }}>
              {chunk.topic_label || chunk.topic || 'Untitled chunk'}
            </span>
            {isUnresolved && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[0.625rem] font-bold tracking-[0.1em]"
                style={{ background: 'rgba(255,74,8,0.12)', color: 'var(--cinder-flame)' }}
              >
                <AlertTriangle size={10} />
                UNRESOLVED
              </span>
            )}
            {showSaved && (
              <span className="text-[0.625rem] font-bold" style={{ color: 'var(--cinder-flame-dim)' }}>
                Saved ✓
              </span>
            )}
          </div>
          <div
            className="text-[0.625rem] mt-1 font-mono tracking-wider"
            style={{ color: 'var(--cinder-text-faint)' }}
          >
            {chunkRangeLabel(chunk.start_index, chunk.end_index)}
          </div>
        </div>
        <button
          type="button"
          onClick={onEditStart}
          className="p-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[rgba(255,74,8,0.08)]"
          style={{ color: 'var(--cinder-text-dim)' }}
          title="Edit chunk"
        >
          <Edit3 size={14} />
        </button>
      </div>

      {/* summary */}
      {chunk.summary && (
        <p className="text-xs leading-relaxed" style={{ color: 'var(--cinder-text-dim)' }}>
          {chunk.summary}
        </p>
      )}

      {/* keywords */}
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {keywords.map((kw, i) => (
            <span
              key={`${kw}-${i}`}
              className="inline-block px-2 py-0.5 rounded-sm text-[0.625rem] font-mono tracking-wider"
              style={{
                background: 'rgba(255,74,8,0.06)',
                color: 'var(--cinder-flame-dim)',
                border: `1px solid var(--cinder-line)`,
              }}
            >
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── main component ──

export default function MemoryConsole() {
  const [conversations, setConversations] = useState([]);
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [chunksCache, setChunksCache] = useState({});
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [convError, setConvError] = useState(null);
  const [unresolvedOnly, setUnresolvedOnly] = useState(false);
  const [editingChunkId, setEditingChunkId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [savingChunkId, setSavingChunkId] = useState(null);
  const [savedChunkId, setSavedChunkId] = useState(null);

  // ── fetch conversations on mount ──

  const fetchConversations = useCallback(async () => {
    setLoadingConvs(true);
    setConvError(null);
    try {
      const data = await conversationsApi.listConversations();
      setConversations(safeArray(data));
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setConvError(err.message || 'Failed to load conversations');
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // ── toggle conversation (lazy-load chunks) ──

  const fetchChunks = useCallback(async (convId) => {
    setChunksCache((prev) => ({ ...prev, [convId]: { loading: true, data: null, error: null } }));
    try {
      const res = await conversationsApi.listHistoryChunks(convId);
      setChunksCache((prev) => ({
        ...prev,
        [convId]: {
          loading: false,
          data: safeArray(res.history_chunks || res.data?.history_chunks),
          error: null,
        },
      }));
    } catch (err) {
      console.error('Failed to load history chunks:', err);
      setChunksCache((prev) => ({
        ...prev,
        [convId]: { loading: false, data: null, error: err.message || 'Failed to load chunks' },
      }));
    }
  }, []);

  const toggleConv = useCallback(
    async (convId) => {
      if (selectedConvId === convId) {
        setSelectedConvId(null);
        return;
      }
      setSelectedConvId(convId);
      setEditingChunkId(null);
      setSavedChunkId(null);
      if (!chunksCache[convId]) {
        await fetchChunks(convId);
      }
    },
    [selectedConvId, chunksCache, fetchChunks],
  );

  // ── edit handlers ──

  const startEditing = useCallback((chunk) => {
    setEditingChunkId(chunk.id);
    setEditValues({
      topic_label: chunk.topic_label || chunk.topic || '',
      keywords: Array.isArray(chunk.keywords) ? chunk.keywords.join(', ') : chunk.keywords || '',
      unresolved: chunk.unresolved ?? false,
    });
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingChunkId(null);
    setEditValues({});
  }, []);

  const saveChunk = useCallback(
    async (chunkId) => {
      setSavingChunkId(chunkId);
      try {
        const payload = {
          topic_label: editValues.topic_label,
          keywords: formatKeywords(editValues.keywords),
          unresolved: editValues.unresolved,
        };
        await conversationsApi.updateHistoryChunk(chunkId, payload);

        // update local cache
        setChunksCache((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((cid) => {
            if (next[cid]?.data) {
              next[cid] = {
                ...next[cid],
                data: next[cid].data.map((ch) =>
                  ch.id === chunkId
                    ? {
                        ...ch,
                        topic_label: payload.topic_label,
                        keywords: payload.keywords,
                        unresolved: payload.unresolved,
                      }
                    : ch,
                ),
              };
            }
          });
          return next;
        });

        setEditingChunkId(null);
        setEditValues({});
        setSavedChunkId(chunkId);
        setTimeout(() => setSavedChunkId(null), 2000);
      } catch (err) {
        console.error('Failed to update chunk:', err);
      } finally {
        setSavingChunkId(null);
      }
    },
    [editValues],
  );

  // ── derive display data ──

  const activeCache = selectedConvId ? chunksCache[selectedConvId] : null;
  const allChunks = activeCache?.data ?? [];
  const filteredChunks = unresolvedOnly ? allChunks.filter((c) => c.unresolved === true) : allChunks;

  // ── render ──

  return (
    <div className="flex-1 h-full flex" style={{ background: 'var(--cinder-base)' }}>
      {/* ── left sidebar: conversation list ── */}
      <aside
        className="flex-shrink-0 flex flex-col overflow-hidden"
        style={{ width: 280, borderRight: `1px solid var(--cinder-line)` }}
      >
        <div
          className="px-4 py-3 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: `1px solid var(--cinder-line)` }}
        >
          <div className="flex items-center gap-2">
            <Database size={14} style={{ color: 'var(--cinder-flame-dim)' }} />
            <span className="text-sm font-light" style={{ color: 'var(--cinder-text)' }}>
              Conversations
            </span>
          </div>
          {/* filter toggle */}
          {selectedConvId && (
            <button
              type="button"
              onClick={() => setUnresolvedOnly((v) => !v)}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-sm text-[0.625rem] font-bold tracking-[0.1em] transition-colors',
              )}
              style={{
                color: unresolvedOnly ? 'var(--cinder-flame)' : 'var(--cinder-text-dim)',
                border: `1px solid ${unresolvedOnly ? 'var(--cinder-flame)' : 'var(--cinder-line)'}`,
                background: unresolvedOnly ? 'rgba(255,74,8,0.08)' : 'transparent',
              }}
              title="Toggle unresolved only filter"
            >
              <Filter size={10} />
              UNRESOLVED
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* loading state */}
          {loadingConvs && (
            <div className="flex items-center justify-center py-8" style={{ color: 'var(--cinder-text-faint)' }}>
              <RefreshCw size={16} className="animate-spin" />
            </div>
          )}

          {/* error state */}
          {!loadingConvs && convError && (
            <div className="px-4 py-8 text-center">
              <p className="text-xs mb-3" style={{ color: 'var(--cinder-flame)' }}>
                {convError}
              </p>
              <button
                type="button"
                onClick={fetchConversations}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs transition-colors"
                style={{
                  color: 'var(--cinder-text-dim)',
                  border: `1px solid var(--cinder-line)`,
                }}
              >
                <RefreshCw size={12} />
                Retry
              </button>
            </div>
          )}

          {/* empty state */}
          {!loadingConvs && !convError && conversations.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-xs" style={{ color: 'var(--cinder-text-dim)' }}>
                No conversations yet
              </p>
            </div>
          )}

          {/* conversation rows */}
          {!loadingConvs &&
            !convError &&
            conversations.map((conv) => (
              <ConversationRow
                key={conv.id}
                conv={conv}
                isSelected={selectedConvId === conv.id}
                isLoading={chunksCache[conv.id]?.loading ?? false}
                onToggle={toggleConv}
              />
            ))}
        </div>
      </aside>

      {/* ── right panel: chunk cards ── */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {!selectedConvId && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3 max-w-sm px-6">
              <div
                className="mx-auto p-3 rounded-full inline-block"
                style={{ background: 'rgba(255,74,8,0.06)' }}
              >
                <Database size={28} style={{ color: 'var(--cinder-flame-dim)' }} />
              </div>
              <h2 className="text-lg font-light" style={{ color: 'var(--cinder-text)' }}>
                History Chunk Manager
              </h2>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--cinder-text-dim)' }}>
                Select a conversation from the sidebar to browse and edit its history chunks.
              </p>
            </div>
          </div>
        )}

        {selectedConvId && (
          <>
            {/* panel header */}
            <div
              className="px-5 py-3 flex items-center justify-between flex-shrink-0"
              style={{ borderBottom: `1px solid var(--cinder-line)`, background: 'var(--cinder-glass-heavy)' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <MessageSquare size={14} style={{ color: 'var(--cinder-text-dim)' }} />
                <span className="text-sm font-light truncate" style={{ color: 'var(--cinder-text)' }}>
                  {(() => {
                    const c = conversations.find((x) => x.id === selectedConvId);
                    return c ? c.name || c.session_name || `Session ${c.id}` : '';
                  })()}
                </span>
              </div>
              <span className="text-[0.625rem] font-mono" style={{ color: 'var(--cinder-text-faint)' }}>
                {filteredChunks.length} chunk{filteredChunks.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* chunk cards */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* loading state */}
              {activeCache?.loading && (
                <div className="flex items-center justify-center py-12" style={{ color: 'var(--cinder-text-faint)' }}>
                  <RefreshCw size={20} className="animate-spin" />
                </div>
              )}

              {/* error state */}
              {!activeCache?.loading && activeCache?.error && (
                <div className="py-12 text-center">
                  <p className="text-xs mb-3" style={{ color: 'var(--cinder-flame)' }}>
                    {activeCache.error}
                  </p>
                  <button
                    type="button"
                    onClick={() => fetchChunks(selectedConvId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs transition-colors"
                    style={{
                      color: 'var(--cinder-text-dim)',
                      border: `1px solid var(--cinder-line)`,
                    }}
                  >
                    <RefreshCw size={12} />
                    Retry
                  </button>
                </div>
              )}

              {/* empty state */}
              {!activeCache?.loading && !activeCache?.error && filteredChunks.length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-xs" style={{ color: 'var(--cinder-text-dim)' }}>
                    {unresolvedOnly ? 'No unresolved chunks' : 'No history chunks'}
                  </p>
                </div>
              )}

              {/* chunk cards */}
              {!activeCache?.loading &&
                !activeCache?.error &&
                filteredChunks.map((chunk) => (
                  <ChunkCard
                    key={chunk.id}
                    chunk={chunk}
                    isEditing={editingChunkId === chunk.id}
                    editValues={editingChunkId === chunk.id ? editValues : {}}
                    onEditStart={() => startEditing(chunk)}
                    onEditValues={setEditValues}
                    onSave={() => saveChunk(chunk.id)}
                    onCancel={cancelEditing}
                    savedChunkId={savedChunkId}
                  />
                ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
