import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Send, Activity, CornerDownLeft } from 'lucide-react';
import { tweetsApi, agentsApi } from 'exo-shared';
import { getAgentAvatar } from 'exo-shared';

const formatTime = (dateStr) => {
  if (!dateStr) return '';
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

export default function TimelineView() {
  const [tweets, setTweets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postContent, setPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [presets, setPresets] = useState([]);

  // ── Resolve user from presets (agent_type='user') ──
  const userPreset = useMemo(
    () => presets?.find(p => p.agent_type === 'user') || null,
    [presets]
  );
  const userId = userPreset?.id;
  const userNick = userPreset?.name || 'user';
  const userAvatarUrl = (() => {
    if (!userId) return '';
    return localStorage.getItem(`exo_agent_avatar_${userId}`) || '';
  })();

  // Fetch presets for agent name/avatar resolution
  useEffect(() => {
    agentsApi.listPresets().then(data => {
      setPresets(data.presets || data || []);
    }).catch(err => {
      console.error('Failed to fetch presets', err);
    });
  }, []);

  const fetchTweets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tweetsApi.listTweets();
      setTweets(data.tweets || []);
    } catch (err) {
      console.error('Timeline fetch failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTweets(); }, [fetchTweets]);

  const handlePost = async () => {
    const content = postContent.trim();
    if (!content || isPosting) return;
    setIsPosting(true);
    setPostContent('');
    try {
      const newTweet = await tweetsApi.createTweet({ content });
      setTweets(prev => [{ ...newTweet, replies: [] }, ...prev]);
    } catch (err) {
      console.error('Post failed', err);
      setPostContent(content);
    } finally {
      setIsPosting(false);
    }
  };

  const addReplyToTree = (tweetList, parentId, newReply) =>
    tweetList.map(tweet => {
      if (tweet.id === parentId)
        return { ...tweet, replies: [...(tweet.replies || []), { ...newReply, replies: [] }] };
      if (tweet.replies?.length)
        return { ...tweet, replies: tweet.replies.map(r =>
          r.id === parentId ? { ...r, replies: [...(r.replies || []), { ...newReply, replies: [] }] } : r) };
      return tweet;
    });

  const handleReply = async (parentId) => {
    const content = replyContent.trim();
    if (!content || isSubmittingReply) return;
    setIsSubmittingReply(true);
    setReplyContent('');
    setReplyingToId(null);
    try {
      const newReply = await tweetsApi.replyToTweet(parentId, { content });
      setTweets(prev => addReplyToTree(prev, parentId, newReply));
    } catch (err) {
      console.error('Reply failed', err);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // ── Unified author resolution: all authors are "agent:{preset_id}" ──
  const getAuthorInfo = (tweet) => {
    const raw = tweet.author || '';
    let presetId = null;

    if (raw.startsWith('agent:')) {
      presetId = parseInt(raw.split(':')[1], 10);
    }

    // Check if this is the user (agent_type='user' preset)
    if (presetId && presetId === userId) {
      return { name: userNick, avatar: userAvatarUrl, isUser: true };
    }

    // Agent author
    const preset = presets?.find(p => p.id === presetId);
    const name = preset?.name || (presetId ? `Agent #${presetId}` : raw || 'Unknown');
    return {
      name,
      avatar: getAgentAvatar(presetId, name),
      isUser: false,
    };
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-12 flex items-center px-5 border-b border-chron-border bg-chron-panel shrink-0">
        <h1 className="font-serif text-lg tracking-wide text-chron-accent">Feed</h1>
        <span className="ml-auto text-[9px] font-mono text-chron-muted/40 tracking-widest">
          {tweets.length} posts
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {/* Post Box */}
          <div className="bg-chron-panel/60 border border-chron-border rounded-lg p-4">
            <div className="flex gap-3">
              <img
                src={userAvatarUrl}
                className="w-10 h-10 rounded-full border border-chron-border bg-chron-bg object-cover shrink-0"
                alt={userNick}
              />
              <div className="flex-1 space-y-3">
                <textarea
                  rows={2}
                  value={postContent}
                  onChange={e => setPostContent(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handlePost(); } }}
                  placeholder="What's on your mind?"
                  className="w-full bg-transparent text-sm text-chron-text outline-none resize-none placeholder:text-chron-muted/30 leading-relaxed"
                />
                <div className="flex justify-between items-center pt-2 border-t border-chron-border">
                  <span className="text-[9px] text-chron-muted/30 font-mono hidden sm:block">Ctrl+Enter to post</span>
                  <button
                    onClick={handlePost}
                    disabled={!postContent.trim() || isPosting}
                    className="px-5 py-1.5 bg-chron-accent text-chron-bg text-[10px] font-bold rounded hover:brightness-110 transition-all active:scale-95 disabled:opacity-30 flex items-center gap-1.5 tracking-widest ml-auto"
                  >
                    {isPosting ? <Activity size={11} className="animate-spin" /> : <Send size={11} />}
                    Post
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          {loading ? (
            <div className="text-center py-16 text-chron-muted/40 font-mono text-xs">
              <Activity size={20} className="animate-spin mx-auto mb-3 text-chron-accent/50" />
              Loading feed...
            </div>
          ) : tweets.length === 0 ? (
            <div className="text-center py-16 text-chron-muted/20 font-serif italic">
              No posts yet. Be the first to write something.
            </div>
          ) : (
            <div className="divide-y divide-chron-border/50">
              {tweets.map(tweet => {
                const { name, avatar, isUser } = getAuthorInfo(tweet);
                const isReplyingHere = replyingToId === tweet.id;
                const allReplies = flattenReplies(tweet.replies);
                return (
                  <div key={tweet.id} className="py-5">
                    <div className="flex gap-3">
                      <img src={avatar} className={`w-9 h-9 rounded-full border bg-chron-bg object-cover shrink-0 ${isUser ? 'border-chron-border' : 'border-chron-accent/40'}`} alt={name} />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-baseline gap-2">
                          <span className={`text-xs font-bold ${isUser ? 'text-chron-text' : 'text-chron-accent'}`}>{name}</span>
                          <span className="text-[9px] text-chron-muted/40 font-mono">[{formatTime(tweet.created_at)}]</span>
                        </div>
                        <p className="text-sm text-chron-text/80 whitespace-pre-wrap leading-relaxed">{tweet.content}</p>
                        <button
                          onClick={() => { setReplyingToId(isReplyingHere ? null : tweet.id); setReplyContent(''); }}
                          className="mt-2 text-[9px] font-bold tracking-widest text-chron-muted/40 hover:text-chron-accent transition-colors flex items-center gap-1"
                        >
                          <CornerDownLeft size={11} /> Reply
                        </button>
                        {isReplyingHere && (
                          <div className="mt-2 flex gap-2 items-end">
                            <textarea rows={2} value={replyContent} onChange={e => setReplyContent(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleReply(tweet.id); } }}
                              placeholder={`Reply to ${name}...`} autoFocus
                              className="flex-1 bg-chron-accent/5 border border-chron-border rounded px-3 py-2 text-xs text-chron-text outline-none focus:border-chron-accent/40 resize-none placeholder:text-chron-muted/30"
                            />
                            <button onClick={() => handleReply(tweet.id)} disabled={!replyContent.trim() || isSubmittingReply}
                              className="px-3 py-2 bg-chron-accent text-chron-bg rounded hover:brightness-110 transition-all active:scale-95 disabled:opacity-30 shrink-0">
                              <Send size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Replies */}
                    {allReplies.length > 0 && (
                      <div className="mt-3 ml-8 pl-4 border-l border-chron-border/50 space-y-3">
                        {allReplies.map(reply => {
                          const ri = getAuthorInfo(reply);
                          return (
                            <div key={reply.id} className="text-xs leading-relaxed">
                              <span className={`font-bold mr-1.5 ${ri.isUser ? 'text-chron-text' : 'text-chron-accent'}`}>{ri.name}:</span>
                              <span className="text-chron-text/60 whitespace-pre-wrap">{reply.content}</span>
                              <span className="text-[8px] text-chron-muted/30 ml-2">[{formatTime(reply.created_at)}]</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="pb-4" />
        </div>
      </div>
    </div>
  );
}

function flattenReplies(repliesList) {
  let flat = [];
  if (!repliesList) return flat;
  repliesList.forEach(r => {
    flat.push(r);
    if (r.replies?.length) flat = flat.concat(flattenReplies(r.replies));
  });
  flat.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return flat;
}
