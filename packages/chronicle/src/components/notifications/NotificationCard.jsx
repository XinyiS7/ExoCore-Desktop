import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useNotificationContext } from '../../contexts/NotificationContext';

/**
 * Format a timestamp as relative time (Chinese).
 */
function relativeTime(ts) {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return '刚刚';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  const mon = Math.floor(day / 30);
  return `${mon} 个月前`;
}

export default function NotificationCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const { dismiss, navigateTo } = useNotificationContext();
  const navigate = useNavigate();

  const hasLongBody = item.body && item.body.length > 80;

  return (
    <div className="px-4 py-3 border-b border-white/5 last:border-b-0 animate-fade-in">
      {/* Header: sender + time */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.6875rem] font-semibold text-orange-400/80 truncate">
          来自: {item.senderName}
        </span>
        <span className="text-[0.625rem] text-neutral-500 shrink-0">
          {relativeTime(item.timestamp)}
        </span>
      </div>

      {/* Title */}
      {item.title && (
        <p className="text-sm text-neutral-100 mt-1.5 leading-snug">
          {item.title}
        </p>
      )}

      {/* Body — expandable */}
      <div
        className={`text-xs text-neutral-300 mt-1 leading-relaxed ${
          expanded ? '' : 'line-clamp-3'
        }`}
        onClick={() => setExpanded((e) => !e)}
        role="button"
        tabIndex={0}
      >
        {item.body || '(无内容)'}
      </div>

      {/* Expand/collapse toggle */}
      {hasLongBody && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-0.5 text-[0.625rem] text-neutral-500
                     hover:text-neutral-300 transition-colors mt-0.5"
        >
          {expanded ? (
            <>
              收起 <ChevronUp size={12} />
            </>
          ) : (
            <>
              展开 <ChevronDown size={12} />
            </>
          )}
        </button>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 mt-2 pt-2 border-t border-white/5">
        <button
          onClick={() => dismiss(item)}
          className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          关闭
        </button>
        <button
          onClick={() => navigateTo(item, navigate)}
          className="flex items-center gap-1 text-xs text-orange-400
                     hover:text-orange-300 transition-colors"
        >
          <ExternalLink size={12} />
          跳转
        </button>
      </div>
    </div>
  );
}
