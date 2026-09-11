import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';
import { toAppApiError } from './api';
import type { AgentPresetRow, CreateConversationResult } from './types';
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
  fixedPreset,
  fixedProject,
}: {
  onClose: () => void;
  onCreated: (result: CreateConversationResult) => void;
  /** Profile mode: validated Agent identity is displayed but cannot be changed. */
  fixedPreset?: AgentPresetRow;
  /** Project mode: validated Project identity is displayed but cannot be changed. */
  fixedProject?: { id: number; name: string };
}) {
  const presetsQuery = useVisiblePresetsQuery(fixedPreset === undefined);
  const projectsQuery = useProjectsQuery();
  const [ambiguousWrite, setAmbiguousWrite] = useState(false);
  const [permissionIds, setPermissionIds] = useState<number[]>([]);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const mountedRef = useRef(false);
  const fixedPresetIdRef = useRef<number | null>(fixedPreset?.id ?? null);
  const fixedProjectIdRef = useRef<number | null>(fixedProject?.id ?? null);
  const nextSubmitTokenRef = useRef(0);
  const activeOriginRef = useRef<{
    token: number;
    fixedPresetId: number | null;
    fixedProjectId: number | null;
  } | null>(null);
  fixedPresetIdRef.current = fixedPreset?.id ?? null;
  fixedProjectIdRef.current = fixedProject?.id ?? null;

  const isCurrentOrigin = (origin: {
    token: number;
    fixedPresetId: number | null;
    fixedProjectId: number | null;
  }) =>
    mountedRef.current &&
    activeOriginRef.current?.token === origin.token &&
    fixedPresetIdRef.current === origin.fixedPresetId &&
    fixedProjectIdRef.current === origin.fixedProjectId;

  // Canonical shared invalidation remains inside the mutation. These callbacks
  // are dialog-local and therefore run only for the still-live submit origin.
  const mutation = useCreateConversationMutation(
    (result) => {
      const origin = activeOriginRef.current;
      if (origin && isCurrentOrigin(origin)) onCreated(result);
    },
    () => {
      const origin = activeOriginRef.current;
      if (origin && isCurrentOrigin(origin)) setAmbiguousWrite(true);
    },
  );

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
  const selectedProjectId = watch('projectId');
  const primaryProjectId = fixedProject ? String(fixedProject.id) : selectedProjectId;
  const selectedPreset = useMemo(
    () => fixedPreset ?? (presetsQuery.data ?? []).find((preset) => String(preset.id) === selectedPresetId),
    [fixedPreset, presetsQuery.data, selectedPresetId],
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

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeOriginRef.current = null;
    };
  }, []);

  const closeDialog = useCallback(() => {
    // Revoke synchronously; do not wait for React to unmount before suppressing
    // a completion that races with the close event.
    activeOriginRef.current = null;
    onClose();
  }, [onClose]);

  // Focus entry + Escape + return focus + Tab containment (a11y, Plan §8.8).
  // The canonical modal must trap forward/backward Tab across its currently
  // usable controls while open (Home selectable / fixed-Agent / fixed-Project /
  // g045 dynamic permission states share this component). Only enabled,
  // visible controls participate, so a pending/ambiguous disabled submit is
  // skipped and focus wraps across the remaining usable controls without
  // reaching background page elements. Escape remains safe in every state -
  // the terminal lock applies to submit, not to closing (creation policy).
  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const firstField = dialogRef.current?.querySelector<HTMLElement>('input, select, textarea');
    firstField?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDialog();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = [...dialog.querySelectorAll<HTMLElement>(
        'input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
      )].filter((el) => !el.closest('[hidden]'));
      if (focusables.length === 0) return;
      const index = focusables.indexOf(document.activeElement as HTMLElement);
      const delta = event.shiftKey ? -1 : 1;
      // Wrap: last + Tab → first, first + Shift+Tab → last. If focus somehow
      // left the dialog, re-enter at the nearest edge.
      const next = index === -1
        ? (event.shiftKey ? focusables.length - 1 : 0)
        : (index + delta + focusables.length) % focusables.length;
      event.preventDefault();
      focusables[next].focus();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      returnFocusRef.current?.focus?.();
    };
  }, [closeDialog]);

  const togglePermission = (projectId: number) => {
    setPermissionIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId],
    );
  };

  const onSubmit = handleSubmit(async (values) => {
    if (ambiguousWrite) return; // terminal lock — never submit again.
    const submittedPreset = fixedPreset ?? selectedPreset;
    const origin = {
      token: ++nextSubmitTokenRef.current,
      fixedPresetId: fixedPreset?.id ?? null,
      fixedProjectId: fixedProject?.id ?? null,
    };
    activeOriginRef.current = origin;
    setBannerError(null);
    try {
      await mutation.mutateAsync({
        // Capture Agent identity and type before the request leaves. A later
        // Profile switch cannot rewrite this already-created input object.
        presetId: submittedPreset?.id ?? Number(values.presetId),
        projectId: fixedProject?.id ?? (values.projectId ? Number(values.projectId) : 0),
        ...(values.name.trim() ? { name: values.name.trim() } : {}),
        ...(isG045AgentType(submittedPreset?.agent_type) ? { frozenProjectIds: [...permissionIds] } : {}),
      });
      // The mutation invalidates shared Conversations before the guarded local
      // callback closes/navigates a still-live origin.
    } catch (cause) {
      if (!isCurrentOrigin(origin)) return;
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
          <button type="button" className="app-icon-btn" aria-label="关闭" onClick={closeDialog}>
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
            {fixedPreset ? (
              <div className="app-radio-card" aria-labelledby="preset-label fixed-preset-name">
                <span className="app-radio-card-body">
                  <span id="fixed-preset-name" className="app-radio-card-name">
                    {fixedPreset.name || `Agent #${fixedPreset.id}`}
                    {isG045AgentType(fixedPreset.agent_type) ? (
                      <span className="app-phase-chip app-phase-chip--g045">g045</span>
                    ) : null}
                  </span>
                  {fixedPreset.description ? <span className="app-radio-card-desc">{fixedPreset.description}</span> : null}
                  <span className="app-muted">已固定为当前 Agent</span>
                </span>
              </div>
            ) : (
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
            )}
            {!fixedPreset ? <FieldError message={errors.presetId?.message} /> : null}
          </div>

          <div className="app-field">
            <span className="app-field-label" id="project-label">
              所属项目{fixedProject ? null : '（可选）'}
            </span>
            {fixedProject ? (
              <div className="app-radio-card" aria-labelledby="project-label fixed-project-name">
                <span className="app-radio-card-body">
                  <span id="fixed-project-name" className="app-radio-card-name">
                    {fixedProject.name || `项目 #${fixedProject.id}`}
                  </span>
                  <span className="app-muted">已固定为当前项目</span>
                </span>
              </div>
            ) : (
              <SectionLoad
                loading={projectsQuery.isPending}
                error={projectsQuery.isError}
                onRetry={() => void projectsQuery.refetch()}
              >
                <select id="conv-project" aria-labelledby="project-label" className="app-input" {...register('projectId')}>
                  <option value="0">— 不关联（Drift）—</option>
                  {projects.map((project) => (
                    <option key={project.id} value={String(project.id)}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </SectionLoad>
            )}
            {!fixedProject ? <p className="app-muted">不选择项目时，会话标记为 Drift。</p> : null}
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
            <button type="button" className="app-btn app-btn-ghost" onClick={closeDialog}>
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
