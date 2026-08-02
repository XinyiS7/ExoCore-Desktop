import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('exo-shared', () => ({
  baseUrl: 'http://localhost:8000',
  getCsrfToken: () => 'mock-csrf',
  MAIN_MODEL_IDS: [],
  useTheme: () => ({ theme: 'dark' }),
  configApi: {
    getModelCatalog: vi.fn().mockResolvedValue({
      models: [{ name: 'gemini-3.6-flash', abilities: ['audio'], compatible_endpoint_ids: [2] }],
      endpoints: [{ id: 2, attachment_transports: ['file_uri'] }],
      roles: [{ role: 'main', model: 'gemini-3.6-flash', endpoint: 2 }],
    }),
  },
  resolveInitialSessionTarget: vi.fn(() => ({ model: 'gemini-3.6-flash', endpoint: 2 })),
}));
vi.mock('../../hooks/usePollingChat', () => ({
  usePollingChat: () => ({ sendMessageAsync: vi.fn(), resumePolling: vi.fn() }),
}));

import ChatArea from './ChatArea.jsx';

const baseProps = {
  setActiveSessionId: () => {},
  setRefreshKey: () => {},
  setShowConvList: () => {},
  openNewSession: () => {},
  presets: [],
  fileTree: null,
};

const CONV_A = { id: 'conv-a', agent_preset_id: 1, thinking_level: 'auto', temperature: 1.0, session_type: 'lite', name: 'A' };

function renderChatArea(sessionId) {
  return render(
    <MemoryRouter>
      <ChatArea activeSessionId={sessionId} {...baseProps} />
    </MemoryRouter>,
  );
}

function sseBody(events) {
  const text = events.join('\n\n') + '\n\n';
  let sent = false;
  return {
    getReader: () => ({
      read: async () => {
        if (!sent) { sent = true; return { done: false, value: new TextEncoder().encode(text) }; }
        return { done: true, value: undefined };
      },
    }),
    cancel: () => {},
  };
}

function installRecorder() {
  class Rec {
    static instances = [];
    static isTypeSupported() { return true; }

    constructor(stream, options = {}) {
      this.stream = stream;
      this.mimeType = options.mimeType || 'audio/webm';
      this.state = 'inactive';
      Rec.instances.push(this);
    }

    start() { this.state = 'recording'; }

    stop() {
      if (this.state === 'inactive') return;
      this.state = 'inactive';
      setTimeout(() => this.onstop?.(), 0);
    }

    emitData(data = new Blob(['voice'], { type: 'audio/webm' })) {
      this.ondataavailable?.({ data });
    }
  }
  vi.stubGlobal('MediaRecorder', Rec);
  return Rec;
}

function installMic() {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] };
  vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
  return { stream, track };
}

function defaultFetchStub() {
  // 兜底所有未覆盖路由：JSON 空对象，避免 HTML/res.json 错误
  return vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => [] }));
}

async function recordClip() {
  fireEvent.click(screen.getByTitle('录制语音'));
  await waitFor(() => expect(globalThis.MediaRecorder.instances[0]).toBeTruthy());
  await act(async () => new Promise(r => setTimeout(r, 10)));
  act(() => globalThis.MediaRecorder.instances[0].emitData());
  fireEvent.click(screen.getByText('停止'));
  await waitFor(() => expect(screen.getByText('发送')).toBeInTheDocument());
}

beforeEach(() => {
  vi.stubGlobal('isSecureContext', true);
  const localStorageMock = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
  vi.stubGlobal('localStorage', localStorageMock);
  class IntersectionObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
  Element.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:chat-test'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });
  vi.stubGlobal('fetch', defaultFetchStub());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete globalThis.isSecureContext;
});

describe('ChatArea audio recovery production wiring (14.4/15/18)', () => {
  it('session switch does not throw (R8: audioRecoverySessionSwitch import)', async () => {
    const { rerender, unmount } = renderChatArea('conv-a');
    await act(async () => new Promise(r => setTimeout(r, 20)));

    expect(() => {
      rerender(
        <MemoryRouter>
          <ChatArea activeSessionId="conv-b" {...baseProps} />
        </MemoryRouter>,
      );
    }).not.toThrow();

    expect(() => {
      rerender(
        <MemoryRouter>
          <ChatArea activeSessionId="conv-a" {...baseProps} />
        </MemoryRouter>,
      );
    }).not.toThrow();

    unmount();
  });

  it('deferred upload + session switch submits 0 chat requests (P0-R11)', async () => {
    let chatPosts = 0;
    vi.stubGlobal('fetch', vi.fn((url, opts) => {
      if (String(url).includes('/conversations/') && !String(url).includes('/attachments') && !String(url).includes('/chat')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [CONV_A] });
      }
      if (String(url).includes('/attachments')) {
        if (opts?.method === 'POST') {
          return new Promise(res => setTimeout(
            () => res({ ok: true, status: 201, json: async () => ({ attachments: [{ id: 99 }] }) }),
            100,
          ));
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      if (String(url).includes('/chat')) {
        if (opts?.method === 'POST') {
          chatPosts += 1;
          return Promise.resolve({
            ok: true,
            status: 200,
            body: { getReader: () => ({ read: async () => ({ done: true }) }), cancel: () => {} },
          });
        }
        // GET /chat（history load）：JSON 契约，不得返回 SSE body
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ messages: [] }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    }));

    installRecorder();
    installMic();
    const { rerender, unmount } = renderChatArea('conv-a');
    await waitFor(() => expect(screen.getByTitle('录制语音')).toBeInTheDocument());

    await recordClip();

    // 发送 → upload 开始（100ms pending）
    fireEvent.click(screen.getByText('发送'));
    await act(async () => new Promise(r => setTimeout(r, 20)));

    // upload 期间切换会话
    rerender(
      <MemoryRouter>
        <ChatArea activeSessionId="conv-b" {...baseProps} />
      </MemoryRouter>,
    );

    // upload resolve + handleSend 继续（应被 token recheck 拦截）
    await act(async () => new Promise(r => setTimeout(r, 250)));

    expect(chatPosts).toBe(0);
    unmount();
  });

  it('event:error → refresh rehydrates persisted failed anchor → retry keeps one user turn (P0-R13)', async () => {
    let uploads = 0;
    let chatPosts = 0;
    vi.stubGlobal('fetch', vi.fn((url, opts) => {
      if (String(url).includes('/conversations/') && !String(url).includes('/attachments') && !String(url).includes('/chat')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [CONV_A] });
      }
      if (String(url).includes('/attachments')) {
        if (opts?.method === 'POST') uploads += 1;
        return Promise.resolve({ ok: true, status: 201, json: async () => ({ attachments: [{ id: 99 }] }) });
      }
      if (String(url).includes('/chat')) {
        if (opts?.method === 'POST') {
          chatPosts += 1;
          if (chatPosts === 1) {
            return Promise.resolve({ ok: true, status: 200, body: sseBody(['event: error\ndata: {"message":"boom"}']) });
          }
          return Promise.resolve({ ok: true, status: 200, body: sseBody(['event: done\ndata: [DONE]']) });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            messages: [{
              id: 500,
              role: 'user',
              content: '',
              attachments_meta: [{
                id: 99,
                display_name: 'rec.webm',
                original_filename: 'rec.webm',
                mime_type: 'audio/webm',
                file_size: 5,
                content_url: '/api/agents/conversations/conv-a/attachments/99/content/',
              }],
            }],
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    }));

    installRecorder();
    installMic();
    const { unmount, container } = renderChatArea('conv-a');
    await waitFor(() => expect(screen.getByTitle('录制语音')).toBeInTheDocument());

    await recordClip();

    // 发送 → 第一次 chat 失败（event:error）
    fireEvent.click(screen.getByText('发送'));
    await waitFor(() => expect(screen.getByText('语音附件已上传，可重发')).toBeInTheDocument());

    expect(screen.getByText('发送失败，附件已保留')).toBeVisible();
    expect(container.querySelectorAll('audio').length).toBe(1); // refresh 载回的唯一 user turn

    // retry：复用 IDs（upload count 不增）、edit_message_id 替换持久化 turn
    fireEvent.click(screen.getByText('重发'));
    await waitFor(() => expect(screen.queryByText('语音附件已上传，可重发')).toBeNull());

    expect(uploads).toBe(1);
    expect(chatPosts).toBe(2);
    expect(container.querySelectorAll('audio').length).toBe(1);
    unmount();
  });

  it('retry binds edit_message_id to the audio turn, not an unrelated image turn (P0-R14)', async () => {
    let chatPosts = 0;
    const retryBodies = [];
    const normalBodies = [];
    vi.stubGlobal('fetch', vi.fn((url, opts) => {
      if (String(url).includes('/conversations/') && !String(url).includes('/attachments') && !String(url).includes('/chat')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [CONV_A] });
      }
      if (String(url).includes('/attachments')) {
        return Promise.resolve({ ok: true, status: 201, json: async () => ({ attachments: [{ id: 99 }] }) });
      }
      if (String(url).includes('/chat')) {
        if (opts?.method === 'POST') {
          chatPosts += 1;
          const body = JSON.parse(opts.body || '{}');
          if (chatPosts === 1) {
            return Promise.resolve({ ok: true, status: 200, body: sseBody(['event: error\ndata: {"message":"boom"}']) });
          }
          if (chatPosts === 2) retryBodies.push(body);
          if (chatPosts === 3) normalBodies.push(body);
          return Promise.resolve({ ok: true, status: 200, body: sseBody(['event: done\ndata: [DONE]']) });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            messages: [
              { id: 400, role: 'user', content: 'pic', attachments_meta: [{ id: 88, mime_type: 'image/png', file_uri: 'files/p.png' }] },
              { id: 500, role: 'user', content: '', attachments_meta: [{ id: 99, mime_type: 'audio/webm', display_name: 'rec.webm', file_size: 5, content_url: '/api/agents/conversations/conv-a/attachments/99/content/' }] },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    }));

    installRecorder();
    installMic();
    const { unmount } = renderChatArea('conv-a');
    await waitFor(() => expect(screen.getByTitle('录制语音')).toBeInTheDocument());

    await recordClip();

    // 发送 → error → refresh 载回两个 user turn
    fireEvent.click(screen.getByText('发送'));
    await waitFor(() => expect(screen.getByText('语音附件已上传，可重发')).toBeInTheDocument());

    // retry：edit_message_id 必须绑定 audio turn（id 500），而非图片 turn（400）
    fireEvent.click(screen.getByText('重发'));
    await waitFor(() => expect(retryBodies).toHaveLength(1));
    expect(retryBodies[0].edit_message_id).toBe(500);
    expect(retryBodies[0].pending_attachments).toContain(99);

    // retry 成功后：recoverable/重发/放弃消失（R15：attempt flags 重置）
    await waitFor(() => expect(screen.queryByText('语音附件已上传，可重发')).toBeNull());
    expect(screen.queryByText('重发')).toBeNull();
    expect(screen.queryByText('放弃')).toBeNull();

    // abandon（此处无入口，直接输入文本普通发送）：无 stale edit ID / pending audio
    fireEvent.change(screen.getByPlaceholderText('Chat to ExoCore...'), { target: { value: 'hello' } });
    fireEvent.keyDown(screen.getByPlaceholderText('Chat to ExoCore...'), { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(normalBodies).toHaveLength(1));
    expect(normalBodies[0].edit_message_id).toBeUndefined();
    expect(normalBodies[0].pending_attachments).toBeUndefined();
    unmount();
  });
});
