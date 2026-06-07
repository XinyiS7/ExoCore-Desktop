import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import { formatMessageTime } from '../../utils/time';

const MD_COMPONENTS = {
  pre({ children, ...props }) {
    return <pre {...props} className="bg-exo-pure border border-exo-mist-10 p-4 rounded-[4px] my-4 overflow-x-auto">{children}</pre>;
  },
  code({ children, className, ...props }) {
    const isInline = !className;
    if (isInline) {
      return <code className="bg-white/10 text-exo-accent px-1 py-0.5 rounded-[2px] font-mono text-[0.9em]" {...props}>{children}</code>;
    }
    return <code className={className} {...props}>{children}</code>;
  },
};

/**
 * Simplified message bubble for Groupchat.
 * - User messages (sender_id === 2): right-aligned, bubble with border
 * - Agent messages: left-aligned, prose content, no bubble
 * - No thinking, no reasoning, no action toolbar
 */
const GroupchatMessage = React.memo(({ msg, isUser, senderName, senderAvatarUrl }) => {
  return (
    <div className={`flex flex-col group w-full ${isUser ? 'items-end' : 'items-start'}`}>
      {/* Sender row: avatar + name + time */}
      <div className={`flex items-center gap-3 mb-2 ${isUser ? 'flex-row-reverse' : ''}`}>
        <img
          src={senderAvatarUrl}
          className={`w-6 h-6 rounded-[2px] border bg-exo-pure object-cover ${isUser ? 'border-exo-mist-20' : 'border-exo-accent/40 shadow-glow-gold'}`}
          alt={senderName}
        />
        <span className={`text-[10px] font-mono font-bold tracking-[0.2em] uppercase ${isUser ? 'text-exo-muted' : 'text-exo-accent'}`}>
          {senderName}
        </span>
        {msg.created_at && (
          <span className="text-[9px] font-mono text-exo-muted/40 tracking-tight">
            {formatMessageTime(msg.created_at)}
          </span>
        )}
      </div>

      {/* Content */}
      {isUser ? (
        <div className="max-w-[92%] bg-exo-pure border border-exo-mist-12 rounded-[4px] rounded-tr-none p-4 text-sm shadow-brutalist transition-all hover:border-exo-mist-20 prose prose-invert prose-sm prose-pre:!bg-transparent prose-pre:!p-0 text-white/90">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeHighlight, rehypeKatex]} components={MD_COMPONENTS}>{msg.content}</ReactMarkdown>
        </div>
      ) : (
        <div className="w-full prose prose-invert prose-sm max-w-none prose-pre:!bg-transparent prose-pre:!p-0">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeHighlight, rehypeKatex]} components={MD_COMPONENTS}>{msg.content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
});

export default GroupchatMessage;
