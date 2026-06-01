import { baseUrl, getCsrfToken } from './api';

// 移除对 localStorage 的持久化依赖，仅保留用于前端本地临时预览生成的方法

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

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Upload failed (${res.status})`);
  }

  const data = await res.json();
  return data.attachments || [];
}
