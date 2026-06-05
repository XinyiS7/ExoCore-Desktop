import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Globe, Heart, Filter } from 'lucide-react';
import ChronicleEntryRow from '../components/ChronicleEntryRow';
import ChronicleEntryModal from '../components/ChronicleEntryModal';
import { chronicleApi, agentsApi } from 'exo-shared';

const SCOPES = [
  { value: 'all', label: '全部', icon: null },
  { value: '表', label: '表 · 外部', icon: Globe },
  { value: '里', label: '里 · 内部', icon: Heart },
];

export default function ChronicleView({ presets: presetsProp = [] }) {
  const [presets, setPresets] = useState(presetsProp);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scopeFilter, setScopeFilter] = useState('all');
  const [modalEntry, setModalEntry] = useState(null); // null=closed, {}=create, entry=edit

  const load = useCallback(() => {
    setLoading(true);
    chronicleApi.listChronicleEntries()
      .then(data => setEntries(Array.isArray(data) ? data : []))
      .catch(err => { console.error('Chronicle load failed', err); setEntries([]); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Fetch presets for the modal dropdown (if not provided via props)
  useEffect(() => {
    if (presetsProp.length > 0) return;
    agentsApi.listPresets().then(data => {
      setPresets(data.presets || data || []);
    }).catch(err => {
      console.error('Failed to fetch presets for ChronicleView', err);
    });
  }, [presetsProp]);

  const handleEdit = (entry) => setModalEntry(entry);
  const handleDelete = (id) => {
    if (!confirm('确定要删除这条大事记吗？')) return;
    chronicleApi.deleteChronicleEntry(id)
      .then(() => setEntries(prev => prev.filter(e => e.id !== id)))
      .catch(console.error);
  };

  const filtered = scopeFilter === 'all'
    ? entries
    : entries.filter(e => e.scope === scopeFilter);

  // Group by year
  const grouped = filtered.reduce((acc, e) => {
    const year = e.event_time?.slice(0, 4) || '未知';
    if (!acc[year]) acc[year] = [];
    acc[year].push(e);
    return acc;
  }, {});

  const sortedYears = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-12 flex items-center px-5 border-b border-chron-border bg-chron-panel shrink-0">
        <h1 className="font-serif text-lg tracking-wide text-chron-accent">Chronicle</h1>
        <span className="ml-auto text-[9px] font-mono text-chron-muted/40 uppercase tracking-widest">
          {filtered.length} 条大事记
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {/* Filters + Create */}
          <div className="flex items-center justify-between gap-3">
            {/* Scope filter pills */}
            <div className="flex items-center gap-1.5">
              <Filter size={12} className="text-chron-muted/30" />
              {SCOPES.map(s => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.value}
                    onClick={() => setScopeFilter(s.value)}
                    className={`flex items-center gap-1 px-2.5 py-1 text-[10px] rounded-full border transition-all font-mono ${
                      scopeFilter === s.value
                        ? 'border-chron-accent/40 bg-chron-accent/10 text-chron-accent'
                        : 'border-chron-border/50 text-chron-muted/50 hover:border-chron-border hover:text-chron-muted'
                    }`}
                  >
                    {Icon && <Icon size={10} />}
                    {s.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setModalEntry({})}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-chron-accent text-chron-bg text-[10px] font-bold uppercase tracking-widest rounded hover:brightness-110 transition-all active:scale-95"
            >
              <Plus size={12} />
              新建
            </button>
          </div>

          {/* Entries by Year */}
          {loading ? (
            <div className="text-center py-16 text-chron-muted/40 font-mono text-xs">
              加载中...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-chron-muted/20 font-serif italic">
              还没有大事记。<br />
              <button onClick={() => setModalEntry({})} className="text-chron-accent/50 hover:text-chron-accent mt-2 inline-block text-xs">
                + 记录第一个里程碑
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {sortedYears.map(year => (
                <div key={year}>
                  <div className="sticky top-0 z-10 flex items-center gap-3 mb-3 px-1">
                    <span className="text-2xl font-serif text-chron-accent/60 tracking-wide">{year}</span>
                    <div className="flex-1 h-px bg-chron-border/50" />
                    <span className="text-[9px] font-mono text-chron-muted/30">{grouped[year].length} 条</span>
                  </div>
                  <div className="bg-chron-panel/40 border border-chron-border/50 rounded-lg overflow-hidden">
                    {grouped[year]
                      .sort((a, b) => b.event_time?.localeCompare(a.event_time || '') || 0)
                      .map(entry => (
                        <ChronicleEntryRow
                          key={entry.id}
                          entry={entry}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pb-4" />
        </div>
      </div>

      {/* Create/Edit Modal */}
      {modalEntry !== null && (
        <ChronicleEntryModal
          entry={modalEntry && Object.keys(modalEntry).length ? modalEntry : null}
          presets={presets}
          onClose={() => setModalEntry(null)}
          onSave={() => { setModalEntry(null); load(); }}
        />
      )}
    </div>
  );
}
