import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConversationSettingsDialog } from '../features/chat/ConversationSettingsDialog';
import { PrimeConversationConfirmDialog } from '../features/agents/PrimeConversationConfirmDialog';
import {
  getTheaterDocuments,
  theaterDocumentErrorMessage,
  uploadTheaterDocuments,
} from '../features/chat/api';
import { queryKeys } from '../features/chat/queries';
import { callsToPath, installFetch, jsonResponse, renderV4, unmockFetch, type MockRoute } from './helpers';

const DOCS = '/api/agents/conversations/101/theater-documents/';

const convRow = (over: Record<string, unknown> = {}) => ({
  id: 101,
  name: 'Alpha',
  created_at: '2026-10-01T00:00:00Z',
  frozen_project_ids: [],
  project: 0,
  project_name: null,
  agent_type: 'standard',
  agent_preset_id: 5,
  last_message_at: null,
  thinking_level: 'auto',
  memory_injection_enabled: null,
  is_prime: false,
  tags: ['theater'],
  session_prompt: '',
  ...over,
});

const doc = (id: number, filename: string, charCount: number, position: number) => ({
  id,
  filename,
  char_count: charCount,
  position,
  created_at: '2026-11-11T10:00:00Z',
});

const state = (documents: ReturnType<typeof doc>[], injected = true) => ({
  documents,
  total_chars: documents.reduce((sum, d) => sum + d.char_count, 0),
  limit: 15000,
  injected,
});

function baseRoutes(extra: MockRoute[] = []): MockRoute[] {
  return [
    ...extra,
    { test: '/api/core/tags/suggest/', handler: () => jsonResponse({ tags: [] }) },
    { test: '/api/agents/conversations/101/', handler: () => jsonResponse(convRow()) },
  ];
}

const file = (name: string, body = 'x') => new File([body], name, { type: 'text/plain' });

async function openDialog() {
  renderV4(<ConversationSettingsDialog conversationId={101} onClose={() => {}} />);
  return screen.findByRole('dialog', { name: '会话设定' });
}

function pickFiles(dialog: HTMLElement, files: File[]) {
  fireEvent.change(within(dialog).getByLabelText('选择剧本文档'), { target: { files } });
}

afterEach(() => unmockFetch());

describe('theater document adapters (#128)', () => {
  it('normalizes the state and posts one multipart batch under `files`', async () => {
    const { calls } = installFetch([
      { test: DOCS, method: 'POST', handler: () => jsonResponse(state([doc(1, 'a.md', 5, 1)]), 201) },
    ]);
    const result = await uploadTheaterDocuments(101, [file('a.md'), file('b.txt')]);
    expect(result).toEqual({
      documents: [{ id: 1, filename: 'a.md', charCount: 5, position: 1, createdAt: '2026-11-11T10:00:00Z' }],
      totalChars: 5,
      limit: 15000,
      injected: true,
    });
    const body = callsToPath(calls, '/theater-documents/')[0].init?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect((body.getAll('files') as File[]).map((f) => f.name)).toEqual(['a.md', 'b.txt']);
  });

  it('rejects malformed envelopes as CONTRACT errors', async () => {
    installFetch([
      { test: DOCS, handler: () => jsonResponse({ documents: [{ id: 1 }], total_chars: 0, limit: 1, injected: true }) },
    ]);
    await expect(getTheaterDocuments(101)).rejects.toMatchObject({ code: 'CONTRACT' });
  });

  it('maps backend error bodies to one line, with filename when present', () => {
    expect(
      theaterDocumentErrorMessage({ code: 'theater_document_empty', message: '文件正文为空。', filename: 'x.md' }),
    ).toBe('「x.md」文件正文为空。');
    expect(theaterDocumentErrorMessage({ code: 'theater_document_no_files', message: '请选择要上传的文件。' })).toBe(
      '请选择要上传的文件。',
    );
    expect(theaterDocumentErrorMessage({ code: 'conversation_not_found', message: '会话不存在' })).toBeNull();
  });
});

describe('Session Settings theater document section (#128)', () => {
  it('lists documents in server order with the injected status and budget', async () => {
    installFetch(
      baseRoutes([
        { test: DOCS, handler: () => jsonResponse(state([doc(1, '世界观.md', 5200, 1), doc(2, '人物.txt', 3100, 3)])) },
      ]),
    );
    const dialog = await openDialog();
    expect(await within(dialog).findByText(/剧场生效中/)).toBeTruthy();
    expect(within(dialog).getByText(/正文 8,300 \/ 15,000 字符/)).toBeTruthy();
    const list = within(dialog).getByRole('list', { name: '剧本文档列表' });
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('世界观.md'),
      expect.stringContaining('人物.txt'),
    ]);
  });

  it('stays visible but says 不被读取 when the conversation is not effectively sealed', async () => {
    installFetch(baseRoutes([{ test: DOCS, handler: () => jsonResponse(state([doc(1, 'a.md', 3, 1)], false)) }]));
    const dialog = await openDialog();
    expect(await within(dialog).findByText(/不被读取（仅非主会话且带 #theater 时注入）/)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: '上传 .md / .txt' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: '删除 a.md' })).toBeTruthy();
  });

  it('uploads immediately and shows only the returned server state', async () => {
    const { calls } = installFetch(
      baseRoutes([
        {
          test: DOCS,
          method: 'POST',
          handler: () => jsonResponse(state([doc(1, 'a.md', 1, 1), doc(2, 'b.txt', 1, 2)]), 201),
        },
        { test: DOCS, handler: () => jsonResponse(state([])) },
      ]),
    );
    const dialog = await openDialog();
    await within(dialog).findByText('尚未上传剧本文档。');
    pickFiles(dialog, [file('a.md'), file('b.txt')]);
    expect(await within(dialog).findByText('b.txt')).toBeTruthy();
    expect(within(dialog).getByText(/正文 2 \/ 15,000/)).toBeTruthy();
    expect(calls.filter((c) => c.init?.method === 'PATCH')).toHaveLength(0);
  });

  it('a rejected batch shows the backend message and leaves the list unchanged', async () => {
    installFetch(
      baseRoutes([
        {
          test: DOCS,
          method: 'POST',
          handler: () =>
            jsonResponse(
              {
                code: 'theater_document_budget_exceeded',
                message: '剧本文档合计不得超过 15,000 字符（当前 10,000，本批 5,001）。',
                current_chars: 10000,
                batch_chars: 5001,
                limit: 15000,
              },
              400,
            ),
        },
        { test: DOCS, handler: () => jsonResponse(state([doc(1, 'a.md', 10000, 1)])) },
      ]),
    );
    const dialog = await openDialog();
    await within(dialog).findByText('a.md');
    pickFiles(dialog, [file('b.md')]);
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '剧本文档合计不得超过 15,000 字符（当前 10,000，本批 5,001）。',
    );
    expect(within(dialog).queryByText('b.md')).toBeNull();
    expect(within(dialog).getByText(/正文 10,000 \/ 15,000/)).toBeTruthy();
  });

  it('deletes one document and renders the returned state', async () => {
    const { calls } = installFetch(
      baseRoutes([
        {
          test: `${DOCS}2/`,
          method: 'DELETE',
          handler: () => jsonResponse(state([doc(1, 'a.md', 2, 1), doc(3, 'c.md', 1, 3)])),
        },
        {
          test: DOCS,
          handler: () => jsonResponse(state([doc(1, 'a.md', 2, 1), doc(2, 'b.md', 1, 2), doc(3, 'c.md', 1, 3)])),
        },
      ]),
    );
    const dialog = await openDialog();
    fireEvent.click(await within(dialog).findByRole('button', { name: '删除 b.md' }));
    await waitFor(() => expect(within(dialog).queryByText('b.md')).toBeNull());
    expect(within(dialog).getByText(/正文 3 \/ 15,000/)).toBeTruthy();
    expect(callsToPath(calls, '/theater-documents/2/')).toHaveLength(1);
  });

  it('saving tags refetches the documents so the status line follows', async () => {
    const { calls } = installFetch(
      baseRoutes([
        {
          test: '/api/agents/conversations/101/',
          method: 'PATCH',
          handler: (_url, init) => jsonResponse(convRow({ ...JSON.parse(String(init?.body)) })),
        },
        { test: DOCS, handler: () => jsonResponse(state([])) },
      ]),
    );
    const dialog = await openDialog();
    await within(dialog).findByText(/剧场生效中/);
    expect(callsToPath(calls, '/theater-documents/')).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
    await waitFor(() => expect(callsToPath(calls, '/theater-documents/')).toHaveLength(2));
  });
});

describe('Prime transfer refreshes theater-document status (#128)', () => {
  it('invalidates the whole theater-documents family after a confirmed transfer', async () => {
    installFetch([
      {
        test: '/api/agents/conversations/102/',
        method: 'PATCH',
        handler: () => jsonResponse(convRow({ id: 102, is_prime: true })),
      },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
    ]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spy = vi.spyOn(client, 'invalidateQueries');
    render(
      <QueryClientProvider client={client}>
        <PrimeConversationConfirmDialog open conversationId={102} conversationName="Beta" onClose={() => {}} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '设为主会话' }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.theaterDocumentsAll }));
  });
});
