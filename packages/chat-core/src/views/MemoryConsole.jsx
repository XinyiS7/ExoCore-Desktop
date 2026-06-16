import React from 'react';
import { Database } from 'lucide-react';

export default function MemoryConsole() {
 return (
 <div className="flex-1 h-full flex items-center justify-center bg-chat-bg">
  <div className="text-center space-y-4 max-w-md px-6">
  <div className="p-4 rounded-full bg-chat-accent/10 inline-block">
   <Database size={32} className="text-chat-accent/50" />
  </div>
  <h2 className="text-xl font-light text-chat-text">Memory Console</h2>
  <p className="text-sm text-chat-muted leading-relaxed">
   Centralized memory management — scopes, portraits, knowledge fragments,
   and triggered notes — will be available here.
  </p>
  <p className="text-[0.625rem] font-mono text-chat-muted/40 tracking-widest">
   Coming Soon
  </p>
  </div>
 </div>
 );
}
