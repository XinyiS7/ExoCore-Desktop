import React from 'react';
import { ArrowLeft, Database } from 'lucide-react';

export default function AgentMemory({ appState, setView, goBack, viewParams }) {
  const { presets } = appState;
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

      {/* Placeholder — MemoryManager removed, awaiting new implementation */}
      <div className="flex-1 h-full flex items-center justify-center bg-chat-bg">
        <div className="text-center space-y-4 max-w-md px-6">
          <div className="p-4 rounded-full bg-chat-accent/10 inline-block">
            <Database size={32} className="text-chat-accent/50" />
          </div>
          <h2 className="text-xl font-light text-chat-text">Agent Memory</h2>
          <p className="text-sm text-chat-muted leading-relaxed">
            Per-agent memory portraits and knowledge fragments will be available here.
          </p>
          <p className="text-[10px] font-mono text-chat-muted/40 uppercase tracking-widest">
            Coming Soon
          </p>
        </div>
      </div>
    </div>
  );
}
