import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';
import { TacticalHud } from '../features/chat/hud/TacticalHud';
import { HudStateStrip } from '../features/chat/hud/HudStateStrip';
import type { ModelCatalog } from 'exo-shared/models';
import { installFetch, jsonResponse, unmockFetch } from './helpers';
import type { UseAuraResult } from '../features/chat/aura/useAura';

const catalog: ModelCatalog = {
  models: [
    { name: 'gemini-2.5-flash', family: 'gemini', abilities: ['audio'], compatible_endpoint_ids: [2] },
    { name: 'deepseek-v4-flash', family: 'deepseek', abilities: [], compatible_endpoint_ids: [1] },
  ],
  endpoints: [
    { id: 1, name: 'deepseek-api', provider: 'deepseek', execution_type: 'cloud', execution_adapter: 'http', payload_format: 'chat', cache_transport: '', attachment_transports: [], configured: true, enabled: true },
    { id: 2, name: 'gemini-antigravity', provider: 'gemini', execution_type: 'cloud', execution_adapter: 'http', payload_format: 'chat', cache_transport: 'context_cache', attachment_transports: ['file_uri'], configured: true, enabled: true },
  ],
  roles: {
    main: [{ model: 'gemini-2.5-flash', default_endpoint: 2 }],
    support: {
      general_sub_agent: { model: 'gemini-2.5-flash', default_endpoint: 2 },
      vision_helper: { model: 'gemini-2.5-flash', default_endpoint: 2 },
      grounding: { model: 'gemini-2.5-flash', default_endpoint: 2 },
      image_gen: { model: 'gemini-2.5-flash', default_endpoint: 2 },
    },
  },
  providers: [
    { id: 'gemini', display_name: 'Gemini', execution_type: 'cloud' },
    { id: 'deepseek', display_name: 'DeepSeek', execution_type: 'cloud' },
  ],
};

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const aura: UseAuraResult = {
  selectedId: null,
  palettes: [{
    id: 'burning-sunset', label: 'Burning Sunset', theme: 'dark', builtin: true,
    keypoints: { keyShadow: '#0a0200', keyMid: '#941b0c', keyHighlight: '#f8bf74' },
  }],
  customCount: 0,
  atCapacity: false,
  select: vi.fn(),
  saveNew: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
};

const baseProps = {
  aura,
  runtimeUncertain: false,
  target: { model: 'gemini-2.5-flash', endpoint: 2 },
  onTargetChange: vi.fn(),
  transport: 'sse' as const,
  onTransportChange: vi.fn(),
  thinkingLevel: 'auto',
  isG045: true,
};

describe('P1D Tactical HUD (Plan Task 3 / D2, §8.6)', () => {
  afterEach(() => unmockFetch());

  function installDefaults(overrides: { open?: boolean } = {}) {
    installFetch([
      { test: '/api/core/model-catalog/', handler: () => jsonResponse(catalog) },
    ]);
    return { open: overrides.open ?? true };
  }

  it('shows only the model name and keeps the full target in the tooltip (#72 U1)', () => {
    const onOpen = vi.fn();
    render(
      <HudStateStrip
        model="deepseek-v4-flash"
        endpointLabel="deepseek-api"
        thinkingLabel="auto"
        transport="sse"
        cacheSummary=""
        cacheDetail="无缓存"
        cacheReleaseEligible={false}
        cacheReleaseDisabled={false}
        cacheReleasing={false}
        onReleaseCache={vi.fn()}
        onOpen={onOpen}
      />,
    );
    const target = screen.getByTitle('执行目标：deepseek-v4-flash · deepseek-api');
    expect(target).toHaveTextContent(/^deepseek-v4-flash$/);
    fireEvent.click(screen.getByRole('button', { name: 'more' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('shows thinking as a bare level and cache as remaining seconds beside release (#72)', () => {
    const { rerender } = render(
      <HudStateStrip
        model="gemini-3.8-flash"
        endpointLabel="gemini"
        thinkingLabel="medium"
        transport="sse"
        cacheSummary="120s"
        cacheDetail="远端缓存剩余 120s"
        cacheReleaseEligible
        cacheReleaseDisabled={false}
        cacheReleasing={false}
        onReleaseCache={vi.fn()}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByTitle('思考级别：medium')).toHaveTextContent(/^medium$/);
    const cache = screen.getByTitle('远端缓存剩余 120s');
    expect(cache).toHaveTextContent(/^120s−$/);
    expect(within(cache).getByRole('button', { name: '释放上下文缓存' })).toBeTruthy();

    // Nothing to show and nothing to release: the cache slot disappears.
    rerender(
      <HudStateStrip
        model="gemini-3.8-flash"
        endpointLabel="gemini"
        thinkingLabel="medium"
        transport="sse"
        cacheSummary=""
        cacheDetail="无缓存"
        cacheReleaseEligible={false}
        cacheReleaseDisabled={false}
        cacheReleasing={false}
        onReleaseCache={vi.fn()}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.queryByTitle('无缓存')).toBeNull();
  });

  it('exposes the same cache release command only when eligible and unlocked', () => {
    const release = vi.fn();
    const stripProps = {
      model: 'deepseek-v4-flash',
      endpointLabel: 'deepseek-api',
      thinkingLabel: 'auto',
      transport: 'sse' as const,
      cacheSummary: '',
      cacheDetail: '无缓存',
      cacheReleasing: false,
      onOpen: vi.fn(),
      onReleaseCache: release,
    };
    const { rerender } = render(
      <HudStateStrip
        {...stripProps}
        cacheReleaseEligible={false}
        cacheReleaseDisabled={false}
      />,
    );
    expect(screen.queryByRole('button', { name: '释放上下文缓存' })).toBeNull();

    rerender(
      <HudStateStrip
        {...stripProps}
        cacheSummary="30s"
        cacheReleaseEligible
        cacheReleaseDisabled
      />,
    );
    const locked = screen.getByRole('button', { name: '释放上下文缓存' });
    expect(locked).toBeDisabled();
    fireEvent.click(locked);
    expect(release).not.toHaveBeenCalled();

    rerender(
      <HudStateStrip
        {...stripProps}
        cacheSummary="快照"
        cacheReleaseEligible
        cacheReleaseDisabled={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '释放上下文缓存' }));
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('exposes direct cache release only when eligible and preserves its lock', () => {
    const onReleaseCache = vi.fn();
    const props = {
      model: 'deepseek-v4-flash',
      endpointLabel: 'deepseek-api',
      thinkingLabel: 'auto',
      transport: 'sse' as const,
      cacheSummary: '120s',
      cacheDetail: '远端缓存剩余 120s',
      cacheReleasing: false,
      onReleaseCache,
      onOpen: vi.fn(),
    };
    const { rerender } = render(
      <HudStateStrip {...props} cacheReleaseEligible={false} cacheReleaseDisabled={false} />,
    );
    expect(screen.queryByRole('button', { name: '释放上下文缓存' })).toBeNull();

    rerender(<HudStateStrip {...props} cacheReleaseEligible cacheReleaseDisabled />);
    const lockedRelease = screen.getByRole('button', { name: '释放上下文缓存' });
    expect(lockedRelease).toBeDisabled();
    fireEvent.click(lockedRelease);
    expect(onReleaseCache).not.toHaveBeenCalled();

    rerender(<HudStateStrip {...props} cacheReleaseEligible cacheReleaseDisabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: '释放上下文缓存' }));
    expect(onReleaseCache).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when closed', () => {
    installDefaults({ open: false });
    const { container } = wrap(<TacticalHud {...baseProps} open={false} onClose={vi.fn()} />);
    expect(container.querySelector('.v4-hud')).toBeNull();
  });

  it('moves focus into the dialog on open and closes via Escape', async () => {
    installDefaults();
    const onClose = vi.fn();
    wrap(<TacticalHud {...baseProps} open onClose={onClose} />);
    await waitFor(() => expect(screen.getByRole('dialog', { name: '战术控制面板' })).toBeTruthy());
    const dialog = screen.getByRole('dialog', { name: '战术控制面板' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('R5 consumer: callback-identity rerenders keep HUD focus contained; Escape closes; trigger restored', async () => {
    installDefaults();
    function HudHarness() {
      const [open, setOpen] = useState(false);
      const [tick, setTick] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            open hud
          </button>
          <button type="button" onClick={() => setTick((t) => t + 1)}>
            bump {tick}
          </button>
          {/* INLINE onClose: the ConversationPage consumer shape — each parent
              rerender hands the helper a NEW callback identity. */}
          <TacticalHud {...baseProps} open={open} onClose={() => setOpen(false)} />
        </>
      );
    }
    wrap(<HudHarness />);
    const trigger = screen.getByRole('button', { name: 'open hud' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: '战术控制面板' });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: /bump/ }));
    fireEvent.click(screen.getByRole('button', { name: /bump/ }));
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '战术控制面板' })).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it('closes through backdrop click and restores nothing outside', async () => {
    installDefaults();
    const onClose = vi.fn();
    const { container } = wrap(<TacticalHud {...baseProps} open onClose={onClose} />);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    fireEvent.click(container.querySelector('.v4-hud-backdrop') as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('groups controls and shows g045-only memory section', async () => {
    installDefaults();
    wrap(<TacticalHud {...baseProps} open onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('选择模型')).toBeTruthy());
    // g045 → private memory toggle present
    expect(screen.getByLabelText('启用私有记忆注入')).toBeTruthy();
    // cache + history + aura groups present
    expect(screen.getByText('上下文缓存')).toBeTruthy();
    expect(screen.getByLabelText('选择历史装配模式')).toBeTruthy();
    expect(screen.getByLabelText('选择氛围色板')).toBeTruthy();
  });

  it('hides the memory section for non-g045 agents', async () => {
    installDefaults();
    wrap(<TacticalHud {...baseProps} isG045={false} open onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('选择模型')).toBeTruthy());
    expect(screen.queryByLabelText('启用私有记忆注入')).toBeNull();
  });

  it('disables request-affecting controls during runtime uncertainty', async () => {
    installDefaults();
    wrap(<TacticalHud {...baseProps} runtimeUncertain open onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('选择模型')).toBeTruthy());
    expect((screen.getByLabelText('选择模型') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText('选择端点') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText('选择思考级别') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText('选择传输模式') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText('选择历史装配模式') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText('启用私有记忆注入') as HTMLInputElement).disabled).toBe(true);
  });

  it('shows honest wiring note when target/transport owners are absent', async () => {
    installDefaults();
    const { container } = wrap(
      <TacticalHud
        open
        onClose={vi.fn()}
        runtimeUncertain={false}
        target={null}
        transport="sse"
        thinkingLevel={null}
        isG045={false}
      />,
    );
    await waitFor(() => expect(screen.getByLabelText('选择模型')).toBeTruthy());
    expect(screen.getByText('目标选择器待运行时初始化后可用。')).toBeTruthy();
    expect(screen.getByText('传输模式由运行时提供（待接线）。')).toBeTruthy();
    expect(container.querySelector('.v4-hud-warning')).toBeNull();
  });

  it('issues exactly one model-catalog request per open', async () => {
    const { calls } = installFetch([
      { test: '/api/core/model-catalog/', handler: () => jsonResponse(catalog) },
    ]);
    wrap(<TacticalHud {...baseProps} open onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('选择模型')).toBeTruthy());
    const catalogCalls = calls.filter((c) => c.url.pathname.endsWith('/model-catalog/'));
    expect(catalogCalls.length).toBe(1);
  });
});