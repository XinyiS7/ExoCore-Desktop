import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BUILTIN_PALETTES,
  computeStops,
  deleteCustomPalette,
  MAX_CUSTOM_PALETTES,
  paletteStopsFor,
  readCustomPalettes,
  resolvePalette,
  saveCustomPalette,
  themeDefaultPaletteId,
  updateCustomPalette,
} from '../features/chat/aura/palettes';

const VALID_STORAGE = [
  {
    id: 'custom-1',
    label: '我的色板',
    theme: 'dark',
    builtin: false,
    keypoints: { keyShadow: '#000000', keyMid: '#123456', keyHighlight: '#abcdef' },
  },
];

describe('P1D aura palette engine (Plan Task 4 / D3, §6.7)', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it('computes the 8 V3-faithful stops from 3 keypoints (burning-sunset)', () => {
    const stops = computeStops('#0a0200', '#941b0c', '#f8bf74');
    expect(stops).not.toBeNull();
    expect(stops!['--obsidian']).toBe('#0a0200');
    expect(stops!['--oxblood-500']).toBe('#941b0c');
    expect(stops!['--orange-500']).toBe('#f8bf74');
    // Interior stops are interpolated OKLCH values — endpoints are exact.
    expect(stops!['--garnet-600']).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('returns null for invalid keypoint colors', () => {
    expect(computeStops('nope', '#941b0c', '#f8bf74')).toBeNull();
  });

  it('resolves theme defaults deterministically', () => {
    expect(themeDefaultPaletteId('dark')).toBe('burning-sunset');
    expect(themeDefaultPaletteId('light')).toBe('morning-mist');
    expect(resolvePalette(null, 'dark').id).toBe('burning-sunset');
    expect(resolvePalette('unknown-id', 'light').id).toBe('morning-mist');
  });

  it('caps custom palettes at three (capacity refusal)', () => {
    for (let i = 0; i < MAX_CUSTOM_PALETTES; i += 1) {
      expect(
        saveCustomPalette(`p${i}`, { keyShadow: '#000000', keyMid: '#111111', keyHighlight: '#222222' }, 'dark'),
      ).toMatchObject({ ok: true });
    }
    const fourth = saveCustomPalette('p4', { keyShadow: '#000000', keyMid: '#111111', keyHighlight: '#222222' }, 'dark');
    expect(fourth).toEqual({ ok: false, reason: 'capacity_reached' });
  });

  it('quarantines corrupt custom storage to []', () => {
    window.localStorage.setItem('exo:v4:aura:custom-palettes', '{not json');
    expect(readCustomPalettes()).toEqual([]);
    expect(window.localStorage.getItem('exo:v4:aura:custom-palettes')).toBeNull();
  });

  it('drops structurally invalid palette rows during read', () => {
    window.localStorage.setItem(
      'exo:v4:aura:custom-palettes',
      JSON.stringify([
        VALID_STORAGE[0],
        { id: 'bad', label: 'x', theme: 'dark', builtin: false, keypoints: { keyShadow: 'red' } },
      ]),
    );
    const list = readCustomPalettes();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('custom-1');
  });

  it('saves, updates and deletes custom palettes', () => {
    const saved = saveCustomPalette('abc', { keyShadow: '#000000', keyMid: '#123456', keyHighlight: '#abcdef' }, 'dark');
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const updated = updateCustomPalette(saved.palette.id, { label: 'abc2' });
    expect(updated.ok).toBe(true);
    const selected = resolvePalette(saved.palette.id, 'dark');
    expect(selected.label).toBe('abc2');
    deleteCustomPalette(saved.palette.id);
    expect(resolvePalette(saved.palette.id, 'dark').id).toBe('burning-sunset');
  });

  it('exposes three usable layer colors for the stage', () => {
    const palette = resolvePalette('deep-ocean', 'dark');
    const stops = paletteStopsFor(palette);
    expect(stops).not.toBeNull();
    // AuraStage uses shadow/mid/highlight keys (≤3 layers).
    expect(BUILTIN_PALETTES.length).toBeGreaterThanOrEqual(6);
  });
});