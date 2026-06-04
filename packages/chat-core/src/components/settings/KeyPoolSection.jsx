import React, { useState, useRef } from 'react';
import { configApi } from 'exo-shared';
import { Save, Trash2, Plus, AlertCircle, RefreshCw, X, Edit3, Key } from 'lucide-react';
import Toast from './Toast';

export default function KeyPoolSection({ platform, keys, loading, onKeysChanged }) {
  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAlias, setNewAlias] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newMasked, setNewMasked] = useState('');
  const keyValueRef = useRef('');

  // Edit state
  const [editing, setEditing] = useState(null); // alias being edited
  const [editAlias, setEditAlias] = useState('');
  const [editMode, setEditMode] = useState('alias'); // 'alias' | 'overwrite'
  const [editKeyValue, setEditKeyValue] = useState('');
  const [editMasked, setEditMasked] = useState('');
  const editKeyRef = useRef('');

  // Delete confirmation
  const [deleting, setDeleting] = useState(null);

  // Global
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const clearFeedback = () => setFeedback(null);

  // ── Key input with masked display ──
  const handleMaskedKeyChange = (e, masked, keyRef, setKey, setMasked) => {
    const newDisplay = e.target.value;
    if (newDisplay === masked) return;

    let newKey;
    if (newDisplay.startsWith('...')) {
      const newSuffix = newDisplay.slice(3);
      if (newDisplay.length > masked.length) {
        const oldSuffix = keyRef.current.length >= 4
          ? keyRef.current.slice(-4)
          : keyRef.current;
        if (newSuffix.startsWith(oldSuffix)) {
          newKey = keyRef.current + newSuffix.slice(oldSuffix.length);
        } else {
          const prefix = keyRef.current.length > 4
            ? keyRef.current.slice(0, -4)
            : '';
          newKey = prefix + newSuffix;
        }
      } else {
        const charsRemoved = masked.length - newDisplay.length;
        newKey = keyRef.current.slice(0, -charsRemoved);
      }
    } else {
      newKey = newDisplay;
    }

    keyRef.current = newKey;
    setKey(newKey);
    if (newKey.length >= 4) {
      setMasked(`...${newKey.slice(-4)}`);
    } else if (newKey.length > 0) {
      setMasked(`...${newKey}`);
    } else {
      setMasked('');
    }
  };

  const handlePaste = (e, keyRef, setKey, setMasked) => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData('text');
    if (!pasted) return;
    const cleaned = pasted.replace(/\s+/g, '');
    keyRef.current = cleaned;
    setKey(cleaned);
    if (cleaned.length >= 4) {
      setMasked(`...${cleaned.slice(-4)}`);
    } else if (cleaned.length > 0) {
      setMasked(`...${cleaned}`);
    } else {
      setMasked('');
    }
  };

  // ── Add key ──
  const resetAddForm = () => {
    setShowAddForm(false);
    setNewAlias('');
    setNewKeyValue('');
    setNewMasked('');
    keyValueRef.current = '';
  };

  const handleAddKey = async () => {
    clearFeedback();
    if (!newAlias.trim() || !newKeyValue.trim()) return;
    setSaving(true);
    try {
      await configApi.createApiKey({
        alias: newAlias.trim(),
        platform,
        key_value: newKeyValue.trim(),
      });
      resetAddForm();
      setFeedback({ type: 'success', msg: 'Key 创建成功' });
      onKeysChanged?.();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.body?.detail || err.body?.error || err.message || '创建失败' });
    } finally {
      setSaving(false);
    }
  };

  // ── Edit ──
  const startEdit = (key) => {
    setEditing(key.alias);
    setEditAlias(key.alias);
    setEditMode('alias');
    setEditKeyValue('');
    setEditMasked('');
    editKeyRef.current = '';
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditAlias('');
    setEditMode('alias');
    setEditKeyValue('');
    setEditMasked('');
    editKeyRef.current = '';
  };

  const handleEditSave = async () => {
    clearFeedback();
    if (!editAlias.trim()) return;
    setSaving(true);
    try {
      if (editMode === 'overwrite') {
        if (!editKeyValue.trim()) return;
        await configApi.overwriteApiKey(editing, editKeyValue.trim());
        setFeedback({ type: 'success', msg: 'Key 已更新' });
      } else if (editAlias.trim() !== editing) {
        await configApi.updateApiKeyAlias(editing, editAlias.trim());
        setFeedback({ type: 'success', msg: 'Alias 已更新' });
      } else {
        // No change
        setSaving(false);
        cancelEdit();
        return;
      }
      cancelEdit();
      onKeysChanged?.();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.body?.detail || err.body?.error || err.message || '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──
  const handleDelete = async (alias) => {
    if (!window.confirm(`删除 key "${alias}"？这将级联删除所有同值 key。`)) return;
    clearFeedback();
    setSaving(true);
    try {
      await configApi.deleteApiKey(alias);
      setDeleting(null);
      setFeedback({ type: 'success', msg: '删除成功' });
      onKeysChanged?.();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.body?.detail || err.body?.error || err.message || '删除失败' });
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ──
  if (loading && keys.length === 0) {
    return (
      <div className="bg-chat-panel border border-white/5 rounded-lg p-8 flex items-center justify-center">
        <RefreshCw size={18} className="animate-spin text-chat-muted/40" />
      </div>
    );
  }

  const canAdd = newAlias.trim() && newKeyValue.trim() && !saving;
  const canEditSave = editMode === 'alias'
    ? editAlias.trim() && !saving
    : editAlias.trim() && editKeyValue.trim() && !saving;

  return (
    <div className="bg-chat-panel border border-white/5 rounded-lg p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key size={14} className="text-chat-muted/50" />
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-chat-text/80">
            Key Pool
          </span>
          <span className="text-[10px] font-mono text-chat-muted/40">
            ({keys.length})
          </span>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-chat-accent/70 hover:text-chat-accent border border-chat-accent/20 hover:border-chat-accent/40 rounded transition-all disabled:opacity-30"
          >
            <Plus size={12} />
            Add Key
          </button>
        )}
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-chat-bg border border-white/10 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-chat-accent/70">
              New Key
            </span>
            <button
              onClick={resetAddForm}
              disabled={saving}
              className="p-0.5 text-chat-muted/40 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-chat-muted/60">
                Alias *
              </label>
              <input
                type="text"
                value={newAlias}
                onChange={e => { setNewAlias(e.target.value); clearFeedback(); }}
                placeholder="例如：我的主力key"
                maxLength={50}
                disabled={saving}
                className="w-full px-3 py-2 bg-chat-panel border border-white/10 rounded text-sm text-chat-text outline-none focus:border-chat-accent/40 transition-colors placeholder:text-chat-muted/30 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-chat-muted/60">
                Key *
              </label>
              <input
                type="text"
                value={newMasked}
                onChange={e => handleMaskedKeyChange(e, newMasked, keyValueRef, setNewKeyValue, setNewMasked)}
                onPaste={e => handlePaste(e, keyValueRef, setNewKeyValue, setNewMasked)}
                placeholder="粘贴 API Key..."
                autoComplete="off"
                disabled={saving}
                className="w-full px-3 py-2 bg-chat-panel border border-white/10 rounded text-sm text-chat-text outline-none focus:border-chat-accent/40 transition-colors placeholder:text-chat-muted/30 font-mono"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddKey}
              disabled={!canAdd}
              className="px-4 py-1.5 bg-chat-accent text-white text-[10px] font-bold uppercase tracking-[0.15em] rounded hover:brightness-110 disabled:opacity-20 disabled:grayscale transition-all flex items-center gap-1.5"
            >
              {saving ? (
                <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save size={12} />
              )}
              Create
            </button>
            <button
              onClick={resetAddForm}
              disabled={saving}
              className="px-4 py-1.5 text-[10px] font-mono uppercase tracking-wider text-chat-muted/50 hover:text-white transition-colors disabled:opacity-30"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Key list */}
      {keys.length === 0 ? (
        <div className="text-center py-6 text-[11px] text-chat-muted/40 font-mono">
          No keys configured for {platform}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_100px_140px_100px] gap-3 px-2 text-[10px] font-mono uppercase tracking-wider text-chat-muted/50">
            <span>Alias</span>
            <span>Last Four</span>
            <span>Created</span>
            <span className="text-right">Actions</span>
          </div>

          {keys.map(k => (
            <div
              key={k.alias}
              className={`grid grid-cols-[1fr_100px_140px_100px] gap-3 items-center px-3 py-2.5 rounded border transition-colors ${
                editing === k.alias
                  ? 'bg-chat-bg border-chat-accent/20'
                  : 'bg-chat-bg border-transparent hover:border-white/5'
              }`}
            >
              {/* Alias */}
              {editing === k.alias ? (
                <input
                  type="text"
                  value={editAlias}
                  onChange={e => { setEditAlias(e.target.value); clearFeedback(); }}
                  maxLength={50}
                  disabled={saving}
                  className="px-2 py-1 bg-chat-panel border border-white/10 rounded text-sm text-chat-text outline-none focus:border-chat-accent/40 font-mono"
                />
              ) : (
                <span className="text-sm text-chat-text font-mono truncate">{k.alias}</span>
              )}

              {/* Last four */}
              {editing === k.alias && editMode === 'overwrite' ? (
                <input
                  type="text"
                  value={editMasked}
                  onChange={e => handleMaskedKeyChange(e, editMasked, editKeyRef, setEditKeyValue, setEditMasked)}
                  onPaste={e => handlePaste(e, editKeyRef, setEditKeyValue, setEditMasked)}
                  placeholder="粘贴新 Key..."
                  autoComplete="off"
                  disabled={saving}
                  className="px-2 py-1 bg-chat-panel border border-white/10 rounded text-sm text-chat-text outline-none focus:border-chat-accent/40 font-mono col-span-2"
                />
              ) : (
                <code className="text-[11px] text-chat-muted/60 font-mono">
                  {k.last_four ? `****${k.last_four}` : '—'}
                </code>
              )}

              {/* Created */}
              {!(editing === k.alias && editMode === 'overwrite') && (
                <span className="text-[10px] text-chat-muted/40 font-mono tabular-nums">
                  {k.created_at ? new Date(k.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—'}
                </span>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-1">
                {editing === k.alias ? (
                  <>
                    <button
                      onClick={handleEditSave}
                      disabled={!canEditSave}
                      className="p-1 text-green-400/60 hover:text-green-400 disabled:opacity-20 transition-colors"
                      title="Save"
                    >
                      {saving ? (
                        <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Save size={13} strokeWidth={1.5} />
                      )}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="p-1 text-chat-muted/40 hover:text-white transition-colors"
                      title="Cancel"
                    >
                      <X size={13} strokeWidth={1.5} />
                    </button>
                    {editMode === 'alias' && (
                      <button
                        onClick={() => setEditMode('overwrite')}
                        disabled={saving}
                        className="text-[9px] font-mono uppercase tracking-wider text-chat-accent/50 hover:text-chat-accent transition-colors px-1"
                        title="Overwrite key value"
                      >
                        Key
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(k)}
                      disabled={saving}
                      className="p-1 text-chat-muted/40 hover:text-chat-accent/60 transition-colors"
                      title="Edit alias"
                    >
                      <Edit3 size={12} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => {
                        if (deleting === k.alias) {
                          handleDelete(k.alias);
                        } else {
                          setDeleting(k.alias);
                        }
                      }}
                      disabled={saving}
                      className={`p-1 transition-colors disabled:opacity-30 ${
                        deleting === k.alias
                          ? 'text-red-400 hover:text-red-300'
                          : 'text-chat-muted/40 hover:text-red-400'
                      }`}
                      title={deleting === k.alias ? 'Confirm delete' : 'Delete key'}
                    >
                      <Trash2 size={12} strokeWidth={1.5} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toast */}
      <Toast
        type={feedback?.type}
        message={feedback?.msg}
        onClose={clearFeedback}
      />
    </div>
  );
}
