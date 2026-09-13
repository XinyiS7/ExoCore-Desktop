import { apiFetch } from 'exo-shared/api';
import { AppApiError, contractError, toAppApiError } from '../chat/api';
import type { AgentPresetRow } from '../chat/types';
import type {
  TelemetryDayUsage,
  TelemetryModelUsage,
  TelemetryUsageResponse,
  UpdateUserPresetInput,
  UsageMode,
} from './types';

const ALLOWED_PATCH_FIELDS: Array<keyof UpdateUserPresetInput> = [
  'name',
  'description',
  'default_model',
  'system_prompt',
];

function isNonNegativeInteger(val: unknown): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val >= 0;
}

/**
 * PATCH /api/agents/presets/<id>/ (Plan §3 D4).
 * Strictly allowlists writable fields; never submits id, agent_type, or is_visible.
 * Validates full AgentPresetRow serializer contract on 2xx responses.
 */
export async function patchUserPreset(
  id: number,
  fields: UpdateUserPresetInput,
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

  try {
    const raw = await apiFetch(`/api/agents/presets/${id}/`, {
      method: 'PATCH',
      body: payload,
    });

    if (typeof raw !== 'object' || raw === null) {
      throw new AppApiError('更新预设接口返回数据异常', {
        body: raw,
        code: 'CONTRACT',
        status: 200,
        ambiguousWrite: true,
      });
    }

    const p = raw as Record<string, unknown>;
    if (
      typeof p.id !== 'number' ||
      !Number.isInteger(p.id) ||
      p.id <= 0 ||
      typeof p.name !== 'string' ||
      !p.name.trim() ||
      p.agent_type !== 'user' ||
      typeof p.is_visible !== 'boolean' ||
      (p.description !== null && p.description !== undefined && typeof p.description !== 'string') ||
      (p.default_model !== null && p.default_model !== undefined && typeof p.default_model !== 'string') ||
      (p.system_prompt !== null && p.system_prompt !== undefined && typeof p.system_prompt !== 'string')
    ) {
      throw new AppApiError('更新预设接口返回数据异常', {
        body: raw,
        code: 'CONTRACT',
        status: 200,
        ambiguousWrite: true,
      });
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
  } catch (err) {
    throw toAppApiError(err);
  }
}

/**
 * GET /api/telemetry/usage/?mode=<mode>&from=<from> (Plan §3 D6).
 * Enforces envelope and row integrity guards; rejects missing or invalid metrics.
 */
export async function fetchDailyUsage(
  mode: UsageMode,
  from: string,
): Promise<TelemetryUsageResponse> {
  try {
    const raw = await apiFetch('/api/telemetry/usage/', {
      params: { mode, from },
    });

    if (
      typeof raw !== 'object' ||
      raw === null ||
      !Array.isArray((raw as Record<string, unknown>).daily) ||
      typeof (raw as Record<string, unknown>).from !== 'string' ||
      typeof (raw as Record<string, unknown>).to !== 'string' ||
      typeof (raw as Record<string, unknown>).is_current !== 'boolean'
    ) {
      throw contractError('用量统计接口返回格式异常', raw);
    }

    const envelope = raw as Record<string, unknown>;
    const dailyRows: TelemetryDayUsage[] = [];

    for (const item of envelope.daily as unknown[]) {
      if (
        typeof item !== 'object' ||
        item === null ||
        typeof (item as Record<string, unknown>).date !== 'string' ||
        !Array.isArray((item as Record<string, unknown>).models)
      ) {
        throw contractError('用量统计接口包含异常每日数据', raw);
      }

      const dayObj = item as Record<string, unknown>;
      const modelRows: TelemetryModelUsage[] = [];

      for (const m of dayObj.models as unknown[]) {
        if (typeof m !== 'object' || m === null) {
          throw contractError('用量统计接口包含异常模型行', raw);
        }

        const modelObj = m as Record<string, unknown>;
        if (
          typeof modelObj.model !== 'string' ||
          !modelObj.model.trim() ||
          !isNonNegativeInteger(modelObj.input_tokens) ||
          !isNonNegativeInteger(modelObj.output_tokens) ||
          !isNonNegativeInteger(modelObj.cached_tokens) ||
          !isNonNegativeInteger(modelObj.conversation_count)
        ) {
          throw contractError('用量统计接口包含异常模型行', raw);
        }

        modelRows.push({
          model: modelObj.model,
          input_tokens: modelObj.input_tokens,
          output_tokens: modelObj.output_tokens,
          cached_tokens: modelObj.cached_tokens,
          conversation_count: modelObj.conversation_count,
        });
      }

      dailyRows.push({
        date: dayObj.date as string,
        models: modelRows,
      });
    }

    return {
      daily: dailyRows,
      from: envelope.from as string,
      to: envelope.to as string,
      is_current: envelope.is_current as boolean,
    };
  } catch (err) {
    throw toAppApiError(err);
  }
}
