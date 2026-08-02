import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Must mock exo-shared before importing the module under test
vi.mock('exo-shared', () => ({
  baseUrl: 'http://localhost:8000',
  getCsrfToken: vi.fn(() => 'mock-csrf'),
}));

import { uploadFilesToAttachments, AttachmentUploadError, enrichMessages, audioCapable, audioUploadErrorMessage, MAX_AUDIO_BYTES } from './attachmentStorage.js';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const SESSION_ID = 'conv-abc';
const fakeFile = () => new File(['data'], 'photo.jpg', { type: 'image/jpeg' });

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockResponse(status, body, ok) {
  mockFetch.mockResolvedValueOnce({
    ok: ok ?? (status >= 200 && status < 300),
    status,
    json: async () => body,
  });
}

describe('uploadFilesToAttachments', () => {
  it('throws AttachmentUploadError on 422 with failures preserved', async () => {
    const body = {
      error: 'all attachments failed',
      failures: [
        { display_name: 'bad.jpg', mime_type: 'image/jpeg', stage: 'upload', reason: 'timeout' },
      ],
    };
    mockResponse(422, body);

    try {
      await uploadFilesToAttachments(SESSION_ID, [fakeFile()]);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AttachmentUploadError);
      expect(e.status).toBe(422);
      expect(e.error).toBe('all attachments failed');
      expect(e.failures).toEqual(body.failures);
      expect(e.message).toBe('all attachments failed');
    }
  });

  it('preserves diagnostics/results in error body when present (M1-ready)', async () => {
    const body = {
      error: 'all attachments failed',
      failures: [{ display_name: 'img.png', stage: 'upload', reason: 'upload failed' }],
      results: [
        { input_index: 0, status: 'failed', diagnostics: [{ stage: 'upload', code: 'upload_failed', level: 'error', message: '上传失败' }] },
      ],
    };
    mockResponse(422, body);

    try {
      await uploadFilesToAttachments(SESSION_ID, [fakeFile()]);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e.results).not.toBeNull();
      expect(e.results[0].status).toBe('failed');
      expect(e.results[0].diagnostics).toHaveLength(1);
    }
  });

  it('returns normalized payload on 201 partial success', async () => {
    const body = {
      attachments: [{ id: 42, display_name: 'good.jpg', mime_type: 'image/jpeg', file_size: 1024 }],
      failures: [{ display_name: 'bad.jpg', mime_type: 'image/jpeg', stage: 'upload', reason: 'timeout' }],
    };
    mockResponse(201, body);

    const result = await uploadFilesToAttachments(SESSION_ID, [fakeFile(), fakeFile()]);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].id).toBe(42);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].display_name).toBe('bad.jpg');
    expect(result.results).toBeNull();
  });

  it('returns empty attachments/failures on 201 with no body array', async () => {
    mockResponse(201, {});

    const result = await uploadFilesToAttachments(SESSION_ID, [fakeFile()]);
    expect(result.attachments).toEqual([]);
    expect(result.failures).toEqual([]);
    expect(result.results).toBeNull();
  });

  it('throws AttachmentUploadError on non-JSON response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => { throw new Error('Not JSON'); },
    });

    try {
      await uploadFilesToAttachments(SESSION_ID, [fakeFile()]);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AttachmentUploadError);
      expect(e.status).toBe(500);
      expect(e.message).toContain('500');
    }
  });
});

describe('uploadFilesToAttachments with audio target', () => {
  it('appends model/endpoint to FormData when target provided', async () => {
    mockResponse(201, { attachments: [{ id: 7, mime_type: 'audio/webm' }] });
    const audioFile = new File(['audio'], 'rec.webm', { type: 'audio/webm;codecs=opus' });
    await uploadFilesToAttachments(SESSION_ID, [audioFile], { model: 'gemini-2.5-flash', endpoint: 2 });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain(`/conversations/${SESSION_ID}/attachments/`);
    const body = options.body;
    expect(body.get('model')).toBe('gemini-2.5-flash');
    expect(body.get('endpoint')).toBe('2');
    expect(body.getAll('files')).toHaveLength(1);
  });

  it('omits model/endpoint when target is null (legacy callers)', async () => {
    mockResponse(201, {});
    await uploadFilesToAttachments(SESSION_ID, [fakeFile()]);
    const body = mockFetch.mock.calls[0][1].body;
    expect(body.get('model')).toBeNull();
    expect(body.get('endpoint')).toBeNull();
  });
});

describe('enrichMessages audio content_url', () => {
  it('maps audio attachments_meta to local audioUrl', () => {
    const enriched = enrichMessages([{
      role: 'user',
      content: '',
      attachments_meta: [{
        id: 7, display_name: 'rec.webm', original_filename: 'rec.webm',
        mime_type: 'audio/webm', file_size: 1024,
        content_url: '/api/agents/conversations/9/attachments/7/content/',
      }],
    }]);
    expect(enriched[0].attachments[0].audioUrl).toBe(
      'http://localhost:8000/api/agents/conversations/9/attachments/7/content/'
    );
    expect(enriched[0].attachments[0].preview).toBeNull();
  });

  it('keeps audioUrl null for non-audio attachments', () => {
    const enriched = enrichMessages([{
      role: 'user', content: 'x',
      attachments_meta: [{ id: 1, mime_type: 'image/png', file_uri: 'files/x.png' }],
    }]);
    expect(enriched[0].attachments[0].audioUrl).toBeNull();
    expect(enriched[0].attachments[0].preview).toBe('files/x.png');
  });
});

describe('audioCapable gate', () => {  const catalog = {
    models: [
      { name: 'gemini-2.5-flash', abilities: ['fc', 'audio'] },
      { name: 'deepseek-v4-flash', abilities: ['fc'] },
    ],
    endpoints: [
      { id: 2, attachment_transports: ['file_uri', 'inline_text'] },
      { id: 1, attachment_transports: ['inline_text'] },
    ],
  };

  it('true when model has audio ability and endpoint supports file_uri', () => {
    expect(audioCapable(catalog, { model: 'gemini-2.5-flash', endpoint: 2 })).toBe(true);
  });

  it('false when model lacks audio ability', () => {
    expect(audioCapable(catalog, { model: 'deepseek-v4-flash', endpoint: 2 })).toBe(false);
  });

  it('false when endpoint lacks file_uri transport', () => {
    expect(audioCapable(catalog, { model: 'gemini-2.5-flash', endpoint: 1 })).toBe(false);
  });

  it('false when catalog or target missing', () => {
    expect(audioCapable(null, { model: 'gemini-2.5-flash', endpoint: 2 })).toBe(false);
    expect(audioCapable(catalog, null)).toBe(false);
    expect(audioCapable(catalog, { model: '', endpoint: null })).toBe(false);
  });
});

describe('audioUploadErrorMessage stable mapping (P1-R5)', () => {
  it('maps structured diagnostics codes to stable user copy', () => {
    expect(audioUploadErrorMessage({ failures: [{ code: 'audio_too_large' }] })).toBe('语音超过 10 MiB 上限');
    expect(audioUploadErrorMessage({ failures: [{ code: 'audio_mime_unsupported' }] })).toBe('语音格式不被支持');
    expect(audioUploadErrorMessage({ failures: [{ code: 'audio_model_unsupported' }] })).toBe('当前模型不支持语音');
    expect(audioUploadErrorMessage({ failures: [{ code: 'audio_target_required' }] })).toBe('语音上传缺少目标配置');
  });

  it('falls back without leaking raw backend code', () => {
    const msg = audioUploadErrorMessage({ status: 502, error: 'rate_limited_internal' });
    expect(msg).not.toContain('rate_limited_internal');
    expect(msg).toContain('502');
  });

  it('10 MiB frontend preflight constant matches backend cap', () => {
    expect(MAX_AUDIO_BYTES).toBe(10 * 1024 * 1024);
  });
});
