import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Tag, Edit3, Trash2, RefreshCw, ChevronDown, ChevronUp, Plus, Brain } from 'lucide-react';
import { baseUrl, getCsrfToken } from 'exo-shared';
import { sortPresets } from '../../utils/presets';

const MemoryManager = ({ presets, openDestructor, presetId }) => {
  const sortedPresets = useMemo(() => sortPresets(presets), [presets]);
  const [selectedPresetId, setSelectedPresetId] = useState(presetId ?? sortedPresets[0]?.id ?? '');

  useEffect(() => {
    if (!selectedPresetId && sortedPresets.length > 0) {
      setSelectedPresetId(sortedPresets[0].id);
    }
  }, [sortedPresets, selectedPresetId]);

  useEffect(() => {
    if (presetId) {
      setSelectedPresetId(presetId);
    }
  }, [presetId]);

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ scope: '', source: '', is_processed: '' });
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editScope, setEditScope] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  
  const [showNewForm, setShowNewForm] = useState(false);
  const [newText, setNewText] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newScope, setNewScope] = useState('global');
  const [creating, setCreating] = useState(false);
  const [patchingScopeId, setPatchingScopeId] = useState(null);
  const [saveError, setSaveError] = useState(null);

  // Content editing is only allowed for preset_id=2 (user global memory)
  const canEditContent = String(selectedPresetId) === '2';

  const [availableTags, setAvailableTags] = useState([]);
  const [scopeKeywords, setScopeKeywords] = useState(null); // { scope: [keywords] } from /api/memory/scope-keywords/

  const fetchEntries = useCallback(() => {
    if (!selectedPresetId) return;
    setLoading(true);
    const params = new URLSearchParams({ preset_id: selectedPresetId });
    if (filters.scope) params.set('scope', filters.scope);
    if (filters.source) params.set('source', filters.source);
    if (filters.is_processed !== '') params.set('is_processed', filters.is_processed);
    fetch(`${baseUrl}/api/memory/portraits/?${params}`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => setEntries(Array.isArray(data) ? data : (data.results ?? [])))
      .catch(err => console.error('记忆加载失败', err))
      .finally(() => setLoading(false));
  }, [selectedPresetId, filters]);

  const fetchTags = useCallback(() => {
    if (!selectedPresetId) return;
    fetch(`${baseUrl}/api/memory/portraits/tags/?preset_id=${selectedPresetId}`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => setAvailableTags(data))
      .catch(err => console.error('获取标签失败', err));
  }, [selectedPresetId]);

  useEffect(() => {
    fetchEntries();
    fetchTags();
  }, [fetchEntries, fetchTags]);

  // Load scope keywords registry (dynamic, user-configurable)
  useEffect(() => {
    fetch(`${baseUrl}/api/memory/scope-keywords/`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setScopeKeywords(data); })
      .catch(() => {});
  }, []);

  // Build scope options from registry + "global" fallback
  const scopeOptions = useMemo(() => {
    const scopes = scopeKeywords ? Object.keys(scopeKeywords) : [];
    if (!scopes.includes('global')) scopes.push('global');
    return scopes;
  }, [scopeKeywords]);

  const scopeLabel = (val) => {
    if (!val) return '—';
    return val.toUpperCase();
  };

  const handleEdit = (entry) => {
    setEditingId(entry.id);
    setEditText(entry.content || '');
    setEditScope(entry.scope || 'global');
    const tags = Array.isArray(entry.tags) ? entry.tags : (entry.tags ? String(entry.tags).split(',') : []);
    setEditTags(tags.join(', '));
  };

  const handleScopeChange = async (entry, newScope) => {
    if (newScope === entry.scope) return;
    setPatchingScopeId(entry.id);
    try {
      const res = await fetch(`${baseUrl}/api/memory/portraits/${entry.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({ scope: newScope }),
      });
      if (res.ok) {
        const updated = await res.json();
        setEntries(prev => prev.map(e => e.id === entry.id ? updated : e));
      }
    } catch (err) {
      console.error('scope 更新失败', err);
    } finally {
      setPatchingScopeId(null);
    }
  };

  const handleSave = async (id) => {
    setSavingId(id);
    setSaveError(null);
    const tags = editTags.split(',').map(t => t.trim()).filter(Boolean);
    const body = { tags, scope: editScope };
    if (canEditContent) body.content = editText;
    try {
      const res = await fetch(`${baseUrl}/api/memory/portraits/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        setEntries(prev => prev.map(e => e.id === id ? updated : e));
        setEditingId(null);
        setSaveError(null);
        fetchTags();
      } else if (res.status === 403) {
        setSaveError('Content editing is restricted to user global memory.');
      }
    } catch (err) {
      console.error('保存失败', err);
    } finally {
      setSavingId(null);
    }
  };

  const handleCreate = async () => {
    if (!newText.trim()) return;
    setCreating(true);
    const tags = newTags.split(',').map(t => t.trim()).filter(Boolean);
    try {
      const res = await fetch(`${baseUrl}/api/memory/portraits/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({ 
          preset_id: selectedPresetId,
          content: newText,
          tags, 
          scope: newScope 
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setEntries(prev => [created, ...prev]);
        setShowNewForm(false);
        setNewText('');
        setNewTags('');
        fetchTags();
      }
    } catch (err) {
      console.error('创建失败', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (id) => {
    openDestructor({
      title: 'Delete Memory Entry',
      description: 'This neural fragment will be permanently erased. This action cannot be undone.',
      onDelete: async () => {
        try {
          const res = await fetch(`${baseUrl}/api/memory/portraits/${id}/`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': getCsrfToken() },
            credentials: 'include',
          });
          if (res.ok || res.status === 204) {
            setEntries(prev => prev.filter(e => e.id !== id));
          }
        } catch (err) {
          console.error('删除失败', err);
        }
      },
    });
  };

  const tagsArray = (entry) => {
    if (Array.isArray(entry.tags)) return entry.tags;
    if (typeof entry.tags === 'string' && entry.tags) return entry.tags.split(',').map(t => t.trim()).filter(Boolean);
    return [];
  };

  // Scope labels are dynamic — if scopeKeywords hasn't loaded yet, show the raw value

  const filterSelect = 'bg-exo-pure border border-exo-mist-10 rounded-[2px] px-3 py-1.5 text-[11px] font-mono text-exo-muted outline-none focus:border-exo-accent/40 cursor-pointer transition-colors hover:border-exo-mist-20';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-3 p-4 border-b border-exo-mist-10 shrink-0 flex-wrap bg-exo-pure/40 backdrop-blur-sm">
        {presetId ? (
          <span className="text-[10px] text-exo-muted font-mono uppercase tracking-wider px-2">
            {sortedPresets.find(p => p.id === presetId)?.name || `Preset #${presetId}`}
          </span>
        ) : (
          <select
            value={selectedPresetId}
            onChange={e => setSelectedPresetId(e.target.value)}
            className="bg-exo-pure border border-exo-mist-10 rounded-[2px] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-exo-accent outline-none focus:border-exo-accent/40 cursor-pointer shadow-sm"
          >
            {sortedPresets.length === 0 && <option value="">无 Agent</option>}
            {sortedPresets.map(p => (
              <option key={p.id} value={p.id} className="bg-exo-pure">{p.name}</option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-2">
          <select value={filters.scope} onChange={e => setFilters(f => ({ ...f, scope: e.target.value }))} className={filterSelect}>
            <option value="">所有范围 / ALL SCOPES</option>
            {scopeOptions.map(val => (
              <option key={val} value={val} className="bg-exo-pure">{scopeLabel(val)}</option>
            ))}
          </select>

          <select value={filters.source} onChange={e => setFilters(f => ({ ...f, source: e.target.value }))} className={filterSelect}>
            <option value="">所有来源 / ALL SOURCES</option>
            <option value="highlight" className="bg-exo-pure">HIGHLIGHT</option>
            <option value="g045_tool" className="bg-exo-pure">TOOL</option>
            <option value="user_manual" className="bg-exo-pure">MANUAL</option>
          </select>

          <select value={filters.is_processed} onChange={e => setFilters(f => ({ ...f, is_processed: e.target.value }))} className={filterSelect}>
            <option value="">全部状态 / ALL STATUS</option>
            <option value="true" className="bg-exo-pure">PROCESSED</option>
            <option value="false" className="bg-exo-pure">PENDING</option>
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={fetchEntries}
            disabled={loading}
            className="p-2 text-exo-muted hover:text-exo-accent transition-colors rounded-[2px] border border-exo-mist-10 hover:bg-white/5 disabled:opacity-40"
            title="刷新"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className={`px-4 py-1.5 rounded-[2px] text-[11px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 shadow-brutalist ${showNewForm ? 'bg-exo-accent text-exo-pure' : 'bg-white text-exo-pure hover:bg-exo-accent'}`}
          >
            <Plus size={14} /> {showNewForm ? 'CANCEL' : 'INJECT MEMORY'}
          </button>
        </div>
      </div>

      {/* New Entry Form */}
      {showNewForm && (
        <div className="p-6 border-b border-exo-mist-10 bg-exo-accent/[0.02] animate-fade-in shrink-0">
          <div className="space-y-4 max-w-4xl">
            <div className="relative">
              <div className="absolute top-3 left-3 opacity-20 pointer-events-none">
                <Brain size={14} className="text-exo-accent" />
              </div>
              <textarea
                placeholder="INPUT NEURAL FRAGMENT..."
                value={newText}
                onChange={e => setNewText(e.target.value)}
                rows={4}
                className="w-full bg-exo-pure border border-exo-mist-10 rounded-[2px] pl-10 pr-4 py-3 text-sm text-white outline-none focus:border-exo-accent/40 resize-none font-mono placeholder:opacity-20 leading-relaxed"
              />
            </div>
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[240px] relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30">
                  <Tag size={12} />
                </div>
                <input
                  placeholder="TAGS (COMMA SEPARATED)"
                  value={newTags}
                  onChange={e => setNewTags(e.target.value)}
                  className="w-full bg-exo-pure border border-exo-mist-10 rounded-[2px] pl-9 pr-4 py-2 text-[11px] text-white font-mono outline-none focus:border-exo-accent/40 uppercase tracking-tight"
                  list="available-tags"
                />
                <datalist id="available-tags">
                  {availableTags.map(tag => <option key={tag} value={tag} />)}
                </datalist>
              </div>
              <select
                value={newScope}
                onChange={e => setNewScope(e.target.value)}
                className="bg-exo-pure border border-exo-mist-10 rounded-[2px] px-4 py-2 text-[11px] font-mono text-white outline-none focus:border-exo-accent/40 cursor-pointer"
              >
                {scopeOptions.map(val => (
                  <option key={val} value={val} className="bg-exo-pure">{scopeLabel(val)}</option>
                ))}
              </select>
              <button
                onClick={handleCreate}
                disabled={creating || !newText.trim()}
                className="px-8 py-2 bg-exo-accent text-exo-pure font-bold rounded-[2px] text-[11px] uppercase tracking-widest hover:shadow-glow-sharp transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-brutalist"
              >
                {creating ? 'COMMITTING...' : 'SAVE TO NEURONS'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
        {loading && !entries.length ? (
          <div className="text-center py-24 text-exo-muted font-mono text-[11px] uppercase tracking-widest animate-pulse">Accessing memory core...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-24 text-exo-muted font-mono text-[11px] uppercase tracking-widest opacity-20 italic">No neural fragments found in current filter</div>
        ) : entries.map(entry => (
          <div key={entry.id} className="composio-card bg-exo-pure/30 group">
            <div className="px-5 py-4">
              {/* Meta row */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {entry.scope !== undefined && (
                    <select
                      value={entry.scope || ''}
                      disabled={patchingScopeId === entry.id}
                      onChange={e => handleScopeChange(entry, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className="text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-[2px] bg-exo-accent/10 text-exo-accent border border-exo-accent/20 cursor-pointer outline-none hover:bg-exo-accent/20 transition-colors disabled:opacity-50"
                    >
                      <option value="" disabled className="bg-exo-pure text-exo-muted">— scope —</option>
                      {scopeOptions.map(val => (
                        <option key={val} value={val} className="bg-exo-pure text-white">{scopeLabel(val)}</option>
                      ))}
                    </select>
                  )}
                  {entry.source && (
                    <span className="text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-[2px] bg-white/5 text-exo-muted border border-exo-mist-10">
                      SRC: {entry.source}
                    </span>
                  )}
                  {entry.is_processed !== undefined && (
                    <span className={`text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-[2px] border ${
                      entry.is_processed
                        ? 'bg-exo-accent/5 text-exo-accent/60 border-exo-accent/20'
                        : 'bg-white/5 text-white/40 border-exo-mist-10'
                    }`}>
                      {entry.is_processed ? 'SYNCED' : 'PENDING'}
                    </span>
                  )}
                  {entry.created_at && (
                    <span className="text-[9px] text-exo-muted/30 font-mono tracking-tighter">
                      [{new Date(entry.created_at).toISOString().split('T')[0]}]
                    </span>
                  )}
                </div>
                {editingId !== entry.id && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => handleEdit(entry)}
                      className="p-1.5 text-exo-muted hover:text-exo-accent transition-colors rounded-[2px] border border-exo-mist-10 hover:bg-white/5"
                      title="编辑"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-1.5 text-exo-muted hover:text-red-500 transition-colors rounded-[2px] border border-exo-mist-10 hover:bg-red-500/10"
                      title="删除"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* Content */}
              {editingId === entry.id ? (
                <div className="space-y-4 pt-1">
                  {!canEditContent && (
                    <div className="text-[10px] text-exo-accent/60 bg-exo-accent/5 border border-exo-accent/10 rounded-[2px] px-3 py-2 font-mono uppercase tracking-wide">
                      Content locked — only scope &amp; tags editable for agent portraits
                    </div>
                  )}
                  {saveError && (
                    <div className="text-[10px] text-red-400 bg-red-500/5 border border-red-500/10 rounded-[2px] px-3 py-2 font-mono uppercase tracking-wide">{saveError}</div>
                  )}
                  <textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    rows={5}
                    readOnly={!canEditContent}
                    className={`w-full bg-black border border-exo-mist-10 rounded-[2px] px-4 py-3 text-[13px] text-white outline-none focus:border-exo-accent/40 resize-y font-mono leading-relaxed shadow-inner ${!canEditContent ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                  <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <input
                        value={editTags}
                        onChange={e => setEditTags(e.target.value)}
                        placeholder="TAGS (COMMA SEPARATED)"
                        className="w-full bg-black border border-exo-mist-10 rounded-[2px] px-4 py-2 text-[11px] text-white font-mono outline-none focus:border-exo-accent/40 uppercase"
                        list="available-tags-edit"
                      />
                      <datalist id="available-tags-edit">
                        {availableTags.map(tag => <option key={tag} value={tag} />)}
                      </datalist>
                    </div>
                    <select
                      value={editScope}
                      onChange={e => setEditScope(e.target.value)}
                      className="bg-black border border-exo-mist-10 rounded-[2px] px-4 py-2 text-[11px] font-mono text-white outline-none focus:border-exo-accent/40 cursor-pointer"
                    >
                      {scopeOptions.map(val => (
                        <option key={val} value={val} className="bg-exo-pure">{scopeLabel(val)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button onClick={() => setEditingId(null)} className="text-[11px] font-bold uppercase tracking-widest text-exo-muted hover:text-white transition-colors px-4">CANCEL</button>
                    <button
                      onClick={() => handleSave(entry.id)}
                      disabled={savingId === entry.id}
                      className="px-6 py-2 bg-exo-accent text-exo-pure font-bold rounded-[2px] text-[11px] uppercase tracking-widest hover:shadow-glow-sharp transition-all disabled:opacity-50 shadow-brutalist"
                    >
                      {savingId === entry.id ? 'COMMITING...' : 'SAVE CHANGES'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className={`text-[13px] text-exo-text/90 leading-relaxed mb-3 font-mono tracking-tight whitespace-pre-wrap ${expandedId === entry.id ? '' : 'line-clamp-4'}`}>{entry.content}</p>
                  {entry.content?.length > 200 && (
                    <button
                      onClick={() => setExpandedId(id => id === entry.id ? null : entry.id)}
                      className="flex items-center gap-1.5 text-[10px] text-exo-accent/60 hover:text-exo-accent transition-colors mb-3 font-bold uppercase tracking-widest"
                    >
                      {expandedId === entry.id
                        ? <><ChevronUp size={12} />COLAPSE</>
                        : <><ChevronDown size={12} />READ FULL FRAGMENT</>}
                    </button>
                  )}
                  {tagsArray(entry).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {tagsArray(entry).map((tag, i) => (
                        <span key={i} className="flex items-center gap-1.5 text-[9px] font-bold uppercase px-2 py-0.5 bg-exo-mist-4 text-exo-muted border border-exo-mist-10 rounded-[2px] transition-colors hover:text-exo-accent hover:border-exo-accent/30">
                          <Tag size={8} className="opacity-40" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MemoryManager;
