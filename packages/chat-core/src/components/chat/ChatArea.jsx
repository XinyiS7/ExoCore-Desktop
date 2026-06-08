import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Save, Plus, RefreshCw, X, FileText,
  Paperclip, Send, Cpu, Activity, Files, ImageIcon, ArrowLeft, Edit2, SlidersHorizontal, Folder
} from 'lucide-react';
import { baseUrl, getCsrfToken, MAIN_MODEL_IDS } from 'exo-shared';
import { getAgentAvatarUrl, getUserAvatarUrl } from '../../utils/avatar';
import { filesToAttachmentData, saveAttachments, enrichMessages, uploadFilesToAttachments } from '../../utils/attachmentStorage';
import { formatDateSeparator, isDifferentDay } from '../../utils/time';
import MessageBubble from './MessageBubble';
import BranchSessionModal from '../modals/BranchSessionModal';
import ContextCacheIndicator from './ContextCacheIndicator';
import { usePollingChat } from '../../hooks/usePollingChat';
import AuroraBackground from './AuroraBackground';
import ControlsDrawer from './ControlsDrawer';
import { DEFAULT_PALETTE_ID, getPalette } from './palettes';
import AutocompletePopup from './AutocompletePopup';

const MSGS_PER_PAGE = 40;

/** Apply a streaming delta to a message object (mutates and returns the message). */
const applyDeltaToMessage = (msg, text, eventType) => {
  if (eventType === 'thinking') {
    msg.reasoning_content = (msg.reasoning_content || '') + text;
    msg.status_text = null;
  } else if (eventType === 'reasoning') {
    const steps = [...(msg.reasoning_steps || [])];
    if (steps.length === 0 || steps[steps.length - 1] !== text) steps.push(text);
    msg.reasoning_steps = steps;
  } else if (eventType === 'status') {
    msg.status_text = text;
  } else if (eventType === 'anchor_created') {
    try {
      const parsed = typeof text === 'string' ? JSON.parse(text) : text;
      msg.new_anchors = [...(msg.new_anchors || []), parsed];
    } catch(e) {}
  } else {
    msg.content = (msg.content || '') + text;
    msg.status_text = null;
  }
  return msg;
};

const ChatArea = ({ activeSessionId, setActiveSessionId, setRefreshKey, setShowConvList, openNewSession, presets, headerTitleOverride, rightExtraButton, onBack, fileTree, pendingInsert, onInsertConsumed, onLoadDirectory, project }) => {
  const [messages, setMessages] = useState([]);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const abortControllerRef = useRef(null);
  const [thinkingLevel, setThinkingLevel] = useState("auto");
  const [temperature, setTemperature] = useState(1.0);
  const [currentModel, setCurrentModel] = useState("");
  const [chatMode, setChatMode] = useState(() => localStorage.getItem('exo_chat_mode') || 'sse');
  const [composeAttachments, setComposeAttachments] = useState([]);
  // Each entry: { clientId, file, preview, name, type, attachmentId, uploading, error }
  const nextClientIdRef = useRef(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastTelemetry, setLastTelemetry] = useState(null);
  const sessionTelemetryRef = useRef({ totalInput: 0, totalOutput: 0, totalCached: 0, totalTools: 0, requests: 0 });
  const [telemetryExpanded, setTelemetryExpanded] = useState(false);
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const [paletteId, setPaletteId] = useState(() =>
    activeSessionId ? localStorage.getItem(`exo_session_theme_${activeSessionId}`) || DEFAULT_PALETTE_ID : DEFAULT_PALETTE_ID
  );
  const [livePalette, setLivePalette] = useState(null); // { colors: {...} } from live preview
  const [inputFocused, setInputFocused] = useState(false);
  const userPreset = useMemo(() => presets?.find(p => p.agent_type === 'user') || null, [presets]);
  const userNick = userPreset?.name || 'user';
  const [userAvatarUrl, setUserAvatarUrl] = useState(() => getUserAvatarUrl());

  // React to avatar changes (cross-component via shared setUserAvatar)
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'exo_user_avatar') {
        setUserAvatarUrl(getUserAvatarUrl());
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const { sendMessageAsync, resumePolling } = usePollingChat();

  const [showAttachPanel, setShowAttachPanel] = useState(false);
  const [sessionAttachments, setSessionAttachments] = useState([]);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  
  const filteredSessionAttachments = sessionAttachments;
  const filteredPendingAttachments = pendingAttachments;
  const [newAttachPath, setNewAttachPath] = useState('');
  const [newAttachName, setNewAttachName] = useState('');
  const [isAddingAttach, setIsAddingAttach] = useState(false);

  const [branchingMessageId, setBranchingMessageId] = useState(null);
  const [isBranching, setIsBranching] = useState(false);

  // ---- @ file autocomplete state ----
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');

  // Extract @[path] references from input text for chip bar
  const fileRefs = useMemo(() => {
    const refs = [];
    const re = /@\[([^\]]+)\]/g;
    let m;
    while ((m = re.exec(inputValue)) !== null) {
      refs.push({ path: m[1], start: m.index, end: m.index + m[0].length });
    }
    return refs;
  }, [inputValue]);

  const allHistoryRef = useRef([]);
  const visibleStartRef = useRef(0);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const topSentinelRef = useRef(null);
  const cacheRef = useRef(null);
  const textareaRef = useRef(null);
  const loadGenRef = useRef(0);
  const draftTimerRef = useRef(null);
  const composeAttachmentsRef = useRef([]);

  // ---- Consume pendingInsert from Drawer ----
  useEffect(() => {
    if (!pendingInsert) return;
    const el = textareaRef.current;
    if (!el) return;
    const token = `@[${pendingInsert.path}]`;
    const start = el.selectionStart;
    const newVal = inputValue.slice(0, start) + token + ' ' + inputValue.slice(start);
    setInputValue(newVal);
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + token.length + 1;
      el.focus();
    }, 0);
    onInsertConsumed?.();
  }, [pendingInsert]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Autocomplete select handler ----
  const handleAutocompleteSelect = useCallback((path, type) => {
    setAutocompleteOpen(false);
    setAutocompleteQuery('');
    const el = textareaRef.current;
    if (!el) return;
    const cursorPos = el.selectionStart;
    const textBefore = inputValue.slice(0, cursorPos);
    const atIdx = textBefore.lastIndexOf('@');
    if (atIdx === -1) return;
    const token = `@[${path}]`;
    const newVal = inputValue.slice(0, atIdx) + token + ' ' + inputValue.slice(cursorPos);
    setInputValue(newVal);
    const newCursor = atIdx + token.length + 1;
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = newCursor;
      el.focus();
    }, 0);
  }, [inputValue]);

  const handleFilesSelected = (files) => {
    if (!activeSessionId || files.length === 0) return;

    const fileArray = Array.from(files);
    const entries = fileArray.map(f => ({
      clientId: ++nextClientIdRef.current,
      file: f,
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      name: f.name,
      type: f.type,
      attachmentId: null,
      uploading: true,
      error: null,
    }));

    setComposeAttachments(prev => [...prev, ...entries]);

    uploadFilesToAttachments(activeSessionId, fileArray)
      .then(attachments => {
        setComposeAttachments(prev => prev.map(e => {
          const idx = entries.findIndex(en => en.clientId === e.clientId);
          if (idx === -1) return e;
          const att = attachments[idx];
          return att
            ? { ...e, attachmentId: att.id, uploading: false }
            : { ...e, uploading: false, error: 'No attachment returned' };
        }));
        fetch(`${baseUrl}/api/agents/conversations/${activeSessionId}/attachments/`, { credentials: 'include' })
          .then(res => res.json())
          .then(data => setSessionAttachments(Array.isArray(data) ? data : (data.attachments || [])))
          .catch(() => {});
      })
      .catch(err => {
        setComposeAttachments(prev => prev.map(e => {
          const match = entries.find(en => en.clientId === e.clientId);
          return match ? { ...e, uploading: false, error: err.message } : e;
        }));
      });
  };

  const handleRemoveComposeAttachment = (clientId) => {
    setComposeAttachments(prev => {
      const entry = prev.find(e => e.clientId === clientId);
      if (entry?.preview) URL.revokeObjectURL(entry.preview);
      return prev.filter(e => e.clientId !== clientId);
    });
  };

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  useEffect(() => { autoResize(); }, [inputValue]);

  // Debounced draft save
  useEffect(() => {
    if (!activeSessionId) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    
    draftTimerRef.current = setTimeout(() => {
      if (inputValue) {
        localStorage.setItem(`exo_draft_${activeSessionId}`, inputValue);
      } else {
        localStorage.removeItem(`exo_draft_${activeSessionId}`);
      }
    }, 500); // 500ms debounce

    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [inputValue, activeSessionId]);

  // Sync composeAttachments to ref for cleanup effect
  useEffect(() => {
    composeAttachmentsRef.current = composeAttachments;
  }, [composeAttachments]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      composeAttachmentsRef.current.forEach(e => { if (e.preview) URL.revokeObjectURL(e.preview); });
    };
  }, []);

  const scrollToBottom = (smooth = true) =>
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant", block: "end" });

  const isNearBottom = () => {
    const c = scrollContainerRef.current;
    if (!c) return true;
    return c.scrollHeight - c.scrollTop - c.clientHeight < 120;
  };

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

  useEffect(() => {
    if (!activeSessionId) return;
    const loadGen = ++loadGenRef.current;
    allHistoryRef.current = [];
    visibleStartRef.current = 0;
    setMessages([]);
    setHasMore(false);
    setLastTelemetry(null);
    sessionTelemetryRef.current = { totalInput: 0, totalOutput: 0, totalCached: 0, totalTools: 0, requests: 0 };
    setTelemetryExpanded(false);
    setSessionAttachments([]);
    setPendingAttachments([]);
    setIsAddingAttach(false);
    setNewAttachPath('');
    setNewAttachName('');

    // Restore per-session color palette
    const savedPalette = localStorage.getItem(`exo_session_theme_${activeSessionId}`);
    setPaletteId(savedPalette || DEFAULT_PALETTE_ID);

    const savedDraft = localStorage.getItem(`exo_draft_${activeSessionId}`);
    setInputValue(savedDraft ?? '');

    // [Async resume] Check for active async task to resume
    const asyncData = localStorage.getItem(`exo_async_${activeSessionId}`);
    let pendingAsync = null;
    if (asyncData) {
      try { pendingAsync = JSON.parse(asyncData); } catch (e) {
        localStorage.removeItem(`exo_async_${activeSessionId}`);
      }
    }

    fetch(`${baseUrl}/api/agents/conversations/`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (loadGenRef.current !== loadGen) return;
        const current = data.find(c => c.id === activeSessionId);
        if (current) {
          setSessionInfo(current);
          setThinkingLevel(current.thinking_level || "auto");
          setTemperature(current.temperature || 1.0);
          const p = presets.find(x => x.id === current.agent_preset_id);
          setCurrentModel(p ? p.default_model : (MAIN_MODEL_IDS[0] || ""));
        }
      });

    fetch(`${baseUrl}/api/agents/chat/${activeSessionId}/`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (loadGenRef.current !== loadGen) return;
        const enriched = enrichMessages(data);
        allHistoryRef.current = enriched;
        const startIdx = Math.max(0, enriched.length - MSGS_PER_PAGE);
        visibleStartRef.current = startIdx;
        setMessages(enriched.slice(startIdx));
        setHasMore(startIdx > 0);
        requestAnimationFrame(() => scrollToBottom(false));

        // [Async resume] After messages loaded, check if we need to resume polling
        if (!pendingAsync) return;
        const { message_id } = pendingAsync;

        fetch(`${baseUrl}/api/agents/chat/${activeSessionId}/status/?message_id=${message_id}&cursor=0`, {
          headers: { 'X-CSRFToken': getCsrfToken() },
          credentials: 'include',
        })
          .then(res => res.json())
          .then(statusData => {
            if (loadGenRef.current !== loadGen) return;
            if (statusData.status === 'done') {
              // Task completed while away — messages already loaded above
              localStorage.removeItem(`exo_async_${activeSessionId}`);
              return;
            }

            if (statusData.status === 'error') {
              localStorage.removeItem(`exo_async_${activeSessionId}`);
              // Mark last assistant message with error if present
              setMessages(prev => {
                const newMsgs = [...prev];
                const last = newMsgs[newMsgs.length - 1];
                if (last && last.role === 'assistant') {
                  const updated = { ...last, error: statusData.error_message || 'Server error' };
                  newMsgs[newMsgs.length - 1] = updated;
                  allHistoryRef.current[allHistoryRef.current.length - 1] = updated;
                }
                return newMsgs;
              });
              return;
            }

            if (statusData.status === 'not_found') {
              // Task expired — messages already loaded
              localStorage.removeItem(`exo_async_${activeSessionId}`);
              return;
            }

            // status === 'streaming' — resume polling
            setIsGenerating(true);
            abortControllerRef.current = new AbortController();

            // Push AI placeholder if last message isn't assistant
            setMessages(prev => {
              const needsPlaceholder = prev.length === 0 || prev[prev.length - 1].role !== 'assistant';
              if (needsPlaceholder) {
                const placeholder = {
                  id: Date.now(),
                  role: 'assistant',
                  content: '',
                  reasoning_content: '',
                  reasoning_steps: [],
                  new_anchors: [],
                };
                allHistoryRef.current = [...allHistoryRef.current, placeholder];
                return [...prev, placeholder];
              }
              return prev;
            });

            // Replay buffered events
            const initialEvents = statusData.events || [];
            if (initialEvents.length > 0) {
              setMessages(prev => {
                const newMsgs = [...prev];
                const lastMsg = { ...newMsgs[newMsgs.length - 1] };
                initialEvents.forEach(ev => {
                  applyDeltaToMessage(lastMsg, ev.delta || '', ev.event_type || 'content');
                });
                newMsgs[newMsgs.length - 1] = lastMsg;
                allHistoryRef.current[allHistoryRef.current.length - 1] = lastMsg;
                return newMsgs;
              });
            }

            // Start polling
            resumePolling(
              message_id,
              activeSessionId,
              abortControllerRef.current.signal,
              (text, type) => {
                if (loadGenRef.current !== loadGen) return;
                setMessages(prev => {
                  const newMsgs = [...prev];
                  const lastMsg = { ...newMsgs[newMsgs.length - 1] };
                  applyDeltaToMessage(lastMsg, text, type);
                  newMsgs[newMsgs.length - 1] = lastMsg;
                  allHistoryRef.current[allHistoryRef.current.length - 1] = lastMsg;
                  return newMsgs;
                });
                if (isNearBottom()) scrollToBottom(false);
              }
            ).then(() => {
              if (loadGenRef.current !== loadGen) return;
              // Polling complete — reload full message list
              setIsGenerating(false);
              abortControllerRef.current = null;
              fetch(`${baseUrl}/api/agents/chat/${activeSessionId}/`, { credentials: 'include' })
                .then(res => res.json())
                .then(fullData => {
                  if (!Array.isArray(fullData) || fullData.length === 0) return;
                  const enrichedFull = enrichMessages(fullData);
                  allHistoryRef.current = enrichedFull;
                  const sIdx = Math.max(0, enrichedFull.length - MSGS_PER_PAGE);
                  visibleStartRef.current = sIdx;
                  setMessages(enrichedFull.slice(sIdx));
                  requestAnimationFrame(() => scrollToBottom(false));
                })
                .catch(() => {});
            }).catch(err => {
              if (err.name === 'AbortError') return;
              setIsGenerating(false);
              abortControllerRef.current = null;
              console.error('Async resume failed:', err);
            });
          })
          .catch((err) => {
            console.warn('Async resume status query failed:', err);
            localStorage.removeItem(`exo_async_${activeSessionId}`);
          });
      })
      .catch(err => console.error("获取失败:", err));

    fetch(`${baseUrl}/api/agents/conversations/${activeSessionId}/attachments/`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => setSessionAttachments(Array.isArray(data) ? data : (data.attachments || [])))
      .catch(() => {});
    return () => { ++loadGenRef.current; };
  }, [activeSessionId, presets]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  };

  /** Clean @[path] tokens — replace with @path for the LLM while keeping the reference. */
  const cleanContentForSend = (text) => {
    return text.replace(/@\[([^\]]+)\]/g, '@$1');
  };

  const handleSend = async (options = {}) => {
    const regenerateMessageId = options.regenerateMessageId;
    const editMessageId = options.editMessageId !== undefined ? options.editMessageId : (regenerateMessageId ? null : editingMessageId);
    
    if ((!inputValue.trim() && !regenerateMessageId && composeAttachments.length === 0) || isGenerating) return;

    let historyToKeep = [...allHistoryRef.current];
    let userMsg = null;
    let aiMsg = { id: Date.now(), role: 'assistant', content: '', reasoning_content: '', reasoning_steps: [], new_anchors: [] };

    if (editMessageId) {
      const idx = historyToKeep.findIndex(m => m.id === editMessageId);
      if (idx !== -1) {
        historyToKeep = historyToKeep.slice(0, idx);
        userMsg = {
          id: editMessageId, // Keep same ID if possible or let backend handle
          role: 'user',
          content: cleanContentForSend(inputValue),
          attachments: composeAttachments
            .filter(e => e.attachmentId != null)
            .map(e => ({
              name: e.name,
              type: e.type,
              size: e.file.size,
              preview: e.preview,
            }))
        };
        historyToKeep.push(userMsg, aiMsg);
      }
    } else if (regenerateMessageId) {
      const idx = historyToKeep.findIndex(m => m.id === regenerateMessageId);
      if (idx !== -1) {
        historyToKeep = historyToKeep.slice(0, idx);
        historyToKeep.push(aiMsg);
      }
    } else {
      userMsg = {
        role: 'user',
        content: cleanContentForSend(inputValue),
        attachments: composeAttachments
          .filter(e => e.attachmentId != null)
          .map(e => ({
            name: e.name,
            type: e.type,
            size: e.file.size,
            preview: e.preview,
          }))
      };
      historyToKeep.push(userMsg, aiMsg);
    }

    allHistoryRef.current = historyToKeep;
    const newStart = Math.max(0, historyToKeep.length - messages.length - (userMsg ? 2 : 1)); // Heuristic to keep view stable
    setMessages(historyToKeep.slice(visibleStartRef.current));

    const currentInput = inputValue;
    const currentPending = [...pendingAttachments];

    setInputValue("");
    // Clean up compose attachment blob URLs
    composeAttachments.forEach(e => { if (e.preview) URL.revokeObjectURL(e.preview); });
    setComposeAttachments([]);
    setIsGenerating(true);
    setEditingMessageId(null);
    scrollToBottom(true);
    localStorage.removeItem(`exo_draft_${activeSessionId}`);

    abortControllerRef.current = new AbortController();

    try {
      let response;
      const bodyData = {
        content: currentInput,
        model: currentModel,
        thinking_level: thinkingLevel,
        temperature: temperature,
        ...(activeSessionId && localStorage.getItem(`exo_session_key_${activeSessionId}`)
          ? { api_key_alias: localStorage.getItem(`exo_session_key_${activeSessionId}`) }
          : {}),
        ...(activeSessionId && { memory_injection_enabled: localStorage.getItem(`exo_mem_inject_${activeSessionId}`) !== 'false' }),
        ...(currentPending.length > 0 || composeAttachments.some(e => e.attachmentId != null)
          ? { pending_attachments: [
              ...currentPending.map(a => typeof a === 'object' ? a.id : a),
              ...composeAttachments.filter(e => e.attachmentId != null).map(e => e.attachmentId),
            ]}
          : {}),
        ...(editMessageId && { edit_message_id: editMessageId }),
        ...(regenerateMessageId && { regenerate_message_id: regenerateMessageId }),
      };

      const fetchOptions = {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrfToken() },
        credentials: 'include',
        signal: abortControllerRef.current.signal,
      };

      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(bodyData);

      if (chatMode === 'async') {
        const payload = bodyData;
        await sendMessageAsync(payload, activeSessionId, abortControllerRef.current.signal, (text, type) => {
          setMessages(prev => {
            const newMsgs = [...prev];
            const lastMsg = { ...newMsgs[newMsgs.length - 1] };
            applyDeltaToMessage(lastMsg, text, type);
            newMsgs[newMsgs.length - 1] = lastMsg;
            allHistoryRef.current[allHistoryRef.current.length - 1] = lastMsg;
            return newMsgs;
          });
          if (isNearBottom()) scrollToBottom(false);
        });
      } else {
        response = await fetch(`${baseUrl}/api/agents/chat/${activeSessionId}/`, fetchOptions);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split('\n\n'); buffer = blocks.pop();

          for (const block of blocks) {
            const lines = block.split('\n');
            let eventType = 'message'; let dataStr = '';
            for (const line of lines) {
              if (line.startsWith('event:')) eventType = line.substring(6).trim();
              else if (line.startsWith('data:')) dataStr += line.substring(5).trim();
            }
            if (!dataStr || eventType === 'done' || dataStr === '[DONE]') continue;

            if (eventType === 'telemetry') {
              try {
                const t = JSON.parse(dataStr);
                setLastTelemetry(t);
                const acc = sessionTelemetryRef.current;
                acc.totalInput += t.input_chars ?? 0;
                acc.totalOutput += t.output_chars ?? 0;
                acc.totalCached += t.cached_input_chars ?? 0;
                acc.totalTools += t.tool_calls ?? 0;
                acc.requests += 1;
              } catch(e) {}
              continue;
            }

            if (eventType === 'error') {
              let errorMsg = dataStr;
              try { const e = JSON.parse(dataStr); errorMsg = e.message || dataStr; } catch(e) {}
              setMessages(prev => {
                const newMsgs = [...prev];
                const lastMsg = { ...newMsgs[newMsgs.length - 1] };
                lastMsg.status_text = null;
                lastMsg.error = errorMsg;
                newMsgs[newMsgs.length - 1] = lastMsg;
                allHistoryRef.current[allHistoryRef.current.length - 1] = lastMsg;
                return newMsgs;
              });
              continue;
            }

            let text = dataStr;
            try {
              const parsed = JSON.parse(dataStr);
              if (typeof parsed === 'string') text = parsed;
            } catch (e) { text = dataStr.replace(/\\n/g, '\n'); }

            setMessages(prev => {
              const newMsgs = [...prev];
              const lastMsg = { ...newMsgs[newMsgs.length - 1] };
              newMsgs[newMsgs.length - 1] = lastMsg;
              applyDeltaToMessage(lastMsg, text, eventType);
              allHistoryRef.current[allHistoryRef.current.length - 1] = lastMsg;
              return newMsgs;
            });
          }
          if (isNearBottom()) scrollToBottom(false);
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log("Stream aborted by user");
        // Refill input with last user message if it was a normal send or edit
        if (currentInput) {
          setInputValue(currentInput);
          if (activeSessionId) localStorage.setItem(`exo_draft_${activeSessionId}`, currentInput);
        }
      } else {
        console.error("Stream error:", err);
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
      // 刷新消息列表以获取真实 DB id
      fetch(`${baseUrl}/api/agents/chat/${activeSessionId}/`, { credentials: 'include' })
        .then(res => res.json())
        .then(async data => {
          if (!Array.isArray(data) || data.length === 0) return;
          const enriched = enrichMessages(data);
          allHistoryRef.current = enriched;
          const startIdx = Math.max(0, enriched.length - MSGS_PER_PAGE);
          visibleStartRef.current = startIdx;
          setMessages(enriched.slice(startIdx));
          requestAnimationFrame(() => scrollToBottom(false));
        })
        .catch(() => {});
      // Refresh attachments after every SSE completion
      setPendingAttachments([]);
      fetch(`${baseUrl}/api/agents/conversations/${activeSessionId}/attachments/`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => setSessionAttachments(Array.isArray(data) ? data : (data.attachments || [])))
        .catch(() => {});
      // Trigger cache check (server may have created/renewed cache during this request)
      cacheRef.current?.refresh();
    }
  };

  const handleCompress = async () => {
    if (!activeSessionId) return;
    try {
      await fetch(`${baseUrl}/api/agents/conversations/${activeSessionId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        body: JSON.stringify({ thinking_level: thinkingLevel, temperature }),
        credentials: 'include'
      });
    } catch (err) {
      console.error("保存偏好失败:", err);
    }
  };

  const handlePaletteChange = useCallback((arg) => {
    if (typeof arg === 'string') {
      // Selecting a named palette (built-in or custom)
      setPaletteId(arg);
      setLivePalette(null);
      if (activeSessionId) {
        localStorage.setItem(`exo_session_theme_${activeSessionId}`, arg);
      }
    } else if (arg && arg.liveColors) {
      // Live preview from 3-keypoint pickers
      setLivePalette(arg.liveColors);
    }
  }, [activeSessionId]);

  // Resolve the effective colors to pass to AuroraBackground
  const paletteColors = livePalette || getPalette(paletteId)?.colors || {};

  const updatePreference = (updates) => {
    if (updates.model !== undefined) setCurrentModel(updates.model);
    if (updates.thinking_level !== undefined) setThinkingLevel(updates.thinking_level);
    if (updates.temperature !== undefined) setTemperature(parseFloat(updates.temperature));

    const { model, ...patchData } = updates;
    if (Object.keys(patchData).length > 0) {
      fetch(`${baseUrl}/api/agents/conversations/${activeSessionId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        body: JSON.stringify(patchData),
        credentials: 'include'
      }).catch(err => console.error("同步偏好失败", err));
    }
  };

  const handleAddAttachment = async () => {
    const path = newAttachPath.trim();
    if (!path) return;
    try {
      const res = await fetch(`${baseUrl}/api/agents/conversations/${activeSessionId}/attachments/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({ storage_path: path, display_name: newAttachName.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setPendingAttachments(prev => [...prev, data]);
        setNewAttachPath('');
        setNewAttachName('');
        setIsAddingAttach(false);
      } else {
        alert(data.error || '挂载失败');
      }
    } catch (err) {
      console.error('挂载附件失败:', err);
    }
  };

  const handleRemoveAttachment = async (att) => {
    try {
      await fetch(`${baseUrl}/api/agents/conversations/${activeSessionId}/attachments/delete/`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({ source: att.source, id: att.id }),
      });
      setSessionAttachments(prev => prev.filter(a => a.id !== att.id));
    } catch (err) {
      console.error('移除附件失败:', err);
    }
  };

  const handleBranch = useCallback((messageId) => {
    setBranchingMessageId(messageId);
  }, []);

  const onConfirmBranch = async (newName) => {
    if (!branchingMessageId) return;
    setIsBranching(true);
    try {
      const res = await fetch(`${baseUrl}/api/agents/conversations/${activeSessionId}/branch/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({ 
          branch_from_message_id: branchingMessageId,
          name: newName.trim() || undefined
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const trimmedName = newName.trim();
        if (trimmedName) {
          await fetch(`${baseUrl}/api/agents/conversations/${data.conversation_id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
            credentials: 'include',
            body: JSON.stringify({ name: trimmedName }),
          }).catch(() => {});
        }
        if (setRefreshKey) setRefreshKey(p => p + 1);
        if (setActiveSessionId) setActiveSessionId(data.conversation_id);
        setBranchingMessageId(null);
      } else {
        alert(data.error || '分叉失败');
      }
    } catch (err) {
      console.error('分叉失败:', err);
    } finally {
      setIsBranching(false);
    }
  };

  const onEdit = useCallback((msg) => {
    setInputValue(msg.content);
    setEditingMessageId(msg.id);
    if (textareaRef.current) textareaRef.current.focus();
  }, []);

  const handleSendRef = useRef(handleSend);
  useEffect(() => { handleSendRef.current = handleSend; }, [handleSend]);

  const onRegenerate = useCallback((msg) => {
    handleSendRef.current({ regenerateMessageId: msg.id });
  }, []);

  return (
    <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-exo-bg relative">
      <AuroraBackground active={isGenerating} paletteId={paletteId} colors={paletteColors} />
      <div className="relative z-20 flex-shrink-0">
        {/* v1 standalone header: back + session name + ID */}
        {!onBack && (
          <div className="border-b border-exo-mist-10 bg-exo-pure/40 backdrop-blur-md z-20 px-4 md:px-6 py-2 flex items-center gap-2 min-w-0">
            <button onClick={() => setShowConvList(true)} className="md:hidden p-0.5 -ml-0.5 text-exo-muted hover:text-exo-text transition-colors flex-shrink-0"><ArrowLeft size={16} strokeWidth={1.5} /></button>
            <span className="text-sm font-sans font-medium text-white/90 truncate">{headerTitleOverride || sessionInfo?.name || `Session`}</span>
            <span className="text-[10px] font-sans text-exo-muted/30 flex-shrink-0">#{activeSessionId}</span>
          </div>
        )}

        {/* v2 header: status dot · session name (left) | cache + docs (right) */}
        {onBack && (
          <div className="border-b border-exo-mist-10 bg-exo-pure/40 backdrop-blur-md z-20 px-4 md:px-6 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-500 ${isGenerating ? 'breathing-status' : 'bg-[#00509d]/30'}`} />
              {sessionInfo?.name && (
                <span className="text-[11px] font-light text-exo-muted/60 truncate">
                  {sessionInfo.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
              <ContextCacheIndicator ref={cacheRef} activeSessionId={activeSessionId} />
              <button
                onClick={() => setShowAttachPanel(p => !p)}
                className={`p-1 transition-colors relative ${showAttachPanel ? 'text-exo-accent/70' : 'text-exo-muted/20 hover:text-exo-muted/50'}`}
                title="Session Docs"
              >
                <Files size={14} strokeWidth={1.5} />
                {(filteredSessionAttachments.length + filteredPendingAttachments.length) > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-exo-accent" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Attachment panel — positioned below header */}
        {showAttachPanel && (
          <div className="absolute top-full right-4 md:right-6 mt-1 w-80 max-h-[70vh] bg-exo-pure border border-exo-mist-12 rounded-[4px] shadow-2xl z-50 overflow-hidden flex flex-col animate-fade-in" style={{ maxWidth: 'calc(100vw - 2rem)', width: 'min(20rem, calc(100vw - 2rem))' }}>
            <div className="px-4 py-3 border-b border-exo-mist-10 bg-white/5 flex items-center justify-between">
              <span className="label-caps text-exo-muted">挂载文档 ({filteredSessionAttachments.length + filteredPendingAttachments.length})</span>
              <button onClick={() => setShowAttachPanel(false)} className="text-exo-muted hover:text-white transition-colors"><X size={14} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
              {filteredSessionAttachments.map(att => (
                <div key={att.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded-[2px] group transition-colors border border-transparent hover:border-exo-mist-10">
                  <FileText size={14} className="text-blue-400 shrink-0" />
                  <span className="flex-1 text-xs text-exo-muted group-hover:text-white break-all leading-tight">{att.display_name || att.original_filename}</span>
                  <button onClick={() => handleRemoveAttachment(att)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all"><X size={12} /></button>
                </div>
              ))}
              {filteredPendingAttachments.map((att, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-exo-accent/5 rounded-[2px] border border-exo-accent/20 group">
                  <FileText size={14} className="text-exo-accent/50 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-exo-accent/80 break-all leading-tight">{att.display_name || att.original_filename}</div>
                    <div className="text-[9px] text-exo-accent/40 font-mono tracking-widest uppercase">PENDING</div>
                  </div>
                  <button onClick={() => setPendingAttachments(p => p.filter((_, j) => j !== i))} className="p-1 hover:text-red-400 transition-colors"><X size={12} /></button>
                </div>
              ))}
              {filteredSessionAttachments.length === 0 && filteredPendingAttachments.length === 0 && !isAddingAttach && (
                <div className="py-8 text-center text-[10px] text-exo-muted/30 font-mono tracking-widest uppercase">
                  [ 无挂载文档 ]
                </div>
              )}
              {isAddingAttach && (
                <div className="p-2 space-y-2 bg-exo-pure/40 rounded-[2px] border border-exo-mist-10">
                  <input
                    value={newAttachPath}
                    onChange={e => setNewAttachPath(e.target.value)}
                    placeholder="文件绝对路径..."
                    autoFocus
                    className="w-full bg-exo-bg border border-exo-mist-10 rounded-[2px] px-2 py-1.5 text-xs text-white outline-none focus:border-exo-accent/50 transition-colors font-mono"
                  />
                  <input
                    value={newAttachName}
                    onChange={e => setNewAttachName(e.target.value)}
                    placeholder="显示名（可选）"
                    className="w-full bg-exo-bg border border-exo-mist-10 rounded-[2px] px-2 py-1.5 text-xs text-white outline-none focus:border-exo-accent/50 transition-colors"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setIsAddingAttach(false); setNewAttachPath(''); setNewAttachName(''); }} className="px-3 py-1 text-exo-muted hover:text-white text-[11px] uppercase tracking-widest">取消</button>
                    <button onClick={handleAddAttachment} className="px-3 py-1 bg-exo-accent/10 text-exo-accent border border-exo-accent/20 rounded-[2px] text-[11px] uppercase tracking-widest hover:bg-exo-accent hover:text-black transition-all">确认</button>
                  </div>
                </div>
              )}
            </div>
            {!isAddingAttach && (
              <div className="p-2 border-t border-exo-mist-10 bg-white/5">
                <button onClick={() => setIsAddingAttach(true)} className="w-full py-2 text-[11px] uppercase tracking-widest text-exo-muted hover:text-white hover:bg-white/5 flex items-center justify-center gap-2 rounded-[2px] border border-dashed border-exo-mist-10 hover:border-exo-mist-20 transition-all">
                  <Plus size={14} /> 挂载外部路径
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 md:p-6 space-y-8 scrollbar-hide relative z-10">
        <div ref={topSentinelRef} className="h-px" />
        {isLoadingMore && (
          <div className="flex justify-center py-3">
            <span className="text-[10px] uppercase tracking-[0.2em] text-exo-muted flex items-center gap-2 animate-pulse"><RefreshCw size={12} className="animate-spin" /> 正在加载历史协议记录...</span>
          </div>
        )}
        {messages.map((msg, idx) => {
          const agentPreset = presets.find(x => x.id === sessionInfo?.agent_preset_id);
          const agentName = agentPreset?.name || 'Core';
          const prevMsg = idx > 0 ? messages[idx - 1] : null;
          const showDateSep = msg.created_at && (!prevMsg || isDifferentDay(prevMsg.created_at, msg.created_at));
          return (
            <React.Fragment key={msg.id || idx}>
              {showDateSep && (
                <div className="flex items-center justify-center py-2">
                  <span className="text-[10px] font-mono text-exo-muted/30 tracking-wider bg-exo-pure px-3 py-1 rounded-[2px] border border-exo-mist-8">
                    {formatDateSeparator(msg.created_at)}
                  </span>
                </div>
              )}
              <MessageBubble
                msg={msg}
                agentName={agentName}
                agentAvatarUrl={getAgentAvatarUrl(sessionInfo?.agent_preset_id, agentName)}
                userNick={userNick}
                userAvatarUrl={userAvatarUrl}
                onEdit={onEdit}
                onRegenerate={onRegenerate}
                onBranch={handleBranch}
                isGenerating={isGenerating}
              />
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <BranchSessionModal
        isOpen={!!branchingMessageId}
        onClose={() => setBranchingMessageId(null)}
        onConfirm={onConfirmBranch}
        isSubmitting={isBranching}
      />

      <div className="flex-shrink-0 p-4 border-t border-exo-mist-10 bg-exo-pure/80 backdrop-blur-xl flex flex-col gap-2 relative z-10">
        {editingMessageId && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-exo-accent/10 border border-exo-accent/20 rounded-[2px] animate-fade-in">
            <div className="flex items-center gap-2 text-exo-accent text-[10px] font-mono uppercase tracking-widest">
              <Edit2 size={12} />
              <span>正在修正通讯协议数据区块 #{editingMessageId}</span>
            </div>
            <button onClick={() => { setEditingMessageId(null); setInputValue(''); }} className="text-exo-accent/50 hover:text-exo-accent transition-colors"><X size={14} /></button>
          </div>
        )}

        {/* Controls drawer — replaces old inline row */}
        {controlsExpanded && (
          <ControlsDrawer
            currentModel={currentModel}
            thinkingLevel={thinkingLevel}
            temperature={temperature}
            chatMode={chatMode}
            sessionId={activeSessionId}
            paletteId={paletteId}
            onPaletteChange={handlePaletteChange}
            lastTelemetry={lastTelemetry}
            sessionTelemetryRef={sessionTelemetryRef}
            telemetryExpanded={telemetryExpanded}
            setTelemetryExpanded={setTelemetryExpanded}
            onPreferenceChange={updatePreference}
            onChatModeChange={(mode) => {
              setChatMode(mode);
              localStorage.setItem('exo_chat_mode', mode);
            }}
          />
        )}

        <div className={`relative flex flex-col bg-exo-pure border rounded-[4px] transition-all overflow-visible ${inputFocused || inputValue ? 'border-exo-accent/40 shadow-glow-gold' : 'border-exo-mist-10'}`}>
          {/* @ file-reference chip bar */}
          {fileRefs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-2.5 pb-1 border-b border-exo-mist-10 bg-white/[0.02]">
              {fileRefs.map((ref, i) => (
                <span
                  key={`${ref.path}-${i}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-chat-accent/10 border border-chat-accent/20 text-[10px] text-chat-accent font-mono"
                >
                  {ref.path.includes('/') && !ref.path.endsWith('/') ? (
                    <FileText size={10} className="shrink-0" />
                  ) : (
                    <Folder size={10} className="shrink-0" />
                  )}
                  <span className="max-w-[180px] truncate">{ref.path}</span>
                  <button
                    onClick={() => {
                      const newVal = inputValue.slice(0, ref.start) + inputValue.slice(ref.end);
                      setInputValue(newVal);
                    }}
                    className="ml-0.5 text-chat-muted/40 hover:text-red-400 transition-colors"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* @ autocomplete popup — rendered in normal flow above textarea */}
          <AutocompletePopup
            isOpen={autocompleteOpen}
            query={autocompleteQuery}
            fileTree={fileTree}
            onSelect={handleAutocompleteSelect}
            onClose={() => { setAutocompleteOpen(false); setAutocompleteQuery(''); }}
            onLoadDir={onLoadDirectory}
          />

          {composeAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pt-3 pb-2 border-b border-exo-mist-10 bg-white/[0.02]">
              {composeAttachments.map(e => (
                <div key={e.clientId} className="relative group">
                  {e.preview ? (
                    <div className="relative h-14 w-14 rounded-md overflow-hidden border border-exo-mist-10">
                      <img src={e.preview} alt={e.name} className="w-full h-full object-cover" />
                      {e.uploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-exo-accent/50 border-t-exo-accent rounded-full animate-spin" />
                        </div>
                      )}
                      {e.error && (
                        <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                          <span className="text-[8px] text-red-400 font-mono">!</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[10px] font-mono ${
                      e.error ? 'border-red-500/30 text-red-400 bg-red-500/5' :
                      e.uploading ? 'border-exo-mist-10 text-exo-muted bg-exo-pure' :
                      'border-exo-accent/20 text-exo-accent bg-exo-accent/5'
                    }`}>
                      <FileText size={11} />
                      <span className="max-w-[120px] truncate">{e.name}</span>
                      {e.uploading && <div className="w-2.5 h-2.5 border-2 border-exo-accent/50 border-t-exo-accent rounded-full animate-spin" />}
                    </div>
                  )}
                  <button
                    onClick={() => handleRemoveComposeAttachment(e.clientId)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-exo-pure border border-exo-mist-10 text-exo-muted hover:text-red-400 hover:border-red-400/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => {
              const v = e.target.value;
              setInputValue(v);
              autoResize();

              // @ autocomplete detection
              const cursorPos = e.target.selectionStart;
              const textBeforeCursor = v.slice(0, cursorPos);
              const atMatch = textBeforeCursor.match(/@([^\s@\[\]]*)$/);

              if (atMatch && project?.work_dir) {
                setAutocompleteQuery(atMatch[1]);
                setAutocompleteOpen(true);
              } else {
                setAutocompleteOpen(false);
                setAutocompleteQuery('');
              }
            }}
            onFocus={() => setInputFocused(true)}
            onBlur={() => { if (!inputValue) setInputFocused(false); }}
            onKeyDown={e => {
              // Ctrl+Enter to send
              if (e.key === 'Enter' && e.ctrlKey && !e.isComposing) {
                e.preventDefault();
                if (!autocompleteOpen) handleSend();
                return;
              }

              // Backspace: delete whole @[path] token if cursor is right after it
              if (e.key === 'Backspace' && !autocompleteOpen) {
                const cursorPos = e.target.selectionStart;
                const textBefore = inputValue.slice(0, cursorPos);
                const tokenMatch = textBefore.match(/@\[[^\]]+\]$/);
                if (tokenMatch) {
                  e.preventDefault();
                  const newVal = inputValue.slice(0, tokenMatch.index) + inputValue.slice(cursorPos);
                  setInputValue(newVal);
                  setTimeout(() => {
                    e.target.selectionStart = e.target.selectionEnd = tokenMatch.index;
                  }, 0);
                  return;
                }
              }
            }}
            onPaste={e => {
              const items = Array.from(e.clipboardData?.items || []);
              const imageFiles = items
                .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
                .map(item => item.getAsFile())
                .filter(Boolean);
              if (imageFiles.length > 0) {
                e.preventDefault();
                handleFilesSelected(imageFiles);
              }
            }}
            placeholder="Message..."
            className="w-full bg-transparent text-sm text-white/90 outline-none resize-none px-4 pt-2.5 pb-1 disabled:opacity-50 overflow-y-auto max-h-[40vh] font-sans font-normal placeholder:text-exo-muted/40"
            style={{ minHeight: (inputFocused || inputValue) ? '4.5rem' : '2.5rem', fontFamily: 'var(--font-message)' }}
            disabled={isGenerating}
          />
          <div className="flex items-center justify-between px-3 pb-2.5">
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setControlsExpanded(v => !v)}
                className={`p-1.5 transition-colors ${controlsExpanded ? 'text-exo-accent/70' : 'text-exo-muted/30 hover:text-exo-muted/60'}`}
                title="会话控制"
              >
                <SlidersHorizontal size={14} strokeWidth={1.5} />
              </button>
              <button onClick={() => imageInputRef.current?.click()} title="上传视讯数据" className="p-1.5 text-exo-muted/30 hover:text-exo-muted/60 transition-colors"><ImageIcon size={15} strokeWidth={1.5} /></button>
              <button onClick={() => fileInputRef.current?.click()} title="挂载文档区块" className="p-1.5 text-exo-muted/30 hover:text-exo-muted/60 transition-colors"><Paperclip size={15} strokeWidth={1.5} /></button>
              <input type="file" ref={imageInputRef} className="hidden" multiple accept="image/*" onChange={(e) => { handleFilesSelected(e.target.files); e.target.value = ''; }} />
              <input type="file" ref={fileInputRef} className="hidden" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.json,.zip,.py,.js,.ts,.jsx,.tsx,.html,.css,.xml,.yaml,.yml,.toml,.sh,.log" onChange={(e) => { handleFilesSelected(e.target.files); e.target.value = ''; }} />
            </div>
            <div className="flex items-center gap-2">
              {rightExtraButton}
              {isGenerating ? (
                <button
                  onClick={handleStop}
                  className="px-3 py-1 bg-red-500/10 text-red-500 border border-red-500/30 rounded-[2px] hover:bg-red-500 hover:text-white transition-all flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.2em]"
                  title="中止上行链路"
                >
                  <X size={12} />
                  <span>ABORT</span>
                </button>
              ) : (
                <button
                  onClick={() => handleSend(editingMessageId ? { editMessageId: editingMessageId } : {})}
                  disabled={isGenerating || (!inputValue.trim() && composeAttachments.length === 0)}
                  className="p-1.5 bg-exo-accent text-exo-pure rounded-[2px] hover:shadow-glow-gold hover:bg-exo-accentGlow disabled:opacity-20 disabled:grayscale transition-all"
                >
                  <Send size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
