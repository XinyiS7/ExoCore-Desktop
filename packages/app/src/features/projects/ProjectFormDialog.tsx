import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { UseMutationResult } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { toAppApiError } from '../chat/api';
import type { ProjectDetailRow } from '../chat/control/types';
import { useDialogA11y } from '../chat/dialogA11y';
import type { ProjectSubmitVariables, ProjectWriteValues } from './api';

export type ProjectFormValues = ProjectWriteValues;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="app-field-error" role="alert">
      {message}
    </span>
  );
}

type DialogMutation = UseMutationResult<ProjectDetailRow, unknown, ProjectSubmitVariables>;

/**
 * P2B Project create/edit form dialog (Plan §6.1–6.2, §8.3).
 *
 * One dialog for both directions — they share form state, focus ownership and
 * error surfaces; only the ambiguous-write lock is create-specific:
 * - create: a malformed 2xx (no confirmed id) is terminal — resubmission is
 *   locked and navigation is impossible because the returned id is unknown;
 *   the shared Projects list is still invalidated by the mutation hook;
 * - edit: PATCH retries are idempotent, so an ambiguous success is reported,
 *   the canonical detail/list are re-read via mutation invalidation, and the
 *   dialog stays closable with entered values preserved.
 *
 * Submit-time request identity is captured (token): a later route change or
 * dialog close can never rewrite the body or run a stale local completion.
 * Edit submits carry `submitProjectId` inside the mutation variables (F01) so
 * the PATCH target and every completed/ambiguous write cache side effect stay
 * bound to the ORIGIN Project even if the route switched while pending.
 */
export function ProjectFormDialog({
  mode,
  initialValues,
  mutation,
  onClose,
  onConfirmed,
  submitProjectId,
}: {
  mode: 'create' | 'edit';
  initialValues?: Partial<ProjectFormValues>;
  mutation: DialogMutation;
  onClose: () => void;
  /** Runs only for a still-live submit origin after a confirmed write. */
  onConfirmed?: (project: ProjectDetailRow) => void;
  /** Edit-only: the identity of the Project being patched, captured at open. */
  submitProjectId?: number;
}) {
  const [ambiguousWrite, setAmbiguousWrite] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const nextSubmitTokenRef = useRef(0);
  const activeOriginRef = useRef<{ token: number } | null>(null);

  const closeDialog = useCallback(() => {
    // Revoke synchronously; do not wait for React to unmount before
    // suppressing a completion that races with the close event.
    activeOriginRef.current = null;
    onClose();
  }, [onClose]);

  const dialogRef = useDialogA11y(true, closeDialog);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeOriginRef.current = null;
    };
  }, []);

  // Focus the first real field (the shared hook initially focuses the first
  // focusable element, which is the close button).
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLInputElement>('#project-name')?.focus();
  }, [dialogRef]);

  const isCurrentOrigin = (origin: { token: number }) =>
    mountedRef.current && activeOriginRef.current?.token === origin.token;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    defaultValues: {
      name: initialValues?.name ?? '',
      description: initialValues?.description ?? '',
      prompt: initialValues?.prompt ?? '',
      workDir: initialValues?.workDir ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (ambiguousWrite) return; // terminal lock — never resubmit a lost create
    const origin = { token: ++nextSubmitTokenRef.current };
    activeOriginRef.current = origin;
    setBannerError(null);
    try {
      const payload: ProjectSubmitVariables =
        submitProjectId == null ? values : { ...values, projectId: submitProjectId };
      const project = await mutation.mutateAsync(payload);
      if (!isCurrentOrigin(origin)) return; // dialog closed / route switched
      onConfirmed?.(project);
    } catch (cause) {
      if (!isCurrentOrigin(origin)) return;
      const error = toAppApiError(cause);
      if (error.ambiguousWrite) {
        if (mode === 'create') setAmbiguousWrite(true);
        setBannerError(error.message);
        return;
      }
      let hadFieldErrors = false;
      const fieldMap: Record<string, keyof ProjectFormValues> = {
        name: 'name',
        description: 'description',
        prompt: 'prompt',
        work_dir: 'workDir',
      };
      for (const [serverField, formField] of Object.entries(fieldMap)) {
        const message = error.fieldErrors[serverField];
        if (message) {
          hadFieldErrors = true;
          setError(formField, { type: 'server', message });
        }
      }
      // F02: backend field reasons are already rendered next to their controls;
      // the banner then points at them instead of the transport's generic text.
      setBannerError(
        hadFieldErrors
          ? '请修正表单中标记的错误后重试。'
          : error.message ||
              (mode === 'create' ? '创建失败，请稍后重试。' : '保存失败，请稍后重试。'),
      );
    }
  });

  const pending = mutation.isPending;
  const submitLocked = pending || ambiguousWrite;

  return (
    <div className="app-overlay" role="presentation">
      <div
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-form-title"
        ref={dialogRef}
      >
        <div className="app-dialog-head">
          <h2 id="project-form-title" className="app-h2">
            {mode === 'create' ? '新建项目' : '编辑项目'}
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

          <label className="app-field" htmlFor="project-name">
            <span className="app-field-label">
              项目名称 <span className="app-required">*</span>
            </span>
            <input
              id="project-name"
              type="text"
              className="app-input"
              placeholder="项目代号"
              {...register('name', { validate: (v) => v.trim().length > 0 || '项目名称不能为空' })}
            />
          </label>
          <FieldError message={errors.name?.message} />

          <label className="app-field" htmlFor="project-desc">
            <span className="app-field-label">描述（可选）</span>
            <textarea id="project-desc" className="app-input" rows={3} {...register('description')} />
          </label>
          <FieldError message={errors.description?.message} />

          <label className="app-field" htmlFor="project-prompt">
            <span className="app-field-label">System Prompt（可选）</span>
            <textarea id="project-prompt" className="app-input" rows={4} {...register('prompt')} />
          </label>
          <FieldError message={errors.prompt?.message} />

          <label className="app-field" htmlFor="project-workdir">
            <span className="app-field-label">工作目录（可选）</span>
            <input
              id="project-workdir"
              type="text"
              className="app-input"
              placeholder="留空表示未绑定"
              {...register('workDir')}
            />
          </label>
          <FieldError message={errors.workDir?.message} />
          <p className="app-muted">工作目录是项目在磁盘上的根目录绝对路径；此处仅保存配置字符串，不做目录探测。</p>

          <div className="app-dialog-actions">
            <button type="button" className="app-btn app-btn-ghost" onClick={closeDialog}>
              取消
            </button>
            <button type="submit" className="app-btn app-btn--primary" disabled={submitLocked}>
              {ambiguousWrite ? '创建已锁定' : pending ? '保存中…' : mode === 'create' ? '创建项目' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}