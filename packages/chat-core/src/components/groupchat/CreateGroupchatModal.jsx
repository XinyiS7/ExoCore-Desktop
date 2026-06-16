import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { groupchatApi } from 'exo-shared';

/**
 * Modal for creating or editing a Groupchat.
 *
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - onSaved: () => void — callback after create/update/delete
 * - presets: AgentPreset[]
 * - editing: object | null — if provided, edit mode; otherwise create mode
 */
export default function CreateGroupchatModal({ isOpen, onClose, onSaved, presets, editing }) {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [participantIds, setParticipantIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const isEdit = !!editing;

  // Reset form when modal opens or editing changes
  useEffect(() => {
    if (!isOpen) return;
    if (editing) {
      setName(editing.name || '');
      setPrompt(editing.prompt || '');
      setParticipantIds(editing.participant_ids || []);
    } else {
      setName('');
      setPrompt('');
      setParticipantIds([]);
    }
    setError('');
  }, [isOpen, editing]);

  const toggleParticipant = (id) => {
    setParticipantIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        prompt: prompt.trim(),
        participant_ids: participantIds,
      };
      if (isEdit) {
        await groupchatApi.updateGroupchat(editing.id, payload);
      } else {
        await groupchatApi.createGroupchat(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.body?.error || err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete groupchat "${editing?.name}"? This will also delete all messages.`)) return;
    setDeleting(true);
    try {
      await groupchatApi.deleteGroupchat(editing.id);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.body?.error || err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  // Presets excluding user (id 2) — user is always implicitly a participant
  const agentPresets = presets.filter(p => p.id !== 2);

  return (
    <div className="fixed inset-0 z-[150] bg-exo-bg/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-exo-pure border border-exo-mist-12 rounded-[4px] shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-exo-mist-10">
          <h2 className="text-sm font-semibold text-chat-text tracking-tight">
            {isEdit ? 'Manage Groupchat' : 'New Groupchat'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-exo-muted hover:text-white transition-colors rounded"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-[10px] tracking-[0.2em] text-exo-muted">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Groupchat name..."
              autoFocus
              className="w-full bg-exo-bg border border-exo-mist-10 rounded-[2px] px-3 py-2 text-sm text-white outline-none focus:border-exo-accent/50 transition-colors font-sans placeholder:text-exo-muted/40"
            />
          </div>

          {/* Prompt */}
          <div className="space-y-1.5">
            <label className="text-[10px] tracking-[0.2em] text-exo-muted">
              Prompt <span className="text-exo-muted/40">(optional)</span>
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Background prompt for Superior agents..."
              rows={3}
              className="w-full bg-exo-bg border border-exo-mist-10 rounded-[2px] px-3 py-2 text-sm text-white outline-none focus:border-exo-accent/50 transition-colors font-sans resize-y placeholder:text-exo-muted/40"
            />
          </div>

          {/* Participants */}
          <div className="space-y-1.5">
            <label className="text-[10px] tracking-[0.2em] text-exo-muted">
              Participants <span className="text-exo-muted/40">({participantIds.length} agent{participantIds.length !== 1 ? 's' : ''} selected)</span>
            </label>
            {agentPresets.length === 0 ? (
              <p className="text-xs text-exo-muted/40 italic">No agent presets available.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-0.5 bg-exo-bg border border-exo-mist-10 rounded-[2px] p-2">
                {agentPresets.map(preset => {
                  const checked = participantIds.includes(preset.id);
                  return (
                    <label
                      key={preset.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-[2px] cursor-pointer transition-all ${
                        checked ? 'bg-exo-accent/10 border border-exo-accent/20' : 'hover:bg-exo-accent/[0.02] border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleParticipant(preset.id)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-[2px] border flex items-center justify-center transition-all flex-shrink-0 ${
                        checked ? 'bg-exo-accent border-exo-accent' : 'border-exo-mist-20'
                      }`}>
                        {checked && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2 2 4-4" stroke="#0a0200" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{preset.name}</p>
                        <p className="text-[9px] text-exo-muted/50 font-mono">{preset.agent_type || 'standard'}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="text-[11px] font-mono text-red-400 bg-red-500/5 border border-red-500/20 rounded-[2px] px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-exo-mist-10 bg-white/[0.02]">
          <div>
            {isEdit && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-[2px] text-[10px] tracking-widest transition-all flex items-center gap-1.5 disabled:opacity-30"
              >
                <Trash2 size={12} />
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-[10px] tracking-widest text-exo-muted hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="px-4 py-1.5 bg-exo-accent/10 text-exo-accent border border-exo-accent/20 rounded-[2px] text-[10px] tracking-widest hover:bg-exo-accent hover:text-black transition-all flex items-center gap-1.5 disabled:opacity-30"
            >
              <Plus size={12} />
              {saving ? 'Saving...' : isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
