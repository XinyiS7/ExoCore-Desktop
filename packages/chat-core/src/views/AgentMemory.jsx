import React from 'react';
import { ArrowLeft } from 'lucide-react';
import MemoryManager from '../components/settings/MemoryManager';

export default function AgentMemory({ appState, setView, goBack, viewParams }) {
  const { presets, openDestructor } = appState;
  const preset = presets.find(p => p.id === viewParams.agentId);

  return (
    <div className="flex-1 h-full flex flex-col bg-exo-bg">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-exo-mist-8 px-4 md:px-12 py-4 flex items-center gap-4">
        <button onClick={() => goBack()} className="hidden md:inline-flex p-1.5 text-exo-muted hover:text-exo-accent transition-colors">
          <ArrowLeft size={18} strokeWidth={1.5} />
        </button>
        <div>
          <p className="text-sm font-medium text-white">{viewParams.agentName || preset?.name || 'Agent'}</p>
          <p className="text-[10px] text-exo-muted uppercase tracking-wider">Memory Management</p>
        </div>
      </div>

      {/* MemoryManager locked to this preset */}
      <div className="flex-1 overflow-hidden">
        <MemoryManager presets={presets} openDestructor={openDestructor} presetId={viewParams.agentId} />
      </div>
    </div>
  );
}
