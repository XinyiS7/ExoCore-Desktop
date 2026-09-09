import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { FilePlus2, ImagePlus, Mic, MicOff, Send, Square, X } from 'lucide-react';
import type {
  ChatTurnInput,
  ConversationDispatchSettings,
  RuntimeStatus,
  TurnAcceptance,
} from './runtime/types';
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
import { useProjectTree } from './control/queries';
import type { ProjectTreeEntry } from './control/types';
import {
  cleanProjectRefsForSend,
  extractCurrentAtQuery,
  extractProjectRefs,
  insertProjectRefToken,
  isInsertablePath,
} from './project/paths';

export interface ChatComposerProps {
  conversationId: number;
  status: RuntimeStatus;
  /** Global operation lock (busy/reconcile/uncertain/pending-hold, R1-01). */
  busy: boolean;
  /** Null while model/endpoint cannot be resolved; every chat/audio POST is blocked. */
  dispatchSettings: ConversationDispatchSettings | null;
  targetNotice: string | null;
  projectId: number | null;
  pendingProjectInsert: {
    key: number;
    path: string;
    conversationId: number;
    projectId: number;
  } | null;
  onProjectInsertConsumed: () => void;
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

function flattenProjectFiles(entries: readonly ProjectTreeEntry[]): string[] {
  const paths: string[] = [];
  const visit = (items: readonly ProjectTreeEntry[]) => {
    for (const item of items) {
      if (item.type === 'file') paths.push(item.path);
      else if (item.entries) visit(item.entries);
    }
  };
  visit(entries);
  return paths;
}

export function ChatComposer({
  conversationId,
  status,
  busy,
  dispatchSettings,
  targetNotice,
  projectId,
  pendingProjectInsert,
  onProjectInsertConsumed,
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
  const [caret, setCaret] = useState(0);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [autocompleteDismissed, setAutocompleteDismissed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);

  const atQuery =
    editingTarget || autocompleteDismissed ? null : extractCurrentAtQuery(text, caret);
  const projectTree = useProjectTree(atQuery !== null ? projectId : null);
  const projectRefs = useMemo(() => extractProjectRefs(text), [text]);
  const existingRefSet = useMemo(() => new Set(projectRefs), [projectRefs]);
  const suggestions = useMemo(() => {
    if (atQuery === null) return [];
    const query = atQuery.toLocaleLowerCase();
    const all = flattenProjectFiles(projectTree.entries).filter((path) =>
      isInsertablePath(path, existingRefSet),
    );
    const starts = all.filter((path) => path.toLocaleLowerCase().startsWith(query));
    const contains = all.filter(
      (path) => !path.toLocaleLowerCase().startsWith(query) && path.toLocaleLowerCase().includes(query),
    );
    return [...starts, ...contains].slice(0, 50);
  }, [atQuery, existingRefSet, projectTree.entries]);

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
      setCaret(editingTarget.content.length);
      textareaRef.current?.focus();
    } else {
      const saved = loadConversationDraft(conversationId);
      setText(saved);
      setCaret(saved.length);
    }
    setActiveSuggestion(0);
    setAutocompleteDismissed(false);
  }, [conversationId, editingTarget]);

  const handleChange = (val: string) => {
    setText(val);
    if (!editingTarget) saveConversationDraft(conversationId, val);
  };

  useEffect(() => {
    if (!pendingProjectInsert) return;
    if (
      pendingProjectInsert.conversationId !== conversationId ||
      pendingProjectInsert.projectId !== projectId ||
      existingRefSet.has(pendingProjectInsert.path)
    ) {
      onProjectInsertConsumed();
      return;
    }
    const inserted = insertProjectRefToken(text, caret, pendingProjectInsert.path);
    if (inserted.text !== text) {
      handleChange(inserted.text);
      setCaret(inserted.caret);
      window.requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(inserted.caret, inserted.caret);
      });
    }
    onProjectInsertConsumed();
    // A keyed drawer command is consumed exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingProjectInsert?.key]);

  const handleSubmit = async () => {
    if (busy || runActive || audioRecovery.isUploading() || dispatchSettings === null) return;
    // The ref-backed delete guard closes the same-tick Delete → Send race;
    // state-backed disabling remains the presentation projection.
    if (compose.anyUploading || attachmentManager.isDeletePending()) return;
    const trimmed = text.trim();
    const submittedText = cleanProjectRefsForSend(trimmed);

    // Edit is deliberately text-only: newly composed IDs and recorded media
    // remain untouched for the next ordinary turn.
    if (editingTarget) {
      if (!trimmed) return;
      const outcome = await onConfirmEdit(submittedText);
      if (outcome === 'accepted') setText('');
      return;
    }

    const currentAttachmentIds = compose.getSuccessfulIds();
    const hasRecordedAudio = recorder.status === 'recorded' && recorder.blob !== null;
    if (!trimmed && currentAttachmentIds.length === 0 && !hasRecordedAudio) return;

    let outcome: TurnAcceptance;
    if (hasRecordedAudio) {
      if (audioGate.state !== 'supported' || !recorder.mimeType) {
        // A recorded Blob is target-neutral until upload starts. An
        // unsupported target blocks upload without deleting the recording.
        return;
      }
      outcome = await audioRecovery.sendRecorded({
        blob: recorder.blob as Blob,
        mimeType: recorder.mimeType,
        target: audioGate.target,
        dispatchSettings,
        content: submittedText,
        attachmentIds: currentAttachmentIds,
        dispatch: onSend,
      });
    } else {
      outcome = await onSend({
        content: submittedText,
        pendingAttachments: currentAttachmentIds.length > 0 ? currentAttachmentIds : undefined,
        dispatchSettings,
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

  const selectSuggestion = (path: string) => {
    const start = text.slice(0, caret).lastIndexOf('@');
    if (start < 0) return;
    const token = `@[${path}] `;
    const next = text.slice(0, start) + token + text.slice(caret);
    const nextCaret = start + token.length;
    handleChange(next);
    setCaret(nextCaret);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const removeProjectRef = (path: string) => {
    const token = `@[${path}]`;
    const index = text.indexOf(token);
    if (index < 0) return;
    const next = text.slice(0, index) + text.slice(index + token.length).replace(/^ /, '');
    handleChange(next);
    setCaret(Math.min(caret, next.length));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // IME composition guard: Enter during IME should not submit/select (§6.6).
    if (e.nativeEvent.isComposing || isComposingRef.current || e.key === 'Process') return;

    if (atQuery !== null && suggestions.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        setActiveSuggestion((current) => (current + delta + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectSuggestion(suggestions[activeSuggestion] ?? suggestions[0]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAutocompleteDismissed(true);
        return;
      }
    }

    if (e.key === 'Enter' && e.shiftKey) {
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
          busy={
            busy ||
            runActive ||
            !audioSupported ||
            audioRecovery.uploading ||
            attachmentManager.deletePending
          }
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

        {projectRefs.length > 0 ? (
          <div className="app-project-ref-chips" aria-label="已引用项目文件">
            {projectRefs.map((path) => (
              <span key={path} className="app-project-ref-chip">
                <span>{path}</span>
                <button
                  type="button"
                  onClick={() => removeProjectRef(path)}
                  disabled={busy || runActive}
                  aria-label={`移除文件引用 ${path}`}
                >
                  <X size={11} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="app-composer-input-wrap">
          <textarea
            ref={textareaRef}
            className="app-composer-input"
            value={text}
            onChange={(e) => {
              handleChange(e.target.value);
              setCaret(e.target.selectionStart);
              setAutocompleteDismissed(false);
            }}
            onClick={(e) => {
              setCaret(e.currentTarget.selectionStart);
              setAutocompleteDismissed(false);
            }}
            onKeyUp={(e) => setCaret(e.currentTarget.selectionStart)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={(e) => {
              isComposingRef.current = false;
              setCaret(e.currentTarget.selectionStart);
            }}
            placeholder={editingTarget ? '修改消息内容…' : '输入消息… (Enter 换行, Shift+Enter 发送)'}
            rows={2}
            disabled={status === 'stopping'}
            aria-label="消息输入框"
            aria-autocomplete="list"
            aria-controls={atQuery !== null ? 'app-project-ref-options' : undefined}
            aria-expanded={atQuery !== null && suggestions.length > 0}
          />
          {atQuery !== null ? (
            <div id="app-project-ref-options" className="app-project-ref-options" role="listbox" aria-label="项目文件建议">
              {projectTree.rootPending ? (
                <span className="app-muted">正在读取项目文件…</span>
              ) : projectTree.rootError ? (
                <button type="button" className="app-link-btn" onClick={() => void projectTree.refetchRoot()}>
                  项目文件读取失败，重试
                </button>
              ) : suggestions.length === 0 ? (
                <span className="app-muted">没有匹配的工作目录文件</span>
              ) : (
                suggestions.map((path, index) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeSuggestion}
                    className={index === activeSuggestion ? 'is-active' : ''}
                    key={path}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectSuggestion(path)}
                  >
                    {path}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>

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

          {dispatchSettings === null ? (
            <span className="app-audio-target-note" role="status">
              {targetNotice ?? '当前模型或端点尚未就绪'}
            </span>
          ) : null}

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
                  dispatchSettings === null ||
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
                  dispatchSettings === null
                    ? (targetNotice ?? '请先选择可用的模型与端点')
                    : compose.anyUploading || audioRecovery.uploading
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