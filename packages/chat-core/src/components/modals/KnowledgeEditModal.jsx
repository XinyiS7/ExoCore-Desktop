import React, { useState, useEffect } from 'react';
import { BookOpen, Activity, Save } from 'lucide-react';
import { baseUrl, getCsrfToken } from 'exo-shared';
import { ModalShell, Button, FIELD_INPUT, FIELD_AREA } from '../ui';

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
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon={BookOpen}
      title="KNOWLEDGE FRAGMENT"
      subtitle={`Fragment ID: ${knowledgeId}`}
      maxW="md"
      z="z-[110]"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            {saveMsg && (
              <span className={`text-[0.625rem] font-mono font-bold tracking-widest ${saveMsg.includes('SUCCESS') ? 'tx-system-accent' : 'text-red-500'}`}>
                &gt;&gt; STATUS: {saveMsg}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose}>ABORT</Button>
            <Button variant="primary" onClick={handleSave} disabled={isSaving || isLoading}>
              {isSaving ? <Activity size={14} className="animate-spin" /> : <Save size={14} strokeWidth={1.5} />}
              {isSaving ? 'COMMITTING...' : 'COMMIT CHANGES'}
            </Button>
          </div>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex justify-center py-16 tx-system-mute font-mono text-[0.7rem] tracking-[0.3em] animate-pulse">Synchronizing fragment...</div>
      ) : data ? (
        <div className="space-y-8">
          <div className="space-y-3">
            <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Cluster Origin / 标题 <span className="opacity-40">(READ-ONLY)</span></label>
            <div className="text-sm tx-system-mute font-mono opacity-60 italic">{data.title}</div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Neural Abstract / 摘要</label>
              <span className="text-[0.55rem] font-mono tx-system-accent opacity-40">Vector Encoding Enabled</span>
            </div>
            <textarea
              rows={6}
              className={FIELD_AREA}
              value={abstract}
              onChange={e => setAbstract(e.target.value)}
              placeholder="INPUT SEMANTIC OVERVIEW..."
            />
          </div>

          <div className="space-y-3">
            <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Taxonomy Tags / 关键词 <span className="opacity-40">(COMMA SEPARATED)</span></label>
            <input
              className={FIELD_INPUT}
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              placeholder="EG: QUANTUM, ENTANGLEMENT, WAVE..."
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {keywords.split(',').map(k => k.trim()).filter(Boolean).map((kw, i) => (
                <span key={i} className="text-[0.6rem] font-bold px-2 py-0.5 rounded-md bg-exo-accent/5 border border-exo-accent/20 tx-system-accent opacity-70 tracking-tighter">{kw}</span>
              ))}
            </div>
          </div>

          <div className="px-4 py-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] space-y-2">
            <div className="flex items-center gap-2 mb-2 opacity-40">
              <Activity size={10} className="tx-system-normal" />
              <span className="text-[0.6rem] font-mono tx-system-normal tracking-widest">Retrieval Pipeline Specs</span>
            </div>
            <div className="space-y-1.5 opacity-60">
              <p className="text-[0.65rem] font-mono tx-system-mute leading-relaxed">
                <span className="tx-system-accent font-bold">L1_PROTOCOL</span>: Keyword-based taxonomy matching for high-speed recall.
              </p>
              <p className="text-[0.65rem] font-mono tx-system-mute leading-relaxed">
                <span className="tx-system-accent font-bold">L2_VECTOR</span>: Deep semantic analysis via neural embedding of Abstract field.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 tx-system-mute font-mono text-[0.7rem] tracking-widest text-red-500/50">Fragment Retrieval Failed</div>
      )}
    </ModalShell>
  );
};

export default KnowledgeEditModal;
