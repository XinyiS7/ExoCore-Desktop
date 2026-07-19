import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getCompatibleEndpoints, changeTargetModel, useTheme } from 'exo-shared';
import { Cpu, Globe, Palette, Check, X } from 'lucide-react';
import { getCustomPalettes, saveCustomPalette, deleteCustomPalette, updateCustomPalette, computeStops, getPalette, DEFAULT_PALETTE_ID, THEME_DEFAULT_LIGHT, THEME_DEFAULT_DARK, STOP_NAMES, ALL_PRESETS } from './palettes';

const MAX_CUSTOM = 3;

export default function ControlsDrawer({
 catalog,
 sessionTarget,
 setSessionTarget,
 thinkingLevel,
 temperature,
 chatMode,
 sessionId,
 paletteId,
 onPaletteChange,
 lastTelemetry,
 sessionTelemetryRef,
 telemetryExpanded,
 setTelemetryExpanded,
 onPreferenceChange,
 onChatModeChange,
}) {
 const { theme } = useTheme();

 // Filter built-in presets by current theme
 const filteredPresets = Object.entries(ALL_PRESETS)
  .filter(([, p]) => p.theme === theme)
  .map(([id, p]) => p);

 const [memInjectEnabled, setMemInjectEnabled] = useState(() =>
  localStorage.getItem(`exo_mem_inject_${sessionId}`) !== 'false'
 );

 // Re-sync memInjectEnabled when sessionId changes (toggle mounted across session switches)
 useEffect(() => {
  setMemInjectEnabled(localStorage.getItem(`exo_mem_inject_${sessionId}`) !== 'false');
 }, [sessionId]);

 // ── Color scheme state ──
 const currentPalette = getPalette(paletteId);
 const [keyShadow, setKeyShadow] = useState(currentPalette.colors['--obsidian'] || '#0a0200');
 const [keyMid, setKeyMid] = useState(currentPalette.colors['--oxblood-500'] || '#941b0c');
 const [keyHighlight, setKeyHighlight] = useState(currentPalette.colors['--orange-500'] || '#f8bf74');
 const [customName, setCustomName] = useState('');
 const [showSaveInput, setShowSaveInput] = useState(false);
 const [customPalettes, setCustomPalettes] = useState(getCustomPalettes);
 const paletteSelectRef = useRef(null);

 // Sync pickers when paletteId changes externally
 useEffect(() => {
 const p = getPalette(paletteId);
 if (p?.colors) {
  setKeyShadow(p.colors['--obsidian'] || '#0a0200');
  setKeyMid(p.colors['--oxblood-500'] || '#941b0c');
  setKeyHighlight(p.colors['--orange-500'] || '#f8bf74');
 }
 setShowSaveInput(false);
 setCustomName('');
 setCustomPalettes(getCustomPalettes());
 }, [paletteId]);

 // Live-preview a key-color change
 const emitLiveColors = (s, m, h) => {
 if (!onPaletteChange) return;
 const stops = computeStops(s, m, h);
 onPaletteChange({ liveColors: stops });
 };

 const handleShadowChange = (v) => { setKeyShadow(v); emitLiveColors(v, keyMid, keyHighlight); };
 const handleMidChange = (v) => { setKeyMid(v); emitLiveColors(keyShadow, v, keyHighlight); };
 const handleHighlightChange = (v) => { setKeyHighlight(v); emitLiveColors(keyShadow, keyMid, v); };

 // Save current live colors as a named custom palette
 const handleSaveCustom = () => {
 const name = customName.trim();
 if (!name) return;
 const stops = computeStops(keyShadow, keyMid, keyHighlight);
 const saved = saveCustomPalette(name, stops);
 if (saved) {
  setCustomPalettes(getCustomPalettes());
  setShowSaveInput(false);
  setCustomName('');
  onPaletteChange && onPaletteChange(saved.id);
 }
 };

 // Delete a custom palette
 const handleDeleteCustom = (id) => {
 deleteCustomPalette(id);
 setCustomPalettes(getCustomPalettes());
 if (paletteId === id && onPaletteChange) {
  // Fall back to theme-appropriate default instead of hardcoded DEFAULT_PALETTE_ID
  const fallback = theme === 'light' ? THEME_DEFAULT_LIGHT : THEME_DEFAULT_DARK;
  onPaletteChange(fallback);
 }
 };

 // Update current custom palette in-place
 const handleUpdateCustom = () => {
  if (!isCustomSelected) return;
  const name = customName.trim() || currentPalette.label;
  const stops = computeStops(keyShadow, keyMid, keyHighlight);
  const updated = updateCustomPalette(paletteId, { label: name, colors: stops });
  if (updated) {
   setCustomPalettes(getCustomPalettes());
   setShowSaveInput(false);
   setCustomName('');
   // Force Aurora to re-render with updated colors
   onPaletteChange && onPaletteChange(paletteId);
  }
 };

 // Check if current live colors differ from the selected palette
 const liveStops = computeStops(keyShadow, keyMid, keyHighlight);
 const isDirty = !currentPalette?.colors ||
 Object.entries(liveStops).some(([k, v]) => currentPalette.colors[k] !== v);

 const isCustomSelected = paletteId && paletteId.startsWith('custom-');
 const customCount = customPalettes.length;

 return (
 <div className="px-4 pt-3 pb-1 border-t border-exo-mist-10 bg-exo-pure/60 backdrop-blur-md space-y-3 animate-fade-in">
  {/* Row 1: Model + Thinking + Temp + Chat Mode */}
  <div className="flex items-center gap-3 tx-system-mute flex-wrap">
  <Cpu size={10} className="tx-system-mute opacity-25 flex-shrink-0" />

  <select
   value={sessionTarget?.model || ''}
   onChange={e => {
     const nextModel = e.target.value;
     const result = changeTargetModel(catalog, sessionTarget, nextModel);
     setSessionTarget({ model: result.model, endpoint: result.endpoint });
   }}
   className="bg-transparent outline-none text-[0.6875rem] font-sans tx-system-normal opacity-50 cursor-pointer max-w-[140px] truncate hover:tx-system-normal opacity-80 transition-colors"
  >
   {(() => {
     const registeredMainModels = catalog?.roles
       ? [...new Set(catalog.roles.filter(r => r.role === 'main').map(r => r.model))]
       : [];
     return registeredMainModels.map(modelName => (
       <option key={modelName} value={modelName} className="bg-exo-pure tx-system-normal">{modelName}</option>
     ));
   })()}
  </select>

  <span className="tx-system-mute opacity-12 text-[0.5625rem] select-none flex-shrink-0">|</span>

  <select
   value={chatMode}
   onChange={e => onChatModeChange(e.target.value)}
   className="bg-transparent outline-none text-[0.6875rem] font-sans tx-system-normal opacity-40 cursor-pointer hover:tx-system-normal opacity-70 transition-colors"
  >
   <option value="sse" className="bg-exo-pure">SSE</option>
   <option value="async" className="bg-exo-pure">Async</option>
  </select>

  <span className="tx-system-mute opacity-12 text-[0.5625rem] select-none flex-shrink-0">|</span>

  <select
   value={thinkingLevel}
   onChange={e => onPreferenceChange({ thinking_level: e.target.value })}
   className="bg-transparent outline-none text-[0.6875rem] font-sans tx-system-normal opacity-40 cursor-pointer hover:tx-system-normal opacity-70 transition-colors"
  >
   <option value="off" className="bg-exo-pure">Off</option>
   <option value="auto" className="bg-exo-pure">Auto</option>
   <option value="low" className="bg-exo-pure">Low</option>
   <option value="medium" className="bg-exo-pure">Med</option>
   <option value="high" className="bg-exo-pure">High</option>
  </select>

  <span className="tx-system-mute opacity-12 text-[0.5625rem] select-none flex-shrink-0">|</span>

  <select
   value={temperature}
   onChange={e => onPreferenceChange({ temperature: e.target.value })}
   className="bg-transparent outline-none text-[0.6875rem] font-sans tx-system-normal opacity-40 cursor-pointer hover:tx-system-normal opacity-70 transition-colors"
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
    className="font-sans text-[0.625rem] tx-system-mute opacity-25 tabular-nums tracking-wider hover:tx-system-accent opacity-50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
   >
    <span className="inline-block w-1 h-1 rounded-full bg-exo-accent/50" />
    <span className="tx-system-mute opacity-35">{lastTelemetry.model_name || lastTelemetry.platform}</span>
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
    <div className="absolute bottom-full right-0 mb-2 px-4 py-3 bg-exo-panel border border-exo-border rounded-[4px] text-[0.625rem] tx-system-mute shadow-xl z-50 min-w-[260px] animate-fade-in" style={{ fontFamily: 'var(--font-code)' }}>
    <div className="tx-system-accent opacity-60 text-[0.5625rem] tracking-[0.2em] mb-2 font-bold">Session Totals</div>
    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
     <span className="opacity-50">Requests</span>
     <span className="tx-system-normal opacity-80 tabular-nums text-right">{sessionTelemetryRef.current.requests}</span>
     <span className="opacity-50">Total TX</span>
     <span className="tx-system-normal opacity-80 tabular-nums text-right">{sessionTelemetryRef.current.totalInput.toLocaleString()}</span>
     <span className="opacity-50">Total RX</span>
     <span className="tx-system-normal opacity-80 tabular-nums text-right">{sessionTelemetryRef.current.totalOutput.toLocaleString()}</span>
     <span className="opacity-50">Total Cached</span>
     <span className="tx-system-normal opacity-80 tabular-nums text-right">{sessionTelemetryRef.current.totalCached.toLocaleString()}</span>
     <span className="opacity-50">Cache Hit Rate</span>
     <span className="tx-system-normal opacity-80 tabular-nums text-right">
     {sessionTelemetryRef.current.totalInput > 0
      ? Math.round(sessionTelemetryRef.current.totalCached / sessionTelemetryRef.current.totalInput * 100)
      : 0}%
     </span>
     <span className="opacity-50">Tool Calls</span>
     <span className="tx-system-normal opacity-80 tabular-nums text-right">{sessionTelemetryRef.current.totalTools}</span>
    </div>
    </div>
   )}
   </div>
  )}
  </div>

  {/* Row 2: Endpoint + Memory Injection */}
  <div className="flex items-center gap-3">
  <Globe size={10} className="tx-system-mute opacity-25 flex-shrink-0" />
  <span className="text-[0.625rem] tx-system-mute opacity-40 flex-shrink-0">
   Endpoint
  </span>
  {sessionTarget?.model ? (
   (() => {
     const compatibleEndpoints = getCompatibleEndpoints(catalog, sessionTarget.model);
     return compatibleEndpoints.length > 0 ? (
       <select
         value={sessionTarget.endpoint || ''}
         onChange={e => setSessionTarget(p => ({ ...p, endpoint: e.target.value ? Number(e.target.value) : null }))}
         className="bg-transparent outline-none text-[0.6875rem] font-sans tx-system-normal opacity-50 cursor-pointer hover:tx-system-normal opacity-80 transition-colors max-w-[160px] truncate"
       >
         <option value="" className="bg-exo-pure tx-system-normal">— Select Endpoint —</option>
         {compatibleEndpoints.map(ep => (
           <option key={ep.id} value={ep.id} className="bg-exo-pure tx-system-normal">
             {ep.name} ({ep.provider})
           </option>
         ))}
       </select>
     ) : (
       <span className="text-[0.625rem] tx-system-mute opacity-25 italic">
         No compatible endpoints enabled
       </span>
     );
   })()
  ) : (
   <span className="text-[0.625rem] tx-system-mute opacity-25 italic">
    Select a model first
   </span>
  )}

  <span className="tx-system-mute opacity-12 text-[0.5625rem] select-none flex-shrink-0">|</span>

  <span className="text-[0.625rem] tx-system-mute opacity-40 flex-shrink-0">
   Mem
  </span>
  <label className="flex items-center gap-1.5 cursor-pointer select-none">
   <input
   type="checkbox"
   checked={memInjectEnabled}
   onChange={() => {
    const next = !memInjectEnabled;
    setMemInjectEnabled(next);
    localStorage.setItem(`exo_mem_inject_${sessionId}`, String(next));
   }}
   className="sr-only"
   />
   <span
   className={`w-7 h-4 rounded-full transition-colors flex items-center px-[2px] ${
    memInjectEnabled ? 'bg-exo-accent/60' : 'bg-exo-mist-10'
   }`}
   >
   <span
    className={`w-3 h-3 rounded-full bg-white transition-transform ${
    memInjectEnabled ? 'translate-x-3' : 'translate-x-0'
    }`}
   />
   </span>
   <span className="text-[0.625rem] font-sans tx-system-mute opacity-40">
   {memInjectEnabled ? 'On' : 'Off'}
   </span>
  </label>
  </div>

  {/* Row 3: Color Scheme */}
  <div className="space-y-2">
  {/* Selector row */}
  <div className="flex items-center gap-3">
   <Palette size={10} className="tx-system-mute opacity-25 flex-shrink-0" />
   <span className="text-[0.625rem] tx-system-mute opacity-40 flex-shrink-0">
   Palette
   </span>
   <select
   ref={paletteSelectRef}
   value={paletteId || DEFAULT_PALETTE_ID}
   onChange={e => onPaletteChange && onPaletteChange(e.target.value)}
   className="bg-transparent outline-none text-[0.6875rem] font-sans tx-system-normal opacity-40 cursor-pointer hover:tx-system-normal opacity-70 transition-colors max-w-[140px] truncate"
   >
   {filteredPresets.map(p => (
    <option key={p.id} value={p.id} className="bg-exo-pure tx-system-normal">{p.label}</option>
   ))}
   {customPalettes.length > 0 && (
    <option disabled className="bg-exo-pure tx-system-mute opacity-30">───── Custom ─────</option>
   )}
   {customPalettes.map(p => (
    <option key={p.id} value={p.id} className="bg-exo-pure tx-system-normal">◆ {p.label}</option>
   ))}
   </select>
   {/* Delete custom palette */}
   {isCustomSelected && (
   <button
    onClick={() => handleDeleteCustom(paletteId)}
    className="p-0.5 tx-system-mute opacity-30 hover:text-red-400 transition-colors"
    title="Delete this custom palette"
   >
    <X size={11} />
   </button>
   )}
  </div>

  {/* 3-Keypoint color pickers */}
  <div className="flex items-center gap-3 pl-5">
   <span className="text-[0.5625rem] tx-system-mute opacity-30 w-8 flex-shrink-0">Key</span>
   <div className="flex items-center gap-2">
   <label className="flex flex-col items-center gap-0.5">
    <input
    type="color"
    value={keyShadow}
    onChange={e => handleShadowChange(e.target.value)}
    className="w-6 h-6 rounded-[2px] border border-exo-mist-10 bg-transparent cursor-pointer p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-[2px]"
    title="Shadow — deepest tone"
    />
    <span className="text-[7px] tx-system-mute opacity-25 tracking-tighter" style={{ fontFamily: 'var(--font-code)' }}>SHD</span>
   </label>
   <label className="flex flex-col items-center gap-0.5">
    <input
    type="color"
    value={keyMid}
    onChange={e => handleMidChange(e.target.value)}
    className="w-6 h-6 rounded-[2px] border border-exo-mist-10 bg-transparent cursor-pointer p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-[2px]"
    title="Mid-glow — middle tone"
    />
    <span className="text-[7px] tx-system-mute opacity-25 tracking-tighter" style={{ fontFamily: 'var(--font-code)' }}>MID</span>
   </label>
   <label className="flex flex-col items-center gap-0.5">
    <input
    type="color"
    value={keyHighlight}
    onChange={e => handleHighlightChange(e.target.value)}
    className="w-6 h-6 rounded-[2px] border border-exo-mist-10 bg-transparent cursor-pointer p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-[2px]"
    title="Highlight — brightest tone"
    />
    <span className="text-[7px] tx-system-mute opacity-25 tracking-tighter" style={{ fontFamily: 'var(--font-code)' }}>HI</span>
   </label>
   </div>

   {/* Interpolated stops mini-preview */}
   <div className="flex items-center gap-[2px] ml-2">
   {Object.values(liveStops).map((hex, i) => (
    <span
    key={i}
    className="w-2.5 h-2.5 rounded-[1px] border border-cinder-line flex-shrink-0"
    style={{ backgroundColor: hex }}
    title={STOP_NAMES[i]}
    />
   ))}
   </div>

   {/* Save / Update controls */}
   {isDirty && (
   <div className="flex items-center gap-1.5 animate-fade-in">
    {showSaveInput ? (
    <>
     <input
     value={customName}
     onChange={e => setCustomName(e.target.value)}
     onKeyDown={e => {
      if (e.key === 'Enter') {
       if (isCustomSelected) handleUpdateCustom();
       else handleSaveCustom();
      }
      if (e.key === 'Escape') { setShowSaveInput(false); setCustomName(''); }
     }}
     placeholder={isCustomSelected ? (currentPalette?.label || 'name...') : 'name...'}
     autoFocus
     maxLength={24}
     className="w-20 bg-exo-bg border border-exo-mist-10 rounded-[2px] px-1.5 py-0.5 text-[0.625rem] tx-system-normal outline-none focus:border-exo-accent/50"
     style={{ fontFamily: 'var(--font-code)' }}
     />
     {/* Update button — only for custom palettes */}
     {isCustomSelected && (
     <button
      onClick={handleUpdateCustom}
      className="p-0.5 text-amber-400/60 hover:text-amber-400 transition-colors"
      title="Update this palette"
     >
      <Check size={12} />
     </button>
     )}
     {/* Save-as-new button */}
     <button
     onClick={handleSaveCustom}
     disabled={!customName.trim() || customCount >= MAX_CUSTOM}
     className="p-0.5 text-green-400/60 hover:text-green-400 disabled:opacity-20 transition-colors"
     title="Save as new palette"
     >
     <Check size={12} />
     </button>
     <button
     onClick={() => { setShowSaveInput(false); setCustomName(''); }}
     className="p-0.5 tx-system-mute opacity-40 hover:tx-system-normal transition-colors"
     >
     <X size={11} />
     </button>
    </>
    ) : (
    <div className="flex items-center gap-1.5">
     {/* Update button (compact, for custom palettes) */}
     {isCustomSelected && (
     <button
      onClick={() => setShowSaveInput(true)}
      className="text-[0.5625rem] text-amber-400/60 hover:text-amber-400 transition-colors"
      title="Update this palette"
     >
      Update
     </button>
     )}
     {/* Save-as-new button */}
     <button
     onClick={() => setShowSaveInput(true)}
     disabled={customCount >= MAX_CUSTOM}
     className="text-[0.5625rem] tx-system-accent opacity-60 hover:tx-system-accent disabled:opacity-20 transition-colors"
     title={customCount >= MAX_CUSTOM ? `Max ${MAX_CUSTOM} custom palettes` : 'Save as custom palette'}
     >
     {customCount >= MAX_CUSTOM ? `[${MAX_CUSTOM}/${MAX_CUSTOM}]` : '+ Save'}
     </button>
    </div>
    )}
   </div>
   )}
  </div>
  </div>
 </div>
 );
}
