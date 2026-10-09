import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Activity, ArrowLeft, Bot, Camera, Edit3, Pencil, Plus, Star } from 'lucide-react';
import { toAppApiError } from '../chat/api';
import { CreateConversationDialog } from '../chat/CreateConversationDialog';
import { ConversationDeleteMenu } from '../chat/ConversationDeleteMenu';
import { isG045AgentType, useConversationsQuery } from '../chat/queries';
import { formatDateTime } from '../chat/time';
import type { ConversationSummary } from '../chat/types';
import { EmptyState, ErrorState, LoadingState } from '../../shared/AsyncState';
import { useDocumentTitle } from '../../shared/useDocumentTitle';
import { MoreMenu } from '../../shell/PrimaryNavigation';
import { PrimeConversationConfirmDialog } from './PrimeConversationConfirmDialog';
import { AgentPromptDialog } from './AgentPromptDialog';
import { AgentEditDialog } from './AgentEditDialog';
import { AvatarCropDialog } from '../account/AvatarCropDialog';
import { saveAgentAvatar, useAgentAvatar } from '../../shared/agentAvatar';
import {
  isValidPresetId,
  useAgentMemoryQuery,
  useAgentPresetQuery,
  useUpdateAgentPresetMutation,
} from './queries';
import {
  applyConversationFilter,
  deriveProjectOptions,
  projectLabel,
  resolveConversationFilter,
  type ConversationFilter,
} from './projection';

/** Distinct invalid-URL state — no request is issued for bad route params. */
function InvalidAgentState() {
  useDocumentTitle('Agent 不存在');
  return (
    <div className="app-page app-page--center">
      <div className="app-error-page" role="alert">
        <p className="app-error-title">无效的 Agent 地址</p>
        <p className="app-error-hint">Agent 编号必须是正整数。</p>
        <Link className="app-btn" to="/agents">
          Agent Hub
        </Link>
      </div>
    </div>
  );
}

/** 404: the preset is hidden/absent from the visible-only queryset. */
function AgentMissingState() {
  useDocumentTitle('Agent 不存在');
  return (
    <div className="app-error-page" role="alert">
      <p className="app-error-title">Agent 不存在或未公开</p>
      <p className="app-error-hint">返回 Agent Hub 查看可见的 Agent。</p>
      <Link className="app-btn" to="/agents">
        Agent Hub
      </Link>
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="agent-fact">
      <dt className="agent-fact-label">{label}</dt>
      <dd className="agent-fact-value">{value}</dd>
    </div>
  );
}

export function AgentProfilePage() {
  const { presetId } = useParams();
  if (!isValidPresetId(presetId)) return <InvalidAgentState />;
  // Separate component: invalid IDs mount no query hooks at all (no requests).
  return <AgentProfileDetail presetId={Number(presetId)} />;
}

function AgentProfileDetail({ presetId }: { presetId: number }) {
  const navigate = useNavigate();
  const presetQuery = useAgentPresetQuery(presetId);
  const conversationsQuery = useConversationsQuery();
  // Memory is enabled only after the visible preset detail is confirmed (Plan §6.2).
  const presetConfirmed = presetQuery.data !== undefined;
  const memoryQuery = useAgentMemoryQuery(presetId, presetConfirmed);

  const updateMutation = useUpdateAgentPresetMutation();

  // Profile-local controls reset whenever the route Agent changes (Plan §6.2).
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [primeTarget, setPrimeTarget] = useState<ConversationSummary | null>(null);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFilter('all');
    setDialogOpen(false);
    setPrimeTarget(null);
    setPromptDialogOpen(false);
    setEditProfileOpen(false);
    setCropFile(null);
    setAvatarError(null);
    setSaveSuccessNotice(false);
  }, [presetId]);

  const preset = presetQuery.data;
  const avatarUrl = useAgentAvatar(presetId, preset?.name);

  const handlePromptSave = async (prompt: string) => {
    if (!preset) return;
    await updateMutation.mutateAsync({
      id: preset.id,
      fields: {
        system_prompt: prompt,
      },
    });
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  const handleProfileSave = async (fields: {
    name: string;
    description?: string;
    default_model?: string;
  }) => {
    if (!preset) return;
    await updateMutation.mutateAsync({
      id: preset.id,
      fields,
    });
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.type.startsWith('image/')) {
      setAvatarError('请选择有效的图片文件 (PNG, JPG, WebP 等)');
      return;
    }
    setAvatarError(null);
    setCropFile(file);
  };

  const handleAvatarCropConfirm = (dataUrl: string) => {
    saveAgentAvatar(presetId, dataUrl);
    setCropFile(null);
  };

  const title = presetQuery.isError
    ? toAppApiError(presetQuery.error).status === 404
      ? 'Agent 不存在'
      : 'Agent 详情加载失败'
    : preset && preset.id === presetId
      ? preset.name?.trim() || 'Agent Profile'
      : 'Agent Profile';
  useDocumentTitle(title);

  const agentRows = useMemo(
    () => (conversationsQuery.data ?? []).filter((row) => row.agentPresetId === presetId),
    [conversationsQuery.data, presetId],
  );
  const projectOptions = useMemo(() => deriveProjectOptions(agentRows), [agentRows]);
  const projectIds = useMemo(
    () => new Set(projectOptions.map((option) => option.id)),
    [projectOptions],
  );

  // §6.2 real selection fallback: a confirmed dataset update that removed the
  // selected Project permanently resets the selection to All — the stale id is
  // NOT retained, so the Project cannot silently resurrect on a later refill.
  // Pending/failing refetches keep the last successful data and never erase a
  // selection here (projectIds only changes with a replacement dataset).
  useEffect(() => {
    if (filter !== 'all' && filter !== 'drift' && !projectIds.has(filter)) {
      setFilter('all');
    }
  }, [filter, projectIds]);

  // Render-time guard for the transient frame between the dataset update and
  // the reconciliation effect above; both must agree that the stale numeric
  // selection is never shown.
  const activeFilter = resolveConversationFilter(filter, projectIds);
  const visibleRows = applyConversationFilter(agentRows, activeFilter);

  return (
    <div className="app-page">
      <header className="app-topbar app-topbar--detail">
        <Link to="/agents" className="app-back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          Agent Hub
        </Link>
        <div className="app-topbar-title app-topbar-title--detail">
          <h1 className="app-h1">Agent Profile</h1>
          {preset ? (
            <span className="app-topbar-sub">
              <span className="app-chip agent-chip-clamp">{preset.agent_type}</span>
              {preset.default_model ? <span className="app-chip agent-chip-clamp">{preset.default_model}</span> : null}
            </span>
          ) : null}
        </div>
        <MoreMenu className="app-more--top" />
      </header>

      <div className="app-scroll">
        {presetQuery.isPending ? (
          <LoadingState label="正在加载 Agent…" />
        ) : presetQuery.isError ? (
          toAppApiError(presetQuery.error).status === 404 ? (
            <AgentMissingState />
          ) : (
            <ErrorState
              title="Agent 详情加载失败"
              detail={toAppApiError(presetQuery.error).message}
              onRetry={() => void presetQuery.refetch()}
            />
          )
        ) : preset ? (
          <div className="agent-profile">
            <section className="agent-profile-section" aria-labelledby="agent-identity-title">
              <div className="agent-avatar-row">
                <div className="agent-avatar-preview">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={preset.name || `Agent #${preset.id}`}
                      className="agent-avatar-img"
                    />
                  ) : (
                    <Bot size={36} aria-hidden="true" />
                  )}
                </div>
                <div className="agent-avatar-actions">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleAvatarFileChange}
                    aria-label="上传新头像"
                  />
                  <button
                    type="button"
                    className="app-btn app-btn-ghost"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    <Camera size={14} aria-hidden="true" />
                    更换头像
                  </button>
                  <span className="agent-avatar-hint">支持 JPG / PNG / WebP，上传后可裁剪</span>
                  {avatarError ? (
                    <span className="app-field-error" role="alert">{avatarError}</span>
                  ) : null}
                </div>
              </div>

              <div className="agent-section-heading">
                <div>
                  <h2 id="agent-identity-title" className="app-h2 agent-identity-name">
                    {preset.name || `Agent #${preset.id}`}
                    {isG045AgentType(preset.agent_type) ? (
                      <span className="app-phase-chip app-phase-chip--g045">g045</span>
                    ) : null}
                  </h2>
                </div>
                <div className="agent-identity-actions">
                  <button
                    type="button"
                    className="app-btn app-btn-ghost"
                    onClick={() => setEditProfileOpen(true)}
                  >
                    <Pencil size={14} aria-hidden="true" />
                    编辑资料
                  </button>
                  {isG045AgentType(preset.agent_type) ? (
                    <Link
                      to={`/agents/${preset.id}/heartbeat`}
                      className="app-btn app-btn--subtle agent-heartbeat-link"
                      aria-label="Heartbeat Ledger"
                    >
                      <Activity size={16} aria-hidden="true" />
                      Heartbeat Ledger
                    </Link>
                  ) : null}
                </div>
              </div>

              <p className="agent-identity-desc">{preset.description ?? '暂无描述'}</p>
              <dl className="agent-facts">
                <FactRow label="Agent 类型" value={preset.agent_type || '未标注'} />
                <FactRow label="默认模型" value={preset.default_model || '未配置默认模型'} />
              </dl>
            </section>

            <section className="agent-profile-section" aria-labelledby="agent-prompt-heading">
              <div className="agent-section-heading">
                <div>
                  <h2 id="agent-prompt-heading" className="app-h2">
                    System Prompt
                  </h2>
                  <span className="app-topbar-sub">定义该 Agent 的人格设定与系统提示词</span>
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

              {saveSuccessNotice ? (
                <div className="app-banner app-banner--success" role="status">
                  System Prompt 保存成功
                </div>
              ) : null}

              <div className="agent-prompt-card">
                {preset.system_prompt ? (
                  <pre className="agent-prompt-text">{preset.system_prompt}</pre>
                ) : (
                  <span className="agent-prompt-empty">未设置 System Prompt</span>
                )}
              </div>
            </section>

            <section className="agent-profile-section" aria-labelledby="agent-convs-title">
              <div className="agent-section-heading">
                <h2 id="agent-convs-title" className="app-h2">
                  会话
                </h2>
                <button type="button" className="app-btn" onClick={() => setDialogOpen(true)}>
                  <Plus size={16} aria-hidden="true" />
                  使用此 Agent 新建会话
                </button>
              </div>
              {conversationsQuery.isPending ? (
                <LoadingState label="正在加载会话…" />
              ) : conversationsQuery.isError ? (
                <ErrorState
                  title="会话加载失败"
                  detail={toAppApiError(conversationsQuery.error).message}
                  onRetry={() => void conversationsQuery.refetch()}
                />
              ) : agentRows.length === 0 ? (
                <EmptyState title="该 Agent 还没有会话" hint="从 Chat Home 新建会话后，它会出现在这里。" />
              ) : (
                <>
                  <div
                    className="agent-filter-bar"
                    role="radiogroup"
                    aria-label="会话筛选"
                  >
                    <FilterOption
                      label="全部"
                      value="all"
                      checked={activeFilter === 'all'}
                      onChange={() => setFilter('all')}
                    />
                    <FilterOption
                      label="Drift"
                      value="drift"
                      checked={activeFilter === 'drift'}
                      onChange={() => setFilter('drift')}
                    />
                    {projectOptions.map((option) => (
                      <FilterOption
                        key={option.id}
                        label={option.label}
                        value={`project-${option.id}`}
                        checked={activeFilter === option.id}
                        onChange={() => setFilter(option.id)}
                      />
                    ))}
                  </div>
                  {/* D6: every Project option derives from current Agent rows, so a
                      selected Project always yields at least one row; the always-present
                      Drift control may legitimately produce an empty subset. */}
                  {visibleRows.length === 0 ? (
                    <p className="app-muted">没有符合条件的会话。</p>
                  ) : null}
                  <ul className="app-recent-list" aria-label="该 Agent 的会话">
                    {visibleRows.map((row) => (
                      <li key={row.id} className="app-recent-item">
                        {isG045AgentType(preset.agent_type) ? (
                          <button
                            type="button"
                            className={`app-icon-btn prime-star-btn${row.isPrime ? ' prime-star-btn--active' : ''}`}
                            aria-label={row.isPrime ? '当前主会话' : '设为主会话'}
                            title={row.isPrime ? '当前主会话' : '设为主会话'}
                            onClick={() => {
                              if (row.isPrime) return;
                              setPrimeTarget(row);
                            }}
                          >
                            <Star
                              size={16}
                              className={`prime-star${row.isPrime ? ' prime-star--active' : ''}`}
                              aria-hidden="true"
                            />
                          </button>
                        ) : null}
                        <Link to={`/chat/${row.id}`} className="app-recent-row">
                          <span className="app-recent-name">{row.name || `会话 #${row.id}`}</span>
                          <span className="app-recent-time">
                            {formatDateTime(row.lastMessageAt ?? row.createdAt)}
                          </span>
                          <span className="app-recent-meta">
                            <span
                              className={`app-chip agent-chip-clamp${row.projectId === null ? ' app-chip--drift' : ''}`}
                            >
                              {projectLabel(row)}
                            </span>
                          </span>
                        </Link>
                        <ConversationDeleteMenu
                          conversationId={row.id}
                          conversationName={row.name || `会话 #${row.id}`}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <section className="agent-profile-section" aria-labelledby="agent-memory-title">
              <h2 id="agent-memory-title" className="app-h2">
                记忆
              </h2>
              {memoryQuery.isPending ? (
                <LoadingState label="正在加载记忆…" />
              ) : memoryQuery.isError ? (
                <ErrorState
                  title="记忆加载失败"
                  detail={toAppApiError(memoryQuery.error).message}
                  onRetry={() => void memoryQuery.refetch()}
                />
              ) : (
                <>
                  <p className="agent-memory-count">
                    {memoryQuery.data?.count ?? 0} 条记忆（含共享/全局）
                  </p>
                  {memoryQuery.data && memoryQuery.data.tags.length > 0 ? (
                    <ul className="agent-tag-list" aria-label="记忆标签">
                      {memoryQuery.data.tags.map((tag) => (
                        <li key={tag} className="agent-tag">
                          {tag}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="app-muted">暂无记忆标签。</p>
                  )}
                  <p className="app-muted">记忆管理入口将在 P5 Library 阶段提供。</p>
                </>
              )}
            </section>
          </div>
        ) : null}
      </div>
      {dialogOpen && preset ? (
        <CreateConversationDialog
          fixedPreset={preset}
          onClose={() => setDialogOpen(false)}
          onCreated={(result) => {
            setDialogOpen(false);
            navigate(`/chat/${result.conversationId}`);
          }}
        />
      ) : null}
      {primeTarget ? (
        <PrimeConversationConfirmDialog
          open={true}
          conversationId={primeTarget.id}
          conversationName={primeTarget.name || `会话 #${primeTarget.id}`}
          onClose={() => setPrimeTarget(null)}
        />
      ) : null}
      {promptDialogOpen && preset ? (
        <AgentPromptDialog
          agentName={preset.name || `Agent #${preset.id}`}
          initialPrompt={preset.system_prompt ?? ''}
          isOpen={promptDialogOpen}
          onSave={handlePromptSave}
          onClose={() => setPromptDialogOpen(false)}
        />
      ) : null}
      {editProfileOpen && preset ? (
        <AgentEditDialog
          preset={preset}
          isOpen={editProfileOpen}
          onSave={handleProfileSave}
          onClose={() => setEditProfileOpen(false)}
        />
      ) : null}
      {cropFile ? (
        <AvatarCropDialog
          file={cropFile}
          onConfirm={handleAvatarCropConfirm}
          onCancel={() => setCropFile(null)}
        />
      ) : null}
    </div>
  );
}

function FilterOption({
  label,
  value,
  checked,
  onChange,
}: {
  label: string;
  value: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="agent-filter-option">
      <input
        type="radio"
        name="agent-conversation-filter"
        value={value}
        checked={checked}
        onChange={onChange}
      />
      <span>{label}</span>
    </label>
  );
}
