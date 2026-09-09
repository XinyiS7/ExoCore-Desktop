import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuraStage } from '../features/chat/aura/AuraStage';

describe('P1D Aura stage (Plan Task 4 / D3, §6.7)', () => {
  it('renders exactly three decorative layers with inline palette colors', () => {
    const { container } = render(<AuraStage paletteId="deep-ocean" theme="dark" />);
    expect(container.querySelectorAll('.v4-aura-layer')).toHaveLength(3);
    const root = container.querySelector('.v4-aura') as HTMLElement;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    // Decorative: never captures input.
    expect(root.style.pointerEvents).toBe('none');
    expect(root.style.getPropertyValue('--aura-shadow')).toBe('#000a14');
    expect(root.style.getPropertyValue('--aura-mid')).toBe('#084d80');
    expect(root.style.getPropertyValue('--aura-highlight')).toBe('#7cc8f4');
  });

  it('activates the generating projection only when generating', () => {
    const { container, rerender } = render(<AuraStage paletteId={null} theme="dark" generating={false} />);
    expect(container.querySelector('.v4-aura')?.classList.contains('v4-aura--active')).toBe(false);
    rerender(<AuraStage paletteId={null} theme="dark" generating />);
    expect(container.querySelector('.v4-aura')?.classList.contains('v4-aura--active')).toBe(true);
  });

  it('falls back to the theme default palette for unknown ids', () => {
    render(<AuraStage paletteId="does-not-exist" theme="light" />);
    // Morning-mist (light default) shadow color.
    expect(screen.getByTestId('v4-aura').style.getPropertyValue('--aura-shadow')).toBe('#fef9f0');
  });
});