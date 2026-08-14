import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
 Save, Plus, RefreshCw, X, FileText,
 Paperclip, Send, Cpu, Activity, Files, ImageIcon, ArrowLeft, Edit2, SlidersHorizontal, Folder, ChevronDown, Mic
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../ui';
import { baseUrl, getCsrfToken, MAIN_MODEL_IDS, useTheme, configApi, resolveInitialSessionTarget } from 'exo-shared';
import { getAgentAvatarUrl, getUserAvatarUrl } from '../../utils/avatar';
import { filesToAttachmentData, saveAttachments, enrichMessages, uploadFilesToAttachments, audioCapable, audioUploadErrorMessage, MAX_AUDIO_BYTES } from '../../utils/attachmentStorage';
import ComposeAttachmentItem from './ComposeAttachmentItem';
import AudioComposeBar from './AudioComposeBar';
import { formatDateSeparator, isDifferentDay } from '../../utils/time';
import MessageBubble from './MessageBubble';
import BranchSessionModal from '../modals/BranchSessionModal';
import ContextCacheIndicator from './ContextCacheIndicator';
import { usePollingChat } from '../../hooks/usePollingChat';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import {
 audioRecoveryInitial,
 audioRecoveryUploadSuccess,
 audioRecoveryMarkDone,
 audioRecoveryMarkError,
 audioRecoveryBeginAttempt,
 audioRecoveryOnStreamEnd,
 audioRecoveryAbandon,
 audioRecoverySessionSwitch,
 resolveAudioForSend,
} from '../../utils/audioRecoveryMachine';
import RecoverableAudioItem from './RecoverableAudioItem';
import AuroraBackground from './AuroraBackground';
import ControlsDrawer from './ControlsDrawer';
import { DEFAULT_PALETTE_ID, THEME_DEFAULT_LIGHT, THEME_DEFAULT_DARK, getPalette } from './palettes';
import AutocompletePopup from './AutocompletePopup';

const MSGS_PER_PAGE = 50;

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

const MOCK_CATALOG = {
  models: [
    { name: "gemini-3.7-flash", family: "gemini", abilities: ["audio", "context_cache", "fc", "grounding", "thinking", "vision"], compatible_endpoint_ids: [1, 2] },
    { name: "gemini-3-flash-preview", family: "gemini", abilities: ["audio", "context_cache", "fc", "grounding", "thinking", "vision"], compatible_endpoint_ids: [1, 2] },
    { name: "gemini-3.1-pro-preview", family: "gemini", abilities: ["audio", "context_cache", "fc", "grounding", "thinking", "vision"], compatible_endpoint_ids: [1, 2] },
    { name: "gemini-3.1-flash-lite", family: "gemini", abilities: ["audio", "context_cache", "fc", "grounding", "thinking", "vision"], compatible_endpoint_ids: [1, 2] },
    { name: "gemini-2.5-flash-lite", family: "gemini", abilities: ["audio", "context_cache", "fc", "grounding", "thinking", "vision"], compatible_endpoint_ids: [1, 2] },
    { name: "deepseek-v4-flash", family: "deepseek", abilities: ["fc", "thinking"], compatible_endpoint_ids: [1] },
    { name: "deepseek-v4-pro", family: "deepseek", abilities: ["fc", "thinking"], compatible_endpoint_ids: [1] },
    { name: "gemini-3-pro-image", family: "gemini", abilities: ["image_gen"], compatible_endpoint_ids: [2] }
  ],
  endpoints: [
    { id: 1, name: "DeepSeek 官方", provider: "deepseek", payload_format: "openai", cache_transport: "inline_chunk", attachment_transports: ["inline_text"], configured: true, enabled: true },
    { id: 2, name: "Gemini 官方", provider: "gemini", payload_format: "gemini", cache_transport: "remote_reference", attachment_transports: ["file_uri", "inline_text", "inline_image"], configured: true, enabled: true },
    { id: 3, name: "OpenRouter Gemini", provider: "openrouter", payload_format: "openai", cache_transport: "inline_chunk", attachment_transports: ["inline_text", "inline_image"], configured: true, enabled: true }
  ],
  roles: [
    { role: "main", model: "gemini-3.7-flash", endpoint: 2 },
    { role: "general_sub_agent", model: "deepseek-v4-flash", endpoint: 1 },
    { role: "vision_helper", model: "gemini-2.5-flash-lite", endpoint: 2 },
    { role: "grounding", model: "gemini-2.5-flash", endpoint: 2 },
    { role: "image_gen", model: "gemini-3-pro-image", endpoint: 2 }
  ]
};

const ChatArea = ({ activeSessionId, setActiveSessionId, setRefreshKey, setShowConvList, openNewSession, presets, headerTitleOverride, rightExtraButton, onBack, fileTree, pendingInsert, onInsertConsumed, onLoadDirectory, project }) => {
 const navigate = useNavigate();
 const location = useLocation();
 const locationState = location.state || {};
 const chatBackLabel =
   locationState.from === 'agent'    ? locationState.agentName || 'Agent Hub' :
   locationState.from === 'project'  ? locationState.projectName || 'Project' :
   locationState.from === 'projects' ? 'Project Hall' :
   locationState.from === 'home'     ? 'Home' :
   'Back';
 const [messages, setMessages] = useState([]);
 const [sessionInfo, setSessionInfo] = useState(null);
 const [inputValue, setInputValue] = useState("");
 const [isGenerating, setIsGenerating] = useState(false);
 const [editingMessageId, setEditingMessageId] = useState(null);
 const abortControllerRef = useRef(null);
 const [thinkingLevel, setThinkingLevel] = useState("auto");
 const [temperature, setTemperature] = useState(1.0);
 const [catalog, setCatalog] = useState(null);
 const [sessionTarget, setSessionTarget] = useState({ model: "", endpoint: null });
 const recorder = useAudioRecorder({ maxDurationMs: 60000 });
 // P0-R6: 可恢复音频附件（conversation-bound、可渲染）——terminal success 前保留
 // P0-R6: 可恢复音频附件（conversation-bound、可渲染、terminal-success 才清）
 const [recovery, setRecovery] = useState(audioRecoveryInitial);
 // P1-R12: 发送失败可见文案（非 raw），recovery item 内展示
 const [sendError, setSendError] = useState(null);
 // P0-R11: 会话 token——deferred upload 后 recheck，防止向旧会话提交 chat
 const activeSessionIdRef = useRef(activeSessionId);
 useEffect(() => { activeSessionIdRef.current = activeSessionId; }, [activeSessionId]);
 // P0-R13: 服务端持久化的 failed user turn id（retry-in-place 用 edit_message_id 替换）
 const failedUserMsgIdRef = useRef(null);
 // P0-R14: 同步 ref（不经 state/effect）——refresh 回调可靠读到当前 recovery audio IDs
 const recoveryIdsRef = useRef(null);
 const canRecord = useMemo(
  () => audioCapable(catalog, sessionTarget),
  [catalog, sessionTarget]
 );
 // 竞态：录音中切换模型/端点 → 目标不再 eligible → 取消录音并提示
 useEffect(() => {
  if (recorder.status === 'recording' && !canRecord) {
   recorder.fail('target_changed');
  }
 }, [recorder.status, canRecord, recorder]);
 // P0: 会话切换时取消残留录音 + 清 recoverable（防 clip/attachment ID 跨会话带出）
 const activeSessionRef = useRef(activeSessionId);
 useEffect(() => {
  if (activeSessionRef.current !== activeSessionId) {
   recorder.cancel();
   setRecovery(audioRecoverySessionSwitch());
   failedUserMsgIdRef.current = null; // P0-R14: 会话切换清 stale edit 引用
   recoveryIdsRef.current = null;
   activeSessionRef.current = activeSessionId;
  }
 }, [activeSessionId, recorder]);
 const [sessionType, setSessionType] = useState(() =>
 activeSessionId
  ? (localStorage.getItem(`exo_session_type_${activeSessionId}`) || 'lite')
  : 'lite'
 );
 const [chatMode, setChatMode] = useState(() => localStorage.getItem('exo_chat_mode') || 'sse');
 const [composeAttachments, setComposeAttachments] = useState([]);
 const [cacheSkippedToast, setCacheSkippedToast] = useState(null);
 // Each entry: { clientId, file, preview, name, type, attachmentId, uploading, error }
 const nextClientIdRef = useRef(0);
 const [hasMore, setHasMore] = useState(false);
 const [isLoadingMore, setIsLoadingMore] = useState(false);
 const [lastTelemetry, setLastTelemetry] = useState(null);
 const sessionTelemetryRef = useRef({ totalInput: 0, totalOutput: 0, totalCached: 0, totalTools: 0, requests: 0 });
 const [telemetryExpanded, setTelemetryExpanded] = useState(false);
 const [controlsExpanded, setControlsExpanded] = useState(false);
 const { theme } = useTheme();

 const getThemeDefaultId = (t) => {
  return t === 'light' ? THEME_DEFAULT_LIGHT : THEME_DEFAULT_DARK;
 };

 useEffect(() => {
  configApi.getModelCatalog()
   .then(data => setCatalog(data))
   .catch(() => setCatalog(MOCK_CATALOG));
 }, []);

 useEffect(() => {
  if (!catalog || !sessionInfo) return;
  const p = presets.find(x => x.id === sessionInfo.agent_preset_id);
  setSessionTarget(resolveInitialSessionTarget(catalog, p));
 }, [catalog, sessionInfo]);

 const [paletteId, setPaletteId] = useState(() => {
  const stored = activeSessionId
    ? localStorage.getItem(`exo_session_theme_${activeSessionId}`)
    : null;
  if (stored) {
    const preset = getPalette(stored);
    // Validate stored palette is compatible with current theme.
    // Custom palettes have no theme tag → always compatible.
    // Built-in presets must match the current theme.
    // Also verify preset.id === stored to catch fallback-returned stale IDs.
    if (preset && preset.id === stored && (!preset.theme || preset.theme === theme)) {
      return stored;
    }
  }
  return getThemeDefaultId(theme);
 });
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
 const shouldScrollRef = useRef(false);  // flag to scroll after React commit
 const userScrolledUpRef = useRef(false);  // user intent: scrolled away from bottom
 const [showScrollBtn, setShowScrollBtn] = useState(false);

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
   status: null,
   diagnostics: [],
  }));

  // Build clientId → batchIdx lookup for O(1) input_index matching
  const batchIdxByClientId = new Map();
  entries.forEach((e, i) => batchIdxByClientId.set(e.clientId, i));

  setComposeAttachments(prev => [...prev, ...entries]);

  uploadFilesToAttachments(activeSessionId, fileArray)
   .then((data) => {
   const results = data.results || [];

   setComposeAttachments(prev => prev.map(e => {
    const batchIdx = batchIdxByClientId.get(e.clientId);
    if (batchIdx === undefined) return e;

    const result = results[batchIdx];
    if (!result) {
     return {
      ...e,
      uploading: false,
      status: 'failed',
      diagnostics: [{ stage: 'resolve', code: 'no_result', level: 'error', message: 'No result' }],
     };
    }

    return {
     ...e,
     uploading: false,
     attachmentId: result.attachment?.id || null,
     status: result.status,
     diagnostics: result.diagnostics || [],
    };
   }));
   fetch(`${baseUrl}/api/agents/conversations/${activeSessionId}/attachments/`, { credentials: 'include' })
    .then(res => res.json())
    .then(data => setSessionAttachments(Array.isArray(data) ? data : (data.attachments || [])))
    .catch(() => {});
   })
   .catch(err => {
   const results = err.results || [];
   const failures = err.failures || [];

   setComposeAttachments(prev => prev.map(e => {
    const batchIdx = batchIdxByClientId.get(e.clientId);
    if (batchIdx === undefined) return e;

    // Prefer results[] when server provides it (M1 contract)
    const result = results[batchIdx];
    if (result) {
     return {
      ...e,
      uploading: false,
      attachmentId: result.attachment?.id || null,
      status: result.status,
      diagnostics: result.diagnostics || [],
     };
    }

    // Fallback: match by input_index in failures[]
    const failed = failures.find(f => f.input_index === batchIdx);
    if (failed) {
     return {
      ...e,
      uploading: false,
      attachmentId: null,
      status: 'failed',
      diagnostics: failed.diagnostics || [{
       stage: failed.stage,
       code: failed.code,
       level: 'error',
       message: failed.message,
      }],
     };
    }

    return {
     ...e,
     uploading: false,
     status: 'failed',
     diagnostics: [{ stage: 'resolve', code: 'upload_error', level: 'error', message: err.message || 'Upload failed' }],
    };
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

 // Auto-dismiss cache_skipped toast after 3 seconds
 useEffect(() => {
  if (!cacheSkippedToast) return;
  const timer = setTimeout(() => setCacheSkippedToast(null), 3000);
  return () => clearTimeout(timer);
 }, [cacheSkippedToast]);

 // Cleanup blob URLs on unmount
 useEffect(() => {
 return () => {
  composeAttachmentsRef.current.forEach(e => { if (e.preview) URL.revokeObjectURL(e.preview); });
 };
 }, []);

 const scrollToBottom = (smooth = true) =>
 messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant", block: "end" });

 // Scroll after React commits — replaces unreliable rAF inside fetch().then()
 useEffect(() => {
 if (shouldScrollRef.current) {
  shouldScrollRef.current = false;
  scrollToBottom(false);
  userScrolledUpRef.current = false;
  setShowScrollBtn(false);
 }
 }, [messages]);

 const isNearBottom = () => {
 const c = scrollContainerRef.current;
 if (!c) return true;
 return c.scrollHeight - c.scrollTop - c.clientHeight < 120;
 };

 // Track user scroll intent: if user manually scrolls up, stop auto-following
 const handleScrollWheel = useCallback((e) => {
 if (e.deltaY < 0) {
  // User scrolled up — stop auto-follow
  userScrolledUpRef.current = true;
  if (isGenerating) setShowScrollBtn(true);
 } else if (e.deltaY > 0 && isNearBottom()) {
  // User scrolled back to bottom — resume auto-follow
  userScrolledUpRef.current = false;
  setShowScrollBtn(false);
 }
 }, [isGenerating]);

 const handleScrollToBottomClick = useCallback(() => {
 userScrolledUpRef.current = false;
 setShowScrollBtn(false);
 scrollToBottom(true);
 }, []);

 const loadMoreMessages = useCallback(() => {
 if (!hasMore || isLoadingMore) return;
 const container = scrollContainerRef.current;
 const prevScrollHeight = container?.scrollHeight || 0;
 setIsLoadingMore(true);

 const currentLoaded = allHistoryRef.current.length;
 const apiOffset = currentLoaded;

 fetch(`${baseUrl}/api/agents/chat/${activeSessionId}/?limit=${MSGS_PER_PAGE}&offset=${apiOffset}`, {
  credentials: 'include'
 })
  .then(res => res.json())
  .then(data => {
  const olderMessages = data.messages || data;
  const enriched = enrichMessages(olderMessages);

  allHistoryRef.current = [...enriched, ...allHistoryRef.current];

  setMessages(prev => [...enriched, ...prev]);
  setHasMore(data.has_more ?? false);
  setIsLoadingMore(false);

  requestAnimationFrame(() => {
   if (container) container.scrollTop = container.scrollHeight - prevScrollHeight;
  });
  })
  .catch(err => {
  console.error('加载更早消息失败:', err);
  setIsLoadingMore(false);
  });
 }, [hasMore, isLoadingMore, activeSessionId]);

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

 // Restore per-session color palette (with theme validation)
 const savedPalette = localStorage.getItem(`exo_session_theme_${activeSessionId}`);
 if (savedPalette) {
  const preset = getPalette(savedPalette);
  if (preset && preset.id === savedPalette && (!preset.theme || preset.theme === theme)) {
    setPaletteId(savedPalette);
  } else {
    setPaletteId(getThemeDefaultId(theme));
  }
 } else {
  setPaletteId(getThemeDefaultId(theme));
 }

 // Restore per-session session_type
 setSessionType(localStorage.getItem(`exo_session_type_${activeSessionId}`) || 'lite');

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
   const st = current.session_type || 'lite';
   setSessionType(st);
   localStorage.setItem(`exo_session_type_${activeSessionId}`, st);
   const p = presets.find(x => x.id === current.agent_preset_id);
   if (catalog) {
    setSessionTarget(resolveInitialSessionTarget(catalog, p));
   } else {
    setSessionTarget({ model: p ? p.default_model : (MAIN_MODEL_IDS[0] || ""), endpoint: null });
   }
  }
  });

 fetch(`${baseUrl}/api/agents/chat/${activeSessionId}/?limit=${MSGS_PER_PAGE}`, { credentials: 'include' })
  .then(res => res.json())
  .then(data => {
  if (loadGenRef.current !== loadGen) return;
  // 兼容新旧格式：分页模式返回 {messages, total_count, has_more}，旧格式返回数组
  const messages = data.messages || data;
  const enriched = enrichMessages(messages);
  const count = data.total_count ?? enriched.length;
  allHistoryRef.current = enriched;
  visibleStartRef.current = 0;
  setMessages(enriched);
  setHasMore(data.has_more ?? (enriched.length < count));
  shouldScrollRef.current = true;

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
   userScrolledUpRef.current = false;
   setShowScrollBtn(false);
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
    if (!userScrolledUpRef.current && isNearBottom()) scrollToBottom(false);
    }
   ).then(() => {
    if (loadGenRef.current !== loadGen) return;
    // Polling complete — reload latest messages (paginated)
    setIsGenerating(false);
    abortControllerRef.current = null;
    const loadedCount = allHistoryRef.current.length;
    const refreshLimit = Math.max(MSGS_PER_PAGE, Math.ceil(loadedCount / MSGS_PER_PAGE) * MSGS_PER_PAGE);
    fetch(`${baseUrl}/api/agents/chat/${activeSessionId}/?limit=${refreshLimit}`, { credentials: 'include' })
    .then(res => res.json())
    .then(fullData => {
     const messages = fullData.messages || fullData;
     if ((!Array.isArray(messages) || messages.length === 0) && !Array.isArray(fullData)) return;
     const enrichedFull = enrichMessages(Array.isArray(fullData) ? fullData : messages);
     allHistoryRef.current = enrichedFull;
     visibleStartRef.current = 0;
     setMessages(enrichedFull);
     setHasMore(fullData.has_more ?? false);
     shouldScrollRef.current = true;
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

 // When theme changes, verify current paletteId is still compatible
 useEffect(() => {
  const preset = getPalette(paletteId);
  if (preset?.theme && preset.theme !== theme) {
   // Current palette is incompatible with new theme → revert to default
   const newDefault = getThemeDefaultId(theme);
   setPaletteId(newDefault);
   if (activeSessionId) {
    localStorage.setItem(`exo_session_theme_${activeSessionId}`, newDefault);
   }
  }
 }, [theme]);

 const handleStop = () => {
 // 1. Capture async token BEFORE abort (abort() synchronously fires
 //    the onAbort handler in pollLoop which removes localStorage)
 const asyncToken = localStorage.getItem(`exo_async_${activeSessionId}`);

 // 2. Abort frontend request (fetch + polling)
 if (abortControllerRef.current) {
  abortControllerRef.current.abort();
  setIsGenerating(false);
 }

 // 3. Notify backend to stop LLM generation
 const stopUrl = `${baseUrl}/api/agents/chat/${activeSessionId}/stop/`;

 if (asyncToken) {
  try {
   const parsed = JSON.parse(asyncToken);
   fetch(`${stopUrl}?message_id=${parsed.message_id}`, {
    method: 'POST',
    headers: { 'X-CSRFToken': getCsrfToken() },
    credentials: 'include',
   }).catch(() => {});
  } catch {}
 } else {
  // SSE mode: no message_id — best-effort call (backend needs
  // session-level stop support to make this effective; see
  // docs/superpowers/specs/sse-stop-event.md)
  fetch(stopUrl, {
   method: 'POST',
   headers: { 'X-CSRFToken': getCsrfToken() },
   credentials: 'include',
  }).catch(() => {});
 }
 };

 /** Clean @[path] tokens — replace with @path for the LLM while keeping the reference. */
 const cleanContentForSend = (text) => {
 return text.replace(/@\[([^\]]+)\]/g, '@$1');
 };

 const handleSend = async (options = {}) => {
 // editMessageId: explicit (redo from regenerate button) or from editing state (edit flow)
 const editMessageId = options.editMessageId ?? editingMessageId;
 const forceCacheRebuild = options.forceCacheRebuild || false;

  if ((!inputValue.trim() && editMessageId == null && composeAttachments.length === 0 && recorder.status !== 'recorded' && !recovery.item) || isGenerating) return;

  // Send guard: block if uploads pending or failed entries remain
  const uploadingEntries = composeAttachments.filter(e => e.uploading);
  if (uploadingEntries.length > 0) {
   alert('还有文件在上传中，请稍候');
   return;
  }
  const failedEntries = composeAttachments.filter(e => e.status === 'failed');
  if (failedEntries.length > 0) {
   alert(`以下文件上传失败，请移除后重试：\n${failedEntries.map(e => e.name).join('\n')}`);
   return;
  }

  const currentInput = inputValue;
  const currentPending = [...pendingAttachments];
  const sendSessionId = activeSessionId; // P0-R11: 发送时会话 token

  // P0: 防重复 Send — 在 await upload 前即进入 generating，阻塞二次点击
  setIsGenerating(true);
  setSendError(null);
  // P0-R6: optimistic 回滚快照（chat 失败时恢复，避免重复空气泡）
  const preSendHistory = [...allHistoryRef.current];

  // P0-R6: 统一 audio source 决策（new clip / recoverable IDs / none）——gate 对两种 source 一致
  const audioPlan = resolveAudioForSend({
   status: recorder.status,
   canRecord,
   recoverableAudio: recovery.item,
   conversationId: activeSessionId,
  });
  if (audioPlan.gate === 'unsupported') {
   setIsGenerating(false);
   alert('当前模型/端点不支持语音，请切换到支持音频的 Gemini 目标');
   return;
  }
  let audioPendingIds = [];
  if (audioPlan.kind === 'upload') {
   // P1-R5: 前端 10 MiB 同值预检（后端仍是最终事实源）
   if (recorder.blob.size > MAX_AUDIO_BYTES) {
    alert('语音超过 10 MiB 上限，请缩短录音后重试');
    setIsGenerating(false);
    return;
   }
   // 上传录音（需带 model/endpoint，后端 resolve_session_target）
   const audioFile = new File([recorder.blob], `recording-${Date.now()}.webm`, { type: recorder.mimeType || 'audio/webm' });
   try {
    const up = await uploadFilesToAttachments(activeSessionId, [audioFile], {
     model: sessionTarget.model,
     endpoint: sessionTarget.endpoint,
    });
    if (up.attachments && up.attachments.length > 0) {
     audioPendingIds = up.attachments.map(a => a.id);
     // P0-R11: 上传期间切换会话 → 不提交 chat、不写旧 recovery
     if (sendSessionId !== activeSessionIdRef.current) {
      setIsGenerating(false);
      return;
     }
     // P0-R6: 保留可恢复 pending（conversation-bound），terminal success 前不清
     setRecovery(audioRecoveryUploadSuccess(recovery, sendSessionId, audioPendingIds));
     recoveryIdsRef.current = { conversationId: sendSessionId, attachmentIds: [...audioPendingIds] };
    } else {
     alert('语音上传失败');
     setIsGenerating(false);
     return;
    }
   } catch (err) {
    // P1-R5: 稳定用户文案，不暴露 raw backend code
    alert(audioUploadErrorMessage(err));
    setIsGenerating(false);
    return;
   }
   recorder.cancel();
  } else if (audioPlan.kind === 'reuse') {
   // P0-R6: chat 失败重试时复用已上传的 attachment ID（不重复上传同一 clip）
   audioPendingIds = audioPlan.attachmentIds;
   // P0-R15: 重试尝试开始——重置 done/error（保留 item/IDs），
   // 否则上次失败 error=true 残留 → retry 成功后 done+error 导致入口不消失
   setRecovery(prev => audioRecoveryBeginAttempt(prev));
  }

  // optimistic history 仅在附件处理成功后才变更（P0: 失败恢复不丢 clip）
  let historyToKeep = [...allHistoryRef.current];
 let userMsg = null;
 let aiMsg = { id: Date.now(), role: 'assistant', content: '', reasoning_content: '', reasoning_steps: [], new_anchors: [] };

 // P0-R14: 仅 reuse + 会话绑定匹配才 auto-edit（普通 edit 始终允许）
 const failedRef = failedUserMsgIdRef.current;
 const canAutoEdit = audioPlan.kind === 'reuse'
  && failedRef && failedRef.conversationId === sendSessionId
  && failedRef.attachmentIds.every(id => audioPlan.attachmentIds.includes(id));
 const retryEditId = editMessageId ?? (canAutoEdit ? failedRef.messageId : null);

 if (retryEditId != null) {
  // P0-R13: retry-in-place —— 替换对应 turn，不新增 bubble
  const replaceMsgId = retryEditId;
  const idx = historyToKeep.findIndex(m => m.id === replaceMsgId);
  if (idx !== -1) {
  const existingMsg = historyToKeep[idx];
  historyToKeep = historyToKeep.slice(0, idx);
  if (inputValue.trim()) {
   // Edit: replace user message content
   userMsg = {
   id: editMessageId,
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
   historyToKeep.push(userMsg);
  } else {
   // Pure redo: keep original user message as-is
   historyToKeep.push(existingMsg);
  }
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

 setInputValue("");
 // Clean up compose attachment blob URLs
 composeAttachments.forEach(e => { if (e.preview) URL.revokeObjectURL(e.preview); });
 setComposeAttachments([]);
 setEditingMessageId(null);
 userScrolledUpRef.current = false;
 setShowScrollBtn(false);
 scrollToBottom(true);
 localStorage.removeItem(`exo_draft_${activeSessionId}`);

 abortControllerRef.current = new AbortController();

 // P0-R11: chat 提交前最终 recheck（deferred upload 窗口已过）
 if (sendSessionId !== activeSessionIdRef.current) {
  setIsGenerating(false);
  return;
 }

 try {
  let response;
  const bodyData = {
  content: currentInput,
  model: sessionTarget.model,
  endpoint: sessionTarget.endpoint,
  session_type: sessionType,
  force_cache_rebuild: forceCacheRebuild,
  thinking_level: thinkingLevel,
  temperature: temperature,
  cache_enabled: activeSessionId && localStorage.getItem(`exo_cache_enabled_${activeSessionId}`) !== 'false',
  ...(activeSessionId && { memory_injection_enabled: localStorage.getItem(`exo_mem_inject_${activeSessionId}`) !== 'false' }),
  ...(currentPending.length > 0 || composeAttachments.some(e => e.attachmentId != null) || audioPendingIds.length > 0
   ? { pending_attachments: [
    ...currentPending.map(a => typeof a === 'object' ? a.id : a),
    ...composeAttachments.filter(e => e.attachmentId != null).map(e => e.attachmentId),
    ...audioPendingIds,
   ]}
   : {}),
  ...(editMessageId != null && { edit_message_id: editMessageId }),
  ...(editMessageId == null && canAutoEdit && { edit_message_id: failedRef.messageId }),
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
   if (!userScrolledUpRef.current && isNearBottom()) scrollToBottom(false);
  });
  setRecovery(audioRecoveryInitial()); // terminal success（async 轮询完成）
  } else {
  response = await fetch(`${baseUrl}/api/agents/chat/${activeSessionId}/`, fetchOptions);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let streamDone = false;
  let streamError = false;

  while (true) {
   const { done, value } = await reader.read();
   if (done) break;
   buffer += decoder.decode(value, { stream: true });
   const blocks = buffer.split('\n\n'); buffer = blocks.pop();

   for (const block of blocks) {
   // P0-R10: terminal error 后停止处理失败 turn 的剩余内容
   if (streamError) continue;
   const lines = block.split('\n');
   let eventType = 'message'; let dataStr = '';
   for (const line of lines) {
    if (line.startsWith('event:')) eventType = line.substring(6).trim();
    else if (line.startsWith('data:')) dataStr += line.substring(5).trim();
   }
   if (!dataStr || eventType === 'done' || dataStr === '[DONE]') {
    // P0-R6-A: 显式记录 terminal done（EOF without done 不算 success）
    if (eventType === 'done' || dataStr === '[DONE]') streamDone = true;
    continue;
   }

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

   if (eventType === 'cache_skipped') {
    try {
     const cs = JSON.parse(dataStr);
     console.log('[cache_skipped]', cs.reason);
     // Show toast
     setCacheSkippedToast(cs.reason);
    } catch(e) {}
    continue;
   }

   if (eventType === 'error') {
    streamError = true;
    // P0-R10/R13: 失败过渡统一在流结束后处理（rollback + 可见文案），此处仅标记
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
   if (!userScrolledUpRef.current && isNearBottom()) scrollToBottom(false);
  }
  // P0-R6-A + R9: 用 functional update 取最新 recovery（避免 fresh-upload 后 stale closure 覆盖新 IDs）
  setRecovery(prev => audioRecoveryOnStreamEnd(
   streamError ? audioRecoveryMarkError(prev)
    : streamDone ? audioRecoveryMarkDone(prev)
    : prev
  ));
  if (streamDone && !streamError) {
   setSendError(null);
   failedUserMsgIdRef.current = null; // turn 成功，无 failed user 可复用
   recoveryIdsRef.current = null;
  } else {
   // P0-R13: 统一 failure transition（EOF without done / event:error 同路径）：
   // 可见稳定文案 + 保留 IDs + optimistic rollback
   setSendError(streamError ? '发送失败，附件已保留' : '连接中断，附件已保留');
   allHistoryRef.current = preSendHistory;
   setMessages(preSendHistory.slice(visibleStartRef.current));
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
  // P1-R12: transport failure 可见（非 console-only）
  setSendError('网络错误，附件已保留');
  }
  // P0-R6: 失败/中止回滚 optimistic turn（finally refresh 以服务端为准）
  allHistoryRef.current = preSendHistory;
  setMessages(preSendHistory.slice(visibleStartRef.current));
 } finally {
  setIsGenerating(false);
  abortControllerRef.current = null;
  // 刷新最新消息以获取真实 DB id（分页模式）
  const loadedCount = allHistoryRef.current.length;
  const refreshLimit = Math.max(MSGS_PER_PAGE, Math.ceil(loadedCount / MSGS_PER_PAGE) * MSGS_PER_PAGE);
  fetch(`${baseUrl}/api/agents/chat/${activeSessionId}/?limit=${refreshLimit}`, { credentials: 'include' })
  .then(res => res.json())
  .then(async data => {
   const messages = data.messages || data;
   if ((!Array.isArray(messages) || messages.length === 0) && !Array.isArray(data)) return;
   const enriched = enrichMessages(Array.isArray(data) ? data : messages);
   allHistoryRef.current = enriched;
   visibleStartRef.current = 0;
   setMessages(enriched);
   setHasMore(data.has_more ?? false);
   shouldScrollRef.current = true;
   // P0-R14: 调和服务端持久化的 failed user turn —— candidate 必须包含当前 recovery 的 audio IDs
   const rr = recoveryIdsRef.current;
   if (rr && rr.conversationId === activeSessionId) {
    const candidate = [...enriched].reverse().find(m => {
     if (m.role !== 'user') return false;
     const metaIds = (m.attachments_meta || []).map(a => a.id);
     const attIds = (m.attachments || []).map(a => a.id);
     const ids = metaIds.length ? metaIds : attIds;
     return ids.length > 0 && rr.attachmentIds.every(id => ids.includes(id));
    });
    failedUserMsgIdRef.current = candidate
     ? { conversationId: activeSessionId, messageId: candidate.id, attachmentIds: [...rr.attachmentIds] }
     : null;
   } else {
    failedUserMsgIdRef.current = null;
   }
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
 if (updates.model !== undefined) setSessionTarget(prev => ({ ...prev, model: updates.model }));
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
  const res = await fetch(`${baseUrl}/api/agents/conversations/${activeSessionId}/attachments/delete/`, {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
  credentials: 'include',
  body: JSON.stringify({ source: att.source, id: att.id }),
  });
  if (res.status === 409) {
   const data = await res.json();
   setCacheSkippedToast(data.detail || data.error);
   return;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  setSessionAttachments(prev => prev.filter(a => a.id !== att.id));
 } catch (err) {
  console.error('移除附件失败:', err);
 }
 };

 const handleBranch = useCallback((messageId) => {
 setBranchingMessageId(messageId);
 }, []);

 const onConfirmBranch = async ({ name: newName, sessionType: branchSessionType }) => {
 if (!branchingMessageId) return;
 setIsBranching(true);
 try {
  const res = await fetch(`${baseUrl}/api/agents/conversations/${activeSessionId}/branch/`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
  credentials: 'include',
  body: JSON.stringify({
   branch_from_message_id: branchingMessageId,
   name: newName.trim() || undefined,
   session_type: branchSessionType || 'lite',
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
 // Redo: pass the user message ID as edit_message_id with empty content.
 // Backend keeps original content and regenerates the AI response.
 handleSendRef.current({ editMessageId: msg.id });
 }, []);

 return (
 <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-exo-bg relative">
  <AuroraBackground active={isGenerating} paletteId={paletteId} colors={paletteColors} />
  <div className="relative z-20 flex-shrink-0">
  {/* v1 standalone header: back + session name + ID */}
  {!onBack && (
   <div className="border-b border-cinder-line bg-exo-pure/20 backdrop-blur-md z-20 px-4 md:px-6 py-2 flex items-center gap-2 min-w-0">
   <button onClick={() => setShowConvList(true)} className="md:hidden p-0.5 -ml-0.5 tx-message-mute hover:tx-message-normal transition-colors flex-shrink-0"><ArrowLeft size={15} strokeWidth={1} /></button>
   <span className="text-sm font-sans font-medium tx-message-normal opacity-90 truncate">{headerTitleOverride || sessionInfo?.name || `Session`}</span>
   <span className="text-[0.725rem] font-sans tx-message-mute opacity-30 flex-shrink-0">#{activeSessionId}</span>
   </div>
  )}

  {/* v2 header: status dot · session name (left) | cache + docs (right) */}
  {onBack && (
   <div className="z-20 px-4 md:px-6 py-2 flex items-center justify-between">
   <div className="flex items-center gap-2 min-w-0">
    {/* Mobile back handled by MobileHeader (unified shell) */}
    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-500 ${isGenerating ? 'breathing-status' : 'bg-[#00509d]/30'}`} />
    {sessionInfo?.name && (
    <span className="text-[0.7875rem] font-light tx-message-mute opacity-60 truncate">
     {sessionInfo.name}
    </span>
    )}
   </div>
   <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
    <SessionTypeToggle
    value={sessionType}
    onChange={(val) => {
     setSessionType(val);
     localStorage.setItem(`exo_session_type_${activeSessionId}`, val);
    }}
    />
    <ContextCacheIndicator ref={cacheRef} activeSessionId={activeSessionId} />
    <button
    onClick={() => setShowAttachPanel(p => !p)}
    className={`p-1 transition-colors relative ${showAttachPanel ? 'tx-message-accent opacity-70' : 'tx-message-mute opacity-20 hover:tx-message-mute opacity-50'}`}
    title="Session Docs"
    >
    <Files size={14} strokeWidth={1} />
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
   <div className="px-4 py-3 border-b border-exo-mist-10 bg-cinder-glass flex items-center justify-between">
    <span className="label-caps tx-message-mute">挂载文档 ({filteredSessionAttachments.length + filteredPendingAttachments.length})</span>
    <button onClick={() => setShowAttachPanel(false)} className="tx-message-mute hover:tx-message-normal transition-colors"><X size={13} strokeWidth={1} /></button>
   </div>
   <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
    {filteredSessionAttachments.map(att => (
    <div key={att.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-exo-accent/[0.04] rounded-[2px] group transition-colors border border-transparent hover:border-exo-mist-10">
     <FileText size={13} strokeWidth={1} className="text-blue-400 shrink-0" />
     <span className="flex-1 text-xs tx-message-mute group-hover:tx-message-normal break-all leading-tight">{att.display_name || att.original_filename}</span>
     <button onClick={() => handleRemoveAttachment(att)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all"><X size={11} strokeWidth={1} /></button>
    </div>
    ))}
    {filteredPendingAttachments.map((att, i) => (
    <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-exo-accent/5 rounded-[2px] border border-exo-accent/20 group">
     <FileText size={13} strokeWidth={1} className="tx-message-accent opacity-50 shrink-0" />
     <div className="flex-1 min-w-0">
     <div className="text-xs tx-message-accent opacity-80 break-all leading-tight">{att.display_name || att.original_filename}</div>
     <div className="text-[0.5625rem] tx-message-accent opacity-40 tracking-widest">PENDING</div>
     </div>
     <button onClick={() => setPendingAttachments(p => p.filter((_, j) => j !== i))} className="p-1 hover:text-red-400 transition-colors"><X size={11} strokeWidth={1} /></button>
    </div>
    ))}
    {filteredSessionAttachments.length === 0 && filteredPendingAttachments.length === 0 && !isAddingAttach && (
    <div className="py-8 text-center text-[0.725rem] tx-message-mute opacity-30 tracking-widest">
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
     className="w-full bg-exo-bg border border-exo-mist-10 rounded-[2px] px-2 py-1.5 text-xs tx-message-normal outline-none focus:border-exo-accent/50 transition-colors "
     />
     <input
     value={newAttachName}
     onChange={e => setNewAttachName(e.target.value)}
     placeholder="显示名（可选）"
     className="w-full bg-exo-bg border border-exo-mist-10 rounded-[2px] px-2 py-1.5 text-xs tx-message-normal outline-none focus:border-exo-accent/50 transition-colors"
     />
     <div className="flex justify-end gap-2">
      <Button variant="ghost" size="sm" onClick={() => { setIsAddingAttach(false); setNewAttachPath(''); setNewAttachName(''); }}>取消</Button>
      <Button variant="primary" size="sm" onClick={handleAddAttachment}>确认</Button>
     </div>
    </div>
    )}
   </div>
   {!isAddingAttach && (
    <div className="p-2 border-t border-exo-mist-10 bg-cinder-glass">
    <button onClick={() => setIsAddingAttach(true)} className="w-full py-2 text-[0.7875rem] tracking-widest tx-message-mute hover:tx-message-normal hover:bg-exo-accent/[0.04] flex items-center justify-center gap-2 rounded-[2px] border border-dashed border-exo-mist-10 hover:border-exo-mist-20 transition-colors">
     <Plus size={13} strokeWidth={1} /> 挂载外部路径
    </button>
    </div>
   )}
   </div>
  )}
  </div>

  <div ref={scrollContainerRef} onWheel={handleScrollWheel} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 md:p-6 space-y-8 scrollbar-hide relative z-10">
  <div ref={topSentinelRef} className="h-px" />
  {isLoadingMore && (
   <div className="flex justify-center py-3">
   <span className="text-[0.725rem] tracking-[0.2em] tx-message-mute flex items-center gap-2 animate-pulse"><RefreshCw size={12} strokeWidth={1} className="animate-spin" /> 正在加载历史协议记录...</span>
   </div>
  )}
  {/* cache_skipped toast */}
  {cacheSkippedToast && (
   <div className="mx-4 mt-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-[2px] text-amber-400 text-xs flex items-center gap-2">
    <Cpu size={12} strokeWidth={1} />
    <span>当前模型不支持远端缓存（仅 Gemini 可用），已切换为普通发送。</span>
    <button onClick={() => setCacheSkippedToast(null)} className="ml-auto tx-message-mute opacity-40 hover:opacity-80">
     <X size={12} strokeWidth={1} />
    </button>
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
     <span className="text-[0.725rem] tx-message-mute opacity-30 tracking-wider">
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

  {/* Floating scroll-to-bottom button — shown when user scrolls up during streaming */}
  {showScrollBtn && (
   <button
   onClick={handleScrollToBottomClick}
   className="sticky bottom-2 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-full bg-exo-accent/90 text-black text-[0.725rem] tracking-[0.15em] shadow-lg hover:bg-exo-accent transition-colors animate-fade-in flex items-center gap-1.5"
   >
   <ChevronDown size={12} strokeWidth={1} /> 回到底部
   </button>
  )}
  </div>

  <BranchSessionModal
  isOpen={!!branchingMessageId}
  onClose={() => setBranchingMessageId(null)}
  onConfirm={onConfirmBranch}
  isSubmitting={isBranching}
  />

  <div className="flex-shrink-0 p-4 border-t border-cinder-line bg-exo-pure/40 backdrop-blur-xl flex flex-col gap-2 relative z-10">
  {editingMessageId && (
   <div className="flex items-center justify-between px-3 py-1.5 bg-exo-accent/10 border border-exo-accent/20 rounded-[2px] animate-fade-in">
   <div className="flex items-center gap-2 tx-message-accent text-[0.725rem] tracking-widest">
    <Edit2 size={11} strokeWidth={1} />
    <span>正在修正通讯协议数据区块 #{editingMessageId}</span>
   </div>
   <button onClick={() => { setEditingMessageId(null); setInputValue(''); }} className="tx-message-accent opacity-50 hover:tx-message-accent transition-colors"><X size={13} strokeWidth={1} /></button>
   </div>
  )}

  {/* Controls drawer — replaces old inline row */}
  {controlsExpanded && (
   <ControlsDrawer
   catalog={catalog}
   sessionTarget={sessionTarget}
   setSessionTarget={setSessionTarget}
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

  <div className={`relative flex flex-col bg-exo-pure/40 backdrop-blur-md border rounded-[4px] transition-all overflow-visible ${inputFocused || inputValue ? 'border-cinder-line-glow shadow-glow-gold' : 'border-cinder-line'}`}>
   {/* @ file-reference chip bar */}
   {fileRefs.length > 0 && (
   <div className="flex flex-wrap gap-1.5 px-3 pt-2.5 pb-1 border-b border-exo-mist-10 bg-cinder-glass">
    {fileRefs.map((ref, i) => (
    <span
     key={`${ref.path}-${i}`}
     className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-chat-accent/10 border border-chat-accent/20 text-[0.725rem] tx-message-accent "
    >
     {ref.path.includes('/') && !ref.path.endsWith('/') ? (
     <FileText size={9} strokeWidth={1} className="shrink-0" />
     ) : (
     <Folder size={9} strokeWidth={1} className="shrink-0" />
     )}
     <span className="max-w-[180px] truncate">{ref.path}</span>
     <button
     onClick={() => {
      const newVal = inputValue.slice(0, ref.start) + inputValue.slice(ref.end);
      setInputValue(newVal);
     }}
     className="ml-0.5 tx-message-mute opacity-40 hover:text-red-400 transition-colors"
     >
     <X size={10} strokeWidth={1} />
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
   <div className="flex flex-wrap gap-2 px-3 pt-3 pb-2 border-b border-exo-mist-10 bg-cinder-glass">
    {composeAttachments.map(entry => (
     <ComposeAttachmentItem
      key={entry.clientId}
      entry={entry}
      onRemove={handleRemoveComposeAttachment}
     />
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
    // Ctrl+Shift+Enter: cache send (fallback to normal send if no attachments)
    if (e.key === 'Enter' && e.ctrlKey && e.shiftKey && !e.isComposing) {
    e.preventDefault();
    if (!autocompleteOpen && !isGenerating) {
     if (composeAttachments.length > 0 || pendingAttachments.length > 0) {
      handleSend(editingMessageId ? { editMessageId: editingMessageId } : { forceCacheRebuild: true });
     } else {
      handleSend(editingMessageId ? { editMessageId: editingMessageId } : {});
     }
    }
    return;
    }

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
   placeholder="Chat to ExoCore..."
   className="w-full bg-transparent text-sm tx-message-normal opacity-90 outline-none resize-none px-4 pt-2.5 pb-1 disabled:opacity-50 overflow-y-auto max-h-[40vh] font-normal placeholder:tx-message-mute opacity-40"
   style={{ minHeight: (inputFocused || inputValue) ? '4.5rem' : '2.5rem', fontFamily: 'var(--font-message)' }}
   disabled={isGenerating}
   />
   {recorder.status !== 'idle' && (
    <AudioComposeBar
     recorder={recorder}
     isGenerating={isGenerating}
     onSend={() => handleSend()}
    />
   )}
   {recovery.item && recovery.item.conversationId === activeSessionId && (
    <RecoverableAudioItem
     isGenerating={isGenerating}
     onRetry={() => handleSend()}
     onAbandon={() => { setRecovery(audioRecoveryAbandon()); setSendError(null); failedUserMsgIdRef.current = null; recoveryIdsRef.current = null; }}
     errorText={sendError}
    />
   )}
   <div className="flex items-center justify-between px-3 pb-2.5">
   <div className="flex items-center gap-0.5">
    <button
    onClick={() => setControlsExpanded(v => !v)}
    className={`p-1 transition-colors ${controlsExpanded ? 'tx-message-accent opacity-70' : 'tx-message-mute opacity-20 hover:tx-message-mute opacity-50'}`}
    title="会话控制"
    >
    <SlidersHorizontal size={14} strokeWidth={1} />
    </button>
    <button onClick={() => imageInputRef.current?.click()} title="上传视讯数据" className="p-1 tx-message-mute opacity-20 hover:tx-message-mute opacity-50 transition-colors"><ImageIcon size={14} strokeWidth={1} /></button>
    <button onClick={() => fileInputRef.current?.click()} title="挂载文档区块" className="p-1 tx-message-mute opacity-20 hover:tx-message-mute opacity-50 transition-colors"><Paperclip size={14} strokeWidth={1} /></button>
    {canRecord && recorder.status === 'idle' && !isGenerating && (
     <button
      onClick={() => { if (!isGenerating) recorder.start(); }}
      title="录制语音"
      className="p-1 tx-message-mute opacity-20 hover:tx-message-mute opacity-50 transition-colors"
     >
      <Mic size={14} strokeWidth={1} />
     </button>
    )}
    <input type="file" ref={imageInputRef} className="hidden" multiple accept="image/*" onChange={(e) => { handleFilesSelected(e.target.files); e.target.value = ''; }} />
    <input type="file" ref={fileInputRef} className="hidden" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.json,.zip,.py,.js,.ts,.jsx,.tsx,.html,.css,.xml,.yaml,.yml,.toml,.sh,.log" onChange={(e) => { handleFilesSelected(e.target.files); e.target.value = ''; }} />
    <span className="text-[0.625rem] tx-message-mute opacity-30 tracking-wider tabular-nums ml-1">
     {inputValue.length}
    </span>
   </div>
   <div className="flex items-center gap-2">
    {rightExtraButton}
    {/* 🧊 Cache Send button — visible when attachments exist */}
    {!isGenerating && (composeAttachments.length > 0 || pendingAttachments.length > 0 || recorder.status === 'recorded') && (
     <button
      onClick={() => handleSend(editingMessageId ? { editMessageId: editingMessageId } : { forceCacheRebuild: true })}
      className="p-1.5 bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 rounded-[2px] hover:bg-cyan-500/25 hover:text-cyan-300 disabled:opacity-20 disabled:grayscale transition-colors"
      title="生成Cache并发送 (Ctrl+Shift+Enter)"
     >
      <Cpu size={15} strokeWidth={1} />
     </button>
    )}
    {isGenerating ? (
    <button
     onClick={handleStop}
     className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-[2px] hover:bg-red-500 hover:tx-message-normal transition-colors flex items-center gap-1.5 text-[0.725rem] tracking-[0.2em]"
     title="中止上行链路"
    >
     <X size={12} strokeWidth={1} />
     <span>ABORT</span>
    </button>
    ) : (
    <button
     onClick={() => handleSend(editingMessageId ? { editMessageId: editingMessageId } : {})}
     disabled={isGenerating || (!inputValue.trim() && composeAttachments.length === 0 && recorder.status !== 'recorded')}
     className="p-1.5 bg-exo-accent text-exo-pure rounded-[2px] hover:shadow-glow-gold hover:bg-exo-accentGlow disabled:opacity-20 disabled:grayscale transition-colors"
    >
     <Send size={15} strokeWidth={1} />
    </button>
    )}
   </div>
   </div>
  </div>
  </div>
 </div>
 );
};

// ── SessionTypeToggle ────────────────────────────────────────────────
const SessionTypeToggle = ({ value, onChange }) => {
 const isFull = value === 'full';

 return (
 <label className="flex items-center gap-1.5 cursor-pointer select-none">
  <input
  type="checkbox"
  checked={isFull}
  onChange={() => onChange(isFull ? 'lite' : 'full')}
  className="sr-only"
  />
  <span
  className={`w-7 h-4 rounded-full transition-colors flex items-center px-[2px] ${
   isFull ? 'bg-exo-accent/60' : 'bg-exo-mist-10'
  }`}
  >
  <span
   className={`w-3 h-3 rounded-full bg-white transition-transform ${
   isFull ? 'translate-x-3' : 'translate-x-0'
   }`}
  />
  </span>
  <span className="text-[0.725rem] tx-message-mute opacity-50">
  {isFull ? 'Full' : 'Lite'}
  </span>
 </label>
 );
};

export default ChatArea;
