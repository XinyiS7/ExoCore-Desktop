import { useState, useEffect } from 'react';
import { agentsApi } from 'exo-shared';

export function usePresets() {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPresets = () => {
    setLoading(true);
    agentsApi.listPresets()
      .then(setPresets)
      .catch(err => console.error('Presets load failed', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPresets(); }, []);

  return { presets, setPresets, loading, refresh: fetchPresets };
}
