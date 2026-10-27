/** Wire-shape Collection fixtures (ReactSheet §13.2 list item / §13.4 detail). */

export function listItem(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    kind: 'text',
    title: `藏品 ${id}`,
    description: '',
    collection_context: '',
    preview: '一段文字',
    tags: [],
    source: { type: 'text', key: `text-${id}` },
    target: { type: 'collection_item', id },
    search_target: 'collection',
    collected_at: '2026-10-14T10:00:00+00:00',
    updated_at: '2026-10-14T10:00:00+00:00',
    ...overrides,
  };
}

export function detailItem(id: number, overrides: Record<string, unknown> = {}) {
  return {
    ...listItem(id),
    source: {
      type: 'message',
      key: '88',
      snapshot: {
        message_id: 88,
        message: {
          message_id: 88, conversation_id: 12, index_in_session: 3,
          role: 'assistant', created_at: '2026-10-13T08:00:00+00:00',
        },
      },
      available: true,
    },
    text_content: '一段文字',
    asset: null,
    representations: [],
    capabilities: ['update', 'delete'],
    comments: [
      { id: 31, author_type: 'human', author_label: 'Alicia', body: '第一次', created_at: '2026-10-14T10:00:00+00:00', can_delete: true },
      { id: 32, author_type: 'agent', author_label: 'Alessandro', body: '我也喜欢', created_at: '2026-10-14T11:00:00+00:00', can_delete: false },
    ],
    viewer_stats: [
      {
        viewer_type: 'human', viewer_key: 'alicia', label: 'Alicia',
        view_count: 2, show_count: 1, collect_count: 1, last_viewed_at: '2026-10-14T12:00:00+00:00',
      },
      {
        viewer_type: 'agent', viewer_key: 'preset:1', label: 'Alessandro',
        view_count: 1, show_count: 0, collect_count: 0, last_viewed_at: null,
      },
    ],
    ...overrides,
  };
}

export function imageDetail(id: number, overrides: Record<string, unknown> = {}) {
  return detailItem(id, {
    kind: 'image',
    preview: '',
    text_content: '',
    source: {
      type: 'attachment', key: `att-${id}`, available: true,
      snapshot: { provenance_id: 'p', filename: 'cat.png', message: null },
    },
    asset: { sha256: 'abc', file_size: 2048, mime_type: 'image/png', status: 'ready' },
    representations: [{
      kind: 'image_preview', state: 'succeeded', canonical_text: '',
      content_url: `/api/collection/items/${id}/representations/image_preview/content/`,
      artifact_mime_type: 'image/webp', producer_type: 'deterministic_preview',
      producer_version: 'collection-cp4-v1', model_identity: '', attempt_count: 1,
      retryable: false, retry_url: null, error_code: '', updated_at: '2026-10-14T10:00:00+00:00',
    }],
    capabilities: ['update', 'delete', 'bring_to_chat', 'read_original'],
    original_content_url: `/api/collection/items/${id}/original/`,
    ...overrides,
  });
}
