import React from 'react';
import { AlertTriangle, Archive, Trash2 } from 'lucide-react';
import { ModalShell, Button } from '../ui';

const DestructorModal = ({ isOpen, onClose, title, description, onArchive, onDelete }) => {
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon={AlertTriangle}
      title="DESTRUCTION PROTOCOL"
      subtitle="Irreversible operation"
      maxW="sm"
      footer={
        <div className="flex items-center justify-end gap-3 flex-wrap">
          <Button variant="ghost" onClick={onClose}>ABORT</Button>
          {typeof onArchive === 'function' && (
            <Button variant="primary" onClick={() => { onArchive(); onClose(); }}>
              <Archive size={14} strokeWidth={1.5} /> ARCHIVE
            </Button>
          )}
          <Button variant="danger" onClick={() => { onDelete(); onClose(); }}>
            <Trash2 size={14} strokeWidth={1.5} /> PURGE
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Alert banner — 警示语义靠内容传达，不靠容器红框 */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500">
          <AlertTriangle size={18} className="animate-pulse shrink-0" />
          <span className="text-[0.65rem] font-mono tracking-[0.2em] font-bold">PURGE IS IRREVERSIBLE</span>
        </div>

        <div className="space-y-2">
          <p className="text-base font-bold tx-system-normal tracking-tight">{title}</p>
          <p className="tx-system-mute leading-relaxed text-xs">{description}</p>
        </div>

        <div className="px-4 py-3 rounded-lg bg-red-500/5 border-l-2 border-red-500/40">
          <p className="text-[0.65rem] font-mono text-red-500/70 leading-relaxed">
            All neural weights associated with this entry will be decoupled from the active link.
          </p>
        </div>
      </div>
    </ModalShell>
  );
};

export default DestructorModal;
