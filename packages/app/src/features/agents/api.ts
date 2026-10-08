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

const ALLOWED_PATCH_FIELDS: Array<keyof UpdateAgentPresetInput> = [
  'name',
  'description',
  'default_model',
  'system_prompt',
];

export type UpdateAgentPresetInput = {
  name?: string;
  description?: string;
  default_model?: string;
  system_prompt?: string;
};

/** PATCH /api/agents/presets/<id>/ — updates preset fields such as system_prompt. */
export async function patchAgentPreset(
  id: number,
  fields: UpdateAgentPresetInput,
): Promise<AgentPresetRow> {
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
    throw contractError('预设 ID 必须为正整数', { id });
  }

  const payload: Record<string, unknown> = {};
  for (const key of ALLOWED_PATCH_FIELDS) {
    if (fields[key] !== undefined) {
      payload[key] = fields[key];
    }
  }

  const raw = await apiFetch(`/api/agents/presets/${id}/`, {
    method: 'PATCH',
    body: payload,
  });

  if (typeof raw !== 'object' || raw === null) {
    throw contractError('更新预设接口返回数据异常', raw);
  }

  const p = raw as Record<string, unknown>;
  if (
    typeof p.id !== 'number' ||
    !Number.isInteger(p.id) ||
    p.id <= 0 ||
    typeof p.name !== 'string' ||
    !p.name.trim() ||
    typeof p.agent_type !== 'string' ||
    typeof p.is_visible !== 'boolean' ||
    (p.description !== null && p.description !== undefined && typeof p.description !== 'string') ||
    (p.default_model !== null && p.default_model !== undefined && typeof p.default_model !== 'string') ||
    (p.system_prompt !== null && p.system_prompt !== undefined && typeof p.system_prompt !== 'string')
  ) {
    throw contractError('更新预设接口返回数据异常', raw);
  }

  return {
    id: p.id,
    name: p.name,
    description: typeof p.description === 'string' ? p.description : null,
    agent_type: p.agent_type,
    default_model: typeof p.default_model === 'string' ? p.default_model : null,
    system_prompt: typeof p.system_prompt === 'string' ? p.system_prompt : null,
    is_visible: p.is_visible,
  };
}
