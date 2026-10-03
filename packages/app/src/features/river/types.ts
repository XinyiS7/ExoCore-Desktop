export const RIVER_SOURCES = ['memo', 'heartbeat', 'diary', 'task', 'chronicle'] as const;
export type RiverSource = typeof RIVER_SOURCES[number];
export const SOURCE_LABELS: Record<RiverSource, string> = {
  memo: 'Memo', heartbeat: 'Heartbeat', diary: 'Diary', task: 'Task', chronicle: '历史纪事',
};
interface RiverBase {
  source_id: string;
  occurred_at: string;
  time_precision: 'day' | 'instant';
  preset_id: number | null;
  preview: string;
  capabilities: string[];
}
export type RiverItem = RiverBase & (
  | { source_type: 'memo'; target: { type: 'memo'; memo_id: number }; source_specific: { author: string; tags: string[]; reply_count: number } }
  | { source_type: 'heartbeat'; target: { type: 'heartbeat'; session_uuid: string }; source_specific: { launch_source: string; domain: string; status: string } }
  | { source_type: 'diary'; target: { type: 'diary'; preset_id: number; day: string }; source_specific: { day: string } }
  | { source_type: 'task'; target: { type: 'task'; entry_id: number }; source_specific: { event_kind: 'created' | 'completed'; title: string; entry_type: string; status: string; is_pinned: boolean; start_date: string; due_date: string | null; cycle_start: string | null; cycle_due: string | null; completion_id?: number; completion_note?: string; completion_cycle_start?: string | null } }
  | { source_type: 'chronicle'; target: { type: 'chronicle'; id: number }; source_specific: { event_time: string; kind: 'milestone' | 'moment'; scope: string | null; keywords: string[] } }
);
export interface RiverPageData { items: RiverItem[]; next_cursor: string | null }
export interface RiverFilters { sources?: readonly RiverSource[]; presetId?: number; limit?: number }
/** CP1 read projection of the full ScheduleEntry serializer; no second task state. */
export interface OpenTask {
  id: number; title: string; description: string;
  entry_type: 'todo' | 'periodic' | 'goal'; status: 'active' | 'escalated';
  is_pinned: boolean; start_date: string; tags: string[];
  due_date: string | null; cycle_due: string | null; next_periodic_due: string | null;
}
export type ReadingItem = Extract<RiverItem, { source_type: 'diary' | 'heartbeat' }>;
