import type { AgentPresetRow, ConversationSummary } from '../chat/types';

/**
 * Pure Agent projections (Plan §6.2/§6.5). All helpers are read-only: they
 * never mutate their inputs, never reorder the Conversation collection, and
 * never issue requests.
 */

/** D3: g045 first, then ascending numeric id for all ties. Unknown future
 *  non-g045 types stay visible and sort by id — no local order is read/written. */
export function orderVisiblePresets(presets: readonly AgentPresetRow[]): AgentPresetRow[] {
  return [...presets].sort((a, b) => {
    const rankA = a.agent_type === 'g045' ? 0 : 1;
    const rankB = b.agent_type === 'g045' ? 0 : 1;
    return rankA - rankB || a.id - b.id;
  });
}

export type ConversationFilter = 'all' | 'drift' | number;

export interface ProjectOption {
  id: number;
  label: string;
}

/**
 * One truthful Project/Drift label rule shared by filter options and row chips
 * (D6 / §6.5): Drift is decided by normalized null Project identity, never by
 * display name; a positive Project id with an unavailable name keeps the
 * frozen `Project #<id>` fallback.
 */
export function projectLabel(
  row: Pick<ConversationSummary, 'projectId' | 'projectName'>,
): string {
  if (row.projectId === null || row.projectId === undefined) return 'Drift';
  if (typeof row.projectName === 'string' && row.projectName.trim() !== '') return row.projectName;
  return `Project #${row.projectId}`;
}

/**
 * Project filter options derived from the current Agent rows: deduplicated by
 * positive `projectId`, first backend occurrence supplies the label. Drift
 * (null projectId) is never a fabricated option.
 */
export function deriveProjectOptions(agentRows: readonly ConversationSummary[]): ProjectOption[] {
  const seen = new Map<number, ProjectOption>();
  for (const row of agentRows) {
    if (row.projectId === null || row.projectId === undefined || row.projectId <= 0) continue;
    if (seen.has(row.projectId)) continue;
    seen.set(row.projectId, { id: row.projectId, label: projectLabel(row) });
  }
  return [...seen.values()];
}

/** Backend order is authoritative: filtering only narrows, never reorders. */
export function applyConversationFilter(
  agentRows: readonly ConversationSummary[],
  filter: ConversationFilter,
): ConversationSummary[] {
  if (filter === 'all') return [...agentRows];
  if (filter === 'drift') return agentRows.filter((row) => row.projectId === null);
  return agentRows.filter((row) => row.projectId === filter);
}

/**
 * §6.2 render-time guard: if a dataset update removed the selected Project
 * before the Profile's state reconciliation effect runs, this projection keeps
 * the rendered selection honest. The page owns the permanent state fallback.
 */
export function resolveConversationFilter(
  filter: ConversationFilter,
  projectIds: ReadonlySet<number>,
): ConversationFilter {
  if (filter !== 'all' && filter !== 'drift' && !projectIds.has(filter)) return 'all';
  return filter;
}
