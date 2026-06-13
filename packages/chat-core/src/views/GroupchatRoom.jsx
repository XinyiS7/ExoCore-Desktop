import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, ArrowLeft, Settings, RefreshCw } from 'lucide-react';
import { groupchatApi } from 'exo-shared';
import { getAgentAvatarUrl, getUserAvatarUrl } from '../utils/avatar';
import { formatDateSeparator, isDifferentDay } from '../utils/time';
import GroupchatMessage from '../components/groupchat/GroupchatMessage';
import AuroraBackground from '../components/chat/AuroraBackground';

const MSGS_PER_PAGE = 20;

/**
 * Extract active @mention at cursor position.
 * Returns { active, start, query } or { active: false }.
 */
function detectMention(value, cursorPos) {
 const before = value.slice(0, cursorPos);
 const atIdx = before.lastIndexOf('@');
 if (atIdx === -1) return { active: false };

 // @ must be at word boundary (start, space, or newline before it)
 const charBefore = atIdx > 0 ? before[atIdx - 1] : ' ';
 if (charBefore !== ' ' && charBefore !== '\n') return { active: false };

 const query = before.slice(atIdx + 1);
 // Query must not contain spaces or newlines (single name)
 if (query.includes(' ') || query.includes('\n')) return { active: false };

 return { active: true, start: atIdx, query };
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(str) {
 const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
 return str.replace(/[&<>"']/g, c => map[c]);
}

/**
 * GroupchatRoom — the message board for a single groupchat.
 *
 * Props:
 * - groupchat: object { id, name, prompt, participant_ids }
 * - presets: AgentPreset[]
 * - onBack: () => void — navigate back to list (mobile)
 * - onManage: () => void — open edit modal
 */
export default function GroupchatRoom({ groupchat, presets, onBack, onManage }) {
 const [messages, setMessages] = useState([]);
 const [inputValue, setInputValue] = useState('');
 const [cursorPos, setCursorPos] = useState(0);
 const [hasMore, setHasMore] = useState(false);
 const [isLoadingMore, setIsLoadingMore] = useState(false);
 const [isSending, setIsSending] = useState(false);
 const [sendError, setSendError] = useState('');

 // ── Mention state ──
 const [mentionIndex, setMentionIndex] = useState(0);

 const allHistoryRef = useRef([]);
 const visibleStartRef = useRef(0);
 const loadGenRef = useRef(0);
 const messagesEndRef = useRef(null);
 const scrollContainerRef = useRef(null);
 const topSentinelRef = useRef(null);
 const textareaRef = useRef(null);
 const draftTimerRef = useRef(null);
 const mentionListRef = useRef(null);

 // Resolve user identity from presets (agent_type='user')
 const userPreset = useMemo(
 () => presets?.find(p => p.agent_type === 'user') || null,
 [presets]
 );
 const userNick = userPreset?.name || 'user';
 const userId = userPreset?.id;
 const [userAvatarUrl, setUserAvatarUrl] = useState(() => getUserAvatarUrl());

 useEffect(() => {
 const handler = (e) => {
  if (e.key === 'exo_user_avatar') {
  setUserAvatarUrl(getUserAvatarUrl());
  }
 };
 window.addEventListener('storage', handler);
 return () => window.removeEventListener('storage', handler);
 }, []);

 // ── Resolve participants from groupchat.participant_ids ──
 const participants = useMemo(() => {
 if (!groupchat?.participant_ids) return [];
 return groupchat.participant_ids.map(id => {
  if (id === 2) return { id: 2, name: userNick, isUser: true, avatarUrl: userAvatarUrl };
  const preset = presets.find(p => p.id === id);
  const name = preset?.name || `Agent #${id}`;
  return { id, name, isUser: false, avatarUrl: getAgentAvatarUrl(id, name) };
 });
 }, [groupchat?.participant_ids, presets, userNick, userAvatarUrl]);

 // ── Resolve sender name + avatar (from participants list, fallback to presets) ──
 const getSenderInfo = useCallback((senderId) => {
 const participant = participants.find(p => p.id === senderId);
 if (participant) {
  return { name: participant.name, avatarUrl: participant.avatarUrl, isUser: participant.isUser };
 }
 if (senderId === 2) {
  return { name: userNick, avatarUrl: userAvatarUrl, isUser: true };
 }
 const preset = presets.find(p => p.id === senderId);
 const name = preset?.name || `Agent #${senderId}`;
 return { name, avatarUrl: getAgentAvatarUrl(senderId, name), isUser: false };
 }, [presets, userNick, userAvatarUrl, participants]);

 // ── Mention detection ──
 const mention = useMemo(() => detectMention(inputValue, cursorPos), [inputValue, cursorPos]);

 // Filtered participants for mention dropdown
 const filteredParticipants = useMemo(() => {
 if (!mention.active) return [];
 const q = mention.query.toLowerCase();
 if (!q) return participants; // show all when just @ typed
 return participants.filter(p => p.name.toLowerCase().includes(q));
 }, [mention, participants]);

 // Reset mentionIndex when filtered list changes
 useEffect(() => {
 setMentionIndex(0);
 }, [mention.query]);

 // ── Scroll helpers ──
 const scrollToBottom = (smooth = true) =>
 messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', block: 'end' });

 // ── Lazy load older messages ──
 const loadMoreMessages = useCallback(() => {
 if (!hasMore || isLoadingMore) return;
 const container = scrollContainerRef.current;
 const prevScrollHeight = container?.scrollHeight || 0;
 setIsLoadingMore(true);
 const newStart = Math.max(0, visibleStartRef.current - MSGS_PER_PAGE);
 const newSlice = allHistoryRef.current.slice(newStart, visibleStartRef.current);
 visibleStartRef.current = newStart;
 setMessages(prev => [...newSlice, ...prev]);
 setHasMore(newStart > 0);
 setIsLoadingMore(false);
 requestAnimationFrame(() => {
  if (container) container.scrollTop = container.scrollHeight - prevScrollHeight;
 });
 }, [hasMore, isLoadingMore]);

 // ── IntersectionObserver for top sentinel ──
 useEffect(() => {
 const sentinel = topSentinelRef.current;
 const container = scrollContainerRef.current;
 if (!sentinel || !container) return;
 const observer = new IntersectionObserver(
  ([entry]) => { if (entry.isIntersecting) loadMoreMessages(); },
  { root: container, threshold: 0 }
 );
 observer.observe(sentinel);
 return () => observer.disconnect();
 }, [loadMoreMessages]);

 // ── Load messages on groupchat change ──
 useEffect(() => {
 if (!groupchat?.id) return;
 const loadGen = ++loadGenRef.current;
 allHistoryRef.current = [];
 visibleStartRef.current = 0;
 setMessages([]);
 setHasMore(false);
 setSendError('');

 // Restore draft
 const savedDraft = localStorage.getItem(`exo_gc_draft_${groupchat.id}`);
 setInputValue(savedDraft ?? '');

 // Fetch messages
 groupchatApi.getMessages(groupchat.id)
  .then(data => {
  if (loadGenRef.current !== loadGen) return;
  const msgs = Array.isArray(data) ? data : [];
  allHistoryRef.current = msgs;
  const startIdx = Math.max(0, msgs.length - MSGS_PER_PAGE);
  visibleStartRef.current = startIdx;
  setMessages(msgs.slice(startIdx));
  setHasMore(startIdx > 0);
  requestAnimationFrame(() => scrollToBottom(false));
  })
  .catch(() => {});
 }, [groupchat?.id]);

 // ── Debounced draft save ──
 useEffect(() => {
 if (!groupchat?.id) return;
 if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
 draftTimerRef.current = setTimeout(() => {
  if (inputValue) {
  localStorage.setItem(`exo_gc_draft_${groupchat.id}`, inputValue);
  } else {
  localStorage.removeItem(`exo_gc_draft_${groupchat.id}`);
  }
 }, 500);
 return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
 }, [inputValue, groupchat?.id]);

 // ── Auto-resize textarea ──
 const autoResize = () => {
 const el = textareaRef.current;
 if (!el) return;
 el.style.height = 'auto';
 el.style.height = el.scrollHeight + 'px';
 };
 useEffect(() => { autoResize(); }, [inputValue]);

 // ── Mention selection ──
 const selectMention = useCallback((participant) => {
 if (!mention.active) return;
 const before = inputValue.slice(0, mention.start);
 const after = inputValue.slice(cursorPos);
 const newValue = before + '@' + participant.name + ' ' + after;
 setInputValue(newValue);
 // Set cursor after the inserted name + space
 const newCursor = mention.start + participant.name.length + 2; // @ + name + space
 setCursorPos(newCursor);
 // Focus back on textarea
 requestAnimationFrame(() => {
  const el = textareaRef.current;
  if (el) {
  el.focus();
  el.setSelectionRange(newCursor, newCursor);
  }
 });
 }, [mention.active, mention.start, inputValue, cursorPos]);

 // ── Parse mention_ids from content ──
 const parseMentionIds = useCallback((content) => {
 const ids = [];
 const seen = new Set();
 for (const p of participants) {
  if (seen.has(p.id)) continue;
  // Match @Name at word boundary (case-sensitive exact match)
  const escaped = p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:^|\\s)@${escaped}(?=\\s|[.,!?;:]|$)`, 'g');
  if (regex.test(content)) {
  ids.push(p.id);
  seen.add(p.id);
  }
 }
 return ids;
 }, [participants]);

 // ── Send message ──
 const handleSend = async () => {
 if (!inputValue.trim() || isSending) return;
 const content = inputValue.trim();
 setInputValue('');
 setIsSending(true);
 setSendError('');
 localStorage.removeItem(`exo_gc_draft_${groupchat.id}`);

 try {
  const mention_ids = parseMentionIds(content);
  const newMsg = await groupchatApi.sendMessage(groupchat.id, {
  sender_id: 2,
  content,
  mention_ids,
  });
  // Append to history and scroll down
  allHistoryRef.current = [...allHistoryRef.current, newMsg];
  setMessages(prev => [...prev, newMsg]);
  requestAnimationFrame(() => scrollToBottom(true));
 } catch (err) {
  setSendError(err.body?.error || err.message || 'Send failed');
  // Restore input
  setInputValue(content);
 } finally {
  setIsSending(false);
 }
 };

 // ── Refresh messages (e.g. after navigating back) ──
 const refreshMessages = useCallback(() => {
 if (!groupchat?.id) return;
 groupchatApi.getMessages(groupchat.id)
  .then(data => {
  const msgs = Array.isArray(data) ? data : [];
  allHistoryRef.current = msgs;
  const startIdx = Math.max(0, msgs.length - MSGS_PER_PAGE);
  visibleStartRef.current = startIdx;
  setMessages(msgs.slice(startIdx));
  setHasMore(startIdx > 0);
  })
  .catch(() => {});
 }, [groupchat?.id]);

 // ── Resolve mention_ids → names for display ──
 const resolveMentionNames = useCallback((mentionIds) => {
 if (!mentionIds?.length) return [];
 return mentionIds.map(id => {
  const p = participants.find(pt => pt.id === id);
  return p?.name || `Agent #${id}`;
 }).filter(Boolean);
 }, [participants]);

 // ── Keyboard handler ──
 const handleKeyDown = (e) => {
 if (mention.active && filteredParticipants.length > 0) {
  if (e.key === 'ArrowDown') {
  e.preventDefault();
  setMentionIndex(prev => Math.min(prev + 1, filteredParticipants.length - 1));
  // Scroll selected into view
  requestAnimationFrame(() => {
   const selected = mentionListRef.current?.querySelector('[data-mention-selected="true"]');
   selected?.scrollIntoView({ block: 'nearest' });
  });
  return;
  }
  if (e.key === 'ArrowUp') {
  e.preventDefault();
  setMentionIndex(prev => Math.max(prev - 1, 0));
  requestAnimationFrame(() => {
   const selected = mentionListRef.current?.querySelector('[data-mention-selected="true"]');
   selected?.scrollIntoView({ block: 'nearest' });
  });
  return;
  }
  if (e.key === 'Enter' && !e.shiftKey) {
  e.preventDefault();
  selectMention(filteredParticipants[mentionIndex]);
  return;
  }
  if (e.key === 'Escape') {
  e.preventDefault();
  // Dismiss by moving cursor (trigger re-detect)
  setCursorPos(-1);
  return;
  }
 }

 // Normal Enter to send
 if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
  e.preventDefault();
  handleSend();
 }
 };

 // ── Input change handler ──
 const handleInputChange = (e) => {
 setInputValue(e.target.value);
 setCursorPos(e.target.selectionStart);
 };

 // ── Track cursor position on click/keyboard ──
 const handleInputClick = (e) => {
 setCursorPos(e.target.selectionStart);
 };
 const handleInputKeyUp = (e) => {
 // Update cursor after arrow key movement
 if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
  setCursorPos(e.target.selectionStart);
 }
 };

 const participantCount = groupchat?.participant_ids?.length || 0;
 const showMentionPopup = mention.active && filteredParticipants.length > 0 && cursorPos >= 0;

 return (
 <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-exo-bg relative">
  {/* Breathing background — ambient inactive state */}
  <AuroraBackground active={false} />

  {/* Header */}
  <div className="relative z-20 flex-shrink-0 border-b border-exo-mist-10 bg-exo-pure/40 backdrop-blur-md px-4 md:px-6 py-2 flex items-center justify-between">
  <div className="flex items-center gap-2 min-w-0">
   {/* Mobile back button */}
   <button
   onClick={onBack}
   className="md:hidden p-0.5 -ml-0.5 text-exo-muted hover:text-exo-text transition-colors flex-shrink-0"
   >
   <ArrowLeft size={16} strokeWidth={1.5} />
   </button>
   <div className="min-w-0">
   <span className="text-sm font-sans font-medium text-white/90 truncate block">
    {groupchat?.name || 'Groupchat'}
   </span>
   <span className="text-[9px] text-exo-muted/40">
    {participantCount} participant{participantCount !== 1 ? 's' : ''}
   </span>
   </div>
  </div>
  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
   <button
   onClick={refreshMessages}
   className="p-1.5 text-exo-muted/30 hover:text-exo-muted/60 transition-colors"
   title="Refresh messages"
   >
   <RefreshCw size={14} strokeWidth={1.5} />
   </button>
   <button
   onClick={onManage}
   className="p-1.5 text-exo-muted/30 hover:text-exo-accent transition-colors"
   title="Manage groupchat"
   >
   <Settings size={14} strokeWidth={1.5} />
   </button>
  </div>
  </div>

  {/* Messages */}
  <div
  ref={scrollContainerRef}
  className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 md:p-6 space-y-8 scrollbar-hide relative z-10"
  >
  <div ref={topSentinelRef} className="h-px" />

  {isLoadingMore && (
   <div className="flex justify-center py-3">
   <span className="text-[10px] tracking-[0.2em] text-exo-muted flex items-center gap-2 animate-pulse">
    <RefreshCw size={12} className="animate-spin" /> Loading older messages...
   </span>
   </div>
  )}

  {messages.length === 0 && !isLoadingMore && (
   <div className="flex items-center justify-center h-full py-20">
   <div className="text-center space-y-3">
    <p className="text-sm text-exo-muted/40 font-light">No messages yet</p>
    <p className="text-[10px] text-exo-muted/20 tracking-widest">Start the conversation</p>
   </div>
   </div>
  )}

  {messages.map((msg, idx) => {
   const { name, avatarUrl, isUser } = getSenderInfo(msg.sender_id);
   const prevMsg = idx > 0 ? messages[idx - 1] : null;
   const showDateSep = msg.created_at && (!prevMsg || isDifferentDay(prevMsg.created_at, msg.created_at));
   const mentionNames = resolveMentionNames(msg.mention_ids);
   return (
   <React.Fragment key={msg.id || idx}>
    {showDateSep && (
    <div className="flex items-center justify-center py-2">
     <span className="text-[10px] text-exo-muted/30 tracking-wider bg-exo-pure px-3 py-1 rounded-[2px] border border-exo-mist-8">
     {formatDateSeparator(msg.created_at)}
     </span>
    </div>
    )}
    <GroupchatMessage
    msg={msg}
    isUser={isUser}
    senderName={name}
    senderAvatarUrl={avatarUrl}
    mentionNames={mentionNames}
    />
   </React.Fragment>
   );
  })}

  <div ref={messagesEndRef} />
  </div>

  {/* Input area */}
  <div className="flex-shrink-0 p-4 border-t border-exo-mist-10 bg-exo-pure/80 backdrop-blur-xl relative z-10">
  {sendError && (
   <div className="mb-2 text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded-[2px] px-3 py-2 flex items-center justify-between">
   <span>{sendError}</span>
   <button onClick={() => setSendError('')} className="text-red-400/60 hover:text-red-400 ml-2">✕</button>
   </div>
  )}

  <div className="flex items-end gap-3">
   <div className="relative flex-1">
   {/* Mention autocomplete popup */}
   {showMentionPopup && (
    <div
    className="absolute bottom-full left-0 mb-2 w-64 max-h-48 overflow-y-auto bg-exo-pure border border-exo-mist-10 rounded-[4px] shadow-2xl z-50 scrollbar-hide"
    ref={mentionListRef}
    >
    {filteredParticipants.map((p, i) => (
     <button
     key={p.id}
     data-mention-selected={i === mentionIndex ? 'true' : 'false'}
     onMouseDown={e => {
      e.preventDefault(); // prevent textarea blur
      selectMention(p);
     }}
     onMouseEnter={() => setMentionIndex(i)}
     className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
      i === mentionIndex
      ? 'bg-exo-accent/10 text-exo-accent'
      : 'text-exo-muted hover:bg-white/[0.03]'
     }`}
     >
     <img
      src={p.avatarUrl}
      className="w-5 h-5 rounded-[2px] object-cover border border-exo-mist-10 flex-shrink-0"
      alt={p.name}
     />
     <span className="text-sm truncate">{p.name}</span>
     {p.isUser && (
      <span className="text-[8px] text-exo-muted/40 tracking-wider ml-auto flex-shrink-0">You</span>
     )}
     </button>
    ))}
    {filteredParticipants.length === 0 && (
     <div className="px-3 py-4 text-center text-[10px] text-exo-muted/40 tracking-wider">
     No matches
     </div>
    )}
    </div>
   )}

   <textarea
    ref={textareaRef}
    value={inputValue}
    onChange={handleInputChange}
    onClick={handleInputClick}
    onKeyUp={handleInputKeyUp}
    onKeyDown={handleKeyDown}
    placeholder="Message... (@ to mention)"
    rows={1}
    disabled={isSending}
    className="w-full bg-exo-pure border border-exo-mist-10 rounded-[4px] px-4 py-2.5 text-sm text-white/90 outline-none resize-none focus:border-exo-accent/40 transition-colors font-sans placeholder:text-exo-muted/40 disabled:opacity-50 max-h-[40vh]"
    style={{ minHeight: '2.75rem', fontFamily: 'var(--font-message)' }}
   />
   </div>
   <button
   onClick={handleSend}
   disabled={isSending || !inputValue.trim()}
   className="p-2.5 bg-exo-accent text-exo-pure rounded-[4px] hover:shadow-glow-gold hover:bg-exo-accentGlow disabled:opacity-20 disabled:grayscale transition-all flex-shrink-0"
   >
   <Send size={16} />
   </button>
  </div>
  </div>
 </div>
 );
}
