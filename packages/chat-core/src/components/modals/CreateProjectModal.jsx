import React, { useState, useRef, useEffect } from 'react';
import { FolderPlus, Activity } from 'lucide-react';
import { baseUrl, getCsrfToken } from 'exo-shared';
import { ModalShell, Button, FIELD_INPUT } from '../ui';

const CreateProjectModal = ({ isOpen, onClose, setProjects }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setName(''); setDescription(''); setError(null); setSaving(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/api/core/projects/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({ name: trimmed, description: description.trim() }),
      });
      if (res.ok) {
        const created = await res.json();
        setProjects(prev => [...prev, created]);
        onClose();
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.detail || errData.name || '创建失败');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon={FolderPlus}
      title="NEW PROJECT"
      subtitle="Register a new project cluster"
      maxW="md"
      footer={
        <div className="flex items-center justify-end gap-4">
          <Button variant="ghost" onClick={onClose}>CANCEL</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving || !name.trim()}>
            {saving ? <Activity size={14} className="animate-spin" /> : <FolderPlus size={14} strokeWidth={1.5} />}
            {saving ? 'CREATING...' : 'CREATE'}
          </Button>
        </div>
      }
    >
      <div className="space-y-8">
        <p className="text-xs tx-system-mute leading-relaxed">
          创建一个新的项目仓库，用于组织会话、文件和背景知识。
        </p>
        <div className="space-y-3">
          <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Project Name</label>
          <input
            ref={inputRef}
            className={FIELD_INPUT}
            placeholder="Grand-Archives"
            value={name}
            onChange={e => { setName(e.target.value); setError(null); }}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
          />
        </div>
        <div className="space-y-3">
          <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Description <span className="opacity-40">(optional)</span></label>
          <input
            className={FIELD_INPUT}
            placeholder="项目的简要说明..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
          />
        </div>
        {error && <p className="text-xs text-red-500 flex items-center gap-1">{error}</p>}
      </div>
    </ModalShell>
  );
};

export default CreateProjectModal;
