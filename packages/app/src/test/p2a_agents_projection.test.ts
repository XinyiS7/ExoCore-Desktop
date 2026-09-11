import { afterEach, describe, expect, it } from 'vitest';
import type { AgentPresetRow, ConversationSummary } from '../features/chat/types';
import { getAgentPreset, listAgentMemory } from '../features/agents/api';
import {
  applyConversationFilter,
  deriveProjectOptions,
  orderVisiblePresets,
  projectLabel,
  resolveConversationFilter,
} from '../features/agents/projection';
import { installFetch, jsonResponse, unmockFetch } from './helpers';

function preset(id: number, agentType = 'standard'): AgentPresetRow {
  return {
    id,
    name: `Preset ${id}`,
    description: null,
    agent_type: agentType,
    default_model: null,
    system_prompt: null,
    is_visible: true,
  };
}

function conv(id: number, over: Partial<ConversationSummary> = {}): ConversationSummary {
  return {
    id,
    name: `Conversation ${id}`,
    createdAt: '2026-09-01T00:00:00Z',
    projectId: null,
    projectName: null,
    agentType: 'standard',
    agentPresetId: 5,
    lastMessageAt: null,
    thinkingLevel: 'auto',
    memoryInjectionEnabled: null,
    ...over,
  };
}

afterEach(() => unmockFetch());

describe('orderVisiblePresets (D3)', () => {
  it('sorts g045 first, then ascending numeric id for all ties', () => {
    const rows = [preset(2), preset(5), preset(1, 'g045'), preset(9, 'future-x'), preset(3, 'g045')];
    expect(orderVisiblePresets(rows).map((row) => row.id)).toEqual([1, 3, 2, 5, 9]);
  });

  it('never mutates the source array', () => {
    const rows = [preset(2), preset(1, 'g045')];
    const before = [...rows];
    orderVisiblePresets(rows);
    expect(rows.map((row) => row.id)).toEqual(before.map((row) => row.id));
  });

  it('keeps unknown non-g045 types visible and sorted by id', () => {
    const rows = [preset(8, 'quantum'), preset(4, 'g045')];
    expect(orderVisiblePresets(rows).map((row) => row.id)).toEqual([4, 8]);
  });
});

describe('deriveProjectOptions (D6)', () => {
  it('deduplicates by projectId and keeps the first backend row label', () => {
    const rows = [
      conv(1, { projectId: 7, projectName: 'Alpha' }),
      conv(2, { projectId: 7, projectName: 'Renamed' }),
      conv(3, { projectId: 9, projectName: 'Beta' }),
    ];
    expect(deriveProjectOptions(rows)).toEqual([
      { id: 7, label: 'Alpha' },
      { id: 9, label: 'Beta' },
    ]);
  });

  it('excludes Drift rows and falls back to Project #<id> when unnamed', () => {
    const rows = [
      conv(1, { projectId: null, projectName: null }),
      conv(2, { projectId: 0 }),
      conv(3, { projectId: 7, projectName: null }),
      conv(4, { projectId: 7, projectName: '  ' }),
    ];
    expect(deriveProjectOptions(rows)).toEqual([{ id: 7, label: 'Project #7' }]);
  });

  it('keeps duplicate names with different ids distinct', () => {
    const rows = [
      conv(1, { projectId: 3, projectName: 'Shared' }),
      conv(2, { projectId: 4, projectName: 'Shared' }),
    ];
    expect(deriveProjectOptions(rows)).toEqual([
      { id: 3, label: 'Shared' },
      { id: 4, label: 'Shared' },
    ]);
  });
});

describe('applyConversationFilter', () => {
  const rows = [
    conv(1, { projectId: null }),
    conv(2, { projectId: 7 }),
    conv(3, { projectId: null }),
    conv(4, { projectId: 9 }),
  ];

  it('All returns a copy of the full agent lens in backend order', () => {
    const out = applyConversationFilter(rows, 'all');
    expect(out.map((row) => row.id)).toEqual([1, 2, 3, 4]);
    expect(out).not.toBe(rows);
  });

  it('Drift narrows to projectId null without reordering', () => {
    expect(applyConversationFilter(rows, 'drift').map((row) => row.id)).toEqual([1, 3]);
  });

  it('Project narrows to the exact positive id', () => {
    expect(applyConversationFilter(rows, 7).map((row) => row.id)).toEqual([2]);
  });

  it('never mutates the input array', () => {
    const snapshot = rows.map((row) => row.id);
    applyConversationFilter(rows, 'drift');
    applyConversationFilter(rows, 7);
    expect(rows.map((row) => row.id)).toEqual(snapshot);
  });
});

describe('resolveConversationFilter (§6.2 fallback)', () => {
  const ids = new Set([7, 9]);
  it('keeps all/drift/project filters that still exist', () => {
    expect(resolveConversationFilter('all', ids)).toBe('all');
    expect(resolveConversationFilter('drift', ids)).toBe('drift');
    expect(resolveConversationFilter(7, ids)).toBe(7);
  });
  it('falls back to All when the selected project disappeared', () => {
    expect(resolveConversationFilter(11, ids)).toBe('all');
  });
});

describe('projectLabel (D6 row/option identity rule)', () => {
  it('derives Drift from null Project identity, never from the display name', () => {
    expect(projectLabel(conv(1, { projectId: null, projectName: 'Misleading' }))).toBe('Drift');
  });

  it('keeps valid names and falls back to Project #<id> for null/blank names', () => {
    expect(projectLabel(conv(1, { projectId: 7, projectName: 'Alpha' }))).toBe('Alpha');
    expect(projectLabel(conv(2, { projectId: 7, projectName: null }))).toBe('Project #7');
    expect(projectLabel(conv(3, { projectId: 7, projectName: '   ' }))).toBe('Project #7');
  });
});

describe('agents/api adapters (guarded top-level shapes)', () => {
  it('getAgentPreset accepts a top-level object with numeric id', async () => {
    installFetch([{ test: '/api/agents/presets/5/', handler: () => jsonResponse(preset(5)) }]);
    await expect(getAgentPreset(5)).resolves.toMatchObject({ id: 5 });
  });

  it('getAgentPreset rejects non-object and missing numeric id as CONTRACT', async () => {
    installFetch([
      { test: '/api/agents/presets/1/', handler: () => jsonResponse([preset(1)]) },
      { test: '/api/agents/presets/2/', handler: () => jsonResponse({ name: 'no id' }) },
    ]);
    await expect(getAgentPreset(1)).rejects.toMatchObject({ code: 'CONTRACT' });
    await expect(getAgentPreset(2)).rejects.toMatchObject({ code: 'CONTRACT' });
  });

  it('listAgentMemory aggregates count and trimmed/deduplicated/sorted tags', async () => {
    installFetch([
      {
        test: '/api/memory/plasmids/',
        handler: () =>
          jsonResponse([
            { id: 1, tags: ['b', 'a ', 'b'] },
            { id: 2, tags: ['', 'c', 7] },
            { id: 3 },
          ]),
      },
    ]);
    await expect(listAgentMemory(5)).resolves.toEqual({ count: 3, tags: ['a', 'b', 'c'] });
  });

  it('listAgentMemory sends the exact preset_id param', async () => {
    const { calls } = installFetch([
      { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
    ]);
    await listAgentMemory(12);
    expect(calls).toHaveLength(1);
    expect(calls[0].url.searchParams.get('preset_id')).toBe('12');
  });

  it('listAgentMemory rejects a non-array top-level as CONTRACT', async () => {
    installFetch([
      { test: '/api/memory/plasmids/', handler: () => jsonResponse({ count: 0 }) },
    ]);
    await expect(listAgentMemory(5)).rejects.toMatchObject({ code: 'CONTRACT' });
  });
});
