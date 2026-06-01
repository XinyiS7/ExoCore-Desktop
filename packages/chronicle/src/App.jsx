import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { List, CheckSquare, Calendar } from 'lucide-react';
import TimelineView from './views/TimelineView';
import TaskListView from './views/TaskListView';
import CalendarView from './views/CalendarView';

export default function App() {
  return (
    <div className="w-full h-screen flex flex-col bg-chron-bg text-chron-text font-sans">
      {/* Top Header */}
      <header className="h-12 flex items-center px-5 border-b border-chron-border bg-chron-panel shrink-0">
        <h1 className="font-serif text-lg tracking-wide text-chron-accent">Chronicle</h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<TimelineView />} />
          <Route path="/tasks" element={<TaskListView appState={{ presets: [], openDestructor: () => {} }} />} />
          <Route path="/calendar" element={<CalendarView />} />
        </Routes>
      </main>

      {/* Bottom Nav */}
      <nav className="h-14 flex items-center justify-around border-t border-chron-border bg-chron-panel shrink-0">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 text-xs transition-colors ${
              isActive ? 'text-chron-accent' : 'text-chron-muted hover:text-chron-text'
            }`
          }
        >
          <List size={18} />
          <span>Feed</span>
        </NavLink>
        <NavLink
          to="/tasks"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 text-xs transition-colors ${
              isActive ? 'text-chron-accent' : 'text-chron-muted hover:text-chron-text'
            }`
          }
        >
          <CheckSquare size={18} />
          <span>Tasks</span>
        </NavLink>
        <NavLink
          to="/calendar"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 text-xs transition-colors ${
              isActive ? 'text-chron-accent' : 'text-chron-muted hover:text-chron-text'
            }`
          }
        >
          <Calendar size={18} />
          <span>Calendar</span>
        </NavLink>
      </nav>
    </div>
  );
}
