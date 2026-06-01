import React, { useState, useEffect, useCallback } from 'react';
import { Send, Activity, X, ChevronLeft, CornerDownLeft, Check, Plus } from 'lucide-react';
import MiniCalendar from '../../../components/tasks/MiniCalendar';
import TaskCreateModal from '../../../components/tasks/TaskCreateModal';
import TaskRow from '../../../components/tasks/TaskRow';
import {
  fetchEntries, completeEntry, updateEntry, deleteEntry,
  suspendEntry, resumeEntry, syncGcal, unsyncGcal,
} from '../../../utils/tasksApi';
import { baseUrl, getCsrfToken } from '../../../utils/api';
import { getUserAvatarUrl, getAgentAvatarUrl } from '../../../utils/avatar';

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  if (/^\d{2}:\d{2}/.test(dateStr)) return dateStr.slice(0, 5);
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
};

function SectionHeader({ label }) {
  return (
    <div className="px-4 pt-4 pb-2 text-[9px] uppercase tracking-[0.2em] font-bold text-exo-muted/40 font-mono border-b border-exo-mist-6 mb-1">
      {label}
    </div>
  );
}

export default function TaskPanel({ appState }) {
  const { presets, openDestructor } = appState;
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [taskEntries, setTaskEntries] = useState([]);
  const [tweets, setTweets] = useState([]);
  const [postContent, setPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [modalEntry, setModalEntry] = useState(null);
  const [completingId, setCompletingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const userAvatarUrl = getUserAvatarUrl();
  const userNick = localStorage.getItem('exo_user_nick') || 'You';

  // Fetch tasks
  const loadTasks = useCallback(() => {
    fetchEntries({ status: 'active' })
      .then(setTaskEntries)
      .catch(() => setTaskEntries([]));
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // ── Task mutations ──
  const mutate = (fn) => fn().then(loadTasks).catch(console.error);

  const handleComplete = async (id) => {
    if (completingId === id) return;
    setCompletingId(id);
    try {
      await completeEntry(id);
      await loadTasks();
    } catch (err) {
      console.error('Complete failed', err);
    } finally {
      setCompletingId(null);
    }
  };

  const handleUpdate     = (id, patch) => mutate(() => updateEntry(id, patch));
  const handleSuspend    = (id) => mutate(() => suspendEntry(id));
  const handleResume     = (id) => mutate(() => resumeEntry(id));
  const handleGcalSync   = (id) => mutate(() => syncGcal(id));
  const handleGcalUnsync = (id) => mutate(() => unsyncGcal(id));
  const handleEdit       = (entry) => setModalEntry(entry);

  const handleDelete = (id) => openDestructor({
    title: 'Archive Entry',
    description: 'Archive this task from the active neural link. It will remain in history but cease all active tracking.',
    onDelete: () => mutate(() => deleteEntry(id)),
  });

  const toggleExpand = (id) => setExpandedId(p => p === id ? null : id);

  // Fetch tweets
  const fetchTweets = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/api/core/tweets/`, { credentials: 'include' });
      const data = await res.json();
      setTweets(data.tweets || []);
    } catch (err) {
      console.error('Timeline fetch failed', err);
    }
  }, []);

  useEffect(() => { fetchTweets(); }, [fetchTweets]);

  // Post tweet — always posts to today, then jumps to today
  const handlePost = async () => {
    const content = postContent.trim();
    if (!content || isPosting) return;
    setIsPosting(true);
    setPostContent('');
    try {
      const res = await fetch(`${baseUrl}/api/core/tweets/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const newTweet = await res.json();
        setTweets(prev => [{ ...newTweet, replies: newTweet.replies || [] }, ...prev]);
        setSelectedDate(today);
      } else {
        setPostContent(content);
      }
    } catch (err) {
      console.error('Post failed', err);
      setPostContent(content);
    } finally {
      setIsPosting(false);
    }
  };

  // Reply — ported from Timeline.jsx
  const addReplyToTree = (tweetList, parentId, newReply) =>
    tweetList.map(tweet => {
      if (tweet.id === parentId) {
        return { ...tweet, replies: [...(tweet.replies || []), { ...newReply, replies: [] }] };
      }
      if (tweet.replies?.length) {
        return {
          ...tweet,
          replies: tweet.replies.map(r =>
            r.id === parentId
              ? { ...r, replies: [...(r.replies || []), { ...newReply, replies: [] }] }
              : r
          ),
        };
      }
      return tweet;
    });

  const handleReply = async (parentId) => {
    const content = replyContent.trim();
    if (!content || isSubmittingReply) return;
    setIsSubmittingReply(true);
    setReplyContent('');
    setReplyingToId(null);
    try {
      const res = await fetch(`${baseUrl}/api/core/tweets/${parentId}/reply/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const newReply = await res.json();
        setTweets(prev => addReplyToTree(prev, parentId, newReply));
      }
    } catch (err) {
      console.error('Reply failed', err);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // Filter tasks by selected date
  const filteredTasks = taskEntries.filter(e => {
    if (e.status === 'suspended') return false;
    if (e.entry_type === 'todo') return e.due_date === selectedDate;
    if (e.entry_type === 'periodic') return e.next_periodic_due === selectedDate;
    if (e.entry_type === 'goal') {
      return e.cycle_start && e.cycle_due && selectedDate >= e.cycle_start && selectedDate <= e.cycle_due;
    }
    return false;
  });

  // Group tasks for main area display
  const pinned   = filteredTasks.filter(e => e.is_pinned);
  const todos    = filteredTasks.filter(e => !e.is_pinned && e.entry_type === 'todo');
  const periodic = filteredTasks.filter(e => !e.is_pinned && e.entry_type === 'periodic');
  const goals    = filteredTasks.filter(e => !e.is_pinned && e.entry_type === 'goal');

  // Filter tweets by selected date
  const filteredTweets = tweets.filter(t => {
    if (!t.created_at) return false;
    return t.created_at.slice(0, 10) === selectedDate;
  });

  const getAuthorInfo = (tweet) => {
    if (tweet.author === 'user') {
      return { name: userNick, avatar: userAvatarUrl, isUser: true };
    }
    const presetId = parseInt(tweet.author.split(':')[1]);
    const preset = presets?.find(p => p.id === presetId);
    return { name: preset?.name || 'Agent', avatar: getAgentAvatarUrl(presetId, preset?.name), isUser: false };
  };

  const typeIcon = (entryType) => {
    if (entryType === 'todo') return '○';
    if (entryType === 'periodic') return '↻';
    if (entryType === 'goal') return '◎';
    return '·';
  };

  // Shared TaskRow props factory (key is passed separately, not spread)
  const taskRowProps = (entry) => ({
    entry,
    isExpanded: expandedId === entry.id,
    onToggleExpand: toggleExpand,
    onEdit: handleEdit,
    onComplete: handleComplete,
    onUpdate: handleUpdate,
    onDelete: handleDelete,
    onSuspend: handleSuspend,
    onResume: handleResume,
    onGcalSync: handleGcalSync,
    onGcalUnsync: handleGcalUnsync,
  });

  // --- Full task section (used in main area) ---
  const fullTaskSection = (
    <div className="bg-exo-pure/40 border border-exo-mist-8 rounded-md overflow-hidden">
      <div className="px-4 py-2.5 border-b border-exo-mist-8 flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-exo-muted">Tasks · {selectedDate}</span>
        <button
          onClick={() => setModalEntry({})}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-exo-muted/50 hover:text-exo-accent hover:bg-exo-accent/10 rounded transition-all"
        >
          <Plus size={12} />
          New
        </button>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="px-4 py-8 text-center text-[10px] text-exo-muted/30 font-mono uppercase tracking-widest">
          No tasks for this date
        </div>
      ) : (
        <div>
          {pinned.length > 0 && (
            <div className="border border-exo-accent/30 bg-exo-accent/[0.03] rounded-[4px] m-3 overflow-hidden shadow-[0_0_30px_rgba(212,175,55,0.05)]">
              <div className="px-4 py-2 bg-exo-accent/10 border-b border-exo-accent/20 text-[10px] uppercase tracking-[0.2em] font-bold text-exo-accent font-mono flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-exo-accent rounded-full animate-pulse-glow" />
                Escalated Priority
              </div>
              {pinned.map(e => <TaskRow key={e.id} {...taskRowProps(e)} />)}
            </div>
          )}
          {todos.length > 0 && (
            <div>
              <SectionHeader label="Immediate Objectives / TODO" />
              {todos.map(e => <TaskRow key={e.id} {...taskRowProps(e)} />)}
            </div>
          )}
          {periodic.length > 0 && (
            <div>
              <SectionHeader label="Recursive Patterns / CYCLE" />
              {periodic.map(e => <TaskRow key={e.id} {...taskRowProps(e)} />)}
            </div>
          )}
          {goals.length > 0 && (
            <div>
              <SectionHeader label="Long-Term Projections / OBJECTIVE" />
              {goals.map(e => <TaskRow key={e.id} {...taskRowProps(e)} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // --- Calendar sidebar (shared between desktop and mobile) ---
  const calendarPanel = (
    <div className="flex flex-col h-full">
      <div className="p-3 md:p-4">
        <MiniCalendar
          selectedDate={selectedDate}
          onSelectDate={(d) => { setSelectedDate(d); setShowCalendar(false); }}
          entries={taskEntries}
        />
      </div>
      {/* Compact task quick-list below calendar */}
      <div className="flex-1 overflow-y-auto px-3 md:px-4 pb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-exo-muted">
            Tasks · {selectedDate}
          </p>
          <button
            onClick={() => setModalEntry({})}
            className="p-0.5 rounded text-exo-muted/30 hover:text-exo-accent hover:bg-exo-accent/10 transition-all"
            title="New Task"
          >
            <Plus size={12} strokeWidth={1.5} />
          </button>
        </div>
        {filteredTasks.length === 0 ? (
          <p className="text-[10px] text-exo-muted/60 italic">No tasks</p>
        ) : (
          <div className="space-y-1">
            {filteredTasks.map(task => (
              <div
                key={task.id}
                className={`px-2.5 py-1.5 bg-exo-pure border border-exo-mist-8 rounded text-xs flex items-center gap-1.5 group/task cursor-pointer hover:border-exo-accent/20 transition-colors ${
                  task.status === 'suspended' ? 'opacity-40 line-through' : ''
                }`}
              >
                <span className="text-exo-accent shrink-0">{typeIcon(task.entry_type)}</span>
                <span className="text-exo-text/80 truncate flex-1">{task.title}</span>
                {task.status !== 'suspended' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleComplete(task.id); }}
                    disabled={completingId === task.id}
                    className="shrink-0 p-0.5 rounded text-exo-muted/20 hover:text-exo-accent hover:bg-exo-accent/10 transition-all opacity-0 group-hover/task:opacity-100 disabled:opacity-30"
                    title="Complete"
                  >
                    <Check size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex-1 h-full flex bg-exo-bg overflow-hidden">
      {/* Desktop: fixed left sidebar */}
      <div className="hidden md:flex w-64 flex-shrink-0 border-r border-exo-mist-8 flex-col">
        {calendarPanel}
      </div>

      {/* Mobile: slide-over calendar backdrop */}
      {showCalendar && (
        <div className="md:hidden fixed inset-0 z-[130]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCalendar(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-exo-pure border-r border-exo-mist-8 shadow-2xl z-[140]">
            <div className="flex items-center justify-between px-3 py-2 border-b border-exo-mist-8">
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-exo-muted">Calendar</span>
              <button onClick={() => setShowCalendar(false)} className="p-1 text-exo-muted hover:text-exo-text">
                <X size={14} />
              </button>
            </div>
            {calendarPanel}
          </div>
        </div>
      )}

      {/* Right: Timeline-style main area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Mobile header with date + calendar toggle */}
        <div className="md:hidden flex-shrink-0 h-10 border-b border-exo-mist-8 flex items-center px-3 gap-2 bg-exo-pure">
          <button onClick={() => setShowCalendar(true)} className="p-1 text-exo-muted hover:text-exo-accent">
            <ChevronLeft size={16} strokeWidth={1.5} />
          </button>
          <span className="text-[10px] font-mono text-exo-muted">{selectedDate}</span>
          <div className="flex-1" />
          <button
            onClick={() => setModalEntry({})}
            className="p-1 text-exo-muted/50 hover:text-exo-accent transition-colors"
            title="New Task"
          >
            <Plus size={16} strokeWidth={1.5} />
          </button>
          <span className="text-[9px] font-mono text-exo-muted">{filteredTasks.length} tasks</span>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="max-w-2xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
            {/* Date indicator (desktop) */}
            <div className="hidden md:flex items-center gap-3">
              <h3 className="text-xs font-medium text-white">{selectedDate}</h3>
              <span className="text-[9px] font-mono text-exo-muted">{filteredTasks.length} tasks · {filteredTweets.length} posts</span>
            </div>

            {/* Post Box — always visible, Timeline style */}
            <div className="bg-exo-pure/40 border border-exo-mist-8 rounded-md p-4 md:p-5">
              <div className="flex gap-3 md:gap-4">
                <img
                  src={userAvatarUrl}
                  className="w-10 h-10 md:w-11 md:h-11 rounded-full border border-exo-mist-10 bg-black object-cover shrink-0"
                  alt={userNick}
                />
                <div className="flex-1 space-y-3">
                  <textarea
                    rows={2}
                    value={postContent}
                    onChange={e => setPostContent(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey && !e.isComposing) { e.preventDefault(); handlePost(); } }}
                    placeholder="Inscribe thought to timeline..."
                    className="w-full bg-transparent text-[13px] text-white outline-none resize-none placeholder:text-exo-muted/30 font-mono leading-relaxed"
                  />
                  <div className="flex justify-between items-center pt-3 border-t border-exo-mist-6">
                    <span className="text-[8px] text-exo-muted font-mono uppercase opacity-40 hidden md:block">Markdown & Links Supported</span>
                    <button
                      onClick={handlePost}
                      disabled={!postContent.trim() || isPosting}
                      className="px-5 py-1.5 bg-white text-exo-pure text-[10px] font-bold rounded-[2px] hover:bg-exo-accent transition-all shadow-brutalist active:scale-95 disabled:opacity-30 flex items-center gap-1.5 uppercase tracking-widest ml-auto"
                    >
                      {isPosting ? <Activity size={11} className="animate-spin" /> : <Send size={11} />}
                      Inscribe
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Full task section (desktop + mobile) */}
            {fullTaskSection}

            {/* Timeline posts for selected day */}
            {filteredTweets.length > 0 ? (
              <div className="space-y-0 divide-y divide-exo-mist-4">
                {filteredTweets.map(tweet => {
                  const { name, avatar, isUser } = getAuthorInfo(tweet);
                  const isReplyingHere = replyingToId === tweet.id;

                  const getFlattened = (repliesList, isDirect) => {
                    let flat = [];
                    if (!repliesList) return flat;
                    repliesList.forEach(r => {
                      flat.push({ ...r, isDirect });
                      if (r.replies?.length) flat = flat.concat(getFlattened(r.replies, false));
                    });
                    return flat;
                  };

                  const allReplies = getFlattened(tweet.replies, true);
                  allReplies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

                  return (
                    <div key={tweet.id} className="py-4 md:py-5">
                      <div className="flex gap-3 md:gap-4">
                        <div className="relative shrink-0">
                          <img
                            src={avatar}
                            className={`w-9 h-9 md:w-10 md:h-10 rounded-full border bg-black object-cover shadow-sm ${isUser ? 'border-exo-mist-20' : 'border-exo-accent/40'}`}
                            alt={name}
                          />
                          {!isUser && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-exo-accent rounded-full border-2 border-exo-bg shadow-glow-sharp" title="Neural Agent" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-baseline gap-2">
                            <span className={`text-[12px] font-bold uppercase tracking-tight font-display ${isUser ? 'text-white' : 'text-exo-accent'}`}>{name}</span>
                            <span className="text-[8px] text-exo-muted font-mono opacity-40">[{formatTime(tweet.created_at)}]</span>
                          </div>
                          <p className="text-[13px] text-exo-text/90 whitespace-pre-wrap leading-relaxed">{tweet.content}</p>
                          <button
                            onClick={() => { setReplyingToId(isReplyingHere ? null : tweet.id); setReplyContent(''); }}
                            className="mt-2 text-[9px] font-bold uppercase tracking-widest text-exo-muted/50 hover:text-exo-accent transition-colors flex items-center gap-1"
                          >
                            <CornerDownLeft size={11} /> Respond
                          </button>

                          {isReplyingHere && (
                            <div className="mt-3 flex gap-2 items-end animate-fade-in">
                              <textarea
                                rows={2}
                                value={replyContent}
                                onChange={e => setReplyContent(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey && !e.isComposing) { e.preventDefault(); handleReply(tweet.id); } }}
                                placeholder={`REPLY TO ${name.toUpperCase()}...`}
                                autoFocus
                                className="flex-1 bg-black/40 border border-exo-mist-10 rounded-[2px] px-3 py-2 text-xs text-white font-mono outline-none focus:border-exo-accent/40 resize-none transition-all placeholder:opacity-20"
                              />
                              <button
                                onClick={() => handleReply(tweet.id)}
                                disabled={!replyContent.trim() || isSubmittingReply}
                                className="px-3 py-2 bg-white text-exo-pure rounded-[2px] hover:bg-exo-accent transition-all shadow-brutalist active:scale-95 disabled:opacity-30 shrink-0"
                              >
                                <Send size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Replies */}
                      {allReplies.length > 0 && (
                        <div className="mt-3 ml-6 md:ml-8 pl-3 md:pl-6 border-l border-exo-mist-10 space-y-3 pt-1">
                          {allReplies.map(reply => {
                            const rInfo = getAuthorInfo(reply);
                            const isReplyReplyingHere = replyingToId === reply.id;
                            const prefix = reply.isDirect ? `${rInfo.name}:` : `${rInfo.name} replied:`;
                            return (
                              <div key={reply.id}>
                                <div className="text-[11px] md:text-[12px] leading-relaxed font-mono tracking-tight break-words">
                                  <span className={`text-[10px] md:text-[11px] font-bold tracking-tight font-display mr-1.5 ${rInfo.isUser ? 'text-white' : 'text-exo-accent'}`}>
                                    {prefix}
                                  </span>
                                  <span className="text-exo-text/70 whitespace-pre-wrap">{reply.content}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-[7px] text-exo-muted font-mono opacity-30">[{formatTime(reply.created_at)}]</span>
                                  <button
                                    onClick={() => { setReplyingToId(isReplyReplyingHere ? null : reply.id); setReplyContent(''); }}
                                    className="text-[8px] font-bold uppercase tracking-widest text-exo-muted/50 hover:text-exo-accent transition-colors flex items-center gap-1"
                                  >
                                    <CornerDownLeft size={10} /> Respond
                                  </button>
                                </div>
                                {isReplyReplyingHere && (
                                  <div className="mt-2 flex gap-2 items-end animate-fade-in">
                                    <textarea
                                      rows={2}
                                      value={replyContent}
                                      onChange={e => setReplyContent(e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey && !e.isComposing) { e.preventDefault(); handleReply(reply.id); } }}
                                      placeholder={`REPLY TO ${rInfo.name.toUpperCase()}...`}
                                      autoFocus
                                      className="flex-1 bg-black/40 border border-exo-mist-10 rounded-[2px] px-3 py-2 text-xs text-white font-mono outline-none focus:border-exo-accent/40 resize-none transition-all placeholder:opacity-20"
                                    />
                                    <button
                                      onClick={() => handleReply(reply.id)}
                                      disabled={!replyContent.trim() || isSubmittingReply}
                                      className="px-3 py-2 bg-white text-exo-pure rounded-[2px] hover:bg-exo-accent transition-all shadow-brutalist active:scale-95 disabled:opacity-30 shrink-0"
                                    >
                                      <Send size={12} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-exo-muted/20 font-mono text-[10px] uppercase tracking-widest italic">
                {selectedDate === today ? 'No log entries today' : 'No log entries for this date'}
              </div>
            )}

            {/* Bottom spacing */}
            <div className="pb-8" />
          </div>
        </div>
      </div>

      {/* Task Create/Edit Modal */}
      {modalEntry !== null && (
        <TaskCreateModal
          entry={modalEntry && Object.keys(modalEntry).length ? modalEntry : null}
          onClose={() => setModalEntry(null)}
          onSave={() => { setModalEntry(null); loadTasks(); }}
        />
      )}
    </div>
  );
}
