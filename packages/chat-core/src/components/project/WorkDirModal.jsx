import React, { useState, useEffect } from 'react';
import { FolderOpen, X } from 'lucide-react';
import { baseUrl, getCsrfToken } from 'exo-shared';

const WorkDirModal = ({ projectId, currentWorkDir, setProjects, isOpen, onClose }) => {
 const [workDirDraft, setWorkDirDraft] = useState('');
 const [isSaving, setIsSaving] = useState(false);
 const [error, setError] = useState(null);
 const [fetching, setFetching] = useState(false);

 useEffect(() => {
 if (!isOpen || !projectId) return;

 let cancelled = false;
 setFetching(true);
 setError(null);

 fetch(`${baseUrl}/api/core/projects/${projectId}/`, { credentials: 'include' })
  .then(res => res.ok ? res.json() : Promise.reject(res))
  .then(detail => {
  if (!cancelled) {
   setWorkDirDraft(detail.work_dir || '');
   setFetching(false);
  }
  })
  .catch(() => {
  if (!cancelled) {
   setWorkDirDraft(currentWorkDir || '');
   setFetching(false);
  }
  });

 return () => { cancelled = true; };
 }, [isOpen, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

 useEffect(() => {
 if (!isOpen) return;
 const handler = (e) => { if (e.key === 'Escape') onClose(); };
 window.addEventListener('keydown', handler);
 return () => window.removeEventListener('keydown', handler);
 }, [isOpen, onClose]);

 const handleSave = async () => {
 setIsSaving(true);
 setError(null);
 try {
  const res = await fetch(`${baseUrl}/api/core/projects/${projectId}/`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
  credentials: 'include',
  body: JSON.stringify({ work_dir: workDirDraft }),
  });
  if (res.ok) {
  const updated = await res.json();
  setProjects(prev => prev.map(p => p.id === projectId ? { ...p, work_dir: updated.work_dir } : p));
  onClose();
  } else {
  const errData = await res.json().catch(() => ({}));
  throw new Error(errData.detail || errData.work_dir || '保存失败，请检查路径是否有效');
  }
 } catch (err) {
  setError(err.message || '网络错误，请重试');
 } finally {
  setIsSaving(false);
 }
 };

 const handleClear = async () => {
 setIsSaving(true);
 setError(null);
 try {
  const res = await fetch(`${baseUrl}/api/core/projects/${projectId}/`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
  credentials: 'include',
  body: JSON.stringify({ work_dir: '' }),
  });
  if (res.ok) {
  setProjects(prev => prev.map(p => p.id === projectId ? { ...p, work_dir: '' } : p));
  onClose();
  } else {
  throw new Error('清除失败');
  }
 } catch (err) {
  setError(err.message || '网络错误，请重试');
 } finally {
  setIsSaving(false);
 }
 };

 const hasExisting = Boolean(currentWorkDir);
 const folderColor = error ? 'text-red-400' : hasExisting ? 'text-green-400' : 'text-exo-muted';

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center">
  <div className="absolute inset-0 bg-black/70" onClick={onClose} />
  <div className="relative bg-exo-panel border border-exo-border rounded-xl w-full max-w-lg mx-4 p-6 shadow-2xl">
  <div className="flex items-center justify-between mb-4">
   <h3 className="text-sm font-bold text-exo-text flex items-center gap-2">
   <FolderOpen size={18} className={folderColor} />
   工作目录设置
   </h3>
   <button onClick={onClose} className="p-1 text-exo-muted hover:text-white transition-colors">
   <X size={16} />
   </button>
  </div>

  <p className="text-xs text-exo-muted mb-4 leading-relaxed">
   设置后，项目文件将上传至 <code className="text-[0.625rem] bg-black/30 px-1 py-0.5 rounded border border-exo-border">{'{工作目录}\\ExoCore_Files\\uploads\\'}</code>，
   而非默认存储路径。同时 <code className="text-[0.625rem] bg-black/30 px-1 py-0.5 rounded border border-exo-border">read_project</code> 工具将以该目录为根目录。
  </p>

  <div className="mb-4">
   <label className="text-[0.625rem] tracking-wider text-exo-muted block mb-1.5">目录路径</label>
   <input
   type="text"
   value={workDirDraft}
   onChange={e => { setWorkDirDraft(e.target.value); setError(null); }}
   placeholder={fetching ? '加载中...' : 'D:\\Alicia\\Projects\\MyProject'}
   disabled={fetching}
   className="w-full bg-black/30 border border-exo-border rounded-md px-3 py-2 text-sm text-exo-text focus:border-exo-accent/40 outline-none transition-all placeholder:text-exo-muted/30"
   onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
   />
   {error && (
   <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">{error}</p>
   )}
  </div>

  <div className="flex items-center justify-between">
   <button
   onClick={handleClear}
   disabled={isSaving || !hasExisting}
   className="text-xs text-exo-muted hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
   >
   清除路径
   </button>
   <div className="flex items-center gap-2">
   <button
    onClick={onClose}
    className="px-4 py-1.5 text-xs text-exo-muted hover:text-white border border-exo-border rounded-md hover:border-exo-accent/30 transition-all"
   >
    取消
   </button>
   <button
    onClick={handleSave}
    disabled={isSaving || fetching}
    className="px-4 py-1.5 text-xs font-bold text-black bg-exo-accent rounded-md hover:bg-exo-accent/80 active:scale-95 transition-colors disabled:opacity-50"
   >
    {isSaving ? '保存中...' : '保存'}
   </button>
   </div>
  </div>
  </div>
 </div>
 );
};

export default WorkDirModal;
