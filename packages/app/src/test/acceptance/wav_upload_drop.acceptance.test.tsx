/**
 * WAV upload drop — independent acceptance probe (Desktop frozen @ 329c7f0).
 *
 * Encodes the intended ChatComposer footer drop contract:
 *  key 1  a non-file text drop (text/plain | text/uri-list, files empty) is not
 *         ours: no preventDefault, no compose.addFiles, so the native text drop
 *         into the textarea keeps working;
 *  key 2  a real file drop cancels the native default and hands the files to
 *         compose.addFiles exactly once;
 *  key 3  while busy a file drop never uploads, but still cancels the native
 *         default so the browser cannot navigate away with the dropped file.
 *
 * jsdom offers no usable drag dataTransfer, so each probe dispatches a real
 * cancelable DOM Event with a strict minimal dataTransfer literal attached via
 * Object.defineProperty; React reads that literal off the native event and the
 * returned event carries the authoritative defaultPrevented fact.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { ChatComposer, type ChatComposerProps } from '../../features/chat/ChatComposer';
import type { ComposeAttachmentApi } from '../../features/chat/attachments/useComposeAttachments';
import type { UserAttachmentManagerApi } from '../../features/chat/attachments/useUserAttachmentManager';
import type { AudioRecorderApi } from '../../features/chat/audio/useAudioRecorder';
import type { AudioRecoveryApi } from '../../features/chat/audio/audioRecoveryMachine';
import type { AudioTargetGate } from '../../features/chat/audio/audioTarget';
import type {
  ConversationDispatchSettings,
  TurnAcceptance,
} from '../../features/chat/runtime/types';
import { ensureTestLocalStorage, renderV4 } from '../helpers';

ensureTestLocalStorage();

const SETTINGS: ConversationDispatchSettings = {
  model: 'deepseek-v4-flash',
  endpoint: 7,
  thinkingLevel: 'medium',
  cacheEnabled: true,
  sessionType: 'full',
};

const GATE: AudioTargetGate = {
  state: 'supported',
  target: { model: 'deepseek-v4-flash', endpoint: 7 },
};

/** Real ChatComposerProps shape; every nested API is strict-typed to production. */
function renderComposer(overrides: Partial<ChatComposerProps> = {}) {
  const compose: ComposeAttachmentApi = {
    entries: [],
    anyUploading: false,
    successfulIds: [],
    getSuccessfulIds: () => [],
    uploadingCount: 0,
    addFiles: vi.fn(),
    removeEntry: vi.fn(),
    purgeAttachmentId: vi.fn(),
    clearCompose: vi.fn(),
  };
  const attachmentManager: UserAttachmentManagerApi = {
    rows: [],
    loading: false,
    notice: null,
    frozenInCache: false,
    deletePending: false,
    isDeletePending: () => false,
    refresh: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    dismissNotice: vi.fn(),
  };
  const recorder: AudioRecorderApi = {
    status: 'idle',
    recordingSeconds: 0,
    blob: null,
    blobUrl: null,
    error: null,
    errorMessage: '',
    mimeType: null,
    start: vi.fn(async () => {}),
    stop: vi.fn(),
    cancel: vi.fn(),
    fail: vi.fn(),
  };
  const audioRecovery: AudioRecoveryApi = {
    state: null,
    uploading: false,
    uploadError: null,
    retryDecision: { enabled: false, reason: 'none' },
    onRuntimeOutcome: vi.fn(),
    sendRecorded: vi.fn().mockResolvedValue('accepted' as TurnAcceptance),
    retry: vi.fn(),
    purgeAttachmentId: vi.fn(),
    abandon: vi.fn(),
    dismissUploadError: vi.fn(),
    isUploading: () => false,
    hasSnapshot: () => false,
  };
  const props: ChatComposerProps = {
    conversationId: 42,
    status: 'idle',
    busy: false,
    dispatchSettings: SETTINGS,
    targetNotice: null,
    projectId: null,
    pendingProjectInsert: null,
    onProjectInsertConsumed: vi.fn(),
    onSend: vi.fn(async () => 'accepted' as TurnAcceptance),
    onStop: vi.fn(),
    editingTarget: null,
    onCancelEdit: vi.fn(),
    onConfirmEdit: vi.fn(async () => 'accepted' as TurnAcceptance),
    compose,
    attachmentManager,
    recorder,
    audioGate: GATE,
    audioRecovery,
    onRetryAudio: vi.fn(),
    ...overrides,
  };
  renderV4(<ChatComposer {...props} />);
  return { props };
}

type DropDataTransfer = { types: readonly string[]; files: readonly File[] };

/** Real cancelable DOM Event carrying the strict minimal dataTransfer literal. */
function dispatchDrop(target: Element, dataTransfer: DropDataTransfer): Event {
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer, configurable: true });
  target.dispatchEvent(event);
  return event;
}

const composerInput = () => screen.getByRole('textbox', { name: '消息输入框' });
const composerFooter = () => screen.getByLabelText('消息输入区域');
const wavFile = () => new File(['RIFF....WAVE'], 'voice.wav', { type: 'audio/wav' });

describe('WAV upload drop — independent acceptance probe', () => {
  it('key 1: text/plain & text/uri-list drops are not hijacked (no preventDefault, no addFiles)', () => {
    const { props } = renderComposer();
    for (const target of [composerInput(), composerFooter()]) {
      for (const type of ['text/plain', 'text/uri-list']) {
        const event = dispatchDrop(target, { types: [type], files: [] });
        expect(event.defaultPrevented, `${type} drop on <${target.tagName.toLowerCase()}>`).toBe(false);
      }
    }
    expect(props.compose.addFiles).not.toHaveBeenCalled();
  });

  it('key 2: a real WAV drop cancels the default and uploads exactly once', () => {
    const { props } = renderComposer();
    const file = wavFile();
    const event = dispatchDrop(composerInput(), { types: ['Files'], files: [file] });
    expect(event.defaultPrevented).toBe(true);
    expect(props.compose.addFiles).toHaveBeenCalledTimes(1);
    expect(props.compose.addFiles).toHaveBeenCalledWith([file]);
  });

  it('key 3: a WAV drop while busy uploads nothing but still cancels the default', () => {
    const { props } = renderComposer({ busy: true });
    const event = dispatchDrop(composerInput(), { types: ['Files'], files: [wavFile()] });
    expect(event.defaultPrevented).toBe(true);
    expect(props.compose.addFiles).not.toHaveBeenCalled();
  });
});
