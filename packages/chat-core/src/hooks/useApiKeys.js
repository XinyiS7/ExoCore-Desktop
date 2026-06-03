import { useState, useEffect, useCallback } from 'react';
import { configApi } from 'exo-shared';

export function useApiKeys(platform) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchKeys = useCallback(() => {
    if (!platform) return;
    setLoading(true);
    setError(null);
    configApi.listApiKeys(platform)
      .then(data => setKeys(Array.isArray(data) ? data : []))
      .catch(err => {
        console.error('useApiKeys fetch failed:', err);
        setError(err);
      })
      .finally(() => setLoading(false));
  }, [platform]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  return { keys, loading, error, refresh: fetchKeys };
}
