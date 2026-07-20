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
        return {
          id: a.id,
          name: a.display_name || a.original_filename,
          type: a.mime_type,
          size: a.file_size,
          preview: previewUrl,
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
export async function uploadFilesToAttachments(sessionId, files) {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));

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
