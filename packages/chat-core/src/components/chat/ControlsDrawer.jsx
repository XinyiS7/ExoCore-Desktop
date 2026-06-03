import React, { useState, useEffect, useCallback } from 'react';
import { configApi, MODEL_REGISTRY, MAIN_MODEL_IDS } from 'exo-shared';
import { Cpu, Key, Palette } from 'lucide-react';

export default function ControlsDrawer({
  currentModel,
  thinkingLevel,
  temperature,
  chatMode,
  sessionId,
  lastTelemetry,
  sessionTelemetryRef,
  telemetryExpanded,
  setTelemetryExpanded,
  onPreferenceChange,
  onChatModeChange,
}) {
  // Key alias state
  const [aliases, setAliases] = useState([]);
  const [selectedAlias, setSelectedAlias] = useState('');

  // Determine platform from current model
  const platform = MODEL_REGISTRY.find(m => m.id === currentModel)?.provider || '';

  // Load key_map + aliases
  const loadKeyData = useCallback(async () => {
    if (!sessionId || !platform) return;
    try {
      const [config, keys] = await Promise.all([
        configApi.getConfig(),
        configApi.listApiKeys(platform),
      ]);
      const keyMap = config.key_map || {};
      const platformMap = keyMap[platform] || {};

      // Build alias list from keys
      const aliasList = (Array.isArray(keys) ? keys : []).map(k => k.alias);
      setAliases(aliasList);

      // Determine default: localStorage override > session default > system default
      const stored = localStorage.getItem(`exo_session_key_${sessionId}`);
      if (stored && aliasList.includes(stored)) {
        setSelectedAlias(stored);
        return;
      }

      // Resolve session default (may be id or alias)
      const sessionRef = platformMap.session;
      const systemRef = platformMap.system;
      const resolveAlias = (ref) => {
        if (!ref) return null;
        const byId = keys.find(k => k.id === ref);
        if (byId) return byId.alias;
        const byAlias = keys.find(k => k.alias === ref);
        if (byAlias) return byAlias.alias;
        return typeof ref === 'string' ? ref : null;
      };

      const def = resolveAlias(sessionRef) || resolveAlias(systemRef) || aliasList[0] || '';
      setSelectedAlias(def);
    } catch {
      // Silently fail — key selector will show empty
    }
  }, [sessionId, platform]);

  useEffect(() => { loadKeyData(); }, [loadKeyData]);

  // Persist alias choice to localStorage
  const handleAliasChange = (alias) => {
    setSelectedAlias(alias);
    if (sessionId) {
      localStorage.setItem(`exo_session_key_${sessionId}`, alias);
    }
  };

  return (
    <div className="px-4 pt-3 pb-1 border-t border-exo-mist-10 bg-exo-pure/60 backdrop-blur-md space-y-3 animate-fade-in">
      {/* Row 1: Model + Thinking + Temp + Chat Mode */}
      <div className="flex items-center gap-3 text-exo-muted flex-wrap">
        <Cpu size={10} className="text-exo-muted/25 flex-shrink-0" />

        <select
          value={currentModel}
          onChange={e => onPreferenceChange({ model: e.target.value })}
          className="bg-transparent outline-none text-[11px] font-sans text-white/50 cursor-pointer max-w-[140px] truncate hover:text-white/80 transition-colors"
        >
          {MAIN_MODEL_IDS.map(m => (
            <option key={m} value={m} className="bg-exo-pure text-white">{m}</option>
          ))}
        </select>

        <span className="text-exo-muted/12 text-[9px] select-none flex-shrink-0">|</span>

        <select
          value={chatMode}
          onChange={e => onChatModeChange(e.target.value)}
          className="bg-transparent outline-none text-[11px] font-sans text-white/40 cursor-pointer hover:text-white/70 transition-colors"
        >
          <option value="sse" className="bg-exo-pure">SSE</option>
          <option value="async" className="bg-exo-pure">Async</option>
        </select>

        <span className="text-exo-muted/12 text-[9px] select-none flex-shrink-0">|</span>

        <select
          value={thinkingLevel}
          onChange={e => onPreferenceChange({ thinking_level: e.target.value })}
          className="bg-transparent outline-none text-[11px] font-sans text-white/40 cursor-pointer hover:text-white/70 transition-colors"
        >
          <option value="off" className="bg-exo-pure">Off</option>
          <option value="auto" className="bg-exo-pure">Auto</option>
          <option value="low" className="bg-exo-pure">Low</option>
          <option value="medium" className="bg-exo-pure">Med</option>
          <option value="high" className="bg-exo-pure">High</option>
        </select>

        <span className="text-exo-muted/12 text-[9px] select-none flex-shrink-0">|</span>

        <select
          value={temperature}
          onChange={e => onPreferenceChange({ temperature: e.target.value })}
          className="bg-transparent outline-none text-[11px] font-sans text-white/40 cursor-pointer hover:text-white/70 transition-colors"
        >
          <option value="1.0" className="bg-exo-pure">1.0</option>
          <option value="1.3" className="bg-exo-pure">1.3</option>
          <option value="1.8" className="bg-exo-pure">1.8</option>
        </select>

        {/* Telemetry (moved from old inline row) */}
        {lastTelemetry && (
          <div className="ml-auto flex items-center gap-2 relative flex-shrink-0">
            <button
              onClick={() => setTelemetryExpanded(v => !v)}
              className="font-sans text-[10px] text-exo-muted/25 tabular-nums tracking-wider hover:text-exo-accent/50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <span className="inline-block w-1 h-1 rounded-full bg-exo-accent/50" />
              <span className="text-exo-muted/35">{lastTelemetry.model_name || lastTelemetry.platform}</span>
              <span>TX:{lastTelemetry.input_chars?.toLocaleString()}</span>
              <span>RX:{lastTelemetry.output_chars?.toLocaleString()}</span>
              {lastTelemetry.cached_input_chars > 0 && (
                <span>CACHE:{Math.round(lastTelemetry.cached_input_chars / (lastTelemetry.input_chars || 1) * 100)}%</span>
              )}
              {lastTelemetry.tool_calls > 0 && (
                <span>TOOLS:{lastTelemetry.tool_calls}</span>
              )}
            </button>
            {telemetryExpanded && (
              <div className="absolute bottom-full right-0 mb-2 px-4 py-3 bg-exo-panel border border-exo-border rounded-[4px] font-mono text-[10px] text-exo-muted shadow-xl z-50 min-w-[260px] animate-fade-in">
                <div className="text-exo-accent/60 text-[9px] uppercase tracking-[0.2em] mb-2 font-bold">Session Totals</div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  <span className="opacity-50">Requests</span>
                  <span className="text-white/80 tabular-nums text-right">{sessionTelemetryRef.current.requests}</span>
                  <span className="opacity-50">Total TX</span>
                  <span className="text-white/80 tabular-nums text-right">{sessionTelemetryRef.current.totalInput.toLocaleString()}</span>
                  <span className="opacity-50">Total RX</span>
                  <span className="text-white/80 tabular-nums text-right">{sessionTelemetryRef.current.totalOutput.toLocaleString()}</span>
                  <span className="opacity-50">Total Cached</span>
                  <span className="text-white/80 tabular-nums text-right">{sessionTelemetryRef.current.totalCached.toLocaleString()}</span>
                  <span className="opacity-50">Cache Hit Rate</span>
                  <span className="text-white/80 tabular-nums text-right">
                    {sessionTelemetryRef.current.totalInput > 0
                      ? Math.round(sessionTelemetryRef.current.totalCached / sessionTelemetryRef.current.totalInput * 100)
                      : 0}%
                  </span>
                  <span className="opacity-50">Tool Calls</span>
                  <span className="text-white/80 tabular-nums text-right">{sessionTelemetryRef.current.totalTools}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Row 2: Key Alias Selector */}
      <div className="flex items-center gap-3">
        <Key size={10} className="text-exo-muted/25 flex-shrink-0" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-exo-muted/40 flex-shrink-0">
          Key Alias
        </span>
        {aliases.length > 0 ? (
          <select
            value={selectedAlias}
            onChange={e => handleAliasChange(e.target.value)}
            className="bg-transparent outline-none text-[11px] font-sans text-white/50 cursor-pointer hover:text-white/80 transition-colors max-w-[160px] truncate"
          >
            {aliases.map(a => (
              <option key={a} value={a} className="bg-exo-pure text-white">{a}</option>
            ))}
          </select>
        ) : (
          <span className="text-[10px] text-exo-muted/25 italic">
            {platform ? `No keys configured for ${platform}` : 'Select a model first'}
          </span>
        )}
      </div>

      {/* Row 3: Color Scheme (disabled placeholder) */}
      <div className="flex items-center gap-3 opacity-30">
        <Palette size={10} className="text-exo-muted/25 flex-shrink-0" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-exo-muted/40 flex-shrink-0">
          Color Scheme
        </span>
        <span className="text-[10px] text-exo-muted/30 italic">Coming soon</span>
      </div>
    </div>
  );
}
