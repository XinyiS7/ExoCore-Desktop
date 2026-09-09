/**
 * V4 Aura picker (Plan Task 4, §6.7 — Solaire leaf B).
 *
 * Controlled when selection/library props are provided (page-owned via
 * `useAura`); otherwise keeps the legacy `conversationId` internal mode for
 * existing consumers (pane-5 TacticalHud). Both modes share the fixed
 * internals:
 * - editing an EXISTING custom palette routes to `updateCustomPalette`
 *   (in-place, same id) — never a silent re-create;
 * - valid list semantics: each swatch is a listitem whose selectable button
 *   carries `aria-pressed`; select and edit affordances are SIBLING buttons;
 * - storage failures keep in-memory state and surface `onStorageWarning`;
 * - at most MAX_CUSTOM_PALETTES custom palettes (built-ins excluded).
 */
import { useState } from 'react';
import {
  MAX_CUSTOM_PALETTES,
  paletteStopsFor,
  resolvePalette,
  type AuraKeypoints,
  type AuraPalette,
} from './palettes';
import { useAura, type AuraUpdateOutcome, type UseAuraResult } from './useAura';
import './aura.css';

/** Controlled page-owned selection + library projection mode. */
export interface ControlledAuraPickerProps {
  /** Page-owned conversation-local selection (null → theme default). */
  selectedId: string | null;
  /** Page-owned full library projection. */
  palettes: AuraPalette[];
  onSelect: (id: string | null) => void;
  onSaveNew: (label: string, keypoints: AuraKeypoints) => {
    ok: boolean;
    palette?: AuraPalette;
    reason?: string;
    message?: string;
  };
  onUpdate: (id: string, label: string, keypoints: AuraKeypoints) => AuraUpdateOutcome;
  onDelete: (id: string) => { state: 'persisted' | 'unavailable'; reason?: string };
  /** Shared look of both modes. */
  theme: 'dark' | 'light';
  onStorageWarning?: (message: string) => void;
}

/** Legacy internal-state mode (kept for pane-5 TacticalHud). */
export interface InternalAuraPickerProps {
  conversationId: number;
  theme: 'dark' | 'light';
  onStorageWarning?: (message: string) => void;
}

export type AuraPickerProps = ControlledAuraPickerProps | InternalAuraPickerProps;

function isControlled(props: AuraPickerProps): props is ControlledAuraPickerProps {
  return 'selectedId' in props;
}

const DEFAULT_KEYPOINTS: AuraKeypoints = {
  keyShadow: '#0a0200',
  keyMid: '#941b0c',
  keyHighlight: '#f8bf74',
};

/** Shared presentation: palette grid + editor + delete affordances. */
function AuraPickerView({
  result,
  onSelect,
  onSaveNew,
  onUpdate,
  onDelete,
  theme,
  onStorageWarning,
}: {
  result: Pick<UseAuraResult, 'selectedId' | 'palettes' | 'atCapacity'>;
  onSelect: (id: string | null) => void;
  onSaveNew: (label: string, keypoints: AuraKeypoints) => {
    ok: boolean;
    palette?: AuraPalette;
    reason?: string;
    message?: string;
  };
  onUpdate: (id: string, label: string, keypoints: AuraKeypoints) => AuraUpdateOutcome;
  onDelete: (id: string) => { state: 'persisted' | 'unavailable'; reason?: string };
  theme: 'dark' | 'light';
  onStorageWarning?: (message: string) => void;
}) {
  const { selectedId, palettes, atCapacity } = result;
  const selected = resolvePalette(selectedId, theme);
  const previewStops = paletteStopsFor(selected);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editKeypoints, setEditKeypoints] = useState<AuraKeypoints>(DEFAULT_KEYPOINTS);

  const openNewEditor = () => {
    setEditingId(null);
    setEditLabel('');
    setEditKeypoints({
      keyShadow: selected.keypoints.keyShadow,
      keyMid: selected.keypoints.keyMid,
      keyHighlight: selected.keypoints.keyHighlight,
    });
    setEditorOpen(true);
  };

  const openEditEditor = (palette: AuraPalette) => {
    setEditingId(palette.id);
    setEditLabel(palette.label);
    setEditKeypoints(palette.keypoints);
    setEditorOpen(true);
  };

  const handleUpdateKeypoint = (key: keyof AuraKeypoints, value: string) => {
    setEditKeypoints((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (editingId === null) {
      const mutation = onSaveNew(editLabel, editKeypoints);
      if (!mutation.ok) {
        if (mutation.reason === 'capacity_reached') {
          onStorageWarning?.(`最多保存 ${MAX_CUSTOM_PALETTES} 套自定义色板`);
        } else if (mutation.reason === 'invalid_keypoints') {
          onStorageWarning?.('颜色值无效，请使用 #RRGGBB 格式');
        } else if (mutation.reason === 'storage_unavailable') {
          onStorageWarning?.(mutation.message ?? '无法保存自定义色板');
        }
        return;
      }
      // Selection persistence is performed EXACTLY ONCE by the page owner
      // (internal mode: useAura.saveNew selects internally; controlled mode:
      // the page decides inside its own onSaveNew). The view never selects.
      setEditorOpen(false);
      return;
    }
    // Existing palette → in-place update (updateCustomPalette semantics).
    const outcome = onUpdate(editingId, editLabel, editKeypoints);
    if (!outcome.ok) {
      if (outcome.reason === 'invalid_keypoints') {
        onStorageWarning?.('颜色值无效，请使用 #RRGGBB 格式');
      } else if (outcome.reason === 'storage_unavailable') {
        onStorageWarning?.('无法保存自定义色板修改');
      } else if (outcome.reason === 'not_found') {
        onStorageWarning?.('自定义色板已被移除，请重新创建。');
      }
      return;
    }
    setEditorOpen(false);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    const outcome = onDelete(id);
    if (outcome.state === 'unavailable') {
      onStorageWarning?.(outcome.reason ?? '无法删除自定义色板');
      return;
    }
    // Clearing a deleted selection (if it was selected) is the page owner's
    // single write — internal mode does it inside useAura.remove; controlled
    // mode inside the page's own onDelete. The view only reports outcome.
  };

  return (
    <div className="v4-aura-picker">
      <div className="v4-aura-picker-grid" role="list" aria-label="选择氛围色板">
        {palettes.map((palette) => {
          const stops = paletteStopsFor(palette);
          const isSelected = palette.id === selected.id;
          return (
            <div
              key={palette.id}
              role="listitem"
              className={`v4-aura-swatch${isSelected ? ' v4-aura-swatch--selected' : ''}`}
            >
              <button
                type="button"
                className="v4-aura-swatch-select"
                onClick={() => onSelect(palette.id)}
                aria-label={`选择 ${palette.label}`}
                aria-pressed={isSelected}
                title={palette.label}
              >
                <span className="v4-aura-swatch-bar" aria-hidden="true">
                  {stops
                    ? [stops['--obsidian'], stops['--oxblood-500'], stops['--orange-500']].map((c) => (
                        <i key={c} style={{ background: c }} />
                      ))
                    : null}
                </span>
                <span className="v4-aura-swatch-label">{palette.label}</span>
              </button>
              {!palette.builtin ? (
                <button
                  type="button"
                  className="v4-aura-swatch-edit"
                  onClick={() => openEditEditor(palette)}
                  aria-label={`编辑 ${palette.label}`}
                >
                  编辑
                </button>
              ) : null}
            </div>
          );
        })}
        {!editorOpen && (
          <div role="listitem" className="v4-aura-new-item">
            <button
              type="button"
              className="v4-aura-new"
              onClick={openNewEditor}
              disabled={atCapacity}
              title={atCapacity ? `最多保存 ${MAX_CUSTOM_PALETTES} 套自定义色板` : '新建自定义色板'}
            >
              {atCapacity ? `自定义已满 (${MAX_CUSTOM_PALETTES})` : '+ 自定义'}
            </button>
          </div>
        )}
      </div>

      {/* 3-keypoint preview of the currently selected palette */}
      {previewStops ? (
        <div className="v4-aura-preview" aria-hidden="true">
          <span style={{ background: previewStops['--obsidian'] }} />
          <span style={{ background: previewStops['--oxblood-500'] }} />
          <span style={{ background: previewStops['--orange-500'] }} />
        </div>
      ) : null}

      {editorOpen ? (
        <div className="v4-aura-editor">
          <label className="v4-aura-editor-field">
            名称
            <input
              className="app-input"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              placeholder="自定义色板名称"
            />
          </label>
          <div className="v4-aura-editor-keys">
            {(
              [
                ['keyShadow', '阴影'],
                ['keyMid', '中调'],
                ['keyHighlight', '高光'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="v4-aura-editor-field">
                {label}
                <input
                  className="app-input"
                  type="color"
                  value={editKeypoints[key]}
                  onChange={(e) => handleUpdateKeypoint(key, e.target.value)}
                />
              </label>
            ))}
          </div>
          <div className="v4-aura-editor-actions">
            <button type="button" className="app-btn app-btn-ghost app-btn-sm" onClick={() => setEditorOpen(false)}>
              取消
            </button>
            <button type="button" className="app-btn app-btn-primary app-btn-sm" onClick={handleSave}>
              保存
            </button>
          </div>
        </div>
      ) : null}

      {/* Delete affordances for custom palettes (label row already holds edit) */}
      {palettes
        .filter((p) => !p.builtin)
        .map((palette) => (
          <button
            key={`del-${palette.id}`}
            type="button"
            className="v4-aura-delete"
            onClick={() => handleDelete(palette.id)}
            aria-label={`删除 ${palette.label}`}
          >
            删除 {palette.label}
          </button>
        ))}
    </div>
  );
}

export function AuraPicker(props: AuraPickerProps) {
  if (isControlled(props)) {
    return <ControlledAuraPicker {...props} />;
  }
  return <InternalAuraPicker {...props} />;
}

/** Controlled branch — the page owns selection/library via useAura. */
function ControlledAuraPicker(props: ControlledAuraPickerProps) {
  return (
    <AuraPickerView
      result={{
        selectedId: props.selectedId,
        palettes: props.palettes,
        atCapacity: props.palettes.filter((p) => !p.builtin).length >= MAX_CUSTOM_PALETTES,
      }}
      onSelect={props.onSelect}
      onSaveNew={props.onSaveNew}
      onUpdate={props.onUpdate}
      onDelete={props.onDelete}
      theme={props.theme}
      onStorageWarning={props.onStorageWarning}
    />
  );
}

/** Legacy internal branch — picker owns page state through the same hook so
 * both modes share identical selection/library semantics. */
function InternalAuraPicker(props: InternalAuraPickerProps) {
  const aura = useAura(props.conversationId, {
    theme: props.theme,
    onStorageWarning: props.onStorageWarning,
  });
  return (
    <AuraPickerView
      result={aura}
      onSelect={aura.select}
      onSaveNew={(label, keypoints) => aura.saveNew(label, keypoints)}
      onUpdate={(id, label, keypoints) => aura.update(id, label, keypoints)}
      onDelete={(id) => aura.remove(id)}
      theme={props.theme}
      onStorageWarning={props.onStorageWarning}
    />
  );
}