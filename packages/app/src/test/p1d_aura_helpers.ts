/**
 * Shared Aura leaf test helpers (P1D leaf B).
 */
import { BUILTIN_PALETTES, type AuraPalette } from '../features/chat/aura/palettes';

export function getBuiltin(): AuraPalette[] {
  return BUILTIN_PALETTES;
}

export function customPalette(id: string, label: string): AuraPalette {
  return {
    id,
    label,
    theme: 'dark',
    builtin: false,
    keypoints: { keyShadow: '#000000', keyMid: '#333333', keyHighlight: '#666666' },
  };
}