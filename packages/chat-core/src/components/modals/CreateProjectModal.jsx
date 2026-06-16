import React, { useState, useRef, useEffect } from 'react';
import { FolderPlus, X } from 'lucide-react';
import { baseUrl, getCsrfToken } from 'exo-shared';

const CreateProjectModal = ({ isOpen, onClose, setProjects }) => {
 const [name, setName] = useState('');
 const [description, setDescription] = useState('');
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState(null);
 const inputRef = useRef(null);

 useEffect(() => {
 if (isOpen) {
  setName('');
  setDescription('');
  setError(null);
  setSaving(false);
  setTimeout(() => inputRef.current?.focus(), 100);
 }
 }, [isOpen]);

 useEffect(() => {
 if (!isOpen) return;
 const handler = (e) => { if (e.key === 'Escape') onClose(); };
 window.addEventListener('keydown', handler);
 return () => window.removeEventListener('keydown', handler);
 }, [isOpen, onClose]);

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

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center">
  <div className="absolute inset-0 bg-black/70" onClick={onClose} />
  <div className="relative bg-exo-panel border border-exo-border rounded-xl w-full max-w-lg mx-4 p-6 shadow-2xl">
  <div className="flex items-center justify-between mb-4">
   <h3 className="text-sm font-bold text-exo-text flex items-center gap-2">
   <FolderPlus size={18} className="text-exo-accent" />
   New Project
   </h3>
   <button onClick={onClose} className="p-1 text-exo-muted hover:text-white transition-colors">
   <X size={16} />
   </button>
  </div>

  <p className="text-xs text-exo-muted mb-4 leading-relaxed">
   创建一个新的项目仓库，用于组织会话、文件和背景知识。
  </p>

  <div className="space-y-4 mb-4">
   <div>
   <label className="text-[0.625rem] font-mono tracking-wider text-exo-muted block mb-1.5">Project Name</label>
   <input
    ref={inputRef}
    type="text"
    value={name}
    onChange={e => { setName(e.target.value); setError(null); }}
    placeholder="Grand-Archives"
    className="w-full bg-black/30 border border-exo-border rounded-md px-3 py-2 text-sm text-exo-text font-mono focus:border-exo-accent/40 outline-none transition-all placeholder:text-exo-muted/30"
    onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
   />
   </div>
   <div>
   <label className="text-[0.625rem] font-mono tracking-wider text-exo-muted block mb-1.5">Description (optional)</label>
   <input
    type="text"
    value={description}
    onChange={e => setDescription(e.target.value)}
    placeholder="项目的简要说明..."
    className="w-full bg-black/30 border border-exo-border rounded-md px-3 py-2 text-sm text-exo-text font-mono focus:border-exo-accent/40 outline-none transition-all placeholder:text-exo-muted/30"
    onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
   />
   </div>
  </div>

  {error && (
   <p className="text-xs text-red-400 mb-4 flex items-center gap-1">{error}</p>
  )}

  <div className="flex items-center justify-end gap-2">
   <button
   onClick={onClose}
   className="px-4 py-1.5 text-xs text-exo-muted hover:text-white border border-exo-border rounded-md hover:border-exo-accent/30 transition-all"
   >
   Cancel
   </button>
   <button
   onClick={handleSubmit}
   disabled={saving || !name.trim()}
   className="px-4 py-1.5 text-xs font-bold text-black bg-exo-accent rounded-md hover:bg-exo-accent/80 active:scale-95 transition-colors disabled:opacity-50"
   >
   {saving ? 'Creating...' : 'Create'}
   </button>
  </div>
  </div>
 </div>
 );
};

export default CreateProjectModal;
