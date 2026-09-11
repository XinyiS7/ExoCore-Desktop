import { describe, expect, it } from 'vitest';
import type { ConversationSummary } from '../features/chat/types';
import {
  agentLabel,
  applyAgentFilter,
  deriveAgentOptions,
  fileAvailabilityNote,
  fileSourceLabel,
  formatFileSize,
  isSyncedFileId,
  keywordsEqual,
  knowledgeAbstractLabel,
  knowledgeSourceLabel,
  resolveAgentFilter,
  rowsForProject,
} from '../features/projects/projection';

/** Minimal normalized row helper (ConversationSummary domain shape). */
function row(
  id: number,
  opts: { projectId?: number | null; agentPresetId?: number | null } = {},
): ConversationSummary {
  return {
    id,
    name: `row-${id}`,
    agentPresetId: opts.agentPresetId ?? null,
    projectId: opts.projectId ?? null,
    projectName: opts.projectId === null ? null : `Project ${opts.projectId}`,
    createdAt: '2026-01-01T00:00:00Z',
    lastMessageAt: null,
    agentType: 'standard',
    thinkingLevel: null,
    memoryInjectionEnabled: null,
  };
}

const names = new Map<number, string>([
  [5, 'Ecki'],
  [6, 'Solaire'],
]);

describe('P2B Project lens projections (Plan §5.5 / D4 / §8.4)', () => {
  it('rowsForProject selects only rows whose projectId exactly equals the current Project', () => {
    const rows = [
      row(1, { projectId: 7 }),
      row(2, { projectId: 8 }),
      row(3, { projectId: null }),
      row(4, { projectId: 7 }),
    ];
    expect(rowsForProject(rows, 7).map((r) => r.id)).toEqual([1, 4]);
    // Drift and other Projects never leak in.
    expect(rowsForProject(rows, 8).map((r) => r.id)).toEqual([2]);
    expect(rowsForProject(rows, 7)).toHaveLength(2);
    // Backend order preserved: only narrowing, never reordering.
    expect(rowsForProject(rows, 7).map((r) => r.id)).toEqual([1, 4]);
  });

  it('agentLabel resolves preset names, Agent #<id> fallback and unavailable identity', () => {
    expect(agentLabel(row(1, { agentPresetId: 5 }), names)).toBe('Ecki');
    expect(agentLabel(row(2, { agentPresetId: 42 }), names)).toBe('Agent #42');
    expect(agentLabel(row(3, { agentPresetId: 0 }), names)).toBe('未知 Agent');
    expect(agentLabel(row(4, { agentPresetId: null }), names)).toBe('未知 Agent');
  });

  it('deriveAgentOptions dedupes by positive preset id in backend order with truthful fallbacks', () => {
    const rows = [
      row(1, { agentPresetId: 5 }),
      row(2, { agentPresetId: 42 }),
      row(3, { agentPresetId: 5 }),
      row(4, { agentPresetId: null }),
      row(5, { agentPresetId: 0 }),
    ];
    expect(deriveAgentOptions(rows, names)).toEqual([
      { id: 5, label: 'Ecki' },
      { id: 42, label: 'Agent #42' },
    ]);
    // empty dataset → no options; unknown preset names fall back truthfully
    expect(deriveAgentOptions([], names)).toEqual([]);
  });

  it('applyAgentFilter narrows without reordering; null/invalid rows appear only under All', () => {
    const rows = [
      row(1, { agentPresetId: 5 }),
      row(2, { agentPresetId: null }),
      row(3, { agentPresetId: 5 }),
      row(4, { agentPresetId: 6 }),
    ];
    expect(applyAgentFilter(rows, 'all').map((r) => r.id)).toEqual([1, 2, 3, 4]);
    expect(applyAgentFilter(rows, 5).map((r) => r.id)).toEqual([1, 3]);
    expect(applyAgentFilter(rows, 6).map((r) => r.id)).toEqual([4]);
    // Null/unknown identity is not a selectable fake option and never matches.
    expect(applyAgentFilter(rows, 6).map((r) => r.id)).not.toContain(2);
  });

  it('resolveAgentFilter falls back to All for a stale numeric selection, never for valid states', () => {
    expect(resolveAgentFilter('all', new Set([5]))).toBe('all');
    expect(resolveAgentFilter(5, new Set([5, 6]))).toBe(5);
    expect(resolveAgentFilter(5, new Set([6]))).toBe('all'); // removed by replacement
    expect(resolveAgentFilter(42, new Set())).toBe('all');
  });
});

describe('P2B Files/Knowledge projections (Plan §6.3/§6.4, D3/D6)', () => {
  it('fileSourceLabel maps known CONSISTENT source+id pairs; anything inconsistent or unknown is neutral (D3)', () => {
    expect(fileSourceLabel('web_upload', 11)).toBe('Web 上传');
    expect(fileSourceLabel('obsidian_sync', 'kf_42')).toBe('Obsidian 同步');
    expect(fileSourceLabel('web_upload', 'kf_9')).toBe('引用文件'); // ID-inconsistent
    expect(fileSourceLabel('obsidian_sync', 12)).toBe('引用文件'); // ID-inconsistent
    expect(fileSourceLabel('future_label_v9', 12)).toBe('引用文件');
    expect(fileSourceLabel(null, 12)).toBe('引用文件');
    expect(fileSourceLabel(undefined, 'kf_1')).toBe('引用文件');
    expect(fileSourceLabel('', 12)).toBe('引用文件');
  });

  it('isSyncedFileId + fileAvailabilityNote: kf_ rows are references without a physical browser file (D6)', () => {
    expect(isSyncedFileId('kf_42')).toBe(true);
    expect(isSyncedFileId(11)).toBe(false);
    expect(isSyncedFileId('11')).toBe(true); // string form is always a sync reference
    expect(fileAvailabilityNote('kf_42', 'http://x')).toBe('Obsidian 同步引用，无本地浏览器文件');
    expect(fileAvailabilityNote(11, null)).toBe('无可用文件地址');
    expect(fileAvailabilityNote(11, 'http://x')).toBeNull();
  });

  it('formatFileSize is honest for zero/unknown sizes', () => {
    expect(formatFileSize(0)).toBe('');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });

  it('keywordsEqual is structural: any delimiter-bearing/duplicate/empty entry is data (B02/R4)', () => {
    expect(keywordsEqual(['plain'], ['plain'])).toBe(true);
    expect(keywordsEqual([], [])).toBe(true);
    // comma/space/semicolon-bearing entries are ATOMIC values
    expect(keywordsEqual(['one,two'], ['one,two'])).toBe(true);
    expect(keywordsEqual(['project plan', 'alpha;beta'], ['project plan', 'alpha;beta'])).toBe(true);
    // order is data; duplicates are data
    expect(keywordsEqual(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(keywordsEqual(['alpha', 'alpha'], ['alpha'])).toBe(false);
    expect(keywordsEqual(['alpha'], ['alpha', 'alpha'])).toBe(false);
    // empty entries are representable
    expect(keywordsEqual([''], [''])).toBe(true);
    expect(keywordsEqual(['a', ''], ['a'])).toBe(false);
    // any difference is a real edit
    expect(keywordsEqual(['project plan'], ['project', 'plan'])).toBe(false);
    expect(keywordsEqual(['one,two'], ['one', 'two'])).toBe(false);
    expect(keywordsEqual(['a'], ['a '])).toBe(false);
  });

  it('knowledgeSourceLabel maps known source types; unknown → neutral 知识片段', () => {
    expect(knowledgeSourceLabel('obsidian_md')).toBe('Obsidian');
    expect(knowledgeSourceLabel('web_upload')).toBe('文件上传');
    expect(knowledgeSourceLabel('chat')).toBe('对话记忆');
    expect(knowledgeSourceLabel('mystery_source')).toBe('知识片段');
    expect(knowledgeSourceLabel(null)).toBe('知识片段');
  });

  it('knowledgeAbstractLabel labels null/empty honestly (F04-style)', () => {
    expect(knowledgeAbstractLabel('正文')).toBe('正文');
    expect(knowledgeAbstractLabel(null)).toBe('（无摘要）');
    expect(knowledgeAbstractLabel('')).toBe('（无摘要）');
  });
});