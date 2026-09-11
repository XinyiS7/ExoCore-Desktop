import { apiFetch } from 'exo-shared/api';
import type { ProjectDetailRow } from '../chat/control/types';
import { AppApiError, contractError } from '../chat/api';
import type {
  KnowledgePatchResult,
  KnowledgePatchValues,
  ProjectDeletePreview,
  ProjectKnowledgeRow,
} from './types';

/**
 * P2B Project lifecycle adapters (Plan §5.1 "guarded Project boundaries";
 * §5.3 object guard; §8.3 create/edit behavior).
 *
 * The canonical Projects-LIST owner stays `listProjects` (`features/chat/api.ts`,
 * hardened for row identity) and the canonical Project-DETAIL owner stays
 * `fetchProjectDetail` (`features/chat/control/api.ts`). This module owns only
 * the two NEW write adapters — create and update — plus the shared guarded
 * Project-object validator both use. No generic CRUD framework; only the four
 * verified serializer fields are ever sent (name/description/prompt/work_dir).
 */
export interface ProjectWriteValues {
  name: string;
  description: string;
  prompt: string;
  workDir: string;
}

/**
 * Mutation variables for Project writes: the four wire fields plus the
 * optional submit identity (F01). Edit always carries `projectId` (captured at
 * dialog open, riding inside the variables so settled writes invalidate the
 * SUBMITTED Project); create never needs it.
 */
export type ProjectSubmitVariables = ProjectWriteValues & { projectId?: number };

/**
 * Guarded Project object row shared by create/update responses (Plan §5.3):
 * object with a positive numeric id + the verified serializer fields. Any
 * other shape is an explicit contract error.
 */
export function validateProjectObject(raw: unknown): ProjectDetailRow {
  if (typeof raw !== 'object' || raw === null) {
    throw contractError('项目写入接口返回格式异常', raw);
  }
  const row = raw as Record<string, unknown>;
  if (
    typeof row.id !== 'number' ||
    !Number.isInteger(row.id) ||
    (row.id as number) <= 0 ||
    typeof row.name !== 'string'
  ) {
    throw contractError('项目写入接口返回缺少有效的编号或名称', raw);
  }
  return {
    id: row.id as number,
    name: row.name as string,
    description: typeof row.description === 'string' ? row.description : null,
    prompt: typeof row.prompt === 'string' ? row.prompt : null,
    workDir: typeof row.work_dir === 'string' ? row.work_dir : null,
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
  };
}

/** Wire body for create/update — only the supported serializer fields (Plan §4.1). */
function toWire(values: ProjectWriteValues): Record<string, string> {
  return {
    name: values.name,
    description: values.description,
    prompt: values.prompt,
    work_dir: values.workDir,
  };
}

/** POST /api/core/projects/ — create succeeds only with a confirmed returned id. */
export async function createProject(values: ProjectWriteValues): Promise<ProjectDetailRow> {
  const raw = await apiFetch('/api/core/projects/', { method: 'POST', body: toWire(values) });
  try {
    return validateProjectObject(raw);
  } catch {
    // 2xx yet malformed: the write may have landed but the confirmed id is
    // unknown — ambiguous write (duplicate-create risk), never an inferred id.
    throw new AppApiError('项目已提交，但返回缺少有效的项目编号；结果不确定。请关闭窗口后刷新项目列表确认（避免重复创建）。', {
      body: raw,
      code: 'CONTRACT',
      ambiguousWrite: true,
    });
  }
}

/** PATCH /api/core/projects/<id>/ — same four fields; saves the stored work_dir string. */
export async function updateProject(id: number, values: ProjectWriteValues): Promise<ProjectDetailRow> {
  const raw = await apiFetch(`/api/core/projects/${id}/`, { method: 'PATCH', body: toWire(values) });
  try {
    return validateProjectObject(raw);
  } catch {
    // 2xx yet malformed: the PATCH may have landed; re-read server truth.
    throw new AppApiError('项目已保存，但返回内容无法确认；已重新读取项目数据。', {
      body: raw,
      code: 'CONTRACT',
      ambiguousWrite: true,
    });
  }
}

// ── Project Files (workspace list / upload / delete; Plan §6.3, D3) ──────────

/**
 * GET /api/memory/knowledge/?project=<id> — bare array (P2B §6.4, D2).
 * The backend view declares an unused `page_size` attribute with no
 * pagination_class; the verified runtime shape is a bare array (Razor note:
 * stale pagination wording, no invented pagination client-side). An envelope
 * would be an explicit contract error, never fabricated pagination.
 */
export async function fetchProjectKnowledge(projectId: number): Promise<ProjectKnowledgeRow[]> {
  const raw = await apiFetch('/api/memory/knowledge/', { params: { project: projectId } });
  if (!Array.isArray(raw)) throw contractError('项目知识接口返回格式异常', raw);
  const rows: ProjectKnowledgeRow[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) {
      throw contractError('项目知识接口包含异常行', raw);
    }
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== 'number' ||
      !Number.isInteger(row.id) ||
      (row.id as number) <= 0 ||
      typeof row.title !== 'string'
    ) {
      throw contractError('项目知识接口包含异常行', raw);
    }
    rows.push({
      id: row.id as number,
      title: row.title as string,
      sourceType: typeof row.source_type === 'string' ? row.source_type : null,
      tags: Array.isArray(row.tags) ? (row.tags as unknown[]).filter((t): t is string => typeof t === 'string') : [],
      keywords: Array.isArray(row.keywords)
        ? (row.keywords as unknown[]).filter((k): k is string => typeof k === 'string')
        : [],
      abstract: typeof row.abstract === 'string' ? row.abstract : null,
      updatedAt: typeof row.updated_at === 'string' ? row.updated_at : '',
    });
  }
  return rows;
}

/**
 * POST /api/core/projects/<id>/files/ — existing multipart contract (D6).
 * Sends the chosen File as `file`; a 2xx with a non-object body is an
 * ambiguous write (the file may have been ingested) — never fabricated.
 */
export async function uploadProjectFile(projectId: number, file: File): Promise<void> {
  const body = new FormData();
  body.append('file', file);
  const raw = await apiFetch(`/api/core/projects/${projectId}/files/`, { method: 'POST', body });
  if (typeof raw !== 'object' || raw === null) {
    throw new AppApiError('文件已提交，但返回内容无法确认；请刷新文件列表确认。', {
      body: raw,
      code: 'CONTRACT',
      ambiguousWrite: true,
    });
  }
}

/**
 * DELETE /api/core/projects/<id>/files/<pk>/ — pk passes the verified ID
 * verbatim (numeric upload id OR `kf_<int>` sync id; D3). 204 carries no JSON
 * body; the backend `{error, code}` document stays visible on failures.
 */
export async function deleteProjectFile(projectId: number, fileId: number | string): Promise<void> {
  await apiFetch(`/api/core/projects/${projectId}/files/${String(fileId)}/`, { method: 'DELETE' });
}

/**
 * PATCH /api/memory/knowledge/<pk>/ — abstract and/or keywords (D2).
 * The backend starts async revectorization when abstract changes; this
 * adapter does not interpret it — the UI claim comes from the submitted
 * patch, never from a fabricated revectorize completion.
 */
export async function updateProjectKnowledge(kfId: number, patch: KnowledgePatchValues): Promise<KnowledgePatchResult> {
  const body: Record<string, unknown> = {};
  if (patch.abstract !== undefined) body.abstract = patch.abstract;
  if (patch.keywords !== undefined) body.keywords = patch.keywords;
  const raw = await apiFetch(`/api/memory/knowledge/${kfId}/`, { method: 'PATCH', body });
  if (
    typeof raw !== 'object' ||
    raw === null ||
    typeof (raw as Record<string, unknown>).msg !== 'string' ||
    !Array.isArray((raw as Record<string, unknown>).updated)
  ) {
    throw new AppApiError('摘要已保存，但返回内容无法确认；已重新读取知识列表。', {
      body: raw,
      code: 'CONTRACT',
      ambiguousWrite: true,
    });
  }
  const row = raw as Record<string, unknown>;
  return {
    msg: row.msg as string,
    updated: (row.updated as unknown[]).filter((u): u is string => typeof u === 'string'),
  };
}

// ── Project archival deletion (Plan §6.5, D7) ─────────────────────────────

/** GET /api/core/projects/<id>/delete-preview/ — uploaded files only. */
export async function fetchProjectDeletePreview(projectId: number): Promise<ProjectDeletePreview> {
  const raw = await apiFetch(`/api/core/projects/${projectId}/delete-preview/`);
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw contractError('项目删除预览接口返回格式异常', raw);
  }
  const row = raw as Record<string, unknown>;
  if (
    !Number.isInteger(row.conversations_to_archive) ||
    (row.conversations_to_archive as number) < 0 ||
    !Array.isArray(row.files) ||
    typeof row.files_total_size !== 'number' ||
    !Number.isFinite(row.files_total_size) ||
    row.files_total_size < 0
  ) {
    throw contractError('项目删除预览接口返回格式异常', raw);
  }

  const seenIds = new Set<number>();
  const files = row.files.map((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw contractError('项目删除预览包含异常文件', raw);
    }
    const file = item as Record<string, unknown>;
    if (
      !Number.isInteger(file.id) ||
      (file.id as number) <= 0 ||
      seenIds.has(file.id as number) ||
      typeof file.name !== 'string' ||
      typeof file.size !== 'number' ||
      !Number.isFinite(file.size) ||
      file.size < 0
    ) {
      throw contractError('项目删除预览包含异常文件', raw);
    }
    seenIds.add(file.id as number);
    return { id: file.id as number, name: file.name, size: file.size };
  });

  return {
    conversationsToArchive: row.conversations_to_archive as number,
    files,
    filesTotalSize: row.files_total_size,
  };
}

/** DELETE /api/core/projects/<id>/ — always sends an explicit recovery array. */
export async function deleteProject(projectId: number, keepFileIds: number[]): Promise<void> {
  await apiFetch(`/api/core/projects/${projectId}/`, {
    method: 'DELETE',
    body: { keep_file_ids: keepFileIds },
  });
}