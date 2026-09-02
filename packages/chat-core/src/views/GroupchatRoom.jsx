import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, Settings, RefreshCw, Zap, Palette, Check, X, ChevronDown } from 'lucide-react';
import { groupchatApi, useTheme } from 'exo-shared';
import { getAgentAvatarUrl, getUserAvatarUrl } from '../utils/avatar';
import { formatDateSeparator, isDifferentDay } from '../utils/time';
import GroupchatMessage from '../components/groupchat/GroupchatMessage';
import AuroraBackground from '../components/chat/AuroraBackground';
import {
  getPalette,
  ALL_PRESETS,
  getCustomPalettes,
  THEME_DEFAULT_DARK,
  THEME_DEFAULT_LIGHT,
} from '../components/chat/palettes';

const MSGS_PER_PAGE = 40;  // live 群聊上下文窗口
const BROADCAST_POLL_INTERVAL = 3000;   // ms
const BROADCAST_TIMEOUT_MS = 60000;     // ms

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
 * GroupchatRoom — the message board for a single groupchat.
 *
 * Props:
 * - groupchat: object { id, name, prompt, participant_ids }
 * - presets: AgentPreset[]
 * - onBack: () => void — navigate back to list (mobile)
 * - onManage: () => void — open edit modal
 */
export default function GroupchatRoom({ groupchat, presets, onBack, onManage }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [inputFocused, setInputFocused] = useState(false);

  // ── Palette & Breathing Background State ──
  const [paletteId, setPaletteId] = useState(() => {
    return (
      localStorage.getItem('exo_groupchat_palette') ||
      localStorage.getItem('exo_chat_palette') ||
      (theme === 'light' ? THEME_DEFAULT_LIGHT : THEME_DEFAULT_DARK)
    );
  });
  const [showPalettePicker, setShowPalettePicker] = useState(false);
  const palettePickerRef = useRef(null);

  // Sync palette when theme changes if needed
  useEffect(() => {
    const current = getPalette(paletteId);
    if (!current || (current.theme && current.theme !== theme)) {
      const def = theme === 'light' ? THEME_DEFAULT_LIGHT : THEME_DEFAULT_DARK;
      setPaletteId(def);
      localStorage.setItem('exo_groupchat_palette', def);
    }
  }, [theme, paletteId]);

  // Click outside to dismiss palette picker
  useEffect(() => {
    if (!showPalettePicker) return;
    const handleClickOutside = (e) => {
      if (palettePickerRef.current && !palettePickerRef.current.contains(e.target)) {
        setShowPalettePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPalettePicker]);

  const handleSelectPalette = (id) => {
    setPaletteId(id);
    localStorage.setItem('exo_groupchat_palette', id);
    setShowPalettePicker(false);
  };

  // Available presets for current theme
  const availablePalettes = useMemo(() => {
    const builtin = Object.entries(ALL_PRESETS)
      .filter(([, p]) => p.theme === theme)
      .map(([id, p]) => ({ id, label: p.label, colors: p.colors }));
    const custom = getCustomPalettes().map(p => ({
      id: p.id,
      label: p.label,
      colors: p.colors,
    }));
    return [...builtin, ...custom];
  }, [theme]);

  // ── Broadcast state ──
  const [broadcastState, setBroadcastState] = useState(null);
  const pollRef = useRef(null);
  const elapsedRef = useRef(0);
  const [broadcastElapsed, setBroadcastElapsed] = useState(0);

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
  const shouldScrollRef = useRef(false);       // flag to scroll after React commit
  const userScrolledUpRef = useRef(false);      // user intent: scrolled away from bottom
  const initialScrolledRef = useRef(false);     // sentinel guard: prevent loading older messages before initial scroll
  const [showScrollBtn, setShowScrollBtn] = useState(false);

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

  // ── Resolve sender name + avatar ──
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
    if (!q) return participants;
    return participants.filter(p => p.name.toLowerCase().includes(q));
  }, [mention, participants]);

  // Reset mentionIndex when filtered list changes
  useEffect(() => {
    setMentionIndex(0);
  }, [mention.query]);

  // ── Auto-resize Textarea (prevents long paste overflow) ──
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = typeof window !== 'undefined' && window.innerHeight < 650 ? 120 : 180;
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${Math.max(newHeight, inputFocused || inputValue ? 64 : 38)}px`;
  }, [inputFocused, inputValue]);

  useEffect(() => {
    autoResize();
  }, [inputValue, autoResize]);

  // ── Scroll helpers ──
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', block: 'end' });
  }, []);

  const isNearBottom = useCallback(() => {
    const c = scrollContainerRef.current;
    if (!c) return true;
    return c.scrollHeight - c.scrollTop - c.clientHeight < 120;
  }, []);

  // Scroll after React commits — ensures reliable scroll after DOM is painted
  useEffect(() => {
    if (shouldScrollRef.current) {
      shouldScrollRef.current = false;
      scrollToBottom(false);
      userScrolledUpRef.current = false;
      setShowScrollBtn(false);

      // Double-check scroll in next frame after DOM reflow and mark initial load done
      requestAnimationFrame(() => {
        scrollToBottom(false);
        initialScrolledRef.current = true;
      });

      // Extra backup for late image/font loading shifts
      const timer = setTimeout(() => {
        if (!userScrolledUpRef.current) {
          scrollToBottom(false);
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [messages, scrollToBottom]);

  // Track user scroll intent: if user manually scrolls up, stop auto-following
  const handleScrollWheel = useCallback((e) => {
    if (e.deltaY < 0) {
      // User scrolled up — stop auto-follow
      userScrolledUpRef.current = true;
      if (broadcastState || isSending) setShowScrollBtn(true);
    } else if (e.deltaY > 0 && isNearBottom()) {
      // User scrolled back to bottom — resume auto-follow
      userScrolledUpRef.current = false;
      setShowScrollBtn(false);
    }
  }, [broadcastState, isSending, isNearBottom]);

  const handleScroll = useCallback(() => {
    if (isNearBottom()) {
      userScrolledUpRef.current = false;
      setShowScrollBtn(false);
    }
  }, [isNearBottom]);

  const handleScrollToBottomClick = useCallback(() => {
    userScrolledUpRef.current = false;
    setShowScrollBtn(false);
    scrollToBottom(true);
  }, [scrollToBottom]);

  // ── Lazy load older messages ──
  const loadMoreMessages = useCallback(() => {
    if (!hasMore || isLoadingMore || !initialScrolledRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const prevScrollHeight = container.scrollHeight;
    setIsLoadingMore(true);

    const currentStart = visibleStartRef.current;
    const newStart = Math.max(0, currentStart - MSGS_PER_PAGE);
    visibleStartRef.current = newStart;

    const olderSlice = allHistoryRef.current.slice(newStart, currentStart);
    setMessages(prev => [...olderSlice, ...prev]);
    setHasMore(newStart > 0);
    setIsLoadingMore(false);

    requestAnimationFrame(() => {
      if (container) {
        container.scrollTop = container.scrollHeight - prevScrollHeight;
      }
    });
  }, [hasMore, isLoadingMore]);

  // IntersectionObserver for top sentinel (must be rooted to scrollContainer)
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = scrollContainerRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && initialScrolledRef.current) {
          loadMoreMessages();
        }
      },
      { root: container, threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreMessages]);

  // ── Load initial messages when groupchat changes ──
  useEffect(() => {
    if (!groupchat?.id) return;
    const thisGen = ++loadGenRef.current;
    initialScrolledRef.current = false;
    userScrolledUpRef.current = false;
    setShowScrollBtn(false);

    // Load draft
    const savedDraft = localStorage.getItem(`exo_groupchat_draft_${groupchat.id}`) || '';
    setInputValue(savedDraft);
    setSendError('');
    setBroadcastState(null);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }

    groupchatApi.getMessages(groupchat.id)
      .then(data => {
        if (loadGenRef.current !== thisGen) return;
        const msgs = Array.isArray(data) ? data : [];
        allHistoryRef.current = msgs;
        const startIdx = Math.max(0, msgs.length - MSGS_PER_PAGE);
        visibleStartRef.current = startIdx;
        setMessages(msgs.slice(startIdx));
        setHasMore(startIdx > 0);
        shouldScrollRef.current = true;
      })
      .catch(err => {
        if (loadGenRef.current !== thisGen) return;
        console.error('Failed to load groupchat messages:', err);
      });
  }, [groupchat?.id]);

  // ── Draft auto-save ──
  useEffect(() => {
    if (!groupchat?.id) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      if (inputValue) {
        localStorage.setItem(`exo_groupchat_draft_${groupchat.id}`, inputValue);
      } else {
        localStorage.removeItem(`exo_groupchat_draft_${groupchat.id}`);
      }
    }, 500);
  }, [inputValue, groupchat?.id]);

  // ── Cleanup poll on unmount ──
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Mention insertion ──
  const selectMention = (participant) => {
    if (!mention.active) return;
    const before = inputValue.slice(0, mention.start);
    const after = inputValue.slice(cursorPos);
    const insertion = `@${participant.name} `;
    const newValue = before + insertion + after;
    const newCursor = before.length + insertion.length;

    setInputValue(newValue);
    setCursorPos(newCursor);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursor, newCursor);
      }
    });
  };

  // ── Send normal message ──
  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isSending || !groupchat?.id) return;

    setIsSending(true);
    setSendError('');

    try {
      const msg = await groupchatApi.sendMessage(groupchat.id, {
        sender_id: userId || 2,
        content: text,
      });

      setMessages(prev => [...prev, msg]);
      allHistoryRef.current = [...allHistoryRef.current, msg];
      setInputValue('');
      setCursorPos(0);
      localStorage.removeItem(`exo_groupchat_draft_${groupchat.id}`);
      userScrolledUpRef.current = false;
      setShowScrollBtn(false);
      shouldScrollRef.current = true;
    } catch (err) {
      setSendError(err.message || '发送失败，请重试');
    } finally {
      setIsSending(false);
    }
  };

  // ── Broadcast to all agents ──
  const handleBroadcast = async () => {
    const text = inputValue.trim();
    if (!text || isSending || broadcastState || !groupchat?.id) return;

    setIsSending(true);
    setSendError('');

    const agentParticipants = (groupchat.participant_ids || []).filter(id => id !== 2);

    try {
      const userMsg = await groupchatApi.sendMessage(groupchat.id, {
        sender_id: userId || 2,
        content: text,
      });

      setMessages(prev => [...prev, userMsg]);
      allHistoryRef.current = [...allHistoryRef.current, userMsg];
      setInputValue('');
      setCursorPos(0);
      localStorage.removeItem(`exo_groupchat_draft_${groupchat.id}`);
      userScrolledUpRef.current = false;
      setShowScrollBtn(false);
      shouldScrollRef.current = true;

      // Trigger broadcast
      await groupchatApi.broadcast(groupchat.id, {
        user_message_id: userMsg.id,
      });

      const startedAt = Date.now();
      elapsedRef.current = 0;
      setBroadcastElapsed(0);
      setBroadcastState({
        participants: agentParticipants,
        replied: new Set(),
        startedAt,
      });

      // Poll function
      const doPoll = async () => {
        try {
          const latestMsgs = await groupchatApi.getMessages(groupchat.id);
          const msgs = Array.isArray(latestMsgs) ? latestMsgs : [];
          allHistoryRef.current = msgs;

          const startIdx = visibleStartRef.current;
          setMessages(msgs.slice(startIdx));
          if (!userScrolledUpRef.current && isNearBottom()) {
            shouldScrollRef.current = true;
          }

          const afterUserMsgs = msgs.filter(m => m.id > userMsg.id);
          const repliedSet = new Set(afterUserMsgs.map(m => m.sender_id));

          const allReplied = agentParticipants.every(id => repliedSet.has(id));
          const elapsed = Date.now() - startedAt;
          elapsedRef.current = Math.round(elapsed / 1000);
          setBroadcastElapsed(elapsedRef.current);

          if (allReplied || elapsed >= BROADCAST_TIMEOUT_MS) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setBroadcastState(null);
          } else {
            setBroadcastState(prev => prev ? { ...prev, replied: repliedSet } : null);
          }
        } catch (err) {
          console.error('Broadcast polling failed:', err);
        }
      };

      doPoll();
      pollRef.current = setInterval(doPoll, BROADCAST_POLL_INTERVAL);
    } catch (err) {
      setSendError('广播触发失败，请重试');
    } finally {
      setIsSending(false);
    }
  };

  // ── Refresh messages ──
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
        if (!userScrolledUpRef.current) {
          shouldScrollRef.current = true;
        }
      })
      .catch(() => {});
  }, [groupchat?.id]);

  // ── Resolve mention_ids → names ──
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
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
        e.preventDefault();
        selectMention(filteredParticipants[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setCursorPos(-1);
        return;
      }
    }

    // Ctrl+Shift+Enter: broadcast to all agents
    if (e.key === 'Enter' && e.ctrlKey && e.shiftKey && !e.isComposing) {
      if (mention.active || isSending || broadcastState) return;
      e.preventDefault();
      handleBroadcast();
      return;
    }

    // Ctrl+Enter or Cmd+Enter to send
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.isComposing) {
      if (mention.active) return;
      e.preventDefault();
      handleSend();
      return;
    }
  };

  // ── Input change handler ──
  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    setCursorPos(e.target.selectionStart);
  };

  const handleInputClick = (e) => {
    setCursorPos(e.target.selectionStart);
  };

  const handleInputKeyUp = (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
      setCursorPos(e.target.selectionStart);
    }
  };

  const participantCount = groupchat?.participant_ids?.length || 0;
  const showMentionPopup = mention.active && filteredParticipants.length > 0 && cursorPos >= 0;

  return (
    <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-exo-bg relative h-full overflow-hidden">
      {/* ── Aurora Breathing Background (supports live animation and palette switching) ── */}
      <AuroraBackground
        active={Boolean(broadcastState || isSending)}
        paletteId={paletteId}
      />

      {/* ── Header ── */}
      <div className="relative z-20 flex-shrink-0 border-b border-cinder-line bg-exo-pure/40 backdrop-blur-md px-3.5 sm:px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="min-w-0">
            <span className="text-sm font-sans font-medium tx-system-normal opacity-90 truncate block">
              {groupchat?.name || 'Groupchat'}
            </span>
            <span className="text-[10px] tx-system-mute opacity-60">
              {participantCount} 位成员
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-2 relative">
          {/* Palette Switcher Button */}
          <button
            onClick={() => setShowPalettePicker(p => !p)}
            className="p-1.5 tx-system-mute hover:tx-system-accent hover:bg-white/5 rounded-lg transition-colors"
            title="选择背景呼吸色 (Aurora Palette)"
            aria-label="背景呼吸色"
          >
            <Palette size={15} strokeWidth={1.5} />
          </button>

          {/* Palette Switcher Popover */}
          {showPalettePicker && (
            <div
              ref={palettePickerRef}
              className="absolute top-full right-0 mt-2 w-52 p-2 rounded-xl bg-exo-pure/95 backdrop-blur-xl border border-cinder-line shadow-2xl z-50 animate-fade-in space-y-1"
            >
              <div className="text-[10px] font-mono tracking-wider tx-system-mute px-2 py-1 uppercase border-b border-cinder-line/40 flex items-center justify-between">
                <span>背景呼吸色</span>
                <button onClick={() => setShowPalettePicker(false)} className="text-gray-400 hover:text-white">
                  <X size={12} />
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 py-1 overscroll-contain">
                {availablePalettes.map(p => {
                  const isSelected = p.id === paletteId;
                  const c = p.colors || {};
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPalette(p.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all text-left ${
                        isSelected
                          ? 'bg-chat-accent/15 tx-system-accent font-bold border border-chat-accent/30'
                          : 'tx-system-mute hover:bg-white/5 hover:tx-system-normal'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {/* Swatch preview dots */}
                        <div className="flex items-center -space-x-1 shrink-0">
                          <div className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ background: c['--obsidian'] || '#111' }} />
                          <div className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ background: c['--oxblood-500'] || '#888' }} />
                          <div className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ background: c['--orange-500'] || '#f8bf74' }} />
                        </div>
                        <span className="truncate">{p.label || p.id}</span>
                      </div>
                      {isSelected && <Check size={12} className="shrink-0 tx-system-accent" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={refreshMessages}
            className="p-1.5 tx-system-mute hover:tx-system-normal hover:bg-white/5 rounded-lg transition-colors"
            title="刷新消息"
          >
            <RefreshCw size={14} strokeWidth={1.5} />
          </button>
          <button
            onClick={onManage}
            className="p-1.5 tx-system-mute hover:tx-system-accent hover:bg-white/5 rounded-lg transition-colors"
            title="群组管理"
          >
            <Settings size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* ── Messages List ── */}
      <div
        ref={scrollContainerRef}
        onWheel={handleScrollWheel}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3.5 sm:p-6 space-y-6 sm:space-y-8 scrollbar-hide relative z-10 overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div ref={topSentinelRef} className="h-px" />

        {isLoadingMore && (
          <div className="flex justify-center py-3">
            <span className="text-[10px] sm:text-xs tracking-[0.2em] tx-system-mute flex items-center gap-2 animate-pulse font-mono">
              <RefreshCw size={12} className="animate-spin" /> 加载历史消息...
            </span>
          </div>
        )}

        {messages.length === 0 && !isLoadingMore && (
          <div className="flex items-center justify-center h-full py-16">
            <div className="text-center space-y-2">
              <p className="text-sm tx-system-mute opacity-50 font-light">暂无消息记录</p>
              <p className="text-[11px] tx-system-mute opacity-30 font-mono">输入消息或 @ 呼叫 Agent 开始集会</p>
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
                  <span className="text-[10px] tx-system-mute opacity-50 tracking-wider bg-exo-pure/80 px-2.5 py-0.5 rounded-full border border-cinder-line font-mono">
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

        {/* Floating scroll-to-bottom button — shown when user scrolls up during broadcast or send */}
        {showScrollBtn && (
          <button
            onClick={handleScrollToBottomClick}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-full bg-exo-accent/90 text-black text-[10px] font-mono uppercase tracking-[0.15em] shadow-lg hover:bg-exo-accent transition-all animate-fade-in flex items-center gap-1.5"
          >
            <ChevronDown size={12} /> 回到底部
          </button>
        )}
      </div>

      {/* ── Input Compose Area (PWA Rock-solid, auto-resize, no overflow) ── */}
      <div className="flex-shrink-0 p-2.5 sm:p-4 border-t border-cinder-line bg-exo-pure/40 backdrop-blur-xl flex flex-col gap-2 relative z-20">
        {sendError && (
          <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-1.5 flex items-center justify-between">
            <span>{sendError}</span>
            <button onClick={() => setSendError('')} className="text-rose-400/60 hover:text-rose-400 ml-2">✕</button>
          </div>
        )}

        {broadcastState && (
          <div className="text-xs tx-system-accent bg-exo-accent/10 border border-exo-accent/25 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <RefreshCw size={12} className="animate-spin" />
            <span className="font-mono">
              {broadcastState.replied.size}/{broadcastState.participants.length} 位 Agent 已回复
              {" · "}{broadcastElapsed}s
            </span>
          </div>
        )}

        <div className={`relative flex flex-col bg-exo-pure/50 backdrop-blur-md border rounded-xl transition-all overflow-visible ${
          inputFocused || inputValue ? 'border-cinder-line-glow shadow-glow-gold' : 'border-cinder-line'
        }`}>
          {/* Mention autocomplete popup */}
          {showMentionPopup && (
            <div
              className="absolute bottom-full left-0 mb-2 w-64 max-h-48 overflow-y-auto bg-exo-pure/95 backdrop-blur-xl border border-cinder-line rounded-xl shadow-2xl z-50 scrollbar-hide overscroll-contain p-1"
              ref={mentionListRef}
            >
              {filteredParticipants.map((p, i) => (
                <button
                  key={p.id}
                  data-mention-selected={i === mentionIndex ? 'true' : 'false'}
                  onMouseDown={e => {
                    e.preventDefault();
                    selectMention(p);
                  }}
                  onMouseEnter={() => setMentionIndex(i)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                    i === mentionIndex
                      ? 'bg-chat-accent/15 tx-system-accent font-bold'
                      : 'tx-system-mute hover:bg-white/5 hover:tx-system-normal'
                  }`}
                >
                  <img
                    src={p.avatarUrl}
                    className="w-5 h-5 rounded-md object-cover border border-cinder-line flex-shrink-0"
                    alt={p.name}
                  />
                  <span className="text-xs truncate">{p.name}</span>
                  {p.isUser && (
                    <span className="text-[10px] tx-system-mute opacity-50 ml-auto flex-shrink-0 font-mono">You</span>
                  )}
                </button>
              ))}
              {filteredParticipants.length === 0 && (
                <div className="px-3 py-3 text-center text-xs tx-system-mute opacity-50">
                  无匹配成员
                </div>
              )}
            </div>
          )}

          {/* Textarea with rock-solid autoResize bounds */}
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onClick={handleInputClick}
            onKeyUp={handleInputKeyUp}
            onKeyDown={handleKeyDown}
            placeholder="输入群聊消息... (@ 提及特定 Agent)"
            rows={1}
            disabled={isSending}
            onFocus={() => { setInputFocused(true); autoResize(); }}
            onBlur={() => { if (!inputValue) setInputFocused(false); }}
            className="w-full bg-transparent text-sm tx-system-normal opacity-90 outline-none resize-none px-3.5 pt-2.5 pb-1 disabled:opacity-50 overflow-y-auto max-h-[120px] sm:max-h-[180px] font-sans placeholder:tx-system-mute placeholder:opacity-40"
            style={{
              minHeight: (inputFocused || inputValue) ? '64px' : '38px',
              WebkitOverflowScrolling: 'touch',
            }}
          />

          {/* Action Row — firmly pinned and always reachable */}
          <div className="flex items-center justify-between px-3 pb-2 pt-1 shrink-0 border-t border-cinder-line/20">
            <span className="text-[10px] font-mono tx-system-mute opacity-40 tabular-nums">
              {inputValue.length > 0 ? `${inputValue.length} 字` : ''}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleBroadcast}
                disabled={isSending || !inputValue.trim() || !!broadcastState}
                className="px-2.5 py-1 bg-exo-accent/15 text-exo-accent border border-exo-accent/25 rounded-lg hover:bg-exo-accent hover:text-exo-pure disabled:opacity-25 disabled:grayscale transition-colors flex items-center gap-1 text-xs font-mono shrink-0"
                title="广播给群内所有 Agent (Ctrl+Shift+Enter)"
              >
                <Zap size={13} strokeWidth={1.5} />
                <span className="hidden sm:inline">广播</span>
              </button>
              <button
                onClick={handleSend}
                disabled={isSending || !inputValue.trim()}
                className="px-3 py-1 bg-exo-accent text-exo-pure rounded-lg hover:shadow-glow-gold hover:bg-exo-accentGlow disabled:opacity-25 disabled:grayscale transition-colors flex items-center gap-1 text-xs font-medium shrink-0"
                title="发送 (Ctrl+Enter)"
              >
                <Send size={13} strokeWidth={1.5} />
                <span>发送</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
