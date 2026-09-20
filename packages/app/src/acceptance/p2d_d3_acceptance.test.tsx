import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { NotificationRuntime } from '../features/notifications/NotificationRuntime';
import { initializeStorage } from '../features/notifications/storage';
import { ensureTestLocalStorage, jsonResponse } from '../test/helpers';

class WorkerMessages extends EventTarget {}

const event = (eventId: number, messageId: number, text: string) => ({
  kind: 'assistant-message-arrived',
  version: 1,
  event_id: eventId,
  dedupe_key: `assistant-message:${messageId}`,
  conversation_id: eventId,
  message_id: messageId,
  agent: { id: 6, name: 'Sandro' },
  preview: { policy: 'bounded_text', text, truncated: false },
  target: { kind: 'conversation_message', conversation_id: eventId, message_id: messageId },
  ignore: { allowed: true },
  register_ack: null,
  title_hint: null,
  committed_at: '2026-09-14T00:00:00Z',
});

function renderRuntime(worker: WorkerMessages) {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: worker,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/settings/notifications']}>
        <NotificationRuntime><div>host</div></NotificationRuntime>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function handoff(worker: WorkerMessages, payload: ReturnType<typeof event>) {
  worker.dispatchEvent(new MessageEvent('message', {
    data: { type: 'ASSISTANT_ARRIVAL_HANDOFF', version: 1, event: payload },
  }));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('P2D D-3 explicit-ignore timing acceptance', () => {
  it('a completed ignore for an older indication cannot close a newer arrival', async () => {
    ensureTestLocalStorage();
    localStorage.clear();
    initializeStorage();
    const worker = new WorkerMessages();
    let resolveIgnore!: (response: Response) => void;
    const pendingIgnore = new Promise<Response>((resolve) => { resolveIgnore = resolve; });
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/push/assistant-arrivals/') {
        return Promise.resolve(jsonResponse({ events: [], next_cursor: 0, has_more: false }));
      }
      if (url.pathname === '/api/push/assistant-arrivals/11/ignore/') {
        return pendingIgnore;
      }
      return Promise.resolve(jsonResponse({}, 404));
    }));

    renderRuntime(worker);
    await act(async () => { handoff(worker, event(11, 101, 'first indication')); });
    expect(await screen.findByText('first indication')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '忽略通知' }));

    await act(async () => { handoff(worker, event(22, 202, 'newer indication')); });
    expect(await screen.findByText('newer indication')).toBeInTheDocument();

    await act(async () => {
      resolveIgnore(jsonResponse({
        action: 'ignore', event_id: 11, message_id: 101, conversation_id: 11, created: true,
      }));
      await pendingIgnore;
    });

    await waitFor(() => {
      expect(screen.getByText('newer indication')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '忽略通知' })).not.toBeDisabled();
    });
    expect(screen.queryByText('first indication')).toBeNull();
  });

  it('an older ignore failure cannot attach its error or busy state to a newer arrival', async () => {
    ensureTestLocalStorage();
    localStorage.clear();
    initializeStorage();
    const worker = new WorkerMessages();
    let rejectIgnore!: (reason: Error) => void;
    const pendingIgnore = new Promise<Response>((_resolve, reject) => { rejectIgnore = reject; });
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/push/assistant-arrivals/') {
        return Promise.resolve(jsonResponse({ events: [], next_cursor: 0, has_more: false }));
      }
      if (url.pathname === '/api/push/assistant-arrivals/31/ignore/') return pendingIgnore;
      return Promise.resolve(jsonResponse({}, 404));
    }));

    renderRuntime(worker);
    await act(async () => { handoff(worker, event(31, 301, 'old request')); });
    expect(await screen.findByText('old request')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '忽略通知' }));

    await act(async () => { handoff(worker, event(32, 302, 'fresh arrival')); });
    expect(await screen.findByText('fresh arrival')).toBeInTheDocument();
    await act(async () => {
      rejectIgnore(new Error('offline'));
      await pendingIgnore.catch(() => undefined);
    });

    await waitFor(() => expect(screen.getByText('fresh arrival')).toBeInTheDocument());
    expect(screen.queryByText('offline')).toBeNull();
    expect(screen.getByRole('button', { name: '忽略通知' })).not.toBeDisabled();
  });
});
