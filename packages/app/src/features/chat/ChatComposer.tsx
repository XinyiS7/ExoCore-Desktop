import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Send, Square, X } from 'lucide-react';
import type { ChatTransport, RuntimeStatus, TurnAcceptance } from './runtime/types';
import { loadConversationDraft, saveConversationDraft } from './runtime/storage';

export interface ChatComposerProps {
  conversationId: number;
  status: RuntimeStatus;
  /** Global operation lock (busy/reconcile/uncertain/pending-hold, R1-01). */
  busy: boolean;
  transport: ChatTransport;
  onTransportChange: (transport: ChatTransport) => void;
  onSend: (content: string) => Promise<TurnAcceptance>;
  onStop: () => void;
  editingTarget: { id: number; content: string } | null;
  onCancelEdit: () => void;
  onConfirmEdit: (newContent: string) => Promise<TurnAcceptance>;
}

export function ChatComposer({
  conversationId,
  status,
  busy,
  transport,
  onTransportChange,
  onSend,
  onStop,
  editingTarget,
  onCancelEdit,
  onConfirmEdit,
}: ChatComposerProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);

  const runActive =
    status === 'submitting' ||
    status === 'streaming' ||
    status === 'polling' ||
    status === 'stopping';

  // Load draft or populate edit target
  useEffect(() => {
    if (editingTarget) {
      setText(editingTarget.content);
      textareaRef.current?.focus();
    } else {
      const saved = loadConversationDraft(conversationId);
      setText(saved);
    }
  }, [conversationId, editingTarget]);

  const handleChange = (val: string) => {
    setText(val);
    if (!editingTarget) {
      saveConversationDraft(conversationId, val);
    }
  };

  const handleSubmit = async () => {
    if (busy || runActive) return;
    const trimmed = text.trim();
    if (trimmed.length === 0) return;

    // Only clear the local text when the request is truly ACCEPTED (R1-01):
    // safe synchronous rejection and uncertain outcomes keep the text/draft
    // so the user can retry or re-edit — never an automatic resend.
    if (editingTarget) {
      const outcome = await onConfirmEdit(trimmed);
      if (outcome === 'accepted') setText('');
    } else {
      const outcome = await onSend(trimmed);
      if (outcome === 'accepted') setText('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // IME composition guard: Enter during IME should not submit (§7.1)
    if (e.nativeEvent.isComposing || isComposingRef.current || e.key === 'Process') {
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <footer className="app-composer-wrap" aria-label="消息输入区域">
      {editingTarget ? (
        <div className="app-composer-editbar" role="status">
          <span className="app-composer-editbar-title">正在编辑历史消息 #{editingTarget.id}</span>
          <button
            type="button"
            className="app-btn app-btn-ghost app-btn-xs"
            onClick={onCancelEdit}
            disabled={busy}
            title="取消编辑"
            aria-label="取消编辑"
          >
            <X size={14} aria-hidden="true" />
            取消
          </button>
        </div>
      ) : null}

      <div className="app-composer">
        <textarea
          ref={textareaRef}
          className="app-composer-input"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
          }}
          placeholder={editingTarget ? '修改消息内容…' : '输入消息… (Enter 发送, Shift+Enter 换行)'}
          rows={2}
          disabled={status === 'stopping'}
          aria-label="消息输入框"
        />

        <div className="app-composer-toolbar">
          <div className="app-composer-transport" title="选择传输协议">
            <label className="app-transport-label">
              <span className="app-muted" style={{ fontSize: '11px', marginRight: '4px' }}>模式:</span>
              <select
                className="app-transport-select"
                value={transport}
                onChange={(e) => onTransportChange(e.target.value as ChatTransport)}
                disabled={busy || runActive}
                aria-label="传输模式选择"
              >
                <option value="sse">实时（SSE）</option>
                <option value="async">可恢复（轮询）</option>
              </select>
            </label>
          </div>

          <div className="app-composer-actions">
            {runActive ? (
              <button
                type="button"
                className="app-btn app-btn-danger app-btn-sm"
                onClick={onStop}
                disabled={status === 'stopping'}
                title="停止生成"
                aria-label="停止生成"
              >
                <Square size={14} aria-hidden="true" />
                {status === 'stopping' ? '正在停止…' : '停止'}
              </button>
            ) : (
              <button
                type="button"
                className="app-btn app-btn-primary app-btn-sm"
                onClick={() => void handleSubmit()}
                disabled={busy || text.trim().length === 0}
                title={editingTarget ? '确认修改并发送' : '发送消息'}
                aria-label={editingTarget ? '确认修改并发送' : '发送消息'}
              >
                <Send size={14} aria-hidden="true" />
                {editingTarget ? '修改并重发' : '发送'}
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
