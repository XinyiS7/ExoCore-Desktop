import React, { useState, useEffect } from 'react';
import { Gem, Activity, Save } from 'lucide-react';
import { projectsApi } from 'exo-shared';
import { ModalShell, Button, FIELD_AREA } from '../ui';

/**
 * ProjectPromptModal — 项目级 prompt 编辑弹窗。
 *
 * 取代 ProjectDetail 里原位的 "System Prompt Crystal" inline 编辑
 * （那块用 inline style + 原位 textarea，改起来别扭）。
 * 与 UserProfile 的 system_prompt 走 EditPresetModal 对齐——都进弹窗。
 *
 * 保存：PATCH projectsApi.updateProject(id, { prompt })。
 */
const ProjectPromptModal = ({ isOpen, onClose, project, onSaved }) => {
  const [promptDraft, setPromptDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && project) setPromptDraft(project.prompt || '');
  }, [isOpen, project]);

  const handleSave = async () => {
    if (!project) return;
    setIsSaving(true);
    try {
      await projectsApi.updateProject(project.id, { prompt: promptDraft });
      onSaved?.(promptDraft);
      onClose();
    } catch (err) {
      console.error('Failed to save project prompt', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon={Gem}
      title="PROJECT PROMPT"
      subtitle={`Target: ${project?.name || 'Unknown'}`}
      maxW="lg"
      footer={
        <div className="flex items-center justify-end gap-4">
          <Button variant="ghost" onClick={onClose}>ABORT</Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Activity size={14} className="animate-spin" /> : <Save size={14} strokeWidth={1.5} />}
            {isSaving ? 'COMMITTING...' : 'COMMIT CHANGES'}
          </Button>
        </div>
      }
    >
      <div className="flex justify-between items-end mb-3">
        <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Project Directives / 项目规则</label>
        <span className="text-[0.55rem] font-mono tx-system-accent opacity-60 tracking-widest border border-exo-accent/20 px-2 py-0.5 rounded-full">L2</span>
      </div>
      <textarea
        rows={16}
        className={FIELD_AREA}
        placeholder="Define project context, conventions, and goals..."
        value={promptDraft}
        onChange={e => setPromptDraft(e.target.value)}
        autoFocus
      />
    </ModalShell>
  );
};

export default ProjectPromptModal;
