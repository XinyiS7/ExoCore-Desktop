import React, { useState, useEffect, useCallback } from 'react';
import CalendarWidget from '../components/CalendarWidget';
import MiniCalendar from '../components/MiniCalendar';
import { tasksApi } from 'exo-shared';

export default function CalendarView() {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [dayTasks, setDayTasks] = useState([]);
  const [todayEvents, setTodayEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadDayTasks = useCallback(async () => {
    setLoading(true);
    try {
      const all = await tasksApi.listTasks({ status: 'active' });
      const tasks = Array.isArray(all) ? all : [];
      const filtered = tasks.filter(e => {
        if (e.entry_type === 'todo') return e.due_date === selectedDate;
        if (e.entry_type === 'periodic') return e.next_periodic_due === selectedDate;
        if (e.entry_type === 'goal') {
          return e.cycle_start && e.cycle_due && selectedDate >= e.cycle_start && selectedDate <= e.cycle_due;
        }
        return false;
      });
      setDayTasks(filtered);
    } catch {
      setDayTasks([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // Fetch 48h snapshot for today's quick view
  const loadTodaySnapshot = useCallback(async () => {
    try {
      const data = await tasksApi.getTodaySnapshot();
      setTodayEvents(data?.events || []);
    } catch {
      setTodayEvents([]);
    }
  }, []);

  useEffect(() => { loadDayTasks(); }, [loadDayTasks]);
  useEffect(() => { loadTodaySnapshot(); }, [loadTodaySnapshot]);

  const typeIcon = (t) => t === 'todo' ? '○' : t === 'periodic' ? '↻' : '◎';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-12 flex items-center px-5 border-b border-chron-border bg-chron-panel shrink-0">
        <h1 className="font-serif text-lg tracking-wide text-chron-accent">Calendar</h1>
        <span className="ml-auto text-[9px] font-mono text-chron-muted/40">
          {selectedDate}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {/* Full Calendar Widget */}
          <div className="bg-chron-panel/40 border border-chron-border/50 rounded-lg overflow-hidden">
            <CalendarWidget />
          </div>

          {/* Today at a Glance (48h snapshot) */}
          {selectedDate === today && todayEvents.length > 0 && (
            <div className="bg-chron-panel/40 border border-chron-border/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-serif text-chron-accent">Today at a Glance</h3>
                <span className="text-[9px] font-mono text-chron-muted/40 uppercase">48h window</span>
              </div>
              <div className="space-y-2">
                {todayEvents.map(ev => (
                  <a
                    key={ev.id}
                    href={ev.html_link || '#'}
                    target={ev.html_link ? '_blank' : undefined}
                    rel={ev.html_link ? 'noopener noreferrer' : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded border transition-colors hover:border-chron-accent/20 ${
                      ev.source === 'gcal' ? 'border-blue-400/20 bg-blue-400/[0.03]' : 'border-chron-border/30'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ev.source === 'gcal' ? 'bg-blue-400/60' : 'bg-chron-accent/60'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-chron-text/70 truncate">
                        {ev.source === 'exocore' && '[ExoCore] '}{ev.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {!ev.all_day && ev.start && (
                          <span className="text-[9px] text-chron-muted/40 font-mono">
                            {ev.start.slice(11, 16)}{ev.end ? ` – ${ev.end.slice(11, 16)}` : ''}
                          </span>
                        )}
                        {ev.all_day && <span className="text-[9px] text-chron-muted/40 font-mono">全天</span>}
                        {ev.source === 'exocore' && ev.entry_type && (
                          <span className="text-[8px] uppercase tracking-wider text-chron-muted/30">{ev.entry_type}</span>
                        )}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Day detail */}
          <div className="bg-chron-panel/40 border border-chron-border/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-serif text-chron-accent">
                {selectedDate === today ? 'Today' : selectedDate}
              </h3>
              <span className="text-[9px] font-mono text-chron-muted/40 uppercase">
                {dayTasks.length} task{dayTasks.length !== 1 ? 's' : ''}
              </span>
            </div>

            {loading ? (
              <div className="text-center py-8 text-chron-muted/40 text-xs">Loading...</div>
            ) : dayTasks.length === 0 ? (
              <div className="text-center py-8 text-chron-muted/20 font-serif italic text-sm">
                Nothing scheduled for this day
              </div>
            ) : (
              <div className="space-y-2">
                {dayTasks.map(task => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded border border-chron-border/30 hover:border-chron-accent/20 transition-colors ${
                      task.status === 'suspended' ? 'opacity-40' : ''
                    }`}
                  >
                    <span className="text-chron-accent/60 text-sm shrink-0">{typeIcon(task.entry_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${task.status === 'suspended' ? 'line-through' : 'text-chron-text/80'}`}>
                        {task.is_pinned && '📌 '}{task.title}
                      </p>
                      {task.description && (
                        <p className="text-[10px] text-chron-muted/40 truncate mt-0.5">{task.description}</p>
                      )}
                    </div>
                    {task.entry_type === 'goal' && (
                      <span className="text-[9px] font-mono text-chron-muted/40">
                        {task.current_cycle_completions ?? 0}/{task.goal_count ?? 1}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pb-4" />
        </div>
      </div>
    </div>
  );
}
