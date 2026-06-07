import React from 'react';
import { Users } from 'lucide-react';

export default function GroupchatPlaceholder() {
  return (
    <div className="flex-1 h-full flex items-center justify-center bg-chat-bg">
      <div className="text-center space-y-4 max-w-md px-6">
        <div className="p-4 rounded-full bg-chat-accent/10 inline-block">
          <Users size={32} className="text-chat-accent/50" />
        </div>
        <h2 className="text-xl font-light text-chat-text">Groupchat</h2>
        <p className="text-sm text-chat-muted leading-relaxed">
          Multi-agent group chat — converse with multiple agents simultaneously
          in a shared workspace — will be available here.
        </p>
        <p className="text-[10px] font-mono text-chat-muted/40 uppercase tracking-widest">
          Coming Soon
        </p>
      </div>
    </div>
  );
}
