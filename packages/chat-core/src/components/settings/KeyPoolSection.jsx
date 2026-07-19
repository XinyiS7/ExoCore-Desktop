import React, { useState, useRef } from 'react';
import { configApi } from 'exo-shared';
import { Save, Trash2, Plus, X, Edit3, Key } from 'lucide-react';
import Toast from './Toast';
import { Button } from '../ui';

export default function KeyPoolSection({ platform, keys, loading, onKeysChanged }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAlias, setNewAlias] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newMasked, setNewMasked] = useState('');
  const [newPlatform, setNewPlatform] = useState(platform === 'all' ? 'gemini' : platform);
  const keyValueRef = useRef('');

  const [editing, setEditing] = useState(null);
  const [editAlias, setEditAlias] = useState('');
  const [editMode, setEditMode] = useState('alias');
  const [editKeyValue, setEditKeyValue] = useState('');
  const [editMasked, setEditMasked] = useState('');
  const editKeyRef = useRef('');

  const [deleting, setDeleting] = useState(null);
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
        const oldSuffix = keyRef.current.length >= 4 ? keyRef.current.slice(-4) : keyRef.current;
        if (newSuffix.startsWith(oldSuffix)) {
          newKey = keyRef.current + newSuffix.slice(oldSuffix.length);
        } else {
          const prefix = keyRef.current.length > 4 ? keyRef.current.slice(0, -4) : '';
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
    if (newKey.length >= 4) { setMasked(`...${newKey.slice(-4)}`); }
    else if (newKey.length > 0) { setMasked(`...${newKey}`); }
    else { setMasked(''); }
  };

  const handlePaste = (e, keyRef, setKey, setMasked) => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData('text');
    if (!pasted) return;
    const cleaned = pasted.replace(/\s+/g, '');
    keyRef.current = cleaned;
    setKey(cleaned);
    if (cleaned.length >= 4) { setMasked(`...${cleaned.slice(-4)}`); }
    else if (cleaned.length > 0) { setMasked(`...${cleaned}`); }
    else { setMasked(''); }
  };

  // ── Add key ──
  const resetAddForm = () => {
    setShowAddForm(false);
    setNewAlias('');
    setNewKeyValue('');
    setNewMasked('');
    setNewPlatform(platform === 'all' ? 'gemini' : platform);
    keyValueRef.current = '';
  };

  const handleAddKey = async () => {
    clearFeedback();
    if (!newAlias.trim() || !newKeyValue.trim()) return;
    setSaving(true);
    try {
      await configApi.createApiKey({
        alias: newAlias.trim(),
        platform: newPlatform,
        key_value: newKeyValue.trim()
      });
      resetAddForm();
      setFeedback({ type: 'success', msg: 'Key 创建成功' });
      onKeysChanged?.();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.body?.detail || err.body?.error || err.message || '创建失败' });
    } finally { setSaving(false); }
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
      } else { setSaving(false); cancelEdit(); return; }
      cancelEdit();
      onKeysChanged?.();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.body?.detail || err.body?.error || err.message || '保存失败' });
    } finally { setSaving(false); }
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
    } finally { setSaving(false); }
  };

  // ── Short date format ──
  const shortDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  const canAdd = newAlias.trim() && newKeyValue.trim() && !saving;
  const canEditSave = editMode === 'alias'
    ? editAlias.trim() && !saving
    : editAlias.trim() && editKeyValue.trim() && !saving;

  if (loading && keys.length === 0) {
    return (
      <div className="bg-chat-panel border border-cinder-line rounded-lg p-4 flex items-center justify-center">
        <span className="inline-block w-4 h-4 border-2 border-chat-muted/20 border-t-chat-muted/40 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-chat-panel border border-cinder-line rounded-lg p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key size={13} className="tx-system-mute" />
          <span className="tx-decoration-normal">
            Key Pool
          </span>
          <span className="tx-decoration-mute">· {keys.length} keys</span>
        </div>
        {!showAddForm && (
          <Button variant="primary" size="sm" onClick={() => setShowAddForm(true)} disabled={saving}>
            <Plus size={11} /> Add
          </Button>
        )}
      </div>

      {/* Add form — inline row */}
      {showAddForm && (
        <div className="flex items-center gap-2 p-2 bg-chat-bg border border-cinder-line rounded flex-wrap sm:flex-nowrap">
          <input
            type="text"
            value={newAlias}
            onChange={e => { setNewAlias(e.target.value); clearFeedback(); }}
            placeholder="Alias / 别名"
            maxLength={50}
            disabled={saving}
            className="flex-1 min-w-[100px] px-2.5 py-1.5 bg-chat-panel border border-cinder-line rounded tx-system-normal outline-none focus:border-chat-accent/30 transition-colors placeholder:tx-decoration-mute font-mono text-xs"
          />
          
          {platform === 'all' && (
            <select
              value={newPlatform}
              onChange={e => setNewPlatform(e.target.value)}
              disabled={saving}
              className="px-2.5 py-1.5 bg-chat-panel border border-cinder-line rounded tx-system-normal outline-none focus:border-chat-accent/30 transition-colors font-mono text-xs cursor-pointer"
            >
              <option value="gemini">Gemini</option>
              <option value="deepseek">DeepSeek</option>
              <option value="openrouter">OpenRouter</option>
              <option value="glm">GLM</option>
            </select>
          )}

          <input
            type="text"
            value={newMasked}
            onChange={e => handleMaskedKeyChange(e, newMasked, keyValueRef, setNewKeyValue, setNewMasked)}
            onPaste={e => handlePaste(e, keyValueRef, setNewKeyValue, setNewMasked)}
            placeholder="Paste API Key..."
            autoComplete="off"
            disabled={saving}
            className="flex-1 min-w-[150px] px-2.5 py-1.5 bg-chat-panel border border-cinder-line rounded tx-system-normal outline-none focus:border-chat-accent/30 transition-colors placeholder:tx-decoration-mute font-mono text-xs"
          />
          
          <Button variant="primary" size="sm" onClick={handleAddKey} disabled={!canAdd} className="shrink-0">
            {saving ? (
              <span className="inline-block w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={11} />
            )}
            Create
          </Button>
          <button
            onClick={resetAddForm}
            disabled={saving}
            className="p-1 tx-system-mute hover:tx-system-normal transition-colors flex-shrink-0"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Key list — compact rows */}
      {keys.length === 0 ? (
        <div className="text-center py-4 tx-decoration-mute">
          No keys configured for {platform}
        </div>
      ) : (
        <div className="space-y-0.5">
          {keys.map(k => (
            <div
              key={k.alias}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded border transition-colors ${
                editing === k.alias
                  ? 'bg-chat-bg border-chat-accent/20'
                  : 'bg-chat-bg border-transparent hover:border-exo-mist-10'
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
                  className="w-32 px-2 py-0.5 bg-chat-panel border border-cinder-line rounded tx-system-normal outline-none focus:border-chat-accent/40 font-mono"
                />
              ) : (
                <span className="tx-system-normal truncate min-w-0 flex-1">{k.alias}</span>
              )}

              {/* Meta: last four + date */}
              {editing === k.alias && editMode === 'overwrite' ? (
                <input
                  type="text"
                  value={editMasked}
                  onChange={e => handleMaskedKeyChange(e, editMasked, editKeyRef, setEditKeyValue, setEditMasked)}
                  onPaste={e => handlePaste(e, editKeyRef, setEditKeyValue, setEditMasked)}
                  placeholder="Paste new key..."
                  autoComplete="off"
                  disabled={saving}
                  className="w-40 px-2 py-0.5 bg-chat-panel border border-cinder-line rounded tx-system-normal outline-none focus:border-chat-accent/40 font-mono"
                />
              ) : (
                <div className="flex items-center gap-4 mr-2 flex-shrink-0">
                  <code className="tx-decoration-mute tabular-nums">
                    {k.last_four ? `****${k.last_four}` : '—'}
                  </code>
                  <span className="tx-decoration-mute tabular-nums w-10 text-right">
                    {shortDate(k.created_at)}
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {editing === k.alias ? (
                  <>
                    <button
                      onClick={handleEditSave}
                      disabled={!canEditSave}
                      className="p-1 text-green-600 hover:text-green-500 disabled:opacity-30 transition-colors"
                    >
                      {saving ? (
                        <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Save size={12} strokeWidth={1.5} />
                      )}
                    </button>
                    <button onClick={cancelEdit} disabled={saving} className="p-1 tx-system-mute hover:tx-system-normal transition-colors">
                      <X size={12} strokeWidth={1.5} />
                    </button>
                    {editMode === 'alias' && (
                      <button
                        onClick={() => setEditMode('overwrite')}
                        disabled={saving}
                        className="tx-decoration-mute hover:tx-decoration-normal transition-colors px-1 font-mono text-[10px]"
                      >
                        Key
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(k)} disabled={saving} className="p-1 tx-system-mute hover:tx-system-accent transition-colors">
                      <Edit3 size={11} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => deleting === k.alias ? handleDelete(k.alias) : setDeleting(k.alias)}
                      disabled={saving}
                      className={`p-1 transition-colors disabled:opacity-30 ${
                        deleting === k.alias ? 'text-red-600 hover:text-red-500' : 'tx-system-mute hover:text-red-600'
                      }`}
                    >
                      <Trash2 size={11} strokeWidth={1.5} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Toast type={feedback?.type} message={feedback?.msg} onClose={clearFeedback} />
    </div>
  );
}
