import React, { useState, useEffect } from 'react';
import { ArrowLeft, Activity, Save, History, Tag, Clock, Zap, BookOpen, AlertCircle } from 'lucide-react';
import { baseUrl, getCsrfToken } from '../../utils/api';

const ProposalEditPanel = ({ proposal, conversationName, conversationId, onBack }) => {
  const [topicLabel, setTopicLabel] = useState(proposal?.topic || '');
  const [summary, setSummary] = useState(proposal?.summary || '');
  const [keywords, setKeywords] = useState(
    Array.isArray(proposal?.keywords) ? proposal.keywords.join(', ') : (proposal?.keywords || '')
  );
  const [unresolved, setUnresolved] = useState(proposal?.unresolved ?? false);
  const [readonlyMeta, setReadonlyMeta] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveMsgType, setSaveMsgType] = useState('ok'); // 'ok' | 'err'

  const [originalMessages, setOriginalMessages] = useState(null);
  const [isLoadingMsgs, setIsLoadingMsgs] = useState(false);

  // Load full detail for editable + readonly meta
  useEffect(() => {
    if (!proposal?.id) return;
    setIsLoadingDetail(true);
    fetch(`${baseUrl}/api/memory/history_chunks/${proposal.id}/`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.topic_label !== undefined) setTopicLabel(data.topic_label);
        if (data.summary !== undefined) setSummary(data.summary);
        if (data.keywords) setKeywords(Array.isArray(data.keywords) ? data.keywords.join(', ') : data.keywords);
        if (data.unresolved !== undefined) setUnresolved(data.unresolved);
        setReadonlyMeta({
          time_ref: data.time_ref || null,
          emotion: data.emotion || null,
          entities: Array.isArray(data.entities) ? data.entities : [],
          importance: data.importance ?? null,
        });
      })
      .catch(err => console.error('history_chunk 详情加载失败', err))
      .finally(() => setIsLoadingDetail(false));
  }, [proposal?.id]);

  // Load original chat messages for the trace window
  useEffect(() => {
    if (!proposal || conversationId == null) return;
    setIsLoadingMsgs(true);
    fetch(`${baseUrl}/api/agents/chat/${conversationId}/`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        const msgs = Array.isArray(data) ? data : (data.messages || data.data || []);
        const start = proposal.start_index ?? 0;
        const end = proposal.end_index ?? msgs.length - 1;
        setOriginalMessages(msgs.slice(start, end + 1));
      })
      .catch(err => console.error('原始消息加载失败', err))
      .finally(() => setIsLoadingMsgs(false));
  }, [proposal, conversationId]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch(`${baseUrl}/api/memory/history_chunks/${proposal.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({
          topic_label: topicLabel,
          summary,
          keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
          unresolved,
        }),
      });
      const json = await res.json();
      setSaveMsgType(res.ok ? 'ok' : 'err');
      setSaveMsg(json.msg || (res.ok ? '已保存。' : 'SAVE_FAILED'));
    } catch {
      setSaveMsgType('err');
      setSaveMsg('NETWORK_ERROR');
    } finally {
      setIsSaving(false);
    }
  };

  const keywordList = keywords.split(',').map(k => k.trim()).filter(Boolean);

  const importancePct = readonlyMeta?.importance != null
    ? Math.round(readonlyMeta.importance * 100)
    : null;

  return (
    <div className="flex flex-col h-full bg-exo-bg bg-noise animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-4 px-6 h-16 border-b border-exo-mist-10 bg-exo-pure/40 backdrop-blur-md shrink-0">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-exo-muted hover:text-white transition-all hover:bg-white/5 rounded-[2px]"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-exo-accent shrink-0" />
            <span className="text-[13px] font-bold text-white uppercase tracking-[0.2em] font-display">
              History Chunk / 记忆片段
            </span>
          </div>
          <span className="text-[9px] text-exo-muted font-mono uppercase tracking-widest opacity-40 mt-0.5 truncate">
            {conversationName}{proposal?.topic ? ` · ${proposal.topic}` : ''}
            {' · '}Index {proposal?.start_index ?? '?'} – {proposal?.end_index ?? '?'}
          </span>
        </div>
        {isLoadingDetail && (
          <Activity size={12} className="animate-spin text-exo-accent ml-auto shrink-0" />
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">

        {/* ── LEFT column (mobile: top sections) ── */}
        <div className="flex flex-col shrink-0 md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-exo-mist-10 overflow-y-auto scrollbar-hide">

          {/* ① Editable Meta */}
          <div className="p-5 border-b border-exo-mist-6 space-y-5">
            <div className="flex items-center gap-2 opacity-40 mb-1">
              <Tag size={12} />
              <span className="text-[10px] font-bold text-white uppercase tracking-[0.2em] font-mono">
                Editable Meta
              </span>
            </div>

            {/* topic_label */}
            <div className="space-y-2">
              <label className="label-caps opacity-50">Topic Label / 话题标签</label>
              <input
                className="w-full bg-black/60 border border-exo-mist-10 rounded-[2px] px-4 py-2.5 text-sm text-white font-mono focus:border-exo-accent/40 outline-none transition-all placeholder:opacity-20"
                value={topicLabel}
                onChange={e => setTopicLabel(e.target.value)}
                placeholder="TOPIC LABEL..."
              />
            </div>

            {/* summary / content */}
            <div className="space-y-2">
              <label className="label-caps opacity-50">Content / 内容摘要</label>
              <textarea
                className="w-full bg-black/60 border border-exo-mist-10 rounded-[2px] px-4 py-3 text-sm text-white font-mono focus:border-exo-accent/40 outline-none transition-all placeholder:opacity-20 resize-y min-h-[120px]"
                value={summary}
                onChange={e => setSummary(e.target.value)}
                placeholder="DETAILED SUMMARY..."
              />
            </div>

            {/* keywords */}
            <div className="space-y-2">
              <label className="label-caps opacity-50">Keywords / 关键词 (COMMA SEPARATED)</label>
              <input
                className="w-full bg-black/60 border border-exo-mist-10 rounded-[2px] px-4 py-2 text-sm text-white font-mono focus:border-exo-accent/40 outline-none transition-all placeholder:opacity-20 uppercase"
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
                placeholder="KEYWORD_A, KEYWORD_B..."
              />
              {keywordList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {keywordList.map((kw, i) => (
                    <span
                      key={i}
                      className="text-[9px] font-bold px-2 py-0.5 rounded-[2px] bg-exo-accent/5 border border-exo-accent/20 text-exo-accent/70 uppercase tracking-tighter"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* unresolved toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={13} className={unresolved ? 'text-exo-accent' : 'text-exo-muted opacity-40'} />
                <span className="text-[11px] font-mono text-exo-muted uppercase tracking-wider">
                  Unresolved / 未竟事宜
                </span>
              </div>
              <button
                onClick={() => setUnresolved(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                  unresolved ? 'bg-exo-accent/40' : 'bg-white/10'
                }`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 ${
                  unresolved
                    ? 'left-[calc(100%-18px)] bg-exo-accent shadow-[0_0_6px_rgba(212,175,55,0.6)]'
                    : 'left-0.5 bg-exo-muted'
                }`} />
              </button>
            </div>

            {/* Submit row */}
            <div className="flex items-center justify-between pt-2 border-t border-exo-mist-6">
              <div className="flex-1 mr-4">
                {saveMsg && (
                  <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${
                    saveMsgType === 'ok' ? 'text-exo-accent' : 'text-red-400'
                  }`}>
                    &gt;&gt; {saveMsg}
                  </span>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2 bg-white text-exo-pure rounded-[2px] text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-exo-accent transition-all shadow-brutalist active:scale-95 disabled:opacity-30 flex items-center gap-2 shrink-0"
              >
                {isSaving ? <Activity size={13} className="animate-spin" /> : <Save size={13} />}
                {isSaving ? 'Committing...' : 'Commit'}
              </button>
            </div>
          </div>

          {/* ② Read-only Meta */}
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 opacity-40 mb-1">
              <Zap size={12} />
              <span className="text-[10px] font-bold text-white uppercase tracking-[0.2em] font-mono">
                Neural Context
              </span>
            </div>

            {readonlyMeta ? (
              <div className="space-y-2">
                {/* time_ref */}
                {readonlyMeta.time_ref && (
                  <div className="flex items-start gap-3 px-3 py-2.5 bg-black/30 border border-exo-mist-6 rounded-[2px]">
                    <Clock size={11} className="text-exo-muted shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[8px] font-bold uppercase tracking-widest text-exo-muted font-mono mb-0.5">Time Ref</div>
                      <div className="text-[11px] text-exo-text font-mono">{readonlyMeta.time_ref}</div>
                    </div>
                  </div>
                )}

                {/* emotion */}
                {readonlyMeta.emotion && (
                  <div className="flex items-start gap-3 px-3 py-2.5 bg-black/30 border border-exo-mist-6 rounded-[2px]">
                    <span className="text-[11px] shrink-0 mt-0.5">◈</span>
                    <div>
                      <div className="text-[8px] font-bold uppercase tracking-widest text-exo-muted font-mono mb-0.5">Emotion</div>
                      <div className="text-[11px] text-exo-text font-mono">{readonlyMeta.emotion}</div>
                    </div>
                  </div>
                )}

                {/* entities */}
                {readonlyMeta.entities.length > 0 && (
                  <div className="px-3 py-2.5 bg-black/30 border border-exo-mist-6 rounded-[2px]">
                    <div className="text-[8px] font-bold uppercase tracking-widest text-exo-muted font-mono mb-1.5">Entities</div>
                    <div className="flex flex-wrap gap-1.5">
                      {readonlyMeta.entities.map((e, i) => (
                        <span key={i} className="text-[9px] font-mono px-2 py-0.5 rounded-[2px] bg-white/5 border border-exo-mist-10 text-exo-text/70">
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* importance */}
                {importancePct !== null && (
                  <div className="px-3 py-2.5 bg-black/30 border border-exo-mist-6 rounded-[2px]">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-[8px] font-bold uppercase tracking-widest text-exo-muted font-mono">Importance</div>
                      <span className="text-[10px] font-mono font-bold text-exo-accent">{importancePct}%</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-1 bg-exo-accent rounded-full"
                        style={{ width: `${importancePct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="px-3 py-6 text-center opacity-20">
                <span className="text-[10px] font-mono uppercase tracking-widest">
                  {isLoadingDetail ? 'Loading...' : 'No context data'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT column: chat trace (mobile: bottom) ── */}
        <div className="flex-1 min-w-0 overflow-y-auto p-5 bg-black/20 scrollbar-hide">
          <div className="flex items-center gap-2 mb-5 opacity-40">
            <History size={13} />
            <h3 className="text-[10px] font-bold text-white uppercase tracking-[0.2em] font-mono">
              Neural Trace Context ({proposal?.start_index ?? '?'} – {proposal?.end_index ?? '?'})
            </h3>
          </div>

          {isLoadingMsgs ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-30">
              <Activity size={22} className="animate-spin mb-4" />
              <span className="text-[10px] font-mono uppercase tracking-widest">Reconstructing Stream...</span>
            </div>
          ) : originalMessages?.length ? (
            <div className="space-y-5">
              {originalMessages.map((msg, i) => (
                <div key={i} className={`flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1.5 px-1 opacity-40">
                    <span className="text-[9px] font-bold uppercase font-mono tracking-tighter">{msg.role}</span>
                    <div className="w-1 h-1 rounded-full bg-white" />
                  </div>
                  <div className={`
                    max-w-[92%] px-4 py-3 rounded-[2px] text-[12px] font-mono tracking-tight leading-relaxed border
                    ${msg.role === 'user'
                      ? 'bg-white text-exo-pure border-white shadow-brutalist'
                      : 'bg-exo-pure text-white/80 border-exo-mist-10'
                    }
                  `}>
                    {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-20 opacity-20 italic">
              <span className="text-[10px] font-mono uppercase tracking-widest">Trace data unavailable</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ProposalEditPanel;
