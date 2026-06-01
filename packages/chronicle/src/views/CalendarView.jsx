import React from 'react';
import { useCalendar } from '../hooks/useCalendar';
import CalendarWidget from '../components/CalendarWidget';
import MiniCalendar from '../components/MiniCalendar';

export default function CalendarView() {
  const { events, loading, refresh } = useCalendar();
  if (loading) return <div className="p-6 text-chron-muted">Loading calendar...</div>;
  return (
    <div className="h-full overflow-y-auto p-4 flex flex-col gap-4">
      <MiniCalendar />
      <CalendarWidget events={events} onRefresh={refresh} />
    </div>
  );
}
