import type { AgentPresetRow } from '../chat/types';
import type { TelemetryDayUsage, UsageMode, UsageTotals } from './types';

export type ResolveUserProfileResult =
  | { status: 'ok'; user: AgentPresetRow }
  | { status: 'missing'; message: string }
  | { status: 'contract_error'; message: string };

/**
 * Validates whether a candidate object strictly satisfies the AgentPresetRow contract.
 */
export function isValidUserPreset(preset: unknown): preset is AgentPresetRow {
  if (typeof preset !== 'object' || preset === null) return false;
  const p = preset as Record<string, unknown>;
  if (typeof p.id !== 'number' || !Number.isInteger(p.id) || p.id <= 0) return false;
  if (typeof p.name !== 'string' || !p.name.trim()) return false;
  if (p.agent_type !== 'user') return false;
  if (typeof p.is_visible !== 'boolean') return false;
  if (p.description !== null && p.description !== undefined && typeof p.description !== 'string') return false;
  if (p.default_model !== null && p.default_model !== undefined && typeof p.default_model !== 'string') return false;
  if (p.system_prompt !== null && p.system_prompt !== undefined && typeof p.system_prompt !== 'string') return false;
  return true;
}

/**
 * Resolves the unique user preset from the canonical presets list (Plan §3 D4).
 * - 0 items -> "用户资料未配置" error;
 * - >1 items -> explicit contract error ("用户资料契约异常");
 * - 1 item with malformed structure -> explicit contract error.
 */
export function resolveUserProfile(presets: AgentPresetRow[]): ResolveUserProfileResult {
  const userPresets = presets.filter(
    (preset) => typeof preset === 'object' && preset !== null && preset.agent_type === 'user',
  );
  if (userPresets.length === 0) {
    return {
      status: 'missing',
      message: '当前可见预设列表中未找到用户资料 (agent_type="user")',
    };
  }
  if (userPresets.length > 1) {
    return {
      status: 'contract_error',
      message: '可见预设列表中存在多条用户资料记录，无法确定唯一身份',
    };
  }

  const candidate = userPresets[0];
  if (!isValidUserPreset(candidate)) {
    return {
      status: 'contract_error',
      message: '用户资料数据不符合契约要求',
    };
  }

  return { status: 'ok', user: candidate };
}

/**
 * Formats numbers with en-US thousand grouping to ensure cross-locale consistency.
 */
export function formatNumber(val: number): string {
  return Number(val).toLocaleString('en-US');
}

/**
 * Computes exact totals from strictly validated daily usage rows.
 * Preserves 0 as a real number (Plan §7.4).
 */
export function computeUsageTotals(daily: TelemetryDayUsage[]): UsageTotals {
  let totalInput = 0;
  let totalOutput = 0;
  let totalCached = 0;
  let totalConversations = 0;

  for (const day of daily) {
    for (const m of day.models) {
      totalInput += m.input_tokens;
      totalOutput += m.output_tokens;
      totalCached += m.cached_tokens;
      totalConversations += m.conversation_count;
    }
  }

  return {
    totalInput,
    totalOutput,
    totalCached,
    totalConversations,
  };
}

export function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Derives initial period anchor (Plan §3 D6):
 * - week: Monday of the current week;
 * - month: 1st of the current month.
 */
export function getInitialAnchor(mode: UsageMode, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (mode === 'week') {
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
  } else {
    d.setDate(1);
  }
  return formatLocalDate(d);
}

/**
 * Shifts period anchor forward or backward:
 * - week: +/- 7 days;
 * - month: +/- 1 calendar month.
 */
export function shiftPeriod(from: string, mode: UsageMode, direction: -1 | 1): string {
  const parts = from.split('-').map(Number);
  const y = parts[0] || new Date().getFullYear();
  const m = parts[1] || 1;
  const d = parts[2] || 1;
  const date = new Date(y, m - 1, d);

  if (mode === 'week') {
    date.setDate(date.getDate() + direction * 7);
  } else {
    date.setMonth(date.getMonth() + direction);
    // Align to 1st of the month
    date.setDate(1);
  }

  return formatLocalDate(date);
}
