import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { formatMessageTime } from '../../utils/time';
import { useTheme } from 'exo-shared';

/**
 * Escape HTML special characters so user content can't inject tags.
 */
function escapeHtml(str) {
 const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
 return str.replace(/[&<>"']/g, c => map[c]);
}

/**
 * Preprocess markdown content: wrap @MentionName patterns in styled spans.
 * Names are matched case-sensitively and sorted longest-first to avoid partial matches.
 */
function highlightMentions(content, names) {
 if (!names?.length) return content;

 // Step 1: Escape all HTML so original content is safe
 let result = escapeHtml(content);

 // Step 2: Selectively insert trusted <span> tags for @mentions
 const sorted = [...names].sort((a, b) => b.length - a.length);
 for (const name of sorted) {
 const escapedName = escapeHtml(name);
 const regex = new RegExp(
  `@${escapedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|[.,!?;:\\-\\]\\)]|$)`,
  'g'
 );
 result = result.replace(regex, `<span class="mention-inline">@${escapedName}</span>`);
 }

 return result;
}

const MD_COMPONENTS = {
 pre({ children, ...props }) {
 return <pre {...props} className="bg-exo-pure border border-exo-mist-10 p-4 rounded-[4px] my-4 overflow-x-auto">{children}</pre>;
 },
 code({ children, className, ...props }) {
 const isInline = !className?.includes('language-');
 if (isInline) {
  return <code className="bg-white/10 tx-message-accent px-1 py-0.5 rounded-[2px] font-mono text-[0.9em]" {...props}>{children}</code>;
 }
 return <code className={className} {...props}>{children}</code>;
 },
 span({ children, className, ...props }) {
 if (className === 'mention-inline') {
  return (
   <span className="mention-inline font-semibold px-1 py-0.5 rounded-[2px] inline-flex items-baseline gap-0.5" {...props}>
   {children}
  </span>
  );
 }
 return <span className={className} {...props}>{children}</span>;
 },
};

/**
 * Simplified message bubble for Groupchat.
 * - User messages (sender_id === 2): right-aligned, bubble with border
 * - Agent messages: left-aligned, prose content, no bubble
 * - @mentions highlighted inline with accent color
 * - thinking/reasoning: collapsible <details> block for agent messages, full content
 *
 * Props:
 * - msg: { sender_id, content, created_at, mention_ids, reasoning_content }
 * - isUser: boolean
 * - senderName: string
 * - senderAvatarUrl: string
 * - mentionNames: string[] — resolved names from mention_ids
 */
const GroupchatMessage = React.memo(({ msg, isUser, senderName, senderAvatarUrl, mentionNames }) => {
 const { theme } = useTheme();
 const processedContent = highlightMentions(msg.content, mentionNames);

 return (
 <div className={`flex flex-col group w-full ${isUser ? 'items-end' : 'items-start'}`}>
  {/* Sender row: avatar + name + time */}
  <div className={`flex items-center gap-3 mb-2 ${isUser ? 'flex-row-reverse' : ''}`}>
  <img
   src={senderAvatarUrl}
   className={`w-6 h-6 rounded-[2px] border bg-exo-pure object-cover ${isUser ? 'border-exo-mist-20' : 'border-exo-accent/40 shadow-glow-gold'}`}
   alt={senderName}
  />
  <span className={`text-[0.625rem] font-mono font-bold tracking-[0.2em] ${isUser ? 'tx-message-mute' : 'tx-message-accent'}`}>
   {senderName}
  </span>
  {msg.created_at && (
   <span className="text-[0.5625rem] font-mono tx-message-mute opacity-40 tracking-tight">
   {formatMessageTime(msg.created_at)}
   </span>
  )}
  </div>

  {/* Content */}
  {isUser ? (
   <div className={`max-w-[92%] bg-exo-pure border border-exo-mist-12 rounded-[4px] rounded-tr-none p-4 text-sm shadow-brutalist transition-all hover:border-exo-mist-20 prose ${theme !== 'light' ? 'prose-invert' : ''} prose-sm prose-pre:!bg-transparent prose-pre:!p-0 prose-code:before:content-none prose-code:after:content-none tx-message-normal opacity-90`} style={{ fontFamily: 'var(--font-message)' }}>
   <ReactMarkdown
   remarkPlugins={[remarkGfm, remarkMath]}
   rehypePlugins={[rehypeHighlight, rehypeKatex, rehypeRaw]}
   components={MD_COMPONENTS}
   >
   {processedContent}
   </ReactMarkdown>
  </div>
  ) : (
   <div className={`w-full prose ${theme !== 'light' ? 'prose-invert' : ''} prose-sm max-w-none prose-pre:!bg-transparent prose-pre:!p-0 prose-code:before:content-none prose-code:after:content-none`} style={{ fontFamily: 'var(--font-message)' }}>
   {msg.reasoning_content && (
    <details className="mb-3 group/thinking">
     <summary className="text-[0.625rem] tx-system-mute opacity-50 cursor-pointer hover:opacity-80 transition-opacity select-none tracking-wider">
      💭 thinking
     </summary>
     <div className="mt-2 pl-3 border-l-2 border-exo-accent/20 text-[0.75rem] tx-system-mute opacity-70 whitespace-pre-wrap leading-relaxed">
      {msg.reasoning_content}
     </div>
    </details>
   )}
   <ReactMarkdown
   remarkPlugins={[remarkGfm, remarkMath]}
   rehypePlugins={[rehypeHighlight, rehypeKatex, rehypeRaw]}
   components={MD_COMPONENTS}
   >
   {processedContent}
   </ReactMarkdown>
  </div>
  )}
 </div>
 );
});

export default GroupchatMessage;
