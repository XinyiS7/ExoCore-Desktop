import { useState, useEffect } from 'react';
import { tasksApi } from 'exo-shared';

export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = () => {
    setLoading(true);
    tasksApi.listTasks()
      .then(setTasks)
      .catch(err => console.error('Tasks load failed', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTasks(); }, []);

  const toggleTask = async (taskId, completed) => {
    try {
      await tasksApi.completeTask(taskId);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed } : t));
    } catch (err) {
      console.error('Toggle task failed', err);
    }
  };

  return { tasks, loading, refresh: fetchTasks, toggleTask };
}
