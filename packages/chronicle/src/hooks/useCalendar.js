import { useState, useEffect, useCallback } from 'react';
import { tasksApi } from 'exo-shared';

export function useCalendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback((params = {}) => {
    setLoading(true);
    tasksApi.getCalendarSnapshot(params)
      .then(data => setEvents(data.events || []))
      .catch(err => console.error('Calendar events load failed', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  return { events, loading, refresh: fetchEvents };
}
