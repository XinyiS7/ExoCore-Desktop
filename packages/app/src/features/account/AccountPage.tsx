import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Camera, Edit3, User } from 'lucide-react';
import { ErrorState, LoadingState } from '../../shared/AsyncState';
import { useDocumentTitle } from '../../shared/useDocumentTitle';
import { saveUserAvatar, useUserAvatar } from '../../shared/userAvatar';
import { MoreMenu } from '../../shell/PrimaryNavigation';
import { toAppApiError } from '../chat/api';
import { AvatarCropDialog } from './AvatarCropDialog';
import { useUpdateUserProfileMutation, useUserProfileQuery } from './queries';
import { UsageSummary } from './UsageSummary';
import { UserPromptDialog } from './UserPromptDialog';
import './account.css';

export function AccountPage() {
  useDocumentTitle('账号');

  const { presetsQuery, resolution, user } = useUserProfileQuery();
  const updateMutation = useUpdateUserProfileMutation();

  const avatarUrl = useUserAvatar();
  const [imgError, setImgError] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form drafts for 3 inline fields
  const [nameDraft, setNameDraft] = useState('');
  const [descDraft, setDescDraft] = useState('');
  const [modelDraft, setModelDraft] = useState('');
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // Sync drafts when user query loads or refetches
  useEffect(() => {
    if (user) {
      setNameDraft(user.name ?? '');
      setDescDraft(user.description ?? '');
      setModelDraft(user.default_model ?? '');
    }
  }, [user]);

  // Reset imgError when avatarUrl changes
  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  const handleAvatarFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError('请选择有效的图片文件');
      e.target.value = '';
      return;
    }
    setAvatarError(null);
    setCropFile(file);
    e.target.value = '';
  };

  const handleCropConfirm = (dataUrl: string) => {
    try {
      saveUserAvatar(dataUrl);
      setCropFile(null);
      setAvatarError(null);
    } catch (err) {
      setAvatarError(`保存头像失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setFormError(null);
    setFieldErrors({});
    setSaveSuccessNotice(false);

    const trimmedName = nameDraft.trim();
    if (!trimmedName) {
      setFieldErrors({ name: '用户名不能为空' });
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: user.id,
        fields: {
          name: trimmedName,
          description: descDraft,
          default_model: modelDraft,
        },
      });
      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 3000);
    } catch (err) {
      const apiErr = toAppApiError(err);
      setFormError(apiErr.message);
      if (apiErr.fieldErrors && Object.keys(apiErr.fieldErrors).length > 0) {
        setFieldErrors(apiErr.fieldErrors);
      }
    }
  };

  const handlePromptSave = async (prompt: string) => {
    if (!user) return;
    await updateMutation.mutateAsync({
      id: user.id,
      fields: {
        system_prompt: prompt,
      },
    });
  };

  return (
    <div className="app-page">
      <header className="app-topbar app-topbar--detail">
        <Link to="/" className="app-back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          Chat
        </Link>
        <div className="app-topbar-title app-topbar-title--detail">
          <h1 className="app-h1">账号</h1>
          <span className="app-topbar-sub">用户资料与偏好</span>
        </div>
        <MoreMenu className="app-more--top" />
      </header>

      <div className="app-scroll">
        {presetsQuery.isPending ? (
          <LoadingState label="正在加载用户资料…" />
        ) : presetsQuery.isError ? (
          <ErrorState
            title="用户资料加载失败"
            detail={toAppApiError(presetsQuery.error).message}
            onRetry={() => void presetsQuery.refetch()}
          />
        ) : resolution.status === 'missing' ? (
          <ErrorState
            title="用户资料未配置"
            detail={resolution.message}
            onRetry={() => void presetsQuery.refetch()}
          />
        ) : resolution.status === 'contract_error' ? (
          <ErrorState
            title="用户资料契约异常"
            detail={resolution.message}
            onRetry={() => void presetsQuery.refetch()}
          />
        ) : user ? (
          <div className="account-container">
            {/* Identity & Avatar card */}
            <section className="account-section" aria-labelledby="identity-heading">
              <h2 id="identity-heading" className="app-h2">
                个人资料
              </h2>

              <div className="account-avatar-row">
                <div className="account-avatar-preview">
                  {avatarUrl && !imgError ? (
                    <img
                      src={avatarUrl}
                      alt="用户头像"
                      className="account-avatar-img"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <User size={36} aria-hidden="true" />
                  )}
                </div>

                <div className="account-avatar-actions">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="account-hidden-file"
                    onChange={handleAvatarFileChange}
                  />
                  <button
                    type="button"
                    className="app-btn app-btn-ghost"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera size={16} aria-hidden="true" />
                    更换头像
                  </button>
                  <span className="account-avatar-hint">
                    支持 JPG、PNG、WebP，本地裁剪保存
                  </span>
                  {avatarError ? (
                    <span className="app-field-error" role="alert">
                      {avatarError}
                    </span>
                  ) : null}
                </div>
              </div>

              <form onSubmit={handleProfileSubmit} className="account-form">
                {formError ? (
                  <div className="app-banner app-banner--error" role="alert">
                    {formError}
                  </div>
                ) : null}

                {saveSuccessNotice ? (
                  <div className="app-banner app-banner--success" role="status">
                    资料保存成功
                  </div>
                ) : null}

                <div className="account-field">
                  <label htmlFor="account-name" className="account-label">
                    用户名 <span className="account-required">*</span>
                  </label>
                  <input
                    id="account-name"
                    type="text"
                    className="app-input"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    disabled={updateMutation.isPending}
                    placeholder="输入用户名"
                  />
                  {fieldErrors.name ? (
                    <span className="app-field-error" role="alert">
                      {fieldErrors.name}
                    </span>
                  ) : null}
                </div>

                <div className="account-field">
                  <label htmlFor="account-desc" className="account-label">
                    签名 / 简介
                  </label>
                  <input
                    id="account-desc"
                    type="text"
                    className="app-input"
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    disabled={updateMutation.isPending}
                    placeholder="简短的自我介绍"
                  />
                  {fieldErrors.description ? (
                    <span className="app-field-error" role="alert">
                      {fieldErrors.description}
                    </span>
                  ) : null}
                </div>

                <div className="account-field">
                  <label htmlFor="account-model" className="account-label">
                    默认模型标签
                  </label>
                  <input
                    id="account-model"
                    type="text"
                    className="app-input"
                    value={modelDraft}
                    onChange={(e) => setModelDraft(e.target.value)}
                    disabled={updateMutation.isPending}
                    placeholder="例如 Human / Custom"
                  />
                  {fieldErrors.default_model ? (
                    <span className="app-field-error" role="alert">
                      {fieldErrors.default_model}
                    </span>
                  ) : null}
                </div>

                <div className="account-form-actions">
                  <button
                    type="submit"
                    className="app-btn"
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? '保存中…' : '保存修改'}
                  </button>
                </div>
              </form>
            </section>

            {/* System Prompt Section */}
            <section className="account-section" aria-labelledby="prompt-heading">
              <div className="account-section-head">
                <div>
                  <h2 id="prompt-heading" className="app-h2">
                    System Prompt
                  </h2>
                  <span className="app-topbar-sub">用户身份的通用系统提示词</span>
                </div>
                <button
                  type="button"
                  className="app-btn app-btn-ghost"
                  onClick={() => setPromptDialogOpen(true)}
                >
                  <Edit3 size={16} aria-hidden="true" />
                  编辑 Prompt
                </button>
              </div>

              <div className="account-prompt-card">
                {user.system_prompt ? (
                  <pre className="account-prompt-text">{user.system_prompt}</pre>
                ) : (
                  <span className="account-prompt-empty">未设置 System Prompt</span>
                )}
              </div>
            </section>

            {/* Telemetry Usage Section */}
            <UsageSummary />

            {/* Dialogs */}
            {cropFile ? (
              <AvatarCropDialog
                file={cropFile}
                onConfirm={handleCropConfirm}
                onCancel={() => setCropFile(null)}
              />
            ) : null}

            <UserPromptDialog
              initialPrompt={user.system_prompt ?? ''}
              isOpen={promptDialogOpen}
              onSave={handlePromptSave}
              onClose={() => setPromptDialogOpen(false)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
