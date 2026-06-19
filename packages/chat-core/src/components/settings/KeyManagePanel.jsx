import React, { useState, useEffect, useCallback } from 'react';
import { configApi, MODEL_REGISTRY } from 'exo-shared';
import { useApiKeys } from '../../hooks/useApiKeys';
import KeyPoolSection from './KeyPoolSection';
import RoleKeyMapSection from './RoleKeyMapSection';
import { RefreshCw } from 'lucide-react';

/** Derive unique platform list from model registry. */
function getPlatforms() {
 const providers = [...new Set(MODEL_REGISTRY.map(m => m.provider))];
 return providers.length > 0 ? providers : ['gemini', 'deepseek'];
}

export default function KeyManagePanel() {
 const platforms = getPlatforms();
 const [activePlatform, setActivePlatform] = useState(platforms[0] || 'gemini');
 const { keys, loading, refresh } = useApiKeys(activePlatform);

 // Key map from SystemConfig
 const [keyMap, setKeyMap] = useState({});
 const [keyMapLoading, setKeyMapLoading] = useState(true);

 const fetchKeyMap = useCallback(() => {
 setKeyMapLoading(true);
 configApi.getConfig()
  .then(config => setKeyMap(config.key_map || {}))
  .catch(() => {})
  .finally(() => setKeyMapLoading(false));
 }, []);

 useEffect(() => { fetchKeyMap(); }, [fetchKeyMap]);

 // Called after key CRUD or key_map changes
 const handleDataChanged = useCallback(() => {
 refresh();
 fetchKeyMap();
 }, [refresh, fetchKeyMap]);

 const isLoading = loading && keyMapLoading && keys.length === 0;

 if (isLoading) {
 return (
  <div className="flex items-center justify-center h-64">
  <RefreshCw size={20} className="animate-spin tx-system-mute opacity-40" />
  </div>
 );
 }

 const platformKeyMap = keyMap[activePlatform] || {};

 return (
 <div className="h-full flex flex-col">
  {/* Platform tabs */}
  <div className="flex gap-0 border-b border-white/5 px-5 pt-2">
  {platforms.map(p => (
   <button
   key={p}
   onClick={() => setActivePlatform(p)}
   className={`px-4 py-2 text-[0.625rem] font-mono tracking-[0.12em] transition-all border-b-2 -mb-[1px] ${
    activePlatform === p
    ? 'tx-system-accent border-chat-accent bg-chat-accent/5'
    : 'tx-system-mute opacity-40 border-transparent hover:tx-system-mute opacity-60 hover:border-chat-muted/15'
   }`}
   >
   {p}
   </button>
  ))}
  </div>

  {/* Content — reduced spacing */}
  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
  <KeyPoolSection
   platform={activePlatform}
   keys={keys}
   loading={loading}
   onKeysChanged={handleDataChanged}
  />

  <RoleKeyMapSection
   platform={activePlatform}
   keys={keys}
   keyMapForPlatform={platformKeyMap}
   onSaved={fetchKeyMap}
  />
  </div>
 </div>
 );
}
