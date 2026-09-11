import { apiFetch } from 'exo-shared/api';
import type { AgentPresetRow } from '../chat/types';
import { contractError } from '../chat/api';

/**
 * P2A Agent feature adapters (Plan §6.1/§6.3).
 *
 * - preset detail: top-level object with numeric `id`, then the verified
 *   `AgentPresetSerializer` shape (same row type as the visible list);
 * - Memory list: top-level array required; only the D5 count/tag summary
 *   crosses this boundary — Plasmid content never reaches presentation.
 * - normalization never mutates the server payload.
 */

export interface AgentMemorySummary {
  /** Exact length of the endpoint's returned array (includes shared/global). */
  count: number;
  /** Trimmed, deduplicated, non-empty tag strings in deterministic order. */
  tags: string[];
}

/** GET /api/agents/presets/<id>/ — visible-only queryset ⇒ hidden preset is 404. */
export async function getAgentPreset(id: number): Promise<AgentPresetRow> {
  const raw = await apiFetch(`/api/agents/presets/${id}/`);
  if (typeof raw !== 'object' || raw === null || typeof (raw as { id?: unknown }).id !== 'number') {
    throw contractError('预设详情接口返回格式异常', raw);
  }
  return raw as AgentPresetRow;
}

/** Deterministic code-unit order — same input ⇒ same output in any runtime. */
function compareTags(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * GET /api/memory/plasmids/?preset_id=<id> — bare array (D5 aggregation only).
 * Rows are DRF-serialized; tags are read leniently and only string tags are kept.
 */
export async function listAgentMemory(presetId: number): Promise<AgentMemorySummary> {
  const raw = await apiFetch('/api/memory/plasmids/', { params: { preset_id: presetId } });
  if (!Array.isArray(raw)) throw contractError('记忆列表接口返回格式异常', raw);
  const tags = new Set<string>();
  for (const row of raw) {
    const rowTags = (row as { tags?: unknown } | null)?.tags;
    if (!Array.isArray(rowTags)) continue;
    for (const tag of rowTags) {
      if (typeof tag === 'string' && tag.trim() !== '') tags.add(tag.trim());
    }
  }
  return { count: raw.length, tags: [...tags].sort(compareTags) };
}
