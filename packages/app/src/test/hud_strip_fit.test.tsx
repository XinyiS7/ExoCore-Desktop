import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { HudStateStrip } from '../features/chat/hud/HudStateStrip';

/**
 * #72 acceptance follow-up: the strip drops to model / thinking / cache when
 * its pills cannot all show in full, and expands again once there is room.
 * jsdom has no layout, so widths and ResizeObserver are stubbed.
 */

let stripWidth = 0;
let pillShortfall = 0;
let resize: (() => void) | null = null;

function px(el: HTMLElement, kind: 'client' | 'scroll' | 'offset'): number {
  if (el.classList.contains('v4-strip')) return stripWidth;
  if (!el.classList.contains('v4-strip-item')) return 0;
  // Pills are 60px wide as laid out; their content wants 60 + shortfall.
  if (kind === 'scroll') return 58 + pillShortfall;
  return kind === 'offset' ? 60 : 58;
}

function renderStrip() {
  return render(
    <HudStateStrip
      model="gemini-3.8-flash"
      endpointLabel="gemini"
      thinkingLabel="medium"
      transport="sse"
      cacheSummary="快照"
      cacheDetail="本地快照，无远端缓存"
      cacheReleaseEligible={false}
      cacheReleaseDisabled={false}
      cacheReleasing={false}
      onReleaseCache={() => {}}
      onOpen={() => {}}
    />,
  );
}

describe('HudStateStrip fit', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return px(this, 'client');
    });
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return px(this, 'scroll');
    });
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return px(this, 'offset');
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          resize = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resize = null;
  });

  it('keeps every pill when they all fit', () => {
    stripWidth = 400;
    pillShortfall = 0;
    renderStrip();
    expect(screen.getByRole('group', { name: '会话状态摘要' })).not.toHaveClass('v4-strip--compact');
  });

  it('drops to three pills when any would ellipsize, and restores them once there is room', () => {
    stripWidth = 260;
    pillShortfall = 10; // 4 pills × 10px short → needs 300px
    renderStrip();
    const strip = screen.getByRole('group', { name: '会话状态摘要' });
    expect(strip).toHaveClass('v4-strip--compact');
    expect(strip.querySelectorAll('.v4-strip-item:not(.v4-strip-item--optional)')).toHaveLength(3);
    expect(screen.getByText('SSE')).toHaveClass('v4-strip-item--optional');

    stripWidth = 299;
    act(() => resize?.());
    expect(strip).toHaveClass('v4-strip--compact');

    stripWidth = 300;
    pillShortfall = 0;
    act(() => resize?.());
    expect(strip).not.toHaveClass('v4-strip--compact');
  });

  it('does not collapse for a pill clipped only by its own max-width', () => {
    stripWidth = 400;
    pillShortfall = 200;
    // Stands in for the stylesheet's pill max-width (CSS is not loaded in jsdom).
    const realStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
      const style = realStyle(el, pseudo);
      return (el as HTMLElement).classList.contains('v4-strip-item')
        ? Object.defineProperty(Object.create(style), 'maxWidth', { value: '60px' })
        : style;
    });
    renderStrip();
    expect(screen.getByRole('group', { name: '会话状态摘要' })).not.toHaveClass('v4-strip--compact');
  });
});
