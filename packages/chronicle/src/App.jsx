import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { MessageCircle, CheckSquare, Calendar, BookOpen } from 'lucide-react';
import TimelineView from './views/TimelineView';
import TaskListView from './views/TaskListView';
import CalendarView from './views/CalendarView';
import ChronicleView from './views/ChronicleView';

export default function App() {
  return (
    <div className="w-full h-screen flex flex-col bg-chron-bg text-chron-text font-sans">
      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<TimelineView />} />
          <Route path="/tasks" element={<TaskListView />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/chronicle" element={<ChronicleView />} />
        </Routes>
      </main>

      {/* Bottom Nav */}
      <nav className="h-13 flex items-center justify-around border-t border-chron-border bg-chron-panel shrink-0">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-4 py-1.5 text-xs transition-colors ${
              isActive ? 'text-chron-accent' : 'text-chron-muted hover:text-chron-text'
            }`
          }
        >
          <MessageCircle size={18} strokeWidth={1.5} />
          <span className="text-[10px] tracking-wide">Feed</span>
        </NavLink>
        <NavLink
          to="/tasks"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-4 py-1.5 text-xs transition-colors ${
              isActive ? 'text-chron-accent' : 'text-chron-muted hover:text-chron-text'
            }`
          }
        >
          <CheckSquare size={18} strokeWidth={1.5} />
          <span className="text-[10px] tracking-wide">Tasks</span>
        </NavLink>
        <NavLink
          to="/chronicle"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-4 py-1.5 text-xs transition-colors ${
              isActive ? 'text-chron-accent' : 'text-chron-muted hover:text-chron-text'
            }`
          }
        >
          <BookOpen size={18} strokeWidth={1.5} />
          <span className="text-[10px] tracking-wide">Chronicle</span>
        </NavLink>
        <NavLink
          to="/calendar"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-4 py-1.5 text-xs transition-colors ${
              isActive ? 'text-chron-accent' : 'text-chron-muted hover:text-chron-text'
            }`
          }
        >
          <Calendar size={18} strokeWidth={1.5} />
          <span className="text-[10px] tracking-wide">Calendar</span>
        </NavLink>
      </nav>
    </div>
  );
}
