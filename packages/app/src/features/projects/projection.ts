import type { ConversationSummary } from '../chat/types';

/**
 * Pure P2B Project projections (Plan §5.5, D4, §8.4). All helpers are
 * read-only: they never mutate their inputs, never reorder the backend
 * Conversation collection, and never issue requests.
 */

export type AgentFilter = 'all' | number;

export interface AgentOption {
  id: number;
  /** Truthful label: visible preset name when available, else `Agent #<id>`. */
  label: string;
}

/**
 * D4 lens: only rows whose normalized `projectId` EXACTLY equals the current
 * positive Project ID are included. Drift (null) and other Projects never leak
 * in; backend order is preserved (filtering only narrows).
 */
export function rowsForProject(
  conversations: readonly ConversationSummary[],
  projectId: number,
): ConversationSummary[] {
  return conversations.filter((row) => row.projectId === projectId);
}

/**
 * Truthful Agent identity label (Plan §5.5): visible preset name, else
 * `Agent #<id>`; null/invalid Agent identity receives an unavailable label —
 * it never creates a fake option and is only listed under All.
 */
export function agentLabel(
  row: Pick<ConversationSummary, 'agentPresetId'>,
  presetNames: ReadonlyMap<number, string>,
): string {
  const id = row.agentPresetId;
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) return '未知 Agent';
  return presetNames.get(id) ?? `Agent #${id}`;
}

/**
 * Agent filter options derived from the CURRENT Project rows: deduplicated by
 * positive `agentPresetId` in backend row order; visible preset data supplies
 * names where available (Plan §5.5). Null/invalid Agent rows are never options.
 */
export function deriveAgentOptions(
  rows: readonly ConversationSummary[],
  presetNames: ReadonlyMap<number, string>,
): AgentOption[] {
  const seen = new Set<number>();
  const options: AgentOption[] = [];
  for (const row of rows) {
    const id = row.agentPresetId;
    if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    options.push({ id, label: presetNames.get(id) ?? `Agent #${id}` });
  }
  return options;
}

/** Filtering only narrows a subset; it never reorders the collection (D4). */
export function applyAgentFilter(
  rows: readonly ConversationSummary[],
  filter: AgentFilter,
): ConversationSummary[] {
  if (filter === 'all') return [...rows];
  return rows.filter((row) => row.agentPresetId === filter);
}

/**
 * §8.4 render-time guard: if a successful dataset replacement removed the
 * selected Agent, the rendered selection is honest immediately (the page owns
 * the permanent state fallback effect). Pending/failed refetches keep the last
 * successful data, so this never erases a still-valid selection.
 */
export function resolveAgentFilter(
  filter: AgentFilter,
  agentIds: ReadonlySet<number>,
): AgentFilter {
  if (filter !== 'all' && !agentIds.has(filter)) return 'all';
  return filter;
}

// ── Project Files / Knowledge presentation (Plan §6.3/§6.4, D3) ───────────────

/**
 * D3 source label: known CONSISTENT pairs get their normal label (numeric id
 * ↔ web_upload, kf_ id ↔ obsidian_sync); unknown OR ID-inconsistent source
 * metadata gets a NEUTRAL reference label. The label never rejects a row or
 * decides deletion routing — the verified ID does.
 */
export function fileSourceLabel(source: string | null | undefined, id: number | string | null | undefined): string {
  const synced = typeof id === 'string';
  if (source === 'web_upload' && !synced) return 'Web 上传';
  if (source === 'obsidian_sync' && synced) return 'Obsidian 同步';
  return '引用文件';
}

/** A string `kf_` id marks a synced file (no physical browser file, D6). */
export function isSyncedFileId(id: number | string): boolean {
  return typeof id === 'string';
}

/** D6: synced rows are references without a physical browser file. */
export function fileAvailabilityNote(id: number | string, url: string | null): string | null {
  if (isSyncedFileId(id)) return 'Obsidian 同步引用，无本地浏览器文件';
  if (url === null) return '无可用文件地址';
  return null;
}

/** Human file size for the Files section metadata line. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Lossless keyword editing (B02/R4) ──────────────────────────────────────

/**
 * Structural equality of keyword arrays — the editor's no-op detector.
 * The stored array is the single source of truth: untouched entries never
 * traverse a delimiter join/split pipeline, so comparison is element-wise
 * (order and duplicates are data). No text representation exists anywhere
 * in the editing path.
 */
export function keywordsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Neutral knowledge source label (presentation only). */
export function knowledgeSourceLabel(source: string | null | undefined): string {
  if (source === 'obsidian_md') return 'Obsidian';
  if (source === 'web_upload' || source === 'web') return '文件上传';
  if (source === 'chat' || source === 'conversation') return '对话记忆';
  return '知识片段';
}

/** F04-style honest absent label for a Knowledge abstract. */
export function knowledgeAbstractLabel(abstract: string | null | undefined): string {
  return abstract == null || abstract === '' ? '（无摘要）' : abstract;
}