import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';
import { toAppApiError } from './api';
import type { CreateConversationResult } from './types';
import { isG045AgentType, useCreateConversationMutation, useProjectsQuery, useVisiblePresetsQuery } from './queries';
import { LoadingState } from '../../shared/AsyncState';

interface FormValues {
  name: string;
  presetId: string;
  projectId: string;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="app-field-error" role="alert">
      {message}
    </span>
  );
}

function SectionLoad({
  loading,
  error,
  onRetry,
  children,
}: {
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (loading) return <LoadingState label="加载中…" />;
  if (error) {
    return (
      <div className="app-banner" role="alert">
        加载失败
        <button type="button" className="app-link-btn" onClick={onRetry}>
          重试
        </button>
      </div>
    );
  }
  return <>{children}</>;
}

/**
 * Canonical Conversation creation (Plan Task 6 / §6.5):
 * - Agent required; Project optional (none ⇒ Drift, project_id 0);
 * - g045 presets expose the optional cross-project permission selection;
 *   non-g045 presets never show interactive permission UI;
 * - only canonical init fields are submitted (no temperature/session-type);
 * - field/network/envelope errors stay visible inside the dialog;
 * - duplicate submit is blocked while the mutation is pending.
 */
export function CreateConversationDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (result: CreateConversationResult) => void;
}) {
  const presetsQuery = useVisiblePresetsQuery();
  const projectsQuery = useProjectsQuery();
  // onAmbiguousWrite: a 2xx write returned a malformed envelope — outcome is
  // unknown, so this dialog instance must never submit again (terminal lock).
  const mutation = useCreateConversationMutation(
    (result) => onCreated(result),
    () => setAmbiguousWrite(true),
  );
  const [ambiguousWrite, setAmbiguousWrite] = useState(false);
  const [permissionIds, setPermissionIds] = useState<number[]>([]);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { name: '', presetId: '', projectId: '0' },
  });

  const selectedPresetId = watch('presetId');
  const primaryProjectId = watch('projectId');
  const selectedPreset = useMemo(
    () => (presetsQuery.data ?? []).find((preset) => String(preset.id) === selectedPresetId),
    [presetsQuery.data, selectedPresetId],
  );
  const eligiblePresets = useMemo(
    () => (presetsQuery.data ?? []).filter((preset) => preset.agent_type !== 'user'),
    [presetsQuery.data],
  );
  const isG045 = isG045AgentType(selectedPreset?.agent_type);
  const projects = projectsQuery.data ?? [];

  // Non-g045 presets never carry permission state.
  useEffect(() => {
    if (!isG045) setPermissionIds([]);
  }, [isG045]);

  // The extension list excludes the primary project (backend contract).
  useEffect(() => {
    const primary = primaryProjectId ? Number(primaryProjectId) : 0;
    setPermissionIds((prev) => (primary ? prev.filter((id) => id !== primary) : prev));
  }, [primaryProjectId]);

  // Focus entry + Escape + return focus (a11y, Plan §17.4).
  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const firstField = dialogRef.current?.querySelector<HTMLElement>('input, select, textarea');
    firstField?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      returnFocusRef.current?.focus?.();
    };
  }, [onClose]);

  const togglePermission = (projectId: number) => {
    setPermissionIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId],
    );
  };

  const onSubmit = handleSubmit(async (values) => {
    if (ambiguousWrite) return; // terminal lock — never submit again.
    setBannerError(null);
    try {
      await mutation.mutateAsync({
        presetId: Number(values.presetId),
        projectId: values.projectId ? Number(values.projectId) : 0,
        ...(values.name.trim() ? { name: values.name.trim() } : {}),
        ...(isG045 ? { frozenProjectIds: permissionIds } : {}),
      });
      // onCreated in the mutation hook closes the dialog and navigates.
    } catch (cause) {
      const error = toAppApiError(cause);
      if (error.ambiguousWrite) {
        // Mutation onError already invalidated Recent; surface the terminal
        // state visibly and keep the dialog closable (banner carries the msg).
        setBannerError(error.message);
        return;
      }
      const fieldMap: Record<string, keyof FormValues> = { preset_id: 'presetId', project_id: 'projectId', name: 'name' };
      for (const [serverField, formField] of Object.entries(fieldMap)) {
        const message = error.fieldErrors[serverField];
        if (message) setError(formField, { type: 'server', message });
      }
      setBannerError(error.message || '创建失败，请稍后重试。');
    }
  });

  const pending = isSubmitting || mutation.isPending;
  const submitLocked = pending || ambiguousWrite;

  return (
    <div className="app-overlay" role="presentation">
      <div className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="create-title" ref={dialogRef}>
        <div className="app-dialog-head">
          <h2 id="create-title" className="app-h2">
            新建会话
          </h2>
          <button type="button" className="app-icon-btn" aria-label="关闭" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={(event) => void onSubmit(event)} className="app-dialog-body">
          {bannerError ? (
            <div className="app-banner app-banner--error" role="alert">
              {bannerError}
            </div>
          ) : null}

          <label className="app-field" htmlFor="conv-name">
            <span className="app-field-label">会话名称（可选）</span>
            <input id="conv-name" type="text" className="app-input" placeholder="留空则自动命名" {...register('name')} />
          </label>
          <FieldError message={errors.name?.message} />

          <div className="app-field">
            <span className="app-field-label" id="preset-label">
              Agent <span className="app-required">*</span>
            </span>
            <SectionLoad
              loading={presetsQuery.isPending}
              error={presetsQuery.isError}
              onRetry={() => void presetsQuery.refetch()}
            >
              <div className="app-radio-group" role="radiogroup" aria-labelledby="preset-label">
                {eligiblePresets.map((preset) => (
                  <label key={preset.id} className="app-radio-card">
                    <input type="radio" value={String(preset.id)} {...register('presetId', { required: '请选择一个 Agent' })} />
                    <span className="app-radio-card-body">
                      <span className="app-radio-card-name">
                        {preset.name}
                        {isG045AgentType(preset.agent_type) ? (
                          <span className="app-phase-chip app-phase-chip--g045">g045</span>
                        ) : null}
                      </span>
                      {preset.description ? <span className="app-radio-card-desc">{preset.description}</span> : null}
                    </span>
                  </label>
                ))}
                {eligiblePresets.length === 0 ? <p className="app-muted">暂无可用的 Agent。</p> : null}
              </div>
            </SectionLoad>
            <FieldError message={errors.presetId?.message} />
          </div>

          <div className="app-field">
            <label className="app-field-label" htmlFor="conv-project">
              所属项目（可选）
            </label>
            <SectionLoad
              loading={projectsQuery.isPending}
              error={projectsQuery.isError}
              onRetry={() => void projectsQuery.refetch()}
            >
              <select id="conv-project" className="app-input" {...register('projectId')}>
                <option value="0">— 不关联（Drift）—</option>
                {projects.map((project) => (
                  <option key={project.id} value={String(project.id)}>
                    {project.name}
                  </option>
                ))}
              </select>
            </SectionLoad>
            <p className="app-muted">不选择项目时，会话标记为 Drift。</p>
          </div>

          {isG045 ? (
            <div className="app-field">
              <span className="app-field-label">附加可访问项目（g045 专属）</span>
              <SectionLoad
                loading={projectsQuery.isPending}
                error={projectsQuery.isError}
                onRetry={() => void projectsQuery.refetch()}
              >
                <div className="app-check-group">
                  {projects
                    .filter((project) => project.id !== Number(primaryProjectId))
                    .map((project) => (
                      <label key={project.id} className="app-check-row">
                        <input
                          type="checkbox"
                          checked={permissionIds.includes(project.id)}
                          onChange={() => togglePermission(project.id)}
                        />
                        <span>{project.name}</span>
                      </label>
                    ))}
                  {projects.length === 0 ? <p className="app-muted">没有可附加的项目。</p> : null}
                </div>
              </SectionLoad>
              <p className="app-muted">除所属项目外，允许该 g045 Agent 额外访问的项目（不选则仅所属项目）。</p>
            </div>
          ) : null}

          <div className="app-dialog-actions">
            <button type="button" className="app-btn app-btn-ghost" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="app-btn app-btn--primary" disabled={submitLocked}>
              {ambiguousWrite ? '创建已锁定' : pending ? '创建中…' : '创建会话'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
