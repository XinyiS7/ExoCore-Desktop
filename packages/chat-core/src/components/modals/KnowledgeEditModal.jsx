import React, { useState, useEffect } from 'react';
import { BookOpen, X, Activity, Save } from 'lucide-react';
import { baseUrl, getCsrfToken } from '../../utils/api';

const KnowledgeEditModal = ({ isOpen, onClose, knowledgeId }) => {
  const [data, setData] = useState(null);
  const [abstract, setAbstract] = useState('');
  const [keywords, setKeywords] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !knowledgeId) return;
    setIsLoading(true);
    setSaveMsg('');
    setData(null);
    fetch(`${baseUrl}/api/memory/knowledge/${knowledgeId}/`, { credentials: 'include' })
      .then(res => res.json())
      .then(d => {
        setData(d);
        setAbstract(d.abstract || '');
        setKeywords(Array.isArray(d.keywords) ? d.keywords.join(', ') : (d.keywords || ''));
      })
      .catch(err => console.error('KF 加载失败', err))
      .finally(() => setIsLoading(false));
  }, [isOpen, knowledgeId]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch(`${baseUrl}/api/memory/knowledge/${knowledgeId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({
          abstract,
          keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
        }),
      });
      const json = await res.json();
      setSaveMsg(json.msg || (res.ok ? 'SUCCESS' : 'FAILURE'));
    } catch {
      setSaveMsg('NETWORK_ERROR');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-exo-pure border border-exo-mist-10 rounded-[2px] w-full max-w-xl flex flex-col max-h-[85vh] shadow-[0_0_60px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-exo-mist-10 bg-exo-pure/50">
          <div className="flex flex-col">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 font-mono uppercase tracking-[0.2em]">
              <BookOpen size={16} className="text-exo-accent" /> Knowledge Fragment / 知识片段
            </h2>
            <span className="text-[9px] text-exo-muted font-mono uppercase tracking-widest opacity-40 mt-1">Fragment ID: {knowledgeId}</span>
          </div>
          <button onClick={onClose} className="p-2 text-exo-muted hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1 scrollbar-hide">
          {isLoading ? (
            <div className="flex justify-center py-16 text-exo-muted font-mono text-[11px] uppercase tracking-[0.3em] animate-pulse">Synchronizing fragment...</div>
          ) : data ? (
            <>
              <div className="space-y-2">
                <label className="label-caps opacity-50">Cluster Origin / 标题 (READ-ONLY)</label>
                <div className="px-4 py-2.5 bg-black/30 border border-exo-mist-10 rounded-[2px] text-sm text-exo-muted font-mono opacity-60 italic">{data.title}</div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="label-caps opacity-50">Neural Abstract / 摘要</label>
                  <span className="text-[9px] font-mono text-exo-accent opacity-40 uppercase">Vector Encoding Enabled</span>
                </div>
                <textarea
                  rows={6}
                  className="w-full bg-black/60 border border-exo-mist-10 rounded-[2px] px-4 py-3 text-[13px] text-white font-mono focus:border-exo-accent/40 outline-none transition-all resize-none leading-relaxed"
                  value={abstract}
                  onChange={e => setAbstract(e.target.value)}
                  placeholder="INPUT SEMANTIC OVERVIEW..."
                />
              </div>

              <div className="space-y-3">
                <label className="label-caps opacity-50">Taxonomy Tags / 关键词 (COMMA SEPARATED)</label>
                <input
                  className="w-full bg-black/60 border border-exo-mist-10 rounded-[2px] px-4 py-2.5 text-sm text-white font-mono focus:border-exo-accent/40 outline-none transition-all uppercase placeholder:opacity-20"
                  value={keywords}
                  onChange={e => setKeywords(e.target.value)}
                  placeholder="EG: QUANTUM, ENTANGLEMENT, WAVE..."
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {keywords.split(',').map(k => k.trim()).filter(Boolean).map((kw, i) => (
                    <span key={i} className="text-[9px] font-bold px-2 py-0.5 rounded-[2px] bg-exo-accent/5 border border-exo-accent/20 text-exo-accent/70 uppercase tracking-tighter">{kw}</span>
                  ))}
                </div>
              </div>

              {/* Technical Metadata */}
              <div className="mt-4 p-4 bg-exo-pure border border-exo-mist-10 rounded-[2px] space-y-2">
                <div className="flex items-center gap-2 mb-2 opacity-30">
                  <Activity size={10} className="text-white" />
                  <span className="text-[9px] font-mono text-white uppercase tracking-widest">Retrieval Pipeline Specs</span>
                </div>
                <div className="space-y-1.5 opacity-60">
                  <p className="text-[10px] font-mono text-exo-muted leading-normal">
                    <span className="text-exo-accent font-bold">L1_PROTOCOL</span>: Keyword-based taxonomy matching for high-speed recall.
                  </p>
                  <p className="text-[10px] font-mono text-exo-muted leading-normal">
                    <span className="text-exo-accent font-bold">L2_VECTOR</span>: Deep semantic analysis via neural embedding of Abstract field.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-16 text-exo-muted font-mono text-[11px] uppercase tracking-widest text-red-500/50">Fragment Retrieval Failed</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-5 border-t border-exo-mist-10 bg-exo-pure/80 backdrop-blur-md">
          <div className="flex-1">
            {saveMsg && (
              <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${saveMsg.includes('SUCCESS') ? 'text-exo-accent' : 'text-red-500'}`}>
                &gt;&gt; STATUS: {saveMsg}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-6 py-2 rounded-[2px] text-[11px] font-bold uppercase tracking-widest text-exo-muted hover:text-white transition-colors">Abort</button>
            <button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="px-8 py-2 bg-white text-exo-pure rounded-[2px] text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-exo-accent transition-all shadow-brutalist active:scale-95 disabled:opacity-30 flex items-center gap-3"
            >
              {isSaving ? <Activity size={14} className="animate-spin" /> : <Save size={14} />}
              {isSaving ? 'COMMITTING...' : 'COMMIT CHANGES'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeEditModal;
