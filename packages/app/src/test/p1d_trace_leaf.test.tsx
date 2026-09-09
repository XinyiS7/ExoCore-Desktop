/**
 * P1D trace presentation leaf — frozen camel DTO consumption contract
 * (Plan Task 6 / §6.5; Solaire leaf A).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AssistantRunTrace } from '../features/chat/trace/AssistantRunTrace';
import type {
  AssistantRunTraceItem,
  AssistantRunTraceProjection,
} from '../features/chat/types';

const thinkingItem = (order: number, text: string): AssistantRunTraceItem => ({
  itemId: `t-${order}`,
  order,
  kind: 'thinking',
  text,
});

const toolItem = (
  order: number,
  overrides: Partial<AssistantRunTraceToolish> = {},
): AssistantRunTraceItem => ({
  itemId: `c-${order}`,
  order,
  kind: 'tool',
  callId: `call-${order}`,
  lifecycle: 'succeeded',
  toolName: 'memory_search',
  argumentPreview: null,
  resultSummary: null,
  errorSummary: null,
  durationMs: null,
  ...overrides,
});

interface AssistantRunTraceToolish {
  lifecycle: 'started' | 'succeeded' | 'failed' | 'incomplete';
  toolName: string;
  argumentPreview?: string | null;
  resultSummary?: string | null;
  errorSummary?: string | null;
  durationMs?: number | null;
}

const available = (items: AssistantRunTraceItem[], truncated?: boolean): AssistantRunTraceProjection => ({
  version: 1,
  availability: 'available',
  items,
  ...(truncated ? { truncated: true } : {}),
});

describe('P1D AssistantRunTrace presentation leaf', () => {
  it('is collapsed by default even while streaming', () => {
    const { container } = render(
      <AssistantRunTrace
        reasoning="think"
        streaming
      />,
    );
    const details = container.querySelector('details.v4-trace') as HTMLDetailsElement;
    expect(details).not.toBeNull();
    expect(details.open).toBe(false);
  });

  it('keeps the panel open across streaming rerenders once the user opens it', () => {
    const { container, rerender } = render(
      <AssistantRunTrace reasoning="think" streaming />,
    );
    const details = container.querySelector('details.v4-trace') as HTMLDetailsElement;
    expect(details.open).toBe(false); // initially collapsed even streaming
    fireEvent.click(container.querySelector('summary.v4-trace-summary') as HTMLElement);
    expect(details.open).toBe(true);
    rerender(<AssistantRunTrace reasoning="think" streaming />);
    expect(details.open).toBe(true); // user choice survives rerenders
    fireEvent.click(container.querySelector('summary.v4-trace-summary') as HTMLElement);
    expect(details.open).toBe(false); // and closing survives too
    rerender(<AssistantRunTrace reasoning="think" />);
    expect(details.open).toBe(false);
  });

  it('renders a tool-only history projection (no thinking required)', () => {
    render(
      <AssistantRunTrace projection={available([toolItem(0)])} />,
    );
    expect(screen.getByText('memory_search')).toBeInTheDocument();
    expect(screen.getByText('完成')).toBeInTheDocument();
    expect(screen.queryByLabelText('思考过程')).toBeNull();
  });

  it('preserves server order for interleaved thinking+tool items', () => {
    render(
      <AssistantRunTrace
        projection={available([
          thinkingItem(0, 'first thought'),
          toolItem(1),
          thinkingItem(2, 'second thought'),
        ])}
        defaultOpen
      />,
    );
    const container = document.querySelector('.v4-trace') as HTMLElement;
    // Order check: thinking sections appear before/after the tool row.
    const sections = [...container.querySelectorAll('section.app-reasoning-panel, .v4-trace-tool')];
    expect(sections[0].classList.contains('app-reasoning-panel')).toBe(true);
    expect(sections[1].classList.contains('v4-trace-tool')).toBe(true);
    expect(sections[2].classList.contains('app-reasoning-panel')).toBe(true);
    // Turned-off automatic recall: no memory claim row appears.
    expect(screen.queryByText(/回忆/i)).toBeNull();
  });

  it('shows an omission notice for truncated, NOT the legacy copy', () => {
    render(
      <AssistantRunTrace projection={available([thinkingItem(0, 'a'), toolItem(1)], true)} />,
    );
    expect(screen.getByText(/部分轨迹条目因后端安全长度限制被省略/)).toBeInTheDocument();
    expect(screen.queryByText(/此历史消息没有可验证的工具顺序与详情/)).toBeNull();
  });

  it('keeps legacy reasoning readable with the no-tool-details note', () => {
    render(<AssistantRunTrace reasoning="legacy chain" legacyToolDetailsUnavailable />);
    expect(screen.getByText(/legacy chain/)).toBeInTheDocument();
    expect(screen.getByText(/此历史消息没有可验证的工具顺序与详情/)).toBeInTheDocument();
  });

  it('renders legacy_unavailable projections through the legacy path', () => {
    render(
      <AssistantRunTrace
        reasoning="old reasoning"
        projection={{ version: 1, availability: 'legacy_unavailable', reason: 'ordering_unavailable' }}
        legacyToolDetailsUnavailable
      />,
    );
    expect(screen.getByText(/old reasoning/)).toBeInTheDocument();
    expect(screen.getByText(/此历史消息没有可验证的工具顺序与详情/)).toBeInTheDocument();
    expect(screen.queryByText(/部分轨迹条目/)).toBeNull();
  });

  it('stays sparse when summaries are null (no empty rows)', () => {
    render(
      <AssistantRunTrace
        projection={available([
          toolItem(0, { argumentPreview: null, resultSummary: null, errorSummary: null }),
          toolItem(1, { resultSummary: 'found 2 entries' }),
        ])}
        defaultOpen
      />,
    );
    // No 参数/错误 labels for the null-only row; exactly one 结果 label total.
    expect(screen.queryAllByText('参数')).toHaveLength(0);
    expect(screen.queryAllByText('错误')).toHaveLength(0);
    expect(screen.getAllByText('结果')).toHaveLength(1);
  });

  it('renders incomplete lifecycle honestly (started without terminal)', () => {
    render(
      <AssistantRunTrace
        projection={available([toolItem(0, { lifecycle: 'incomplete' })])}
        defaultOpen
      />,
    );
    expect(screen.getByText('中断')).toBeInTheDocument();
  });

  it('does not scan, redact or truncate backend-supplied preview text', () => {
    const longPreview = 'x'.repeat(600);
    render(
      <AssistantRunTrace
        projection={available([
          toolItem(0, { argumentPreview: longPreview, resultSummary: 'D:/some/path value=secret' }),
        ])}
        defaultOpen
      />,
    );
    // Full backend value passes through verbatim — the frontend never
    // truncates or filters content (backend owns bounds/allowlists).
    expect(screen.getByText(longPreview)).toBeInTheDocument();
    expect(screen.getByText('D:/some/path value=secret')).toBeInTheDocument();
  });

  it('renders nothing when there is no trace, reasoning, count or legacy note', () => {
    const { container } = render(<AssistantRunTrace />);
    expect(container.querySelector('details.v4-trace')).toBeNull();
  });

  it('shows a muted note for an available empty run instead of a legacy claim', () => {
    render(<AssistantRunTrace projection={available([])} />);
    expect(screen.getByText(/本回合没有可展示的思考或工具活动/)).toBeInTheDocument();
    expect(screen.queryByText(/此历史消息没有可验证的工具顺序与详情/)).toBeNull();
  });

  it('shows ONLY the omission notice for truncated when no items survive', () => {
    render(<AssistantRunTrace projection={available([], true)} />);
    expect(screen.getByText(/部分轨迹条目因后端安全长度限制被省略/)).toBeInTheDocument();
    expect(screen.queryByText(/本回合没有可展示的思考或工具活动/)).toBeNull();
    expect(screen.queryByText(/此历史消息没有可验证的工具顺序与详情/)).toBeNull();
  });
});