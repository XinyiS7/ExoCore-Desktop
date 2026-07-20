import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Must mock exo-shared before importing the module under test
vi.mock('exo-shared', () => ({
  baseUrl: 'http://localhost:8000',
  getCsrfToken: vi.fn(() => 'mock-csrf'),
}));

import { uploadFilesToAttachments, AttachmentUploadError } from './attachmentStorage.js';

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
