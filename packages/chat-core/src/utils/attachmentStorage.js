import { baseUrl, getCsrfToken } from 'exo-shared';

// 移除对 localStorage 的持久化依赖，仅保留用于前端本地临时预览生成的方法

/**
 * Typed error carrying structured attachment upload response data.
 */
export class AttachmentUploadError extends Error {
  constructor(status, responseBody) {
    const message = responseBody.error || `Upload failed (${status})`;
    super(message);
    this.name = 'AttachmentUploadError';
    this.status = status || 0;
    this.error = responseBody.error || null;
    this.failures = responseBody.failures || [];
    this.results = responseBody.results || null;
  }
}

/**
 * 将 File 对象数组转换为可用于本地预览的数据（dataUrl）。
 */
export async function filesToAttachmentData(files) {
  return Promise.all(
    files.map(f => new Promise(resolve => {
      if (f.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = e => resolve({ name: f.name, type: f.type, dataUrl: e.target.result });
        reader.onerror = () => resolve({ name: f.name, type: f.type, dataUrl: null });
        reader.readAsDataURL(f);
      } else {
        resolve({ name: f.name, type: f.type, dataUrl: null });
      }
    }))
  );
}

/**
 * 空实现，用于兼容旧的调用。
 */
export function saveAttachments(messageId, attachments) {
  // 不再需要持久化到 localStorage
}

/**
 * 读取后端 API 返回的 attachments_meta 数据，将其转换为前端组件兼容的格式。
 */
export function enrichMessages(messages) {
  return messages.map(msg => {
    if (!msg.attachments_meta || msg.attachments_meta.length === 0) return msg;

    return {
      ...msg,
      attachments: msg.attachments_meta.map(a => {
        let previewUrl = null;
        if (a.mime_type && a.mime_type.startsWith('image/') && a.file_uri) {
           previewUrl = a.file_uri.startsWith('/') && !a.file_uri.startsWith('http')
             ? `${baseUrl}${a.file_uri}`
             : a.file_uri;
        }
        const isAudio = a.mime_type && a.mime_type.startsWith('audio/');
        return {
          id: a.id,
          name: a.display_name || a.original_filename,
          type: a.mime_type,
          size: a.file_size,
          preview: previewUrl,
          // Local same-origin playback for audio; Gemini file_uri is remote and expiring.
          audioUrl: isAudio && a.content_url
            ? (a.content_url.startsWith('/') && !a.content_url.startsWith('http')
                ? `${baseUrl}${a.content_url}`
                : a.content_url)
            : null,
        };
      }),
    };
  });
}

/**
 * Upload multiple files as multipart/form-data to a conversation's attachments endpoint.
 *
 * Returns a normalized payload object:
 *   { attachments: Array, failures: Array, results: Array|null }
 *
 * On non-2xx, throws AttachmentUploadError with status, error, failures, and results
 * (when the backend provides them).
 */
export async function uploadFilesToAttachments(sessionId, files, target = null) {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  // Audio uploads require the session main target (model + endpoint); backend
  // resolves it via resolve_session_target — see Plan Phase A (audio_target_required).
  if (target) {
    if (target.model) formData.append('model', target.model);
    if (target.endpoint != null) formData.append('endpoint', String(target.endpoint));
  }

  const res = await fetch(
    `${baseUrl}/api/agents/conversations/${sessionId}/attachments/`,
    {
      method: 'POST',
      headers: { 'X-CSRFToken': getCsrfToken() },
      credentials: 'include',
      body: formData,
    }
  );

  let data;
  try {
    data = await res.json();
  } catch (_) {
    data = {};
  }

  if (!res.ok) {
    throw new AttachmentUploadError(res.status, data);
  }

  return {
    attachments: data.attachments || [],
    failures: data.failures || [],
    results: data.results || null,
  };
}

// Mirrors backend _AUDIO_MIME_ALLOWLIST (Plan Phase 0 froze these two).
export const AUDIO_MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm'];

// 前端同值预检：10 MiB（后端保持最终事实源）
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/**
 * Upload 错误稳定用户文案映射（不暴露 raw backend code）。
 * 优先使用结构化 failures[0].code，其次 err.error。
 */
export function audioUploadErrorMessage(err) {
  const failure = err.failures?.[0];
  const code = failure?.code || err.error;
  switch (code) {
    case 'audio_too_large': return '语音超过 10 MiB 上限';
    case 'audio_mime_unsupported': return '语音格式不被支持';
    case 'audio_model_unsupported': return '当前模型不支持语音';
    case 'audio_target_required': return '语音上传缺少目标配置';
    case 'attachment_upload_failed': return '语音上传失败';
    default: return `语音上传失败（${err.status || '网络错误'}）`;
  }
}

/**
 * Audio capability gate for the current session main target.
 * Mirrors backend preflight_audio: model must expose `audio` ability and the
 * endpoint must support `file_uri` transport (Gemini Files API).
 * DeepSeek/OpenRouter targets therefore never pass.
 */
export function audioCapable(catalog, target) {
  if (!catalog || !target || !target.model || target.endpoint == null) return false;
  const model = catalog.models?.find(m => m.name === target.model);
  const endpoint = catalog.endpoints?.find(e => e.id === target.endpoint);
  if (!model || !endpoint) return false;
  return (model.abilities || []).includes('audio')
    && (endpoint.attachment_transports || []).includes('file_uri');
}
