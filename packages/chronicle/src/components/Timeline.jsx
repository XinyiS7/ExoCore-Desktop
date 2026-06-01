import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Activity, CornerDownLeft } from 'lucide-react';
import { baseUrl, getCsrfToken } from '../utils/api';
import { getUserAvatarUrl, getAgentAvatarUrl } from '../utils/avatar';

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  if (/^\d{2}:\d{2}/.test(dateStr)) return dateStr.slice(0, 5);
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
};

const Timeline = ({ presets }) => {
  const [tweets, setTweets] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextBeforeId, setNextBeforeId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [userAvatarUrl, setUserAvatarUrl] = useState(() => getUserAvatarUrl());
  const bottomRef = useRef(null);

  const userNick = localStorage.getItem('exo_user_nick') || 'You';

  // Keep avatar in sync if updated from UserProfilePanel
  useEffect(() => {
    const handler = () => setUserAvatarUrl(getUserAvatarUrl());
    window.addEventListener('user-avatar-updated', handler);
    return () => window.removeEventListener('user-avatar-updated', handler);
  }, []);

  const getAuthorInfo = (tweet) => {
    if (tweet.author === 'user') {
      return { name: userNick, avatar: userAvatarUrl, isUser: true };
    }
    const presetId = parseInt(tweet.author.split(':')[1]);
    const preset = presets?.find(p => p.id === presetId);
    const name = preset?.name || 'G045';
    return { name, avatar: getAgentAvatarUrl(presetId, name), isUser: false };
  };

  const fetchTweets = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api/core/tweets/`, { credentials: 'include' });
      const data = await res.json();
      setTweets(data.tweets || []);
      setHasMore(data.has_more);
      setNextBeforeId(data.next_before_id);
    } catch (err) {
      console.error('Timeline fetch failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMoreTweets = useCallback(async () => {
    if (!nextBeforeId || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const res = await fetch(`${baseUrl}/api/core/tweets/?before_id=${nextBeforeId}`, { credentials: 'include' });
      const data = await res.json();
      setTweets(prev => [...prev, ...(data.tweets || [])]);
      setHasMore(data.has_more);
      setNextBeforeId(data.next_before_id);
    } catch (err) {
      console.error('Load more failed', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextBeforeId, isLoadingMore, hasMore]);

  useEffect(() => { fetchTweets(); }, []);

  useEffect(() => {
    const sentinel = bottomRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) fetchMoreTweets(); },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchMoreTweets]);

  const handlePost = async () => {
    const content = newPostContent.trim();
    if (!content || isPosting) return;
    setIsPosting(true);
    setNewPostContent('');
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
      } else {
        setNewPostContent(content);
      }
    } catch (err) {
      console.error('Post failed', err);
      setNewPostContent(content);
    } finally {
      setIsPosting(false);
    }
  };

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

  return (
    <div className="flex-1 flex flex-col h-full bg-exo-bg bg-noise overflow-hidden animate-fade-in">
      <div className="h-14 border-b border-exo-mist-10 flex items-center px-8 bg-exo-pure/40 backdrop-blur-md shrink-0">
        <div className="flex flex-col">
          <span className="font-bold text-[13px] text-white tracking-[0.2em] uppercase font-display">Neural Timeline</span>
          <span className="text-[9px] text-exo-muted font-mono uppercase tracking-widest opacity-40">System-wide Event Log</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-2xl mx-auto px-6 py-8">

          {/* Post Box */}
          <div className="composio-card p-6 mb-10 bg-exo-pure/40">
            <div className="flex gap-4">
              <img
                src={userAvatarUrl}
                className="w-12 h-12 rounded-full border border-exo-mist-10 bg-black object-cover shrink-0"
                alt={userNick}
              />
              <div className="flex-1 space-y-4">
                <textarea
                  rows={3}
                  value={newPostContent}
                  onChange={e => setNewPostContent(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey && !e.isComposing) { e.preventDefault(); handlePost(); } }}
                  placeholder="Inscribe thought to timeline..."
                  className="w-full bg-transparent text-[14px] text-white outline-none resize-none placeholder:opacity-20 font-mono leading-relaxed"
                />
                <div className="flex justify-between items-center pt-4 border-t border-exo-mist-6">
                  <span className="text-[9px] text-exo-muted font-mono uppercase tracking-tight opacity-40">Markdown & Links Supported</span>
                  <button
                    onClick={handlePost}
                    disabled={!newPostContent.trim() || isPosting}
                    className="px-6 py-2 bg-white text-exo-pure text-[11px] font-bold rounded-[2px] hover:bg-exo-accent transition-all shadow-brutalist active:scale-95 disabled:opacity-30 flex items-center gap-2 uppercase tracking-widest"
                  >
                    {isPosting ? <Activity size={12} className="animate-spin" /> : <Send size={12} />}
                    Inscribe
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-exo-muted font-mono text-[11px] uppercase tracking-[0.3em] gap-4">
              <Activity size={24} className="animate-spin text-exo-accent" /> Initializing Stream...
            </div>
          ) : tweets.length === 0 ? (
            <div className="text-center py-20 text-exo-muted/20 font-mono text-[11px] uppercase tracking-widest italic">No log entries found in current epoch</div>
          ) : (
            <div className="space-y-0 divide-y divide-exo-mist-4">
              {tweets.map(tweet => (
                <TweetCard
                  key={tweet.id}
                  tweet={tweet}
                  replyingToId={replyingToId}
                  replyContent={replyContent}
                  setReplyContent={setReplyContent}
                  setReplyingToId={setReplyingToId}
                  isSubmittingReply={isSubmittingReply}
                  handleReply={handleReply}
                  getAuthorInfo={getAuthorInfo}
                />
              ))}
            </div>
          )}

          <div ref={bottomRef} className="h-1" />

          {isLoadingMore && (
            <div className="flex items-center justify-center py-8 text-exo-muted font-mono text-[10px] uppercase tracking-widest gap-2">
              <Activity size={12} className="animate-spin" /> Fetching Archive...
            </div>
          )}

          {!hasMore && tweets.length > 0 && !isLoading && (
            <div className="flex items-center justify-center py-12 opacity-10">
              <div className="h-px w-20 bg-white" />
              <span className="mx-4 text-[9px] font-mono uppercase tracking-widest">End of Stream</span>
              <div className="h-px w-20 bg-white" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TweetCard = ({
  tweet,
  replyingToId,
  replyContent,
  setReplyContent,
  setReplyingToId,
  isSubmittingReply,
  handleReply,
  getAuthorInfo
}) => {
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
    <div className="py-6">
      <div className="flex gap-4">
        <div className="relative shrink-0">
          <img
            src={avatar}
            className={`w-10 h-10 rounded-full border bg-black object-cover shadow-sm ${isUser ? 'border-exo-mist-20' : 'border-exo-accent/40'}`}
            alt={name}
          />
          {!isUser && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-exo-accent rounded-full border-2 border-exo-bg shadow-glow-sharp" title="Neural Agent" />}
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-baseline gap-3">
            <span className={`text-[13px] font-bold uppercase tracking-tight font-display ${isUser ? 'text-white' : 'text-exo-accent'}`}>{name}</span>
            <span className="text-[9px] text-exo-muted font-mono uppercase tracking-tighter opacity-40">[{formatTime(tweet.created_at)}]</span>
          </div>
          <p className="text-[14px] text-white/80 leading-relaxed font-mono tracking-tight break-words whitespace-pre-wrap">{tweet.content}</p>
          <button
            onClick={() => { setReplyingToId(isReplyingHere ? null : tweet.id); setReplyContent(''); }}
            className="mt-3 text-[10px] font-bold uppercase tracking-widest text-exo-muted/50 hover:text-exo-accent transition-colors flex items-center gap-1.5"
          >
            <CornerDownLeft size={12} /> Respond
          </button>

          {isReplyingHere && (
            <div className="mt-4 flex gap-3 items-end animate-fade-in">
              <textarea
                rows={2}
                value={replyContent}
                onChange={e => setReplyContent(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey && !e.isComposing) { e.preventDefault(); handleReply(tweet.id); } }}
                placeholder={`REPLY TO ${name.toUpperCase()}...`}
                autoFocus
                className="flex-1 bg-black/40 border border-exo-mist-10 rounded-[2px] px-4 py-2.5 text-sm text-white font-mono outline-none focus:border-exo-accent/40 resize-none transition-all placeholder:opacity-20"
              />
              <button
                onClick={() => handleReply(tweet.id)}
                disabled={!replyContent.trim() || isSubmittingReply}
                className="px-4 py-2.5 bg-white text-exo-pure rounded-[2px] hover:bg-exo-accent transition-all shadow-brutalist active:scale-95 disabled:opacity-30 shrink-0"
              >
                <Send size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {allReplies.length > 0 && (
        <div className="ml-8 pl-6 border-l border-exo-mist-10 mt-3 space-y-4 pt-1">
          {allReplies.map(reply => {
            const replyAuthor = getAuthorInfo(reply);
            const isReplyReplyingHere = replyingToId === reply.id;
            const prefix = reply.isDirect ? `${replyAuthor.name}:` : `${replyAuthor.name} replied:`;
            return (
              <div key={reply.id} className="relative">
                <div className="text-[14px] leading-relaxed font-mono tracking-tight break-words">
                  <span className={`text-[13px] font-bold tracking-tight font-display mr-2 ${replyAuthor.isUser ? 'text-white' : 'text-exo-accent'}`}>
                    {prefix}
                  </span>
                  <span className="text-white/80 whitespace-pre-wrap">{reply.content}</span>
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[9px] text-exo-muted font-mono uppercase tracking-tighter opacity-40">
                    [{formatTime(reply.created_at)}]
                  </span>
                  <button
                    onClick={() => { setReplyingToId(isReplyReplyingHere ? null : reply.id); setReplyContent(''); }}
                    className="text-[10px] font-bold uppercase tracking-widest text-exo-muted/50 hover:text-exo-accent transition-colors flex items-center gap-1.5"
                  >
                    <CornerDownLeft size={10} /> Respond
                  </button>
                </div>
                {isReplyReplyingHere && (
                  <div className="mt-3 flex gap-3 items-end animate-fade-in">
                    <textarea
                      rows={2}
                      value={replyContent}
                      onChange={e => setReplyContent(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey && !e.isComposing) { e.preventDefault(); handleReply(reply.id); } }}
                      placeholder={`REPLY TO ${replyAuthor.name.toUpperCase()}...`}
                      autoFocus
                      className="flex-1 bg-black/40 border border-exo-mist-10 rounded-[2px] px-4 py-2.5 text-sm text-white font-mono outline-none focus:border-exo-accent/40 resize-none transition-all placeholder:opacity-20"
                    />
                    <button
                      onClick={() => handleReply(reply.id)}
                      disabled={!replyContent.trim() || isSubmittingReply}
                      className="px-4 py-2.5 bg-white text-exo-pure rounded-[2px] hover:bg-exo-accent transition-all shadow-brutalist active:scale-95 disabled:opacity-30 shrink-0"
                    >
                      <Send size={14} />
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
};

export default Timeline;
