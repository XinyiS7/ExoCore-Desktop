import React, { useState, useEffect } from 'react';
import { FolderOpen, Activity } from 'lucide-react';
import { baseUrl, getCsrfToken } from 'exo-shared';
import { ModalShell, Button, FIELD_INPUT } from '../ui';

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

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon={FolderOpen}
      title="工作目录设置"
      subtitle="Project working directory"
      maxW="md"
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={handleClear} disabled={isSaving || !hasExisting} className="hover:!text-red-500 hover:!bg-red-500/5">
            清除路径
          </Button>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose}>取消</Button>
            <Button variant="primary" onClick={handleSave} disabled={isSaving || fetching}>
              {isSaving ? <Activity size={14} className="animate-spin" /> : <FolderOpen size={14} strokeWidth={1.5} />}
              {isSaving ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <p className="text-xs tx-system-mute leading-relaxed">
          设置后，项目文件将上传至 <code className="text-[0.625rem] bg-black/[0.04] dark:bg-white/[0.04] px-1.5 py-0.5 rounded-md">{'{工作目录}\\ExoCore_Files\\uploads\\'}</code>，
          而非默认存储路径。同时 <code className="text-[0.625rem] bg-black/[0.04] dark:bg-white/[0.04] px-1.5 py-0.5 rounded-md">read_project</code> 工具将以该目录为根目录。
        </p>
        <div className="space-y-3">
          <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">目录路径</label>
          <input
            className={`${FIELD_INPUT} ${fetching ? 'opacity-40' : ''}`}
            placeholder={fetching ? '加载中...' : 'D:\\Alicia\\Projects\\MyProject'}
            value={workDirDraft}
            disabled={fetching}
            onChange={e => { setWorkDirDraft(e.target.value); setError(null); }}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>
    </ModalShell>
  );
};

export default WorkDirModal;
