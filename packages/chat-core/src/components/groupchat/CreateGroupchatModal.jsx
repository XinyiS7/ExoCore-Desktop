import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Activity } from 'lucide-react';
import { groupchatApi } from 'exo-shared';
import { ModalShell, Button, FIELD_INPUT, FIELD_AREA } from '../ui';

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

  const agentPresets = presets.filter(p => p.id !== 2);

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon={Plus}
      title={isEdit ? 'MANAGE GROUPCHAT' : 'NEW GROUPCHAT'}
      subtitle={isEdit ? 'Update groupchat settings' : 'Create a new groupchat'}
      maxW="sm"
      z="z-[150]"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div>
            {isEdit && (
              <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
                <Trash2 size={12} /> {deleting ? 'DELETING...' : 'DELETE'}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose}>CANCEL</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? <Activity size={14} className="animate-spin" /> : <Plus size={14} strokeWidth={1.5} />}
              {saving ? 'SAVING...' : isEdit ? 'SAVE' : 'CREATE'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Name</label>
          <input
            className={FIELD_INPUT}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Groupchat name..."
            autoFocus
          />
        </div>

        <div className="space-y-3">
          <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Prompt <span className="opacity-40">(optional)</span></label>
          <textarea
            rows={3}
            className={FIELD_AREA}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Background prompt for Superior agents..."
          />
        </div>

        <div className="space-y-3">
          <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">
            Participants <span className="opacity-40">({participantIds.length})</span>
          </label>
          {agentPresets.length === 0 ? (
            <p className="text-xs tx-system-mute opacity-40 italic">No agent presets available.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1 border border-exo-mist-10/30 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] p-2 scrollbar-hide">
              {agentPresets.map(preset => {
                const checked = participantIds.includes(preset.id);
                return (
                  <label
                    key={preset.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all border ${
                      checked ? 'bg-exo-accent/10 border-exo-accent/20' : 'hover:bg-exo-accent/[0.04] border-transparent'
                    }`}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleParticipant(preset.id)} className="sr-only" />
                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all flex-shrink-0 ${
                      checked ? 'bg-exo-accent border-exo-accent' : 'border-exo-mist-20'
                    }`}>
                      {checked && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2 2 4-4" stroke="#0a0200" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm tx-system-normal truncate">{preset.name}</p>
                      <p className="text-[0.6rem] tx-system-mute opacity-50 font-mono">{preset.agent_type || 'standard'}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <div className="text-[0.7rem] font-mono text-red-500 bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-2">
            {error}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
