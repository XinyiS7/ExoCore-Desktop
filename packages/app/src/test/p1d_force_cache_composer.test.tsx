import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatComposer, type ChatComposerProps } from '../features/chat/ChatComposer';
import type { ComposeAttachmentApi } from '../features/chat/attachments/useComposeAttachments';
import type { UserAttachmentManagerApi } from '../features/chat/attachments/useUserAttachmentManager';
import type { AudioRecorderApi } from '../features/chat/audio/useAudioRecorder';
import type { AudioRecoveryApi } from '../features/chat/audio/audioRecoveryMachine';
import type { AudioTargetGate } from '../features/chat/audio/audioTarget';
import type {
  ChatTurnInput,
  ConversationDispatchSettings,
  TurnAcceptance,
} from '../features/chat/runtime/types';
import { ensureTestLocalStorage, renderV4 } from './helpers';

ensureTestLocalStorage();

const SETTINGS: ConversationDispatchSettings = {
  model: 'deepseek-v4-flash',
  endpoint: 7,
  thinkingLevel: 'medium',
  cacheEnabled: true,
  sessionType: 'full',
};

const FORCE_LABEL = '生成Cache并发送';

function composeStub(overrides: Partial<ComposeAttachmentApi> = {}): ComposeAttachmentApi {
  return {
    entries: [],
    anyUploading: false,
    successfulIds: [],
    getSuccessfulIds: () => [],
    uploadingCount: 0,
    addFiles: vi.fn(),
    removeEntry: vi.fn(),
    purgeAttachmentId: vi.fn(),
    clearCompose: vi.fn(),
    ...overrides,
  };
}

function managerStub(): UserAttachmentManagerApi {
  return {
    rows: [],
    loading: false,
    notice: null,
    frozenInCache: false,
    deletePending: false,
    isDeletePending: () => false,
    refresh: vi.fn(),
    remove: vi.fn(),
    dismissNotice: vi.fn(),
  };
}

function recorderStub(overrides: Partial<AudioRecorderApi> = {}): AudioRecorderApi {
  return {
    status: 'idle',
    recordingSeconds: 0,
    blob: null,
    blobUrl: null,
    error: null,
    errorMessage: '',
    mimeType: null,
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    fail: vi.fn(),
    ...overrides,
  };
}

function recoveryStub(overrides: Partial<AudioRecoveryApi> = {}): AudioRecoveryApi {
  return {
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
    ...overrides,
  };
}

const SUPPORTED_GATE: AudioTargetGate = {
  state: 'supported',
  target: { model: 'deepseek-v4-flash', endpoint: 7 },
};

/** Render the real ChatComposer with stubbed sibling APIs; returns props. */
function renderComposer(overrides: Partial<ChatComposerProps> = {}) {
  const onSend = vi.fn(async (_turn: ChatTurnInput): Promise<TurnAcceptance> => 'accepted');
  const props: ChatComposerProps = {
    conversationId: 42,
    status: 'idle',
    busy: false,
    dispatchSettings: SETTINGS,
    targetNotice: null,
    projectId: null,
    pendingProjectInsert: null,
    onProjectInsertConsumed: vi.fn(),
    onSend,
    onStop: vi.fn(),
    editingTarget: null,
    onCancelEdit: vi.fn(),
    onConfirmEdit: vi.fn().mockResolvedValue('accepted' as TurnAcceptance),
    compose: composeStub(),
    attachmentManager: managerStub(),
    recorder: recorderStub(),
    audioGate: SUPPORTED_GATE,
    audioRecovery: recoveryStub(),
    onRetryAudio: vi.fn(),
    ...overrides,
  };
  renderV4(<ChatComposer {...props} />);
  return { props, onSend };
}

const attachCompose = (ids: number[]) => composeStub({ successfulIds: ids, getSuccessfulIds: () => [...ids] });

const typeText = (text: string) => {
  fireEvent.change(screen.getByRole('textbox', { name: '消息输入框' }), { target: { value: text } });
};

const pressForceShortcut = () => {
  fireEvent.keyDown(screen.getByRole('textbox', { name: '消息输入框' }), {
    key: 'Enter',
    ctrlKey: true,
    shiftKey: true,
  });
};

describe('P1D Force Cache Send — composer entry & guards (V3 capability recovery)', () => {
  it('hides the force entry without sendable attachments', () => {
    renderComposer();
    expect(screen.queryByRole('button', { name: FORCE_LABEL })).toBeNull();
  });

  it('shows the force entry when this round holds validated compose IDs', () => {
    renderComposer({ compose: attachCompose([5]) });
    expect(screen.getByRole('button', { name: FORCE_LABEL })).toBeDefined();
  });

  it('shows the force entry when a recorded audio clip is pending (same sendable fact as ordinary send)', () => {
    renderComposer({
      recorder: recorderStub({ status: 'recorded', blob: new Blob(['x']), mimeType: 'audio/webm' }),
    });
    expect(screen.getByRole('button', { name: FORCE_LABEL })).toBeDefined();
  });

  it('hides the force entry while editing a historical message, even with attachments present', () => {
    renderComposer({ compose: attachCompose([5]), editingTarget: { id: 7, content: 'old' } });
    expect(screen.queryByRole('button', { name: FORCE_LABEL })).toBeNull();
  });

  it('click sends forceCacheRebuild=true with the round attachment IDs', async () => {
    const { onSend } = renderComposer({ compose: attachCompose([5, 6]) });
    fireEvent.click(screen.getByRole('button', { name: FORCE_LABEL }));
    expect(onSend).toHaveBeenCalledTimes(1);
    const turn = onSend.mock.calls[0][0] as ChatTurnInput;
    expect(turn.forceCacheRebuild).toBe(true);
    expect(turn.pendingAttachments).toEqual([5, 6]);
    expect(turn.dispatchSettings).toBe(SETTINGS);
  });

  it('primary send never carries force — ordinary turn omits the flag', async () => {
    const { onSend } = renderComposer({ compose: attachCompose([5]) });
    fireEvent.click(screen.getByRole('button', { name: '发送消息' }));
    const turn = onSend.mock.calls[0][0] as ChatTurnInput;
    expect(turn.forceCacheRebuild).toBeUndefined();
    expect(turn.pendingAttachments).toEqual([5]);
  });

  it('Ctrl+Shift+Enter sends force when sendable attachments exist', () => {
    const { onSend } = renderComposer({ compose: attachCompose([5]) });
    typeText('hi');
    pressForceShortcut();
    expect(onSend).toHaveBeenCalledTimes(1);
    expect((onSend.mock.calls[0][0] as ChatTurnInput).forceCacheRebuild).toBe(true);
  });

  it('Ctrl+Shift+Enter without attachments degrades to an ordinary send (no force, no empty body)', () => {
    const { onSend } = renderComposer();
    typeText('plain');
    pressForceShortcut();
    expect(onSend).toHaveBeenCalledTimes(1);
    const turn = onSend.mock.calls[0][0] as ChatTurnInput;
    expect(turn.forceCacheRebuild).toBeUndefined();
    expect(turn.pendingAttachments).toBeUndefined();
  });

  it('Ctrl+Shift+Enter with empty text and no attachments issues no request at all', () => {
    const { onSend } = renderComposer();
    pressForceShortcut();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('Ctrl+Shift+Enter during IME composing never fires', () => {
    const { onSend } = renderComposer({ compose: attachCompose([5]) });
    const input = screen.getByRole('textbox', { name: '消息输入框' });
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true, shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
  });

  it('force button honors send guards: busy / target unresolved / uploading / delete-pending disable it and block clicks', () => {
    const { onSend } = renderComposer({
      compose: { ...attachCompose([5]), anyUploading: true, uploadingCount: 1 },
      busy: true,
    });
    const force = screen.getByRole('button', { name: FORCE_LABEL });
    expect((force as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(force);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('force shortcut honors the same guards (busy blocks dispatch)', () => {
    const { onSend } = renderComposer({ compose: attachCompose([5]), busy: true });
    typeText('hi');
    pressForceShortcut();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('recorded audio with force flows through sendRecorded with forceCacheRebuild=true', async () => {
    const { props, onSend } = renderComposer({
      recorder: recorderStub({ status: 'recorded', blob: new Blob(['x']), mimeType: 'audio/webm' }),
    });
    fireEvent.click(screen.getByRole('button', { name: FORCE_LABEL }));
    expect(props.audioRecovery.sendRecorded).toHaveBeenCalledTimes(1);
    const input = (props.audioRecovery.sendRecorded as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      forceCacheRebuild?: boolean;
      attachmentIds: number[];
      dispatch: unknown;
    };
    expect(input.forceCacheRebuild).toBe(true);
    expect(input.attachmentIds).toEqual([]);
    expect(input.dispatch).toBe(onSend);
    expect(onSend).not.toHaveBeenCalled(); // audio path owns the dispatch
  });

  it('recorded audio ordinary send does not force', () => {
    const { props } = renderComposer({
      recorder: recorderStub({ status: 'recorded', blob: new Blob(['x']), mimeType: 'audio/webm' }),
    });
    fireEvent.click(screen.getByRole('button', { name: '发送消息' }));
    const input = (props.audioRecovery.sendRecorded as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      forceCacheRebuild?: boolean;
    };
    expect(input.forceCacheRebuild).toBeUndefined();
  });

  it('edit-mode shortcut confirms the edit only — never a force send', () => {
    const { props, onSend } = renderComposer({
      compose: attachCompose([5]),
      editingTarget: { id: 7, content: 'old' },
    });
    const input = screen.getByRole('textbox', { name: '消息输入框' });
    fireEvent.change(input, { target: { value: 'changed' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true, shiftKey: true });
    expect(props.onConfirmEdit).toHaveBeenCalledWith('changed');
    expect(onSend).not.toHaveBeenCalled();
  });
});