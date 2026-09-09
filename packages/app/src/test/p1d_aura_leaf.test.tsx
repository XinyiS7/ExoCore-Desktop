/**
 * P1D Aura leaf — controlled/page-owned selection + library projection,
 * updateCustomPalette routing, no nested buttons, in-memory retention on
 * storage failure, ≤3 CSS layers (Plan Task 4 / §6.7; Solaire leaf B).
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuraStage } from '../features/chat/aura/AuraStage';
import { AuraPicker } from '../features/chat/aura/AuraPicker';
import type { AuraPalette } from '../features/chat/aura/palettes';
import type { UseAuraResult } from '../features/chat/aura/useAura';
import { getBuiltin, customPalette } from './p1d_aura_helpers';

const custom = (id: string, label: string): AuraPalette => customPalette(id, label);

const onSaveNew = vi.fn<UseAuraResult['saveNew']>();
const onUpdate = vi.fn<UseAuraResult['update']>();
const onDelete = vi.fn<UseAuraResult['remove']>();
const PROPS_WITH_CUSTOMS = {
  theme: 'dark' as const,
  selectedId: null,
  palettes: [...getBuiltin(), custom('custom-1', '我的色板')],
  onSelect: vi.fn(),
  onSaveNew,
  onUpdate,
  onDelete,
};

beforeEach(() => {
  PROPS_WITH_CUSTOMS.onSelect.mockReset();
  onSaveNew.mockReset();
  onSaveNew.mockImplementation((label, keypoints) => ({
    ok: true,
    palette: {
      id: 'custom-created',
      label: label || '自定义',
      theme: 'dark',
      builtin: false,
      keypoints,
    },
  }));
  onUpdate.mockReset();
  onUpdate.mockImplementation((id, label, keypoints) => ({
    ok: true,
    palette: { id, label, theme: 'dark', builtin: false, keypoints },
  }));
  onDelete.mockReset();
  onDelete.mockReturnValue({ state: 'persisted' });
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('P1D Aura picker leaf', () => {
  it('is a controlled projection of page-owned selection + library', () => {
    const { container } = render(<AuraPicker {...PROPS_WITH_CUSTOMS} />);
    // Library projection: built-ins + custom rendered as selectable options.
    for (const palette of PROPS_WITH_CUSTOMS.palettes) {
      expect(screen.getByLabelText(`选择 ${palette.label}`)).toBeInTheDocument();
    }
    expect(container.querySelectorAll('.v4-aura-swatch')).toHaveLength(PROPS_WITH_CUSTOMS.palettes.length);
    fireEvent.click(screen.getByLabelText('选择 Deep Ocean'));
    expect(PROPS_WITH_CUSTOMS.onSelect).toHaveBeenCalledWith('deep-ocean');
  });

  it('routes existing-edit through updateCustomPalette, never saveCustomPalette', () => {
    render(<AuraPicker {...PROPS_WITH_CUSTOMS} />);
    fireEvent.click(screen.getByLabelText('编辑 我的色板'));
    const labelInput = screen.getByPlaceholderText('自定义色板名称');
    fireEvent.change(labelInput, { target: { value: '改名色板' } });
    fireEvent.click(screen.getByText('保存'));
    expect(PROPS_WITH_CUSTOMS.onUpdate).toHaveBeenCalledTimes(1);
    expect(PROPS_WITH_CUSTOMS.onUpdate.mock.calls[0][0]).toBe('custom-1');
    expect(PROPS_WITH_CUSTOMS.onUpdate.mock.calls[0][1]).toBe('改名色板');
    expect(PROPS_WITH_CUSTOMS.onSaveNew).not.toHaveBeenCalled();
  });

  it('keeps new-palette creation on saveCustomPalette semantics', () => {
    render(<AuraPicker {...PROPS_WITH_CUSTOMS} />);
    fireEvent.click(screen.getByText('+ 自定义'));
    const labelInput = screen.getByPlaceholderText('自定义色板名称');
    fireEvent.change(labelInput, { target: { value: '新色板' } });
    fireEvent.click(screen.getByText('保存'));
    expect(PROPS_WITH_CUSTOMS.onSaveNew).toHaveBeenCalledTimes(1);
    expect(PROPS_WITH_CUSTOMS.onSaveNew.mock.calls[0][0]).toBe('新色板');
    expect(PROPS_WITH_CUSTOMS.onUpdate).not.toHaveBeenCalled();
  });

  it('perform selection persistence exactly once per flow (controlled view never selects)', () => {
    const { container } = render(<AuraPicker {...PROPS_WITH_CUSTOMS} />);
    // Swatch click → exactly one onSelect (page keeps it once).
    fireEvent.click(screen.getByLabelText('选择 Deep Ocean'));
    expect(PROPS_WITH_CUSTOMS.onSelect).toHaveBeenCalledTimes(1);
    // Create flow: the view saves but NEVER calls onSelect — the page's own
    // onSaveNew owns selection persistence.
    PROPS_WITH_CUSTOMS.onSelect.mockClear();
    fireEvent.click(screen.getByText('+ 自定义'));
    fireEvent.change(screen.getByPlaceholderText('自定义色板名称'), { target: { value: 'x' } });
    fireEvent.click(screen.getByText('保存'));
    expect(PROPS_WITH_CUSTOMS.onSelect).not.toHaveBeenCalled();
    expect(PROPS_WITH_CUSTOMS.onSaveNew).toHaveBeenCalledTimes(1);
    // Delete flow: the view deletes but NEVER touches selection — page-owned.
    const customId = PROPS_WITH_CUSTOMS.palettes.find((p) => !p.builtin)?.id;
    fireEvent.click(container.querySelector('[aria-label^="删除"]') as HTMLElement);
    expect(PROPS_WITH_CUSTOMS.onSelect).not.toHaveBeenCalled();
    expect(PROPS_WITH_CUSTOMS.onDelete).toHaveBeenCalledWith(customId);
  });

  it('resets conversation-local selection when conversationId changes (no reread on close)', () => {
    // Seed a DIFFERENT conversation's selection: aura:8 = morning-mist.
    window.localStorage.setItem('exo:v4:pref:aura:8', JSON.stringify('morning-mist'));
    const { rerender } = render(<AuraPicker conversationId={7} theme="dark" />);
    const cd = () => document.querySelector('.v4-aura-swatch--selected .v4-aura-swatch-select');
    expect(cd()?.getAttribute('aria-label')).toBe('选择 Burning Sunset'); // conv 7 default
    rerender(<AuraPicker conversationId={8} theme="dark" />);
    expect(cd()?.getAttribute('aria-label')).toBe('选择 晨光金雾'); // conv 8 stored choice
    // Same conversation re-render (HUD close/open without unmount) keeps state.
    rerender(<AuraPicker conversationId={8} theme="light" />);
    expect(cd()?.getAttribute('aria-label')).toBe('选择 晨光金雾');
  });

  it('uses valid list semantics with sibling select/edit buttons', () => {
    const { container } = render(<AuraPicker {...PROPS_WITH_CUSTOMS} />);
    const paletteList = screen.getByRole('list', { name: '选择氛围色板' });
    const listItems = within(paletteList).getAllByRole('listitem');
    expect(listItems).toHaveLength(PROPS_WITH_CUSTOMS.palettes.length + 1);
    expect(within(paletteList).queryByRole('option')).not.toBeInTheDocument();

    const swatches = container.querySelectorAll('.v4-aura-swatch');
    for (const [index, swatch] of [...swatches].entries()) {
      expect(swatch.querySelectorAll('button button')).toHaveLength(0);
      const selectBtn = within(swatch as HTMLElement).getByRole('button', {
        name: `选择 ${PROPS_WITH_CUSTOMS.palettes[index].label}`,
      });
      expect(selectBtn).toHaveAttribute(
        'aria-pressed',
        String(PROPS_WITH_CUSTOMS.palettes[index].id === 'burning-sunset'),
      );
      expect(selectBtn.querySelectorAll('button')).toHaveLength(0);
    }
    // Edit affordance is a SIBLING of the select button, not a child.
    const editBtn = container.querySelector('.v4-aura-swatch-edit');
    expect(editBtn).not.toBeNull();
    expect(editBtn?.parentElement?.querySelector('.v4-aura-swatch-select')).not.toBeNull();
  });

  it('retains in-memory selection when storage write fails (internal mode)', () => {
    const warn = vi.fn();
    render(<AuraPicker conversationId={7} theme="dark" onStorageWarning={warn} />);
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota');
      });
    fireEvent.click(screen.getByLabelText('选择 Deep Ocean'));
    // In-memory selection stays even though persistence failed.
    const selectedOption = document.querySelector('.v4-aura-swatch--selected .v4-aura-swatch-select');
    expect(selectedOption).not.toBeNull();
    expect(selectedOption?.getAttribute('aria-label')).toBe('选择 Deep Ocean');
    expect(warn).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('keeps the library in memory when a custom delete fails', () => {
    const warn = vi.fn();
    // Seed one custom palette via real storage BEFORE first render so the
    // useAura initializer observes it.
    window.localStorage.setItem(
      'exo:v4:aura:custom-palettes',
      JSON.stringify([
        { id: 'custom-9', label: '暂存', theme: 'dark', builtin: false,
          keypoints: { keyShadow: '#000000', keyMid: '#333333', keyHighlight: '#666666' } },
      ]),
    );
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota');
      });
    render(<AuraPicker conversationId={7} theme="dark" onStorageWarning={warn} />);
    const delBtn = screen.getByLabelText('删除 暂存');
    expect(delBtn).toBeInTheDocument();
    fireEvent.click(delBtn);
    // Delete failed → the in-memory library row survives + warning surfaced.
    expect(screen.getByLabelText('删除 暂存')).toBeInTheDocument();
    expect(warn).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('renders exactly three composited aura layers', () => {
    const { container } = render(<AuraStage paletteId="deep-ocean" theme="dark" />);
    expect(container.querySelectorAll('.v4-aura-layer')).toHaveLength(3);
  });
});