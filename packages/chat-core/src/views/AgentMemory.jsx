import React, { useState, useEffect, useRef, useCallback } from 'react';
import { heartbeatApi, useTheme } from 'exo-shared';
import BackToUpper from '../components/layout/BackButton';

/* ── Time Helpers ── */
function formatToLocalTime(utcIso) {
  if (!utcIso) return 'N/A';
  try {
    const date = new Date(utcIso);
    if (isNaN(date.getTime())) return utcIso;
    return date.toLocaleString();
  } catch (e) {
    return utcIso;
  }
}

function formatTimeOnly(utcIso) {
  if (!utcIso) return 'N/A';
  try {
    const date = new Date(utcIso);
    if (isNaN(date.getTime())) return utcIso;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch (e) {
    return utcIso;
  }
}

function formatShortDateTime(utcIso) {
  if (!utcIso) return 'N/A';
  try {
    const date = new Date(utcIso);
    if (isNaN(date.getTime())) return utcIso;
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${m}/${d} ${time}`;
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
  }, [presetId, limit, offset, selectedUuid]);

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
  const baselineY = 48;

  const sortedChronologicalEvents = [...filteredEvents].sort((a, b) => {
    const tA = new Date(a.started_at || a.completed_at || 0).getTime();
    const tB = new Date(b.started_at || b.completed_at || 0).getTime();
    return tA - tB;
  });

  const ecgEventPositions = sortedChronologicalEvents.map((ev, index) => {
    const isFailed = ev.status === 'failed';
    const step = sortedChronologicalEvents.length > 1 ? 1050 / (sortedChronologicalEvents.length - 1) : 0;
    const ecgX = sortedChronologicalEvents.length === 1 ? 750 : 200 + index * step;
    const ecgY = isFailed ? 78 : 16;
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

      {/* ── Top Header Bar (Mobile-first responsive) ── */}
      <div
        className="flex-shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6 sm:py-3"
        style={{
          borderBottom: '1px solid var(--cinder-line)',
          background: isLight ? '#ffffff' : '#0a0a0d',
        }}
      >
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="hidden md:inline-flex">
            <BackToUpper label={backLabel} onClick={() => goBack()} />
          </span>

          <span className="text-[11px] sm:text-xs opacity-70 font-mono" style={{ color: 'var(--cinder-text-dim)' }}>
            #{presetId}
          </span>

          <span
            className="text-[10px] tracking-wider uppercase px-2 py-0.5 rounded font-semibold whitespace-nowrap"
            style={{
              color: 'var(--cinder-flame)',
              background: 'var(--cinder-flame-dim)',
              border: '1px solid rgba(255, 74, 8, 0.3)',
            }}
          >
            Heartbeat Ledger
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border whitespace-nowrap"
            style={{
              background: isLight ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.03)',
              borderColor: 'var(--cinder-line)',
              color: 'var(--cinder-text-dim)',
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--cinder-ember)' }} />
            只读账本 (GET Only)
          </div>
        </div>
      </div>

      {/* ── Electrocardiogram (ECG / EKG) Visual Banner ── */}
      <section
        className="relative h-[130px] sm:h-[155px] md:h-[175px] border-b flex flex-col shrink-0 transition-colors duration-200"
        style={{
          background: isLight ? '#f4f1ea' : '#020203',
          borderColor: 'var(--cinder-line)',
        }}
      >
        {/* Top Indicators Bar (Responsive, no overlap) */}
        <div className="absolute top-1.5 sm:top-2 inset-x-3 sm:inset-x-6 flex items-center justify-between pointer-events-none z-30">
          {/* Floating Focus Tooltip Badge */}
          <div
            className="px-2.5 py-0.5 sm:px-3.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-mono flex items-center gap-1.5 sm:gap-2 shadow-sm max-w-[80vw] truncate"
            style={{
              background: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(10, 10, 12, 0.92)',
              border: '1px solid var(--cinder-flame)',
              backdropFilter: 'blur(8px)',
              color: 'var(--cinder-text)',
            }}
          >
            <span style={{ color: 'var(--cinder-flame)' }}>⚡ 波形:</span>
            <span className="font-semibold">
              {activeFocusEvent ? `Att #${activeFocusEvent.attempt_number || 1} (${activeFocusEvent.status})` : '暂无节点'}
            </span>
            <span className="opacity-40 hidden sm:inline">|</span>
            <span className="hidden sm:inline" style={{ color: isLight ? '#1d4ed8' : '#60a5fa' }}>
              {activeFocusEvent ? formatTimeOnly(activeFocusEvent.started_at || activeFocusEvent.completed_at) : 'N/A'}
            </span>
          </div>

          {/* Scroll Hint Badge (hidden on extra small screens) */}
          <div
            className="hidden sm:flex px-2.5 py-0.5 rounded-full text-[10px] items-center gap-1"
            style={{
              background: isLight ? 'rgba(223, 62, 0, 0.08)' : 'rgba(255, 74, 8, 0.12)',
              border: '1px solid rgba(255, 74, 8, 0.3)',
              color: 'var(--cinder-flame)',
            }}
          >
            <span>↔ 滑动查看波形 (Drag / Swipe)</span>
          </div>
        </div>

        {/* Scrollable Canvas Track with Touch Support */}
        <div
          ref={scrollContainerRef}
          className="w-full h-full overflow-x-auto overflow-y-hidden relative smooth-scroll cursor-grab active:cursor-grabbing touch-pan-x"
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          style={{ WebkitOverflowScrolling: 'touch' }}
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
            <svg className="w-full h-[100px] sm:h-[120px] absolute top-0 left-0 z-10" viewBox="0 0 1800 120" preserveAspectRatio="none">
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
                style={{ filter: isLight ? 'drop-shadow(0 0 3px rgba(223, 62, 0, 0.4))' : 'drop-shadow(0 0 6px rgba(255, 74, 8, 0.8))' }}
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
                <line x1={nowX} y1="0" x2={nowX} y2="120" stroke="var(--cinder-flame)" strokeWidth="1.5" style={{ filter: 'drop-shadow(0 0 6px var(--cinder-flame))' }} />
                <rect x={nowX} y="0" width="100" height="120" fill="url(#scanGradient)" className="animate-pulse" />
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
                      r={isSelected ? 7 : 5}
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
                  <circle cx="0" cy="0" r="7" fill="none" stroke="var(--cinder-flame)" strokeWidth="2" className="animate-ping opacity-75" />
                  <circle cx="0" cy="0" r="3" fill={isLight ? 'var(--cinder-flame)' : '#ffffff'} />
                </g>
              )}
            </svg>

            {/* Dense Retry Burst Tag */}
            {Object.keys(retryGroups).length > 0 && (
              <div
                className="absolute top-2 text-[9px] sm:text-[10px] px-2 py-0.5 rounded pointer-events-none z-0 whitespace-nowrap font-medium"
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
              className="absolute bottom-0 left-0 w-[1800px] h-[34px] sm:h-[38px] z-10"
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
                    className={`absolute top-1.5 font-mono text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded cursor-pointer transition-all duration-200 flex items-center gap-1 -translate-x-1/2 ${
                      isActive ? 'z-30 font-semibold text-white -translate-y-4 sm:-translate-y-5 shadow-sm' : 'z-10 text-gray-500 hover:text-black'
                    }`}
                    style={{
                      left: `${ev.ecgX}px`,
                      color: isActive ? '#ffffff' : (isLight ? '#443e3b' : 'var(--cinder-text-dim)'),
                      background: isActive
                        ? (isFailed ? 'rgba(244, 63, 94, 0.95)' : 'rgba(16, 185, 129, 0.95)')
                        : 'transparent',
                      border: isActive ? '1px solid #ffffff' : '1px solid transparent',
                    }}
                    onMouseEnter={() => setHoveredUuid(ev.session_uuid)}
                    onMouseLeave={() => setHoveredUuid(null)}
                    onClick={() => handleSelectEvent(ev.session_uuid, ev.ecgX)}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: isFailed ? '#f43f5e' : '#10b981' }}
                    />
                    <span>
                      {isActive
                        ? `${formatTimeOnly(ev.started_at || ev.completed_at)} (#${ev.attempt_number || 1})`
                        : formatTimeOnly(ev.started_at || ev.completed_at)
                      }
                    </span>
                  </div>
                );
              })}

              {/* NOW Tick Label */}
              <div
                className="absolute top-1.5 font-mono text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded font-bold -translate-x-1/2 z-10"
                style={{
                  left: `${nowX}px`,
                  color: 'var(--cinder-flame)',
                  background: 'var(--cinder-flame-dim)',
                  border: '1px solid rgba(255, 74, 8, 0.4)',
                }}
              >
                📍 NOW
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Main Content Area (Mobile First) ── */}
      <main className="flex-1 flex relative overflow-hidden">
        <div className="flex-1 flex flex-col p-3.5 sm:p-5 md:p-6 overflow-y-auto overscroll-contain">

          {/* Controls & Filter Toolbar (Responsive Flexbox) */}
          <section
            className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 sm:p-3.5 mb-3 sm:mb-4 rounded-xl border"
            style={{
              background: isLight ? '#ffffff' : '#0a0a0d',
              borderColor: 'var(--cinder-line)',
            }}
          >
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1 min-w-[200px]">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] sm:text-xs shrink-0" style={{ color: 'var(--cinder-text-dim)' }}>源:</span>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="px-2 py-1 text-xs rounded-lg border outline-none cursor-pointer"
                  style={{
                    background: isLight ? '#f4f1ea' : 'var(--cinder-base)',
                    borderColor: 'var(--cinder-line)',
                    color: 'var(--cinder-text)',
                  }}
                >
                  <option value="all">全部源 (All)</option>
                  <option value="auto">auto (定时/Cron)</option>
                  <option value="agent">agent (智能体自发)</option>
                  <option value="notification">notification (通知)</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] sm:text-xs shrink-0" style={{ color: 'var(--cinder-text-dim)' }}>状态:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2 py-1 text-xs rounded-lg border outline-none cursor-pointer"
                  style={{
                    background: isLight ? '#f4f1ea' : 'var(--cinder-base)',
                    borderColor: 'var(--cinder-line)',
                    color: 'var(--cinder-text)',
                  }}
                >
                  <option value="all">全部状态 (All)</option>
                  <option value="succeeded">成功 (succeeded)</option>
                  <option value="failed">失败/重试 (failed)</option>
                </select>
              </div>
            </div>

            <button
              onClick={fetchEvents}
              className="px-3 py-1 text-xs rounded-lg border transition-colors hover:border-orange-500 flex items-center gap-1.5 shrink-0"
              style={{
                background: isLight ? '#ffffff' : 'var(--cinder-base)',
                borderColor: 'var(--cinder-line)',
                color: 'var(--cinder-text)',
              }}
            >
              <span>🔄</span>
              <span className="hidden sm:inline">刷新列表</span>
            </button>
          </section>

          {/* Loading State */}
          {loading && (
            <div className="py-12 text-center text-xs opacity-60 animate-pulse font-mono" style={{ color: 'var(--cinder-text-dim)' }}>
              正在加载心跳记录 (Loading Heartbeat Events)...
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-3.5 mb-4 rounded-xl border text-xs font-mono" style={{ background: 'rgba(244, 63, 94, 0.08)', borderColor: 'rgba(244, 63, 94, 0.3)', color: '#fda4af' }}>
              ⚠️ 发生错误: {error}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filteredEvents.length === 0 && (
            <div
              className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl border border-dashed"
              style={{
                background: isLight ? '#ffffff' : '#0a0a0d',
                borderColor: 'var(--cinder-line)',
              }}
            >
              <svg className="w-10 h-10 mb-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4l3 3" />
              </svg>
              <div className="text-sm font-semibold mb-1" style={{ color: 'var(--cinder-text)' }}>
                暂无心跳历史记录
              </div>
              <div className="text-xs max-w-sm leading-relaxed" style={{ color: 'var(--cinder-text-dim)' }}>
                当前 Preset (id={presetId}) 尚未触发或记录任何 Heartbeat 会话。
              </div>
            </div>
          )}

          {/* Event History Cards List */}
          {!loading && !error && filteredEvents.length > 0 && (
            <div className="flex flex-col gap-2.5 sm:gap-3">
              {filteredEvents.map((ev) => {
                const isSelected = ev.session_uuid === selectedUuid;
                const isFailed = ev.status === 'failed';
                const ecgObj = ecgEventPositions.find(p => p.session_uuid === ev.session_uuid);

                return (
                  <article
                    key={ev.session_uuid}
                    onClick={() => handleSelectEvent(ev.session_uuid, ecgObj?.ecgX)}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col gap-2.5 relative active:scale-[0.99] ${
                      isSelected
                        ? 'border-orange-500 shadow-[0_0_12px_rgba(255,74,8,0.12)]'
                        : 'hover:border-orange-500/40'
                    }`}
                    style={{
                      background: isSelected
                        ? (isLight ? 'rgba(223, 62, 0, 0.04)' : 'rgba(255, 74, 8, 0.04)')
                        : (isLight ? '#ffffff' : '#0a0a0d'),
                      borderColor: isSelected ? 'var(--cinder-flame)' : 'var(--cinder-line)',
                    }}
                  >
                    {/* Header Row: Badges on left, clean timestamp on right */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] sm:text-[11px] font-semibold uppercase px-2 py-0.5 rounded-md flex items-center gap-1 ${
                            isFailed ? 'bg-rose-500/10 text-rose-500 border border-rose-500/25' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                          }`}
                        >
                          {isFailed ? '✕ 失败' : '✓ 成功'}
                        </span>
                        <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md border font-mono" style={{ background: isLight ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.04)', borderColor: 'var(--cinder-line)', color: 'var(--cinder-text-dim)' }}>
                          {ev.launch_source}
                        </span>
                        {ev.domain && (
                          <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md border bg-blue-500/10 text-blue-500 border-blue-500/20 truncate max-w-[140px]">
                            {ev.domain}
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[10px] sm:text-[11px]" style={{ color: 'var(--cinder-text-dim)' }}>
                        {formatShortDateTime(ev.started_at || ev.completed_at)}
                      </div>
                    </div>

                    {/* Content / Error preview */}
                    {isFailed ? (
                      <div className="text-xs italic p-2.5 rounded-lg border bg-rose-500/5 border-rose-500/15 text-rose-400 leading-relaxed">
                        [心跳中断/失败] {ev.content || '详情请点击查看 error_summary'}
                      </div>
                    ) : (
                      <div
                        className="text-xs p-2.5 rounded-lg border leading-relaxed line-clamp-3"
                        style={{
                          background: isLight ? '#f7f4ef' : 'rgba(0, 0, 0, 0.3)',
                          borderColor: 'var(--cinder-line)',
                          color: 'var(--cinder-text)',
                        }}
                      >
                        {ev.content || '(无摘要正文)'}
                      </div>
                    )}

                    {/* Footer Row */}
                    <div className="flex items-center justify-between text-[10px] sm:text-[11px] pt-1 border-t" style={{ borderColor: 'var(--cinder-line)', color: 'var(--cinder-text-faint)' }}>
                      <span className="font-mono truncate max-w-[180px] sm:max-w-none" style={{ color: 'var(--cinder-text-dim)' }}>
                        UUID: {ev.session_uuid?.slice(0, 8)}...{ev.session_uuid?.slice(-4)}
                      </span>
                      <span className="font-mono">
                        Attempt #{ev.attempt_number || 1} {isFailed ? '⬇️' : '⬆️'}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Pagination Bar */}
          {!loading && !error && events.length > 0 && (
            <footer
              className="mt-4 flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border text-xs"
              style={{
                background: isLight ? '#ffffff' : '#0a0a0d',
                borderColor: 'var(--cinder-line)',
                color: 'var(--cinder-text-dim)',
              }}
            >
              <div>
                共 <strong>{totalCount}</strong> 条
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  className="px-2.5 py-1 rounded-lg border disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: isLight ? '#ffffff' : 'var(--cinder-base)', borderColor: 'var(--cinder-line)', color: 'var(--cinder-text)' }}
                >
                  上一页
                </button>
                <button
                  disabled={!hasMore}
                  onClick={() => setOffset(offset + limit)}
                  className="px-2.5 py-1 rounded-lg border disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: isLight ? '#ffffff' : 'var(--cinder-base)', borderColor: 'var(--cinder-line)', color: 'var(--cinder-text)' }}
                >
                  下一页
                </button>
              </div>
            </footer>
          )}

        </div>

        {/* ── Mobile Backdrop for Detail Drawer ── */}
        {drawerOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />
        )}

        {/* ── Detail Drawer Inspector (Full responsive: Sheet on Mobile, Drawer on Desktop) ── */}
        <aside
          className={`
            fixed inset-y-0 right-0 z-50 w-full max-w-full sm:w-[480px] md:w-[480px]
            md:absolute md:top-0 md:h-full shadow-2xl transition-transform duration-300 flex flex-col
            ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}
          `}
          style={{
            background: isLight ? '#ffffff' : '#0e0e12',
            borderLeft: '1px solid var(--cinder-line)',
            boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.6)',
          }}
        >
          {/* Drawer Header */}
          <div
            className="p-3.5 sm:p-4 border-b flex items-center justify-between shrink-0"
            style={{
              borderColor: 'var(--cinder-line)',
              background: isLight ? '#f4f1ea' : 'rgba(0, 0, 0, 0.4)',
            }}
          >
            <div className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--cinder-text)' }}>
              🔍 Heartbeat 详情
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center border transition-colors hover:border-orange-500 text-sm font-bold"
              style={{ borderColor: 'var(--cinder-line)', color: 'var(--cinder-text-dim)' }}
              aria-label="关闭详情"
            >
              ✕
            </button>
          </div>

          {/* Drawer Body with smooth overscroll */}
          <div
            className="flex-1 p-4 sm:p-6 overflow-y-auto overscroll-contain flex flex-col gap-4 sm:gap-5 pb-24 md:pb-8"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {detailLoading ? (
              <div className="py-12 text-center text-xs opacity-60 animate-pulse font-mono" style={{ color: 'var(--cinder-text-dim)' }}>
                加载详情中 (Loading Event Detail)...
              </div>
            ) : eventDetail ? (
              <>
                {/* Metadata Stack / Grid */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--cinder-flame)' }}>
                    📌 基础元数据 (Metadata)
                  </span>
                  <div
                    className="flex flex-col gap-2 p-3 sm:p-3.5 rounded-xl border text-xs"
                    style={{
                      background: isLight ? '#f7f4ef' : 'rgba(0,0,0,0.4)',
                      borderColor: 'var(--cinder-line)',
                    }}
                  >
                    <div className="flex flex-col sm:grid sm:grid-cols-[120px_1fr] gap-0.5 sm:gap-2">
                      <span className="opacity-60" style={{ color: 'var(--cinder-text-dim)' }}>Session UUID:</span>
                      <span className="font-mono break-all font-semibold" style={{ color: 'var(--cinder-text)' }}>{eventDetail.session_uuid}</span>
                    </div>

                    <div className="flex flex-col sm:grid sm:grid-cols-[120px_1fr] gap-0.5 sm:gap-2">
                      <span className="opacity-60" style={{ color: 'var(--cinder-text-dim)' }}>Preset:</span>
                      <span className="font-mono" style={{ color: 'var(--cinder-text)' }}>ID {eventDetail.preset_id} ({eventDetail.preset_name})</span>
                    </div>

                    <div className="flex flex-col sm:grid sm:grid-cols-[120px_1fr] gap-0.5 sm:gap-2">
                      <span className="opacity-60" style={{ color: 'var(--cinder-text-dim)' }}>Status:</span>
                      <span className="font-mono uppercase font-bold" style={{ color: eventDetail.status === 'failed' ? '#f43f5e' : '#10b981' }}>
                        {eventDetail.status}
                      </span>
                    </div>

                    <div className="flex flex-col sm:grid sm:grid-cols-[120px_1fr] gap-0.5 sm:gap-2">
                      <span className="opacity-60" style={{ color: 'var(--cinder-text-dim)' }}>Launch Source:</span>
                      <span className="font-mono" style={{ color: 'var(--cinder-text)' }}>{eventDetail.launch_source}</span>
                    </div>

                    <div className="flex flex-col sm:grid sm:grid-cols-[120px_1fr] gap-0.5 sm:gap-2">
                      <span className="opacity-60" style={{ color: 'var(--cinder-text-dim)' }}>Domain:</span>
                      <span className="font-mono" style={{ color: 'var(--cinder-text)' }}>{eventDetail.domain || '(空)'}</span>
                    </div>

                    <div className="flex flex-col sm:grid sm:grid-cols-[120px_1fr] gap-0.5 sm:gap-2">
                      <span className="opacity-60" style={{ color: 'var(--cinder-text-dim)' }}>Attempt Number:</span>
                      <span className="font-mono" style={{ color: 'var(--cinder-text)' }}>第 {eventDetail.attempt_number || 1} 次尝试</span>
                    </div>

                    {eventDetail.wake_up_task_id && (
                      <div className="flex flex-col sm:grid sm:grid-cols-[120px_1fr] gap-0.5 sm:gap-2">
                        <span className="opacity-60" style={{ color: 'var(--cinder-text-dim)' }}>WakeUpTask ID:</span>
                        <span className="font-mono" style={{ color: 'var(--cinder-text)' }}>{eventDetail.wake_up_task_id}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timestamps */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--cinder-flame)' }}>
                    ⏰ 时间记录 (Timestamps)
                  </span>
                  <div
                    className="flex flex-col gap-2 p-3 sm:p-3.5 rounded-xl border text-xs"
                    style={{
                      background: isLight ? '#f7f4ef' : 'rgba(0,0,0,0.4)',
                      borderColor: 'var(--cinder-line)',
                    }}
                  >
                    <div className="flex flex-col sm:grid sm:grid-cols-[120px_1fr] gap-0.5 sm:gap-2">
                      <span className="opacity-60" style={{ color: 'var(--cinder-text-dim)' }}>Started At:</span>
                      <span className="font-mono" style={{ color: 'var(--cinder-text)' }}>
                        {formatToLocalTime(eventDetail.started_at)}
                      </span>
                    </div>

                    <div className="flex flex-col sm:grid sm:grid-cols-[120px_1fr] gap-0.5 sm:gap-2">
                      <span className="opacity-60" style={{ color: 'var(--cinder-text-dim)' }}>Completed At:</span>
                      <span className="font-mono" style={{ color: 'var(--cinder-text)' }}>
                        {formatToLocalTime(eventDetail.completed_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Seed Message */}
                {eventDetail.seed_message && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--cinder-flame)' }}>
                      🌱 Seed Message (种子消息)
                    </span>
                    <div
                      className="p-3 rounded-xl border font-mono text-xs whitespace-pre-wrap max-h-40 overflow-y-auto break-all"
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

                {/* Error Summary or Content */}
                {eventDetail.status === 'failed' ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 text-rose-500">
                      ⚠️ Error Summary (错误摘要)
                    </span>
                    <div className="p-3 rounded-xl border font-mono text-xs whitespace-pre-wrap text-rose-400 bg-rose-500/10 border-rose-500/30 break-all">
                      {eventDetail.error_summary || 'No error details provided.'}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--cinder-flame)' }}>
                      📝 Final Summary (最终摘要正文)
                    </span>
                    <div
                      className="p-3 rounded-xl border text-xs leading-relaxed whitespace-pre-wrap break-words"
                      style={{
                        background: isLight ? '#f7f4ef' : 'rgba(0,0,0,0.5)',
                        borderColor: 'var(--cinder-line)',
                        color: 'var(--cinder-text)',
                      }}
                    >
                      {eventDetail.content || '(空摘要)'}
                    </div>
                  </div>
                )}

                {/* Safe Tool History */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--cinder-flame)' }}>
                    🧰 Safe Tool History ({eventDetail.tool_history?.length || 0} calls)
                  </span>
                  <div className="flex flex-col gap-2">
                    {Array.isArray(eventDetail.tool_history) && eventDetail.tool_history.length > 0 ? (
                      eventDetail.tool_history.map((t, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl border flex flex-col gap-1 text-xs"
                          style={{
                            background: isLight ? '#f7f4ef' : 'rgba(0,0,0,0.4)',
                            borderColor: 'var(--cinder-line)',
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-semibold text-blue-500">🛠️ {t.tool_name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md uppercase bg-emerald-500/10 text-emerald-500">{t.status || 'success'}</span>
                          </div>
                          <div className="text-[11px] break-all" style={{ color: 'var(--cinder-text-faint)' }}>
                            {t.summary || JSON.stringify(t)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs italic p-3 rounded-xl border" style={{ borderColor: 'var(--cinder-line)', color: 'var(--cinder-text-faint)' }}>
                        无工具执行记录
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
