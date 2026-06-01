import { useState } from 'react';

export function useMemoryManager() {
  const [memoryRefreshKey, setMemoryRefreshKey] = useState(0);

  const triggerMemoryRefresh = () => setMemoryRefreshKey(k => k + 1);

  return { memoryRefreshKey, triggerMemoryRefresh };
}
