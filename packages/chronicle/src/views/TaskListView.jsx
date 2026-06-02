import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, ChevronLeft, Check } from 'lucide-react';
import MiniCalendar from '../components/MiniCalendar';
import TaskCreateModal from '../components/TaskCreateModal';
import TaskRow from '../components/TaskRow';
import { tasksApi } from 'exo-shared';

const SectionHeader = ({ label }) => (
  <div className="px-4 pt-4 pb-2 text-[9px] uppercase tracking-[0.2em] font-bold text-chron-muted/40 font-mono border-b border-chron-border/50 mb-1">
    {label}
  </div>
);

export default function TaskListView() {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [taskEntries, setTaskEntries] = useState([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [modalEntry, setModalEntry] = useState(null);
  const [completingId, setCompletingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const loadTasks = useCallback(() => {
    tasksApi.listTasks({ status: 'active' })
      .then(setTaskEntries)
      .catch(() => setTaskEntries([]));
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const mutate = (fn) => fn().then(loadTasks).catch(console.error);

  const handleComplete = async (id) => {
    if (completingId === id) return;
    setCompletingId(id);
    try { await tasksApi.completeTask(id); await loadTasks(); }
    catch (err) { console.error('Complete failed', err); }
    finally { setCompletingId(null); }
  };

  const handleUpdate     = (id, patch) => mutate(() => tasksApi.updateTask(id, patch));
  const handleSuspend    = (id) => mutate(() => tasksApi.suspendTask(id));
  const handleResume     = (id) => mutate(() => tasksApi.resumeTask(id));
  const handleGcalSync   = (id) => mutate(() => tasksApi.syncTaskToGCal(id));
  const handleGcalUnsync = (id) => mutate(() => tasksApi.unlinkTaskGCal(id));
  const handleEdit       = (entry) => setModalEntry(entry);
  const handleDelete     = (id) => {
    if (confirm('Archive this task?')) mutate(() => tasksApi.deleteTask(id));
  };
  const toggleExpand = (id) => setExpandedId(p => p === id ? null : id);

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

  const pinned   = filteredTasks.filter(e => e.is_pinned);
  const todos    = filteredTasks.filter(e => !e.is_pinned && e.entry_type === 'todo');
  const periodic = filteredTasks.filter(e => !e.is_pinned && e.entry_type === 'periodic');
  const goals    = filteredTasks.filter(e => !e.is_pinned && e.entry_type === 'goal');

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

  // Calendar sidebar panel (shared between desktop and mobile)
  const calendarPanel = (
    <div className="flex flex-col h-full">
      <div className="p-3">
        <MiniCalendar
          selectedDate={selectedDate}
          onSelectDate={(d) => { setSelectedDate(d); setShowCalendar(false); }}
          entries={taskEntries}
        />
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-chron-muted">
            {selectedDate}
          </p>
          <button
            onClick={() => setModalEntry({})}
            className="p-0.5 rounded text-chron-muted/30 hover:text-chron-accent transition-all"
            title="New Task"
          >
            <Plus size={12} strokeWidth={1.5} />
          </button>
        </div>
        {filteredTasks.length === 0 ? (
          <p className="text-[10px] text-chron-muted/40 italic">No tasks</p>
        ) : (
          <div className="space-y-1">
            {filteredTasks.map(task => (
              <div key={task.id}
                className={`px-2.5 py-1.5 bg-chron-panel border border-chron-border/50 rounded text-xs flex items-center gap-1.5 cursor-pointer hover:border-chron-accent/20 transition-colors ${
                  task.status === 'suspended' ? 'opacity-40 line-through' : ''
                }`}
              >
                <span className="text-chron-accent shrink-0">{task.entry_type === 'todo' ? '○' : task.entry_type === 'periodic' ? '↻' : '◎'}</span>
                <span className="text-chron-text/70 truncate flex-1">{task.title}</span>
                {task.status !== 'suspended' && (
                  <button onClick={(e) => { e.stopPropagation(); handleComplete(task.id); }}
                    disabled={completingId === task.id}
                    className="shrink-0 p-0.5 rounded text-chron-muted/20 hover:text-chron-accent transition-all opacity-0 group-hover/task:opacity-100"
                    title="Complete">
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
    <div className="flex-1 h-full flex overflow-hidden">
      {/* Desktop: fixed left sidebar */}
      <div className="hidden md:flex w-60 flex-shrink-0 border-r border-chron-border/50 flex-col bg-chron-panel/30">
        {calendarPanel}
      </div>

      {/* Mobile: slide-over calendar */}
      {showCalendar && (
        <div className="md:hidden fixed inset-0 z-[130]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCalendar(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-chron-panel border-r border-chron-border shadow-2xl z-[140]">
            <div className="flex items-center justify-between px-3 py-2 border-b border-chron-border">
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-chron-muted">Calendar</span>
              <button onClick={() => setShowCalendar(false)} className="p-1 text-chron-muted hover:text-chron-text">
                <X size={14} />
              </button>
            </div>
            {calendarPanel}
          </div>
        </div>
      )}

      {/* Main task area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Header */}
        <header className="h-12 flex items-center px-5 border-b border-chron-border bg-chron-panel shrink-0">
          <h1 className="font-serif text-lg tracking-wide text-chron-accent">Tasks</h1>
          <div className="flex items-center gap-2 ml-auto">
            {/* Mobile calendar toggle */}
            <button onClick={() => setShowCalendar(true)} className="md:hidden p-1 text-chron-muted hover:text-chron-accent">
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <span className="text-[9px] font-mono text-chron-muted/40 hidden sm:block">{selectedDate}</span>
            <button
              onClick={() => setModalEntry({})}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-chron-muted/50 hover:text-chron-accent hover:bg-chron-accent/10 rounded transition-all"
            >
              <Plus size={12} />
              New
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
            {/* Mobile date indicator */}
            <div className="md:hidden flex items-center gap-2 text-xs text-chron-muted/50">
              <span className="font-mono">{selectedDate}</span>
              <span>· {filteredTasks.length} tasks</span>
            </div>

            {/* Task sections */}
            {filteredTasks.length === 0 ? (
              <div className="text-center py-16 text-chron-muted/20 font-serif italic">
                No tasks for this date.<br/>
                <button onClick={() => setModalEntry({})} className="text-chron-accent/50 hover:text-chron-accent mt-2 inline-block text-xs">
                  + Create one
                </button>
              </div>
            ) : (
              <div className="bg-chron-panel/40 border border-chron-border/50 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 border-b border-chron-border/50 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-chron-muted">
                    Tasks · {selectedDate}
                  </span>
                  <span className="text-[9px] text-chron-muted/30 font-mono">{filteredTasks.length} items</span>
                </div>

                {pinned.length > 0 && (
                  <div className="border border-chron-accent/30 bg-chron-accent/[0.03] rounded m-3 overflow-hidden">
                    <div className="px-4 py-2 bg-chron-accent/10 border-b border-chron-accent/20 text-[10px] uppercase tracking-[0.2em] font-bold text-chron-accent font-mono flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-chron-accent rounded-full" />
                      Pinned
                    </div>
                    {pinned.map(e => <TaskRow key={e.id} {...taskRowProps(e)} />)}
                  </div>
                )}
                {todos.length > 0 && (
                  <div>
                    <SectionHeader label="Todo" />
                    {todos.map(e => <TaskRow key={e.id} {...taskRowProps(e)} />)}
                  </div>
                )}
                {periodic.length > 0 && (
                  <div>
                    <SectionHeader label="Recurring" />
                    {periodic.map(e => <TaskRow key={e.id} {...taskRowProps(e)} />)}
                  </div>
                )}
                {goals.length > 0 && (
                  <div>
                    <SectionHeader label="Goals" />
                    {goals.map(e => <TaskRow key={e.id} {...taskRowProps(e)} />)}
                  </div>
                )}
              </div>
            )}
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
