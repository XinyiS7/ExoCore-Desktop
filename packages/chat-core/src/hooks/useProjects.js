import { useState, useEffect } from 'react';
import { projectsApi } from 'exo-shared';

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProjects = () => {
    setLoading(true);
    projectsApi.listProjects()
      .then(setProjects)
      .catch(err => { console.error('Projects load failed', err); setError(err); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProjects(); }, []);

  return { projects, setProjects, loading, error, refresh: fetchProjects };
}
