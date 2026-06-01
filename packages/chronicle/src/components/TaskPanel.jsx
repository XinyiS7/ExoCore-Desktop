import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Filter, X } from 'lucide-react';
import MiniCalendar from './MiniCalendar';
import TaskCreateModal from './TaskCreateModal';
import TaskRow from './TaskRow';
import {
  fetchEntries, completeEntry, updateEntry, deleteEntry,
  suspendEntry, resumeEntry, syncGcal, unsyncGcal, fetchCalendar,
} from '../../utils/tasksApi';

const todayIso = () => new Date().toISOString().slice(0, 10);

const TYPE_TABS = [
  { value: 'all',      label: '全部 / ALL' },
  { value: 'todo',     label: 'TODO' },
  { value: 'periodic', label: '周期 / CYCLE' },
  { value: 'goal',     label: '目标 / OBJECTIVE' },
];

const STATUS_OPTS = [
  { value: 'active',    label: '进行中 / ACTIVE' },
  { value: 'suspended', label: '已挂起 / SUSPENDED' },
];

function SectionHeader({ label }) {
  return (
    <div className="px-6 pt-6 pb-2 text-[10px] uppercase tracking-[0.2em] font-bold text-exo-muted/40 font-mono border-b border-exo-mist-6 mb-2">
      {label}
    </div>
  );
}

export default function TaskPanel({ openDestructor }) {
  const [entries,      setEntries]      = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [typeFilter,   setTypeFilter]   = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [expandedId,   setExpandedId]   = useState(null);
  const [modalEntry,   setModalEntry]   = useState(null); // null=closed, {}=create, entry=edit
  const [showSidebar,  setShowSidebar]  = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchEntries({ status: statusFilter }),
      fetchCalendar().catch(() => ({ events: [] })),
    ])
      .then(([entryData, calData]) => {
        setEntries(Array.isArray(entryData) ? entryData : []);
        setCalendarEvents(calData?.events || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (id) => setExpandedId(p => p === id ? null : id);

  // ── Filter ──────────────────────────────────────────────────
  const matchesDate = (e) => {
    if (e.entry_type === 'todo')     return e.due_date          === selectedDate;
    if (e.entry_type === 'periodic') return e.next_periodic_due === selectedDate;
    if (e.entry_type === 'goal') {
      if (!e.cycle_start) return false;
      return e.cycle_start <= selectedDate && (!e.cycle_due || selectedDate <= e.cycle_due);
    }
    return false;
  };

  const matchesType = (e) => typeFilter === 'all' || e.entry_type === typeFilter;

  const filtered = entries.filter(e => matchesDate(e) && matchesType(e));

  const pinned   = filtered.filter(e => e.is_pinned);
  const todos    = filtered.filter(e => !e.is_pinned && e.entry_type === 'todo');
  const periodic = filtered.filter(e => !e.is_pinned && e.entry_type === 'periodic');
  const goals    = filtered.filter(e => !e.is_pinned && e.entry_type === 'goal');

  // ── Mutations ────────────────────────────────────────────────
  const mutate = (fn) => fn().then(load).catch(console.error);

  const handleComplete   = (id) => mutate(() => completeEntry(id));
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

  return (
    <div className="flex h-full overflow-hidden relative bg-exo-bg">
      {/* Sidebar Overlay for Mobile */}
      <div 
        className={`lg:hidden fixed inset-0 bg-exo-bg/80 backdrop-blur-md z-[90] transition-opacity duration-300 ${showSidebar ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setShowSidebar(false)}
      />

      {/* ── Left sidebar ── */}
      <div className={`
        fixed lg:relative inset-y-0 left-0 w-[260px] lg:w-[220px] bg-exo-pure border-r border-exo-mist-10 flex flex-col z-[100] transition-transform duration-300 ease-out
        ${showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center justify-between px-4 h-14 border-b border-exo-mist-10 lg:hidden">
          <span className="text-[10px] font-bold text-exo-accent tracking-[0.2em] uppercase font-mono">CHRONOS_FLTR</span>
          <button onClick={() => setShowSidebar(false)} className="p-1 text-exo-muted hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <MiniCalendar
            selectedDate={selectedDate}
            onSelectDate={(date) => { setSelectedDate(date); if(window.innerWidth < 1024) setShowSidebar(false); }}
            entries={entries}
            calendarEvents={calendarEvents}
          />

          {/* Type filter */}
          <div className="px-4 py-6 border-t border-exo-mist-6">
            <div className="label-caps opacity-30 mb-4">Neural Type</div>
            <div className="space-y-1">
              {TYPE_TABS.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTypeFilter(t.value)}
                  className={`
                    group flex items-center gap-3 w-full text-[11px] py-2 px-3 rounded-[2px] transition-all text-left font-mono uppercase tracking-tight
                    ${typeFilter === t.value
                      ? 'text-exo-accent bg-exo-accent/5 border-l-2 border-exo-accent'
                      : 'text-exo-muted/60 hover:text-white hover:bg-white/5 border-l-2 border-transparent'}
                  `}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status filter */}
          <div className="px-4 py-6 border-t border-exo-mist-6">
            <div className="label-caps opacity-30 mb-4">Link Status</div>
            <div className="space-y-1">
              {STATUS_OPTS.map(s => (
                <button
                  key={s.value}
                  onClick={() => setStatusFilter(s.value)}
                  className={`
                    group flex items-center gap-3 w-full text-[11px] py-2 px-3 rounded-[2px] transition-all text-left font-mono uppercase tracking-tight
                    ${statusFilter === s.value
                      ? 'text-exo-accent bg-exo-accent/5 border-l-2 border-exo-accent'
                      : 'text-exo-muted/60 hover:text-white hover:bg-white/5 border-l-2 border-transparent'}
                  `}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right pane ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-noise">
        {/* Header */}
        <div className="flex items-center justify-between px-4 lg:px-8 h-14 border-b border-exo-mist-10 flex-shrink-0 bg-exo-pure/40 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowSidebar(true)}
              className="lg:hidden p-2 -ml-2 text-exo-muted hover:text-exo-accent transition-colors"
            >
              <Filter size={18} />
            </button>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-[0.3em] text-exo-accent font-bold font-mono">Chronos / {selectedDate}</span>
              <span className="text-[8px] uppercase tracking-[0.1em] text-exo-muted font-mono opacity-40">Operational Pipeline Monitor</span>
            </div>
          </div>
          
          <button
            onClick={() => setModalEntry({})}
            className="flex items-center gap-2 px-4 py-1.5 bg-white text-exo-pure rounded-[2px] text-[11px] font-bold uppercase tracking-widest hover:bg-exo-accent transition-all shadow-brutalist active:scale-95"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Initialize Task</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto px-4 lg:px-8">
          {loading && (
            <div className="flex items-center justify-center h-48 text-[11px] text-exo-muted font-mono uppercase tracking-[0.3em] animate-pulse">
              Synchronizing with Chronos Core...
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 opacity-20">
              <span className="text-[11px] text-white font-mono uppercase tracking-[0.3em]">No Active Tasks</span>
              <span className="text-[9px] text-white font-mono uppercase tracking-[0.1em] mt-2">Cycle: {selectedDate}</span>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="pb-20 lg:pb-12 pt-4">
              {/* 📌 Pinned */}
              {pinned.length > 0 && (
                <div className="mb-8 border border-exo-accent/30 bg-exo-accent/[0.03] rounded-[4px] overflow-hidden shadow-[0_0_30px_rgba(212,175,55,0.05)]">
                  <div className="px-4 py-2 bg-exo-accent/10 border-b border-exo-accent/20 text-[10px] uppercase tracking-[0.2em] font-bold text-exo-accent font-mono flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-exo-accent rounded-full animate-pulse-glow" />
                    Escalated Priority
                  </div>
                  {pinned.map(e => (
                    <TaskRow
                      key={e.id}
                      entry={e}
                      isExpanded={expandedId === e.id}
                      onToggleExpand={toggleExpand}
                      onEdit={handleEdit}
                      onComplete={handleComplete}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      onSuspend={handleSuspend}
                      onResume={handleResume}
                      onGcalSync={handleGcalSync}
                      onGcalUnsync={handleGcalUnsync}
                    />
                  ))}
                </div>
              )}

              {/* Todo */}
              {todos.length > 0 && (
                <div className="mb-6">
                  <SectionHeader label="Immediate Objectives / TODO" />
                  <div className="space-y-1">
                    {todos.map(e => (
                      <TaskRow
                        key={e.id}
                        entry={e}
                        isExpanded={expandedId === e.id}
                        onToggleExpand={toggleExpand}
                        onEdit={handleEdit}
                        onComplete={handleComplete}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                        onSuspend={handleSuspend}
                        onResume={handleResume}
                        onGcalSync={handleGcalSync}
                        onGcalUnsync={handleGcalUnsync}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 周期任务 */}
              {periodic.length > 0 && (
                <div className="mb-6">
                  <SectionHeader label="Recursive Patterns / CYCLE" />
                  <div className="space-y-1">
                    {periodic.map(e => (
                      <TaskRow
                        key={e.id}
                        entry={e}
                        isExpanded={expandedId === e.id}
                        onToggleExpand={toggleExpand}
                        onEdit={handleEdit}
                        onComplete={handleComplete}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                        onSuspend={handleSuspend}
                        onResume={handleResume}
                        onGcalSync={handleGcalSync}
                        onGcalUnsync={handleGcalUnsync}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 目标 */}
              {goals.length > 0 && (
                <div className="mb-6">
                  <SectionHeader label="Long-Term Projections / OBJECTIVE" />
                  <div className="space-y-1">
                    {goals.map(e => (
                      <TaskRow
                        key={e.id}
                        entry={e}
                        isExpanded={expandedId === e.id}
                        onToggleExpand={toggleExpand}
                        onEdit={handleEdit}
                        onComplete={handleComplete}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                        onSuspend={handleSuspend}
                        onResume={handleResume}
                        onGcalSync={handleGcalSync}
                        onGcalUnsync={handleGcalUnsync}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalEntry !== null && (
        <TaskCreateModal
          entry={Object.keys(modalEntry).length ? modalEntry : null}
          onClose={() => setModalEntry(null)}
          onSave={() => { setModalEntry(null); load(); }}
        />
      )}
    </div>
  );
}
