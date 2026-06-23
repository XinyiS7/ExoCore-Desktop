import React, { useState, useEffect } from 'react';
import { GitFork, Activity } from 'lucide-react';
import { ModalShell, Button, FIELD_INPUT } from '../ui';

const BranchSessionModal = ({ isOpen, onClose, onConfirm, isSubmitting }) => {
  const [name, setName] = useState('');
  const [sessionType, setSessionType] = useState('lite');

  useEffect(() => {
    if (isOpen) { setName(''); setSessionType('lite'); }
  }, [isOpen]);

  const handleConfirm = () => onConfirm({ name, sessionType });

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon={GitFork}
      title="BRANCH CONTEXT"
      subtitle="Forking active neural stream"
      maxW="sm"
      footer={
        <div className="flex items-center justify-end gap-4">
          <Button variant="ghost" onClick={onClose}>ABORT</Button>
          <Button variant="primary" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? <Activity size={14} className="animate-spin" /> : <GitFork size={14} strokeWidth={1.5} />}
            CONFIRM BRANCH
          </Button>
        </div>
      }
    >
      <div className="space-y-8">
        <p className="text-xs tx-system-mute leading-relaxed italic opacity-70">
          New session branch inherits previous context weights without affecting the primary stream.
        </p>
        <div className="space-y-3">
          <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Branch Alias / 新会话名称</label>
          <input
            className={FIELD_INPUT}
            placeholder="USE DEFAULT IF NULL..."
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
          />
        </div>
        <div className="space-y-3">
          <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Session Type / 会话类型</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'full', label: 'Full', desc: 'Context cache + memory' },
              { value: 'lite', label: 'Lite', desc: 'Lightweight, reduced overhead' },
            ].map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => setSessionType(value)}
                className={`px-4 py-3 rounded-lg border text-left transition-all ${
                  sessionType === value
                    ? 'border-exo-accent/40 bg-exo-accent/5 tx-system-normal'
                    : 'border-transparent bg-black/[0.02] dark:bg-white/[0.02] tx-system-mute hover:border-exo-mist-10/40 hover:tx-system-normal'
                }`}
              >
                <span className="block text-[0.7rem] font-mono tracking-[0.15em]">{label}</span>
                <span className="block text-[0.6rem] opacity-50 mt-0.5">{desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </ModalShell>
  );
};

export default BranchSessionModal;
