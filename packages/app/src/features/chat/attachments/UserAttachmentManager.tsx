import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, FileText, RefreshCw, Snowflake, Trash2 } from 'lucide-react';
import type { UserAttachmentManagerApi } from './useUserAttachmentManager';

export interface UserAttachmentManagerProps {
  manager: UserAttachmentManagerApi;
  /** C1B operation active/uncertain → delete disabled (Gate H). */
  busy: boolean;
}

function formatSize(bytes: number | null | undefined): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Narrow user-uploaded attachment manager (Task 2.5):
 * list user rows, single delete, explicit 409 frozen-cache guidance.
 * Never renders storage_path; tool_collection rows are not exposed.
 */
export function UserAttachmentManager({ manager, busy }: UserAttachmentManagerProps) {
  const [open, setOpen] = useState(false);
  const { rows, loading, notice, frozenInCache, deletePending, refresh, remove, dismissNotice } = manager;
  const deleteDisabled = busy || deletePending;

  // LAZY load: only fetch when the panel is first expanded (and after route
  // switches, where the hook resets rows but leaves refresh untouched).
  const openedOnce = useRef(false);
  useEffect(() => {
    if (open) {
      if (!openedOnce.current || rows.length === 0) void refresh();
      openedOnce.current = true;
    }
  }, [open, rows.length, refresh]);

  return (
    <div className="app-att-manager" data-open={open || undefined}>
      <div className="app-att-manager-head">
        <button
          type="button"
          className="app-att-manager-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? '收起附件管理' : '展开附件管理'}
        >
          {open ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
          <span>会话附件（{rows.length}）</span>
        </button>
        {open || rows.length > 0 || notice ? (
          <button
            type="button"
            className="app-btn app-btn-ghost app-btn-xs"
            onClick={() => void refresh()}
            disabled={loading || busy || deletePending}
            title="刷新附件列表"
            aria-label="刷新附件列表"
          >
            <RefreshCw size={11} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {notice ? (
        <div className="app-att-manager-notice" role={frozenInCache ? 'alert' : 'status'}>
          {frozenInCache ? <Snowflake size={12} aria-hidden="true" /> : null}
          <span>{notice}</span>
          <button
            type="button"
            className="app-btn app-btn-ghost app-btn-xs"
            onClick={dismissNotice}
            aria-label="关闭附件提示"
          >
            关闭
          </button>
        </div>
      ) : null}

      {open ? (
        <ul className="app-att-manager-list">
          {rows.map((row) => (
            <li key={`${row.source}-${String(row.id)}`} className="app-att-manager-row">
              <FileText size={13} strokeWidth={1.5} aria-hidden="true" />
              <span className="app-att-manager-name" title={row.display_name}>
                {row.display_name}
              </span>
              <span className="app-att-manager-meta">
                {row.mime_type ?? '未知类型'}
                {formatSize(row.file_size) ? ` · ${formatSize(row.file_size)}` : ''}
              </span>
              <button
                type="button"
                className="app-btn app-btn-ghost app-btn-xs app-att-manager-delete"
                onClick={() => void remove(row)}
                disabled={deleteDisabled}
                title={deleteDisabled ? '运行中或删除请求进行中，暂不可删除' : '删除此附件'}
                aria-label={`删除附件 ${row.display_name}`}
              >
                <Trash2 size={11} aria-hidden="true" />
                删除
              </button>
            </li>
          ))}
          {loading ? <li className="app-att-manager-loading">刷新中…</li> : null}
        </ul>
      ) : null}
    </div>
  );
}