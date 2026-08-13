import React, { useState, useEffect, useRef, useCallback } from 'react';
import { heartbeatApi, useTheme } from 'exo-shared';
import BackToUpper from '../components/layout/BackButton';

/* ── UTC to Local Time Helper ── */
function formatToLocalTime(utcIso) {
  if (!utcIso) return 'N/A';
  try {
    const date = new Date(utcIso);
    if (isNaN(date.getTime())) return utcIso;
    return date.toLocaleString() + ' (' + Intl.DateTimeFormat().resolvedOptions().timeZone + ')';
  } catch (e) {
    return utcIso;
  }
}

export default function AgentMemory({ appState, setView, goBack, viewParams }) {
  const { presets } = appState || {};
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const presetId = viewParams?.agentId || 1;
  const preset = presets?.find(p => p.id === presetId);
  const backLabel = viewParams?.agentName || preset?.name || 'Agent';

  // State
  const [events, setEvents] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(20);

  // Filters
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Detail Drawer & Selection
  const [selectedUuid, setSelectedUuid] = useState(null);
  const [eventDetail, setEventDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ECG Timeline Hover / Focus State
  const [hoveredUuid, setHoveredUuid] = useState(null);

  // Drag-to-scroll ref for ECG Banner
  const scrollContainerRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragScrollLeftRef = useRef(0);

  // ── 1. Fetch Events List ──
  const fetchEvents = useCallback(async () => {
    if (!presetId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await heartbeatApi.listEvents({
        preset_id: presetId,
        limit,
        offset,
      });
      setEvents(res?.events || []);
      setTotalCount(res?.total_count || 0);
      setHasMore(!!res?.has_more);

      if (res?.events?.length > 0 && !selectedUuid) {
        setSelectedUuid(res.events[0].session_uuid);
      }
    } catch (err) {
      console.error('Failed to fetch heartbeat events:', err);
      setError(err?.message || '获取心跳日志失败');
    } finally {
      setLoading(false);
    }
  }, [presetId, limit, offset]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // ── 2. Fetch Event Detail ──
  useEffect(() => {
    if (!selectedUuid) {
      setEventDetail(null);
      return;
    }
    let isCancelled = false;
    setDetailLoading(true);

    heartbeatApi.getEventDetail(selectedUuid)
      .then(data => {
        if (!isCancelled) {
          setEventDetail(data);
        }
      })
      .catch(err => {
        if (!isCancelled) {
          console.error('Failed to fetch event detail:', err);
          const fallback = events.find(e => e.session_uuid === selectedUuid);
          setEventDetail(fallback || null);
        }
      })
      .finally(() => {
        if (!isCancelled) setDetailLoading(false);
      });

    return () => { isCancelled = true; };
  }, [selectedUuid, events]);

  // ── 3. Smooth Auto-centering Timeline Scroll ──
  const scrollToX = useCallback((xPos) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const containerWidth = container.clientWidth;
    const currentScroll = container.scrollLeft;

    const isVisible = (xPos >= currentScroll + containerWidth * 0.2) &&
                      (xPos <= currentScroll + containerWidth * 0.8);

    if (!isVisible) {
      const targetScroll = xPos - containerWidth / 2;
      container.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: 'smooth'
      });
    }
  }, []);

  const handleSelectEvent = (uuid, ecgX) => {
    setSelectedUuid(uuid);
    setDrawerOpen(true);
    if (ecgX !== undefined) {
      scrollToX(ecgX);
    }
  };

  // ── 4. Drag-to-Scroll Event Handlers for ECG Timeline ──
  const handleMouseDown = (e) => {
    if (e.target.tagName === 'circle' || e.target.closest('.time-tick-label')) return;
    isDraggingRef.current = true;
    dragStartXRef.current = e.pageX - scrollContainerRef.current.offsetLeft;
    dragScrollLeftRef.current = scrollContainerRef.current.scrollLeft;
  };
  const handleMouseLeave = () => { isDraggingRef.current = false; };
  const handleMouseUp = () => { isDraggingRef.current = false; };
  const handleMouseMove = (e) => {
    if (!isDraggingRef.current || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - dragStartXRef.current) * 1.5;
    scrollContainerRef.current.scrollLeft = dragScrollLeftRef.current - walk;
  };

  // ── 5. Client-side Filtering ──
  const filteredEvents = events.filter(ev => {
    if (sourceFilter !== 'all' && ev.launch_source !== sourceFilter) return false;
    if (statusFilter !== 'all' && ev.status !== statusFilter) return false;
    return true;
  });

  // Grouping by WakeUpTask for Visual Retry Correlation
  const retryGroups = {};
  filteredEvents.forEach(ev => {
    const taskId = ev.wake_up_task_id;
    if (taskId) {
      if (!retryGroups[taskId]) retryGroups[taskId] = [];
      retryGroups[taskId].push(ev);
    }
  });

  // ── 6. ECG Wave Generator Data ──
  const nowX = 1400; // NOW mark at ~80% of 1800px track
  const baselineY = 58;

  const sortedChronologicalEvents = [...filteredEvents].sort((a, b) => {
    const tA = new Date(a.started_at || a.completed_at || 0).getTime();
    const tB = new Date(b.started_at || b.completed_at || 0).getTime();
    return tA - tB;
  });

  const ecgEventPositions = sortedChronologicalEvents.map((ev, index) => {
    const isFailed = ev.status === 'failed';
    const step = sortedChronologicalEvents.length > 1 ? 1050 / (sortedChronologicalEvents.length - 1) : 0;
    const ecgX = sortedChronologicalEvents.length === 1 ? 750 : 200 + index * step;
    const ecgY = isFailed ? 94 : 18;
    return { ...ev, ecgX, ecgY, isDownward: isFailed };
  });

  let pastPathD = `M 0,${baselineY} `;
  let futurePathD = `M ${nowX},${baselineY} `;
  let curX = 0;

  const drawGentleBaseline = (targetX) => {
    while (curX < targetX - 45) {
      curX += 40;
      pastPathD += `L ${curX - 25},${baselineY} `;
      pastPathD += `Q ${curX - 15},${baselineY - 2.5} ${curX - 10},${baselineY} Q ${curX - 5},${baselineY + 2.5} ${curX},${baselineY} `;
    }
    if (curX < targetX - 30) {
      pastPathD += `L ${targetX - 30},${baselineY} `;
      curX = targetX - 30;
    }
  };

  ecgEventPositions.forEach(ev => {
    drawGentleBaseline(ev.ecgX);
    const x = ev.ecgX;
    if (!ev.isDownward) {
      pastPathD += `L ${x - 28},${baselineY} `;
      pastPathD += `Q ${x - 20},${baselineY - 5} ${x - 12},${baselineY} `;
      pastPathD += `L ${x - 6},${baselineY + 6} `;
      pastPathD += `L ${x},${ev.ecgY} `;
      pastPathD += `L ${x + 6},${baselineY + 12} `;
      pastPathD += `Q ${x + 18},${baselineY - 6} ${x + 28},${baselineY} `;
    } else {
      pastPathD += `L ${x - 28},${baselineY} `;
      pastPathD += `Q ${x - 20},${baselineY + 5} ${x - 12},${baselineY} `;
      pastPathD += `L ${x - 6},${baselineY - 6} `;
      pastPathD += `L ${x},${ev.ecgY} `;
      pastPathD += `L ${x + 6},${baselineY - 10} `;
      pastPathD += `Q ${x + 18},${baselineY + 6} ${x + 28},${baselineY} `;
    }
    curX = x + 28;
  });

  drawGentleBaseline(nowX);
  pastPathD += `L ${nowX},${baselineY} `;
  futurePathD += `L 1800,${baselineY} `;

  const activeFocusEvent = ecgEventPositions.find(e => e.session_uuid === (hoveredUuid || selectedUuid)) || ecgEventPositions[ecgEventPositions.length - 1];

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden" style={{ background: 'var(--cinder-base)', color: 'var(--cinder-text)' }}>

      {/* Header Bar */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-6 py-3"
        style={{
          borderBottom: '1px solid var(--cinder-line)',
          background: isLight ? '#ffffff' : '#0a0a0d',
        }}
      >
        <div className="flex items-center gap-3">
          <BackToUpper label={backLabel} onClick={() => goBack()} />

          <span className="text-[12px] opacity-70 font-mono" style={{ color: 'var(--cinder-text-dim)' }}>
            (Preset ID: {presetId})
          </span>

          <span
            className="text-[10px] tracking-wider uppercase px-2 py-0.5 rounded font-semibold"
            style={{
              color: 'var(--cinder-flame)',
              background: 'var(--cinder-flame-dim)',
              border: '1px solid rgba(255, 74, 8, 0.3)',
            }}
          >
            Heartbeat Memory Ledger
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border"
            style={{
              background: isLight ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.03)',
              borderColor: 'var(--cinder-line)',
              color: 'var(--cinder-text-dim)',
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--cinder-ember)' }} />
            只读账本 (GET Only · 无写/删除 API)
          </div>
        </div>
      </div>

      {/* Electrocardiogram (ECG / EKG) Visual Banner Wrapper */}
      <section
        className="relative h-[185px] border-b flex flex-col shrink-0 transition-colors duration-200"
        style={{
          background: isLight ? '#f4f1ea' : '#020203',
          borderColor: 'var(--cinder-line)',
        }}
      >
        {/* Floating Focus Tooltip Badge */}
        <div
          className="absolute top-2 left-6 px-3.5 py-1 rounded-full text-[11px] font-mono flex items-center gap-2.5 z-40 pointer-events-none shadow-md"
          style={{
            background: isLight ? '#ffffff' : 'rgba(10, 10, 12, 0.95)',
            border: '1px solid var(--cinder-flame)',
            backdropFilter: 'blur(8px)',
            color: 'var(--cinder-text)',
          }}
        >
          <span style={{ color: 'var(--cinder-flame)' }}>⚡ 心律波形聚焦:</span>
          <span>
            {activeFocusEvent ? `Attempt #${activeFocusEvent.attempt_number || 1} (${activeFocusEvent.status})` : '暂无节点'}
          </span>
          <span style={{ opacity: 0.4 }}>|</span>
          <span style={{ color: isLight ? '#1d4ed8' : '#60a5fa' }}>
            {activeFocusEvent ? formatToLocalTime(activeFocusEvent.started_at || activeFocusEvent.completed_at) : 'N/A'}
          </span>
        </div>

        {/* Scroll Hint Badge */}
        <div
          className="absolute top-2 right-6 px-3 py-1 rounded-full text-[11px] flex items-center gap-1.5 z-40 pointer-events-none"
          style={{
            background: isLight ? 'rgba(223, 62, 0, 0.08)' : 'rgba(255, 74, 8, 0.12)',
            border: '1px solid rgba(255, 74, 8, 0.3)',
            color: 'var(--cinder-flame)',
          }}
        >
          <span>↔ 按住拖动或滑动滚动条 (Drag or Scroll)</span>
        </div>

        {/* Scrollable Canvas Track */}
        <div
          ref={scrollContainerRef}
          className="w-full h-full overflow-x-auto overflow-y-hidden relative smooth-scroll cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          <div
            className="w-[1800px] h-full relative"
            style={{
              backgroundImage: isLight
                ? 'linear-gradient(to right, rgba(138, 46, 22, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(138, 46, 22, 0.08) 1px, transparent 1px)'
                : 'linear-gradient(to right, rgba(255, 74, 8, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 74, 8, 0.05) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          >
            {/* SVG Wave Surface */}
            <svg className="w-full h-[140px] absolute top-0 left-0 z-10" viewBox="0 0 1800 140" preserveAspectRatio="none">
              <defs>
                <linearGradient id="scanGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={isLight ? 'rgba(223, 62, 0, 0.35)' : 'rgba(255, 74, 8, 0.4)'} />
                  <stop offset="100%" stopColor={isLight ? 'rgba(223, 62, 0, 0)' : 'rgba(255, 74, 8, 0)'} />
                </linearGradient>
              </defs>

              {/* Past Solid Wave */}
              <path
                d={pastPathD}
                fill="none"
                stroke="var(--cinder-flame)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: isLight ? 'drop-shadow(0 0 4px rgba(223, 62, 0, 0.4))' : 'drop-shadow(0 0 8px rgba(255, 74, 8, 0.8))' }}
              />

              {/* Future Muted Line */}
              <path
                d={futurePathD}
                fill="none"
                stroke={isLight ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.15)'}
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />

              {/* Scanning Radar Line */}
              <g className="pointer-events-none">
                <line x1={nowX} y1="0" x2={nowX} y2="140" stroke="var(--cinder-flame)" strokeWidth="1.5" style={{ filter: 'drop-shadow(0 0 6px var(--cinder-flame))' }} />
                <rect x={nowX} y="0" width="120" height="140" fill="url(#scanGradient)" className="animate-pulse" />
              </g>

              {/* Peak Node Circles */}
              <g>
                {ecgEventPositions.map(ev => {
                  const isSelected = ev.session_uuid === selectedUuid;
                  return (
                    <circle
                      key={ev.session_uuid}
                      cx={ev.ecgX}
                      cy={ev.ecgY}
                      r={isSelected ? 7.5 : 5.5}
                      fill={ev.isDownward ? '#f43f5e' : '#10b981'}
                      stroke={isLight ? '#ffffff' : '#ffffff'}
                      strokeWidth="1.5"
                      className="cursor-pointer transition-all duration-200 hover:r-8"
                      onMouseEnter={() => setHoveredUuid(ev.session_uuid)}
                      onMouseLeave={() => setHoveredUuid(null)}
                      onClick={() => handleSelectEvent(ev.session_uuid, ev.ecgX)}
                    >
                      <title>{`Attempt #${ev.attempt_number || 1} (${ev.status})`}</title>
                    </circle>
                  );
                })}
              </g>

              {/* Pulsing Beacon Circle */}
              {activeFocusEvent && (
                <g
                  className="pointer-events-none transition-transform duration-300"
                  transform={`translate(${activeFocusEvent.ecgX}, ${activeFocusEvent.ecgY})`}
                >
                  <circle cx="0" cy="0" r="8" fill="none" stroke="var(--cinder-flame)" strokeWidth="2" className="animate-ping opacity-75" />
                  <circle cx="0" cy="0" r="3.5" fill={isLight ? 'var(--cinder-flame)' : '#ffffff'} />
                </g>
              )}
            </svg>

            {/* Dense Retry Burst Bracket Tag */}
            {Object.keys(retryGroups).length > 0 && (
              <div
                className="absolute top-2 text-[10px] px-2 py-0.5 rounded pointer-events-none z-0 whitespace-nowrap font-medium"
                style={{
                  left: '980px',
                  transform: 'translateX(-50%)',
                  color: isLight ? '#be123c' : '#fda4af',
                  background: isLight ? 'rgba(225, 29, 72, 0.1)' : 'rgba(244, 63, 94, 0.15)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                }}
              >
                ⚡ 历史重试 Task 关联群
              </div>
            )}

            {/* Dedicated Bottom Time Axis Bar */}
            <div
              className="absolute bottom-0 left-0 w-[1800px] h-[42px] z-10"
              style={{
                background: isLight ? 'rgba(235, 230, 220, 0.95)' : 'rgba(4, 4, 6, 0.85)',
                borderTop: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              {ecgEventPositions.map(ev => {
                const isActive = ev.session_uuid === selectedUuid || ev.session_uuid === hoveredUuid;
                const isFailed = ev.status === 'failed';

                return (
                  <div
                    key={ev.session_uuid}
                    className={`absolute top-2 font-mono text-[11px] px-1.5 py-0.5 rounded cursor-pointer transition-all duration-200 flex items-center gap-1 -translate-x-1/2 ${
                      isActive ? 'z-30 font-semibold text-white -translate-y-6 shadow-md' : 'z-10 text-gray-500 hover:text-black'
                    }`}
                    style={{
                      left: `${ev.ecgX}px`,
                      color: isActive ? '#ffffff' : (isLight ? '#443e3b' : 'var(--cinder-text-dim)'),
                      background: isActive
                        ? (isFailed ? 'rgba(244, 63, 94, 0.95)' : 'rgba(16, 185, 129, 0.95)')
                        : 'transparent',
                      border: isActive
                        ? '1px solid #ffffff'
                        : '1px solid transparent',
                    }}
                    onMouseEnter={() => setHoveredUuid(ev.session_uuid)}
                    onMouseLeave={() => setHoveredUuid(null)}
                    onClick={() => handleSelectEvent(ev.session_uuid, ev.ecgX)}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: isFailed ? '#f43f5e' : '#10b981' }}
                    />
                    {isActive
                      ? `${formatToLocalTime(ev.started_at || ev.completed_at).split(' ')[1] || ''} [Att #${ev.attempt_number || 1} ${isFailed ? '⬇️ 失败' : '⬆️ 成功'}]`
                      : (ev.started_at ? new Date(ev.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Event')
                    }
                  </div>
                );
              })}

              {/* NOW Tick Label */}
              <div
                className="absolute top-2 font-mono text-[11px] px-2 py-0.5 rounded font-bold -translate-x-1/2 z-10"
                style={{
                  left: `${nowX}px`,
                  color: 'var(--cinder-flame)',
                  background: 'var(--cinder-flame-dim)',
                  border: '1px solid rgba(255, 74, 8, 0.4)',
                }}
              >
                📍 NOW (当前时间点)
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Main Content Area — Theme-aware styling */}
      <main className="flex-1 flex relative overflow-hidden">
        <div className="flex-1 flex flex-col p-6 md:p-8 overflow-y-auto">

          {/* Controls & Filter Toolbar */}
          <section
            className="flex items-center justify-between p-3.5 mb-4 rounded-md border"
            style={{
              background: isLight ? '#ffffff' : '#0a0a0d',
              borderColor: 'var(--cinder-line)',
            }}
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--cinder-text-dim)' }}>触发源:</span>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded border outline-none cursor-pointer"
                  style={{
                    background: isLight ? '#f4f1ea' : 'var(--cinder-base)',
                    borderColor: 'var(--cinder-line)',
                    color: 'var(--cinder-text)',
                  }}
                >
                  <option value="all">全部触发源 (All Sources)</option>
                  <option value="auto">auto (系统定时/Cron ~2.5h)</option>
                  <option value="agent">agent (智能体自发发起)</option>
                  <option value="notification">notification (通知推送)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--cinder-text-dim)' }}>状态过滤:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded border outline-none cursor-pointer"
                  style={{
                    background: isLight ? '#f4f1ea' : 'var(--cinder-base)',
                    borderColor: 'var(--cinder-line)',
                    color: 'var(--cinder-text)',
                  }}
                >
                  <option value="all">全部状态 (All Statuses)</option>
                  <option value="succeeded">succeeded (仅成功)</option>
                  <option value="failed">failed (仅失败/重试)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchEvents}
                className="px-3 py-1 text-xs rounded border transition-colors hover:border-orange-500"
                style={{
                  background: isLight ? '#ffffff' : 'var(--cinder-base)',
                  borderColor: 'var(--cinder-line)',
                  color: 'var(--cinder-text)',
                }}
              >
                🔄 刷新 (GET /api/heartbeat/events/)
              </button>
            </div>
          </section>

          {/* Loading & Error States */}
          {loading && (
            <div className="py-16 text-center text-xs opacity-60 animate-pulse" style={{ color: 'var(--cinder-text-dim)' }}>
              正在加载心跳只读账本 (Loading Heartbeat Events)...
            </div>
          )}

          {error && (
            <div className="p-4 mb-4 rounded border text-xs font-mono" style={{ background: 'rgba(244, 63, 94, 0.08)', borderColor: 'rgba(244, 63, 94, 0.3)', color: '#fda4af' }}>
              ⚠️ 发生错误: {error}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filteredEvents.length === 0 && (
            <div
              className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded border border-dashed"
              style={{
                background: isLight ? '#ffffff' : '#0a0a0d',
                borderColor: 'var(--cinder-line)',
              }}
            >
              <svg className="w-12 h-12 mb-4 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4l3 3" />
              </svg>
              <div className="text-base font-medium mb-1" style={{ color: 'var(--cinder-text)' }}>
                暂无心跳历史记录 (No Heartbeat Events)
              </div>
              <div className="text-xs max-w-sm leading-relaxed" style={{ color: 'var(--cinder-text-dim)' }}>
                当前 Preset (id={presetId}) 尚未触发或记录任何 Heartbeat 会话。<br />
                GET /api/heartbeat/events/?preset_id={presetId} 返回了空数组 <code style={{ color: 'var(--cinder-flame)' }}>events: []</code>。
              </div>
            </div>
          )}

          {/* Event History Cards List */}
          {!loading && !error && filteredEvents.length > 0 && (
            <div className="flex flex-col gap-3">
              {filteredEvents.map((ev) => {
                const isSelected = ev.session_uuid === selectedUuid;
                const isFailed = ev.status === 'failed';
                const ecgObj = ecgEventPositions.find(p => p.session_uuid === ev.session_uuid);

                return (
                  <article
                    key={ev.session_uuid}
                    onClick={() => handleSelectEvent(ev.session_uuid, ecgObj?.ecgX)}
                    className={`p-4 rounded-md border transition-all duration-200 cursor-pointer flex flex-col gap-3 relative ${
                      isSelected
                        ? 'border-orange-500 shadow-[0_0_15px_rgba(255,74,8,0.15)]'
                        : 'hover:border-orange-500/50'
                    }`}
                    style={{
                      background: isSelected
                        ? (isLight ? 'rgba(223, 62, 0, 0.05)' : 'rgba(255, 74, 8, 0.04)')
                        : (isLight ? '#ffffff' : '#0a0a0d'),
                      borderColor: isSelected ? 'var(--cinder-flame)' : 'var(--cinder-line)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded flex items-center gap-1.5 ${
                            isFailed ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30' : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                          }`}
                        >
                          {isFailed ? '✕ Failed' : '✓ Succeeded'}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded border" style={{ background: isLight ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.04)', borderColor: 'var(--cinder-line)', color: 'var(--cinder-text-dim)' }}>
                          🤖 launch_source: {ev.launch_source}
                        </span>
                        {ev.domain && (
                          <span className="text-[11px] px-2 py-0.5 rounded border bg-blue-500/10 text-blue-600 border-blue-500/20">
                            domain: "{ev.domain}"
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[11px]" style={{ color: 'var(--cinder-text-dim)' }}>
                        {formatToLocalTime(ev.started_at || ev.completed_at)}
                      </div>
                    </div>

                    {/* Content / Error preview */}
                    {isFailed ? (
                      <div className="text-xs italic p-2.5 rounded border bg-rose-500/5 border-rose-500/15 text-rose-500">
                        [心跳中断/失败] {ev.content || '详情请在侧边栏查看 error_summary'}
                      </div>
                    ) : (
                      <div
                        className="text-xs p-2.5 rounded border leading-relaxed line-clamp-3"
                        style={{
                          background: isLight ? '#f7f4ef' : 'rgba(0, 0, 0, 0.4)',
                          borderColor: 'var(--cinder-line)',
                          color: 'var(--cinder-text)',
                        }}
                      >
                        {ev.content || '(无摘要正文)'}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--cinder-text-faint)' }}>
                      <span className="font-mono" style={{ color: 'var(--cinder-text-dim)' }}>
                        UUID: {ev.session_uuid}
                      </span>
                      <span>
                        Attempt #{ev.attempt_number || 1} {isFailed ? '(向下失败峰 ⬇️)' : '(向上成功峰 ⬆️)'}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Pagination Bar */}
          {!loading && !error && (
            <footer
              className="mt-4 flex items-center justify-between p-3 rounded-md border text-xs"
              style={{
                background: isLight ? '#ffffff' : '#0a0a0d',
                borderColor: 'var(--cinder-line)',
                color: 'var(--cinder-text-dim)',
              }}
            >
              <div>
                显示第 <strong>{events.length > 0 ? offset + 1 : 0} - {offset + events.length}</strong> 条，共 <strong>{totalCount}</strong> 条 (has_more: {hasMore ? 'true' : 'false'})
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  className="px-2.5 py-1 rounded border disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: isLight ? '#ffffff' : 'var(--cinder-base)', borderColor: 'var(--cinder-line)', color: 'var(--cinder-text)' }}
                >
                  上一页
                </button>
                <button
                  disabled={!hasMore}
                  onClick={() => setOffset(offset + limit)}
                  className="px-2.5 py-1 rounded border disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: isLight ? '#ffffff' : 'var(--cinder-base)', borderColor: 'var(--cinder-line)', color: 'var(--cinder-text)' }}
                >
                  下一页
                </button>
              </div>
            </footer>
          )}

        </div>

        {/* Slide-over Detail Drawer Inspector — Solid Opaque Dark/Light Surface */}
        <aside
          className={`absolute top-0 right-0 w-[500px] h-full shadow-2xl transition-all duration-300 z-50 flex flex-col ${
            drawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          style={{
            background: isLight ? '#ffffff' : '#0e0e12',
            borderLeft: '1px solid var(--cinder-line)',
            boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.8)',
          }}
        >
          <div className="p-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--cinder-line)', background: isLight ? '#f4f1ea' : 'rgba(0, 0, 0, 0.4)' }}>
            <div className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--cinder-text)' }}>
              🔍 Heartbeat Event 详情
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              className="w-7 h-7 rounded flex items-center justify-center border transition-colors hover:border-orange-500"
              style={{ borderColor: 'var(--cinder-line)', color: 'var(--cinder-text-dim)' }}
            >
              ✕
            </button>
          </div>

          <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-5">
            {detailLoading ? (
              <div className="py-12 text-center text-xs opacity-60 animate-pulse" style={{ color: 'var(--cinder-text-dim)' }}>
                加载详情中 (Loading Event Detail)...
              </div>
            ) : eventDetail ? (
              <>
                {/* Metadata Grid */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--cinder-flame)' }}>
                    📌 基础元数据 (Metadata)
                  </span>
                  <div
                    className="grid grid-cols-[140px_1fr] gap-2 p-3 rounded border text-xs"
                    style={{
                      background: isLight ? '#f7f4ef' : 'rgba(0,0,0,0.5)',
                      borderColor: 'var(--cinder-line)',
                    }}
                  >
                    <span style={{ color: 'var(--cinder-text-dim)' }}>Session UUID</span>
                    <span className="font-mono break-all" style={{ color: 'var(--cinder-text)' }}>{eventDetail.session_uuid}</span>

                    <span style={{ color: 'var(--cinder-text-dim)' }}>Preset</span>
                    <span className="font-mono" style={{ color: 'var(--cinder-text)' }}>ID: {eventDetail.preset_id} ({eventDetail.preset_name})</span>

                    <span style={{ color: 'var(--cinder-text-dim)' }}>Status</span>
                    <span className="font-mono uppercase font-semibold" style={{ color: eventDetail.status === 'failed' ? '#f43f5e' : '#10b981' }}>
                      {eventDetail.status}
                    </span>

                    <span style={{ color: 'var(--cinder-text-dim)' }}>Launch Source</span>
                    <span className="font-mono" style={{ color: 'var(--cinder-text)' }}>{eventDetail.launch_source}</span>

                    <span style={{ color: 'var(--cinder-text-dim)' }}>Domain</span>
                    <span className="font-mono" style={{ color: 'var(--cinder-text)' }}>{eventDetail.domain || '(空)'}</span>

                    <span style={{ color: 'var(--cinder-text-dim)' }}>Attempt Number</span>
                    <span className="font-mono" style={{ color: 'var(--cinder-text)' }}>第 {eventDetail.attempt_number || 1} 次尝试</span>

                    <span style={{ color: 'var(--cinder-text-dim)' }}>WakeUpTask ID</span>
                    <span className="font-mono" style={{ color: 'var(--cinder-text)' }}>{eventDetail.wake_up_task_id ?? 'null'}</span>

                    <span style={{ color: 'var(--cinder-text-dim)' }}>Source Conversation</span>
                    <span className="font-mono" style={{ color: 'var(--cinder-text)' }}>{eventDetail.source_conversation_id ?? 'null'}</span>

                    <span style={{ color: 'var(--cinder-text-dim)' }}>Finalization Reason</span>
                    <span className="font-mono" style={{ color: 'var(--cinder-text)' }}>{eventDetail.finalization_reason ?? 'null'}</span>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--cinder-flame)' }}>
                    ⏰ 时间与时区 (UTC 转换本地时区)
                  </span>
                  <div
                    className="grid grid-cols-[140px_1fr] gap-2 p-3 rounded border text-xs"
                    style={{
                      background: isLight ? '#f7f4ef' : 'rgba(0,0,0,0.5)',
                      borderColor: 'var(--cinder-line)',
                    }}
                  >
                    <span style={{ color: 'var(--cinder-text-dim)' }}>Started At</span>
                    <span className="font-mono" style={{ color: 'var(--cinder-text)' }}>
                      {formatToLocalTime(eventDetail.started_at)}
                      <br /><span className="text-[10px] opacity-60">UTC: {eventDetail.started_at}</span>
                    </span>

                    <span style={{ color: 'var(--cinder-text-dim)' }}>Completed At</span>
                    <span className="font-mono" style={{ color: 'var(--cinder-text)' }}>
                      {formatToLocalTime(eventDetail.completed_at)}
                      <br /><span className="text-[10px] opacity-60">UTC: {eventDetail.completed_at}</span>
                    </span>

                    <span style={{ color: 'var(--cinder-text-dim)' }}>Acknowledged At</span>
                    <span className="font-mono" style={{ color: 'var(--cinder-text)' }}>
                      {eventDetail.acknowledged_at ? formatToLocalTime(eventDetail.acknowledged_at) : '未确认 (null)'}
                    </span>
                  </div>
                </div>

                {/* Seed Message */}
                {eventDetail.seed_message && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--cinder-flame)' }}>
                      🌱 Seed Message (种子消息)
                    </span>
                    <div
                      className="p-3 rounded border font-mono text-xs whitespace-pre-wrap max-h-48 overflow-y-auto"
                      style={{
                        background: isLight ? '#f4f1ea' : '#000000',
                        borderColor: 'var(--cinder-line)',
                        color: isLight ? '#1a56db' : '#a5d6ff',
                      }}
                    >
                      {eventDetail.seed_message}
                    </div>
                  </div>
                )}

                {/* Error summary or Content */}
                {eventDetail.status === 'failed' ? (
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 text-rose-500">
                      ⚠️ Error Summary (安全错误摘要)
                    </span>
                    <div className="p-3 rounded border font-mono text-xs whitespace-pre-wrap text-rose-500 bg-rose-500/10 border-rose-500/30">
                      {eventDetail.error_summary || 'No error details provided.'}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--cinder-flame)' }}>
                      📝 Final Summary (最终摘要正文)
                    </span>
                    <div
                      className="p-3 rounded border text-xs leading-relaxed whitespace-pre-wrap"
                      style={{
                        background: isLight ? '#f7f4ef' : 'rgba(0,0,0,0.6)',
                        borderColor: 'var(--cinder-line)',
                        color: 'var(--cinder-text)',
                      }}
                    >
                      {eventDetail.content || '(空摘要)'}
                    </div>
                  </div>
                )}

                {/* Safe Tool History */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--cinder-flame)' }}>
                    🧰 Safe Tool History ({eventDetail.tool_history?.length || 0} calls)
                  </span>
                  <div className="flex flex-col gap-2">
                    {Array.isArray(eventDetail.tool_history) && eventDetail.tool_history.length > 0 ? (
                      eventDetail.tool_history.map((t, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded border flex flex-col gap-1 text-xs"
                          style={{
                            background: isLight ? '#f7f4ef' : 'rgba(0,0,0,0.4)',
                            borderColor: 'var(--cinder-line)',
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-semibold text-blue-500">🛠️ {t.tool_name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded uppercase bg-emerald-500/10 text-emerald-500">{t.status || 'success'}</span>
                          </div>
                          <div className="text-[11px]" style={{ color: 'var(--cinder-text-faint)' }}>
                            Time: {formatToLocalTime(t.timestamp)} | Result: {t.summary || JSON.stringify(t)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs italic" style={{ color: 'var(--cinder-text-faint)' }}>
                        无工具执行记录 (Empty Tool History)
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-xs opacity-60" style={{ color: 'var(--cinder-text-dim)' }}>
                请选择一条心跳记录以查看完整详情。
              </div>
            )}
          </div>
        </aside>
      </main>

    </div>
  );
}
