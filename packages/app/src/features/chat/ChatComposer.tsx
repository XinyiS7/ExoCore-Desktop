import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { FilePlus2, ImagePlus, Mic, MicOff, Send, Square, X } from 'lucide-react';
import type { ChatTransport, ChatTurnInput, RuntimeStatus, TurnAcceptance } from './runtime/types';
import { loadConversationDraft, saveConversationDraft } from './runtime/storage';
import { ComposeAttachmentList } from './attachments/ComposeAttachmentList';
import type { ComposeAttachmentApi } from './attachments/useComposeAttachments';
import { UserAttachmentManager } from './attachments/UserAttachmentManager';
import type { UserAttachmentManagerApi } from './attachments/useUserAttachmentManager';
import { AudioComposeBar } from './audio/AudioComposeBar';
import type { AudioRecorderApi } from './audio/useAudioRecorder';
import type { AudioTargetGate } from './audio/audioTarget';
import { audioTargetUnsupportedText } from './audio/audioTarget';
import { AudioRecoveryBar } from './audio/AudioRecoveryBar';
import type { AudioRecoveryApi } from './audio/audioRecoveryMachine';

export interface ChatComposerProps {
  conversationId: number;
  status: RuntimeStatus;
  /** Global operation lock (busy/reconcile/uncertain/pending-hold, R1-01). */
  busy: boolean;
  transport: ChatTransport;
  onTransportChange: (transport: ChatTransport) => void;
  onSend: (turn: ChatTurnInput) => Promise<TurnAcceptance>;
  onStop: () => void;
  editingTarget: { id: number; content: string } | null;
  onCancelEdit: () => void;
  onConfirmEdit: (newContent: string) => Promise<TurnAcceptance>;
  /** P1C compose attachment lifecycle (Task 2). */
  compose: ComposeAttachmentApi;
  /** P1C narrow user-attachment manager (Task 2.5). */
  attachmentManager: UserAttachmentManagerApi;
  /** P1C recorder lifecycle (Task 3). */
  recorder: AudioRecorderApi;
  /** P1C automatic audio target gate (Task 3.2). */
  audioGate: AudioTargetGate;
  /** Conversation-bound uploaded-audio recovery owner. */
  audioRecovery: AudioRecoveryApi;
  onRetryAudio: () => void;
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
  compose,
  attachmentManager,
  recorder,
  audioGate,
  audioRecovery,
  onRetryAudio,
}: ChatComposerProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);

  const runActive =
    status === 'submitting' ||
    status === 'streaming' ||
    status === 'polling' ||
    status === 'stopping';

  // Audio target availability for the mic button.
  const audioSupported = audioGate.state === 'supported';
  const audioLoading = audioGate.state === 'loading';
  const audioTargetText =
    audioGate.state === 'unsupported' ? audioTargetUnsupportedText(audioGate.reason) : null;

  // Route switch: clear recorder and reset target-dependent error state.
  // Compose entries are cleared by useComposeAttachments(conversationId)'s
  // own effect; the recorder has no conversationKey, so cancel explicitly.
  useEffect(() => {
    recorder.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

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
    if (busy || runActive || audioRecovery.isUploading()) return;
    // The ref-backed delete guard closes the same-tick Delete → Send race;
    // state-backed disabling remains the presentation projection.
    if (compose.anyUploading || attachmentManager.isDeletePending()) return;
    const trimmed = text.trim();

    // Edit is deliberately text-only: newly composed IDs and recorded media
    // remain untouched for the next ordinary turn.
    if (editingTarget) {
      if (!trimmed) return;
      const outcome = await onConfirmEdit(trimmed);
      if (outcome === 'accepted') setText('');
      return;
    }

    const currentAttachmentIds = compose.getSuccessfulIds();
    const hasRecordedAudio = recorder.status === 'recorded' && recorder.blob !== null;
    if (!trimmed && currentAttachmentIds.length === 0 && !hasRecordedAudio) return;

    let outcome: TurnAcceptance;
    if (hasRecordedAudio) {
      if (audioGate.state !== 'supported' || !recorder.mimeType) {
        recorder.fail('target_changed');
        return;
      }
      outcome = await audioRecovery.sendRecorded({
        blob: recorder.blob as Blob,
        mimeType: recorder.mimeType,
        target: audioGate.target,
        content: trimmed,
        attachmentIds: currentAttachmentIds,
        dispatch: onSend,
      });
    } else {
      outcome = await onSend({
        content: trimmed,
        pendingAttachments: currentAttachmentIds.length > 0 ? currentAttachmentIds : undefined,
      });
    }

    // Once an uploaded-audio snapshot exists it becomes the sole retry owner,
    // even if C1B safely rejected before POST. Retaining the Blob/compose IDs
    // here would permit an accidental second audio upload or partial replay.
    const transferredToRecovery = hasRecordedAudio && audioRecovery.hasSnapshot();
    if (outcome === 'accepted' || transferredToRecovery) {
      setText('');
      saveConversationDraft(conversationId, '');
      compose.clearCompose();
      if (hasRecordedAudio) recorder.cancel();
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

  const pickFiles = (input: HTMLInputElement | null, files: FileList | null) => {
    // FileList is live in real browsers: copy it before resetting the input,
    // otherwise clearing value can erase the selection before upload starts.
    const selectedFiles = files ? Array.from(files) : [];
    if (input) input.value = '';
    if (selectedFiles.length > 0) void compose.addFiles(selectedFiles);
  };

  const recordToggle = () => {
    if (recorder.status === 'recording') {
      recorder.stop();
      return;
    }
    if (audioGate.state !== 'supported') return;
    if (recorder.status === 'idle' || recorder.status === 'error') {
      if (audioGate.state === 'supported') void recorder.start();
    }
  };

  const micDisabled =
    busy ||
    runActive ||
    !audioSupported ||
    audioLoading ||
    recorder.status === 'recording';

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

      {/* P1C: narrow user-uploaded attachment manager */}
      <UserAttachmentManager
        manager={attachmentManager}
        busy={busy || runActive || audioRecovery.uploading}
      />

      <div className="app-composer">
        {/* P1C: compose attachment strip (uploading/ok/ok_degraded/failed) */}
        <ComposeAttachmentList
          entries={compose.entries}
          onRemove={compose.removeEntry}
          disabled={busy || runActive || audioRecovery.uploading}
        />

        {/* P1C: recorder + complete uploaded-audio recovery states */}
        <AudioComposeBar
          recorder={recorder}
          busy={busy || runActive || audioRecovery.uploading || attachmentManager.deletePending}
          onSend={recorder.status === 'recorded' ? () => void handleSubmit() : undefined}
        />
        <AudioRecoveryBar
          recovery={audioRecovery}
          runtimeBusy={busy}
          deletePending={attachmentManager.deletePending}
          onRetry={onRetryAudio}
        />

        {audioGate.state === 'unsupported' && recorder.status !== 'error' ? (
          <div className="app-audio-target-note" role="status">
            <MicOff size={11} aria-hidden="true" />
            <span>{audioTargetText}</span>
          </div>
        ) : null}

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
          <div className="app-composer-attach-tools">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              aria-hidden="true"
              tabIndex={-1}
              onChange={(e) => pickFiles(imageInputRef.current, e.target.files)}
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              aria-hidden="true"
              tabIndex={-1}
              onChange={(e) => pickFiles(fileInputRef.current, e.target.files)}
            />
            <button
              type="button"
              className="app-btn app-btn-ghost app-btn-sm app-composer-tool-btn"
              onClick={() => imageInputRef.current?.click()}
              disabled={busy || runActive || audioRecovery.uploading || attachmentManager.deletePending}
              title="选择图片附件"
              aria-label="选择图片附件"
            >
              <ImagePlus size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="app-btn app-btn-ghost app-btn-sm app-composer-tool-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy || runActive || audioRecovery.uploading || attachmentManager.deletePending}
              title="选择文件附件"
              aria-label="选择文件附件"
            >
              <FilePlus2 size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`app-btn app-btn-ghost app-btn-sm app-composer-tool-btn${recorder.status === 'recording' ? ' app-composer-mic--recording' : ''}`}
              onClick={recordToggle}
              disabled={micDisabled || audioRecovery.uploading || attachmentManager.deletePending}
              title={
                recorder.status === 'recording'
                  ? '停止录音'
                  : audioSupported
                    ? '开始录音'
                    : (audioTargetText ?? '当前目标不支持录音')
              }
              aria-label={recorder.status === 'recording' ? '停止录音' : '开始录音'}
            >
              {recorder.status === 'recording' ? <Square size={13} aria-hidden="true" /> : <Mic size={14} aria-hidden="true" />}
            </button>
          </div>

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
                disabled={
                  busy ||
                  compose.anyUploading ||
                  attachmentManager.deletePending ||
                  audioRecovery.uploading ||
                  (editingTarget
                    ? text.trim().length === 0
                    : text.trim().length === 0 &&
                      compose.successfulIds.length === 0 &&
                      recorder.status !== 'recorded')
                }
                title={
                  compose.anyUploading || audioRecovery.uploading
                    ? '附件上传中，请稍候'
                    : attachmentManager.deletePending
                      ? '附件删除进行中，请稍候'
                      : editingTarget
                        ? '确认修改并发送'
                        : '发送消息'
                }
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