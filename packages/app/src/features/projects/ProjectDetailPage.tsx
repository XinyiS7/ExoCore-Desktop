import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MessageSquarePlus, Pencil, Trash2 } from 'lucide-react';
import { CreateConversationDialog } from '../chat/CreateConversationDialog';
import { ConversationDeleteMenu } from '../chat/ConversationDeleteMenu';
import { useConversationsQuery, useVisiblePresetsQuery } from '../chat/queries';
import { useProjectDetailQuery } from '../chat/control/queries';
import { toAppApiError } from '../chat/api';
import { formatDateTime } from '../chat/time';
import { EmptyState, ErrorState, LoadingState } from '../../shared/AsyncState';
import { isValidProjectId, useUpdateProjectMutation } from './queries';
import {
  agentLabel,
  applyAgentFilter,
  deriveAgentOptions,
  resolveAgentFilter,
  rowsForProject,
  type AgentFilter,
} from './projection';
import { ProjectFormDialog, type ProjectFormValues } from './ProjectFormDialog';
import { ProjectDeleteDialog } from './ProjectDeleteDialog';
import { ProjectFilesSection } from './ProjectFilesSection';
import { ProjectKnowledgeSection } from './ProjectKnowledgeSection';

/** Distinct invalid-URL state — no request is issued for bad route params. */
function InvalidProjectState() {
  return (
    <div className="app-page app-page--center">
      <div className="app-error-page" role="alert">
        <p className="app-error-title">无效的项目地址</p>
        <p className="app-error-hint">项目编号必须是正整数。</p>
        <Link className="app-btn" to="/projects">
          项目 Hub
        </Link>
      </div>
    </div>
  );
}

/** 404: the Project is absent from the backend (Archived projects are excluded). */
function ProjectMissingState() {
  return (
    <div className="app-error-page" role="alert">
      <p className="app-error-title">项目不存在或已被删除</p>
      <p className="app-error-hint">返回项目 Hub 查看当前项目。</p>
      <Link className="app-btn" to="/projects">
        项目 Hub
      </Link>
    </div>
  );
}

/**
 * Overview display value (F04): a backend null OR empty string is an explicit
 * absent label — never a blank paragraph/value. Server strings are untouched;
 * the editor still round-trips blanks as ''. Wording-neutral per acceptance.
 */
function displayValue(value: string | null | undefined, absentLabel: string): string {
  return value == null || value === '' ? absentLabel : value;
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="project-fact">
      <dt className="project-fact-label">{label}</dt>
      <dd className="project-fact-value">{value}</dd>
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
    <label className="project-filter-option">
      <input
        type="radio"
        name="project-conversation-filter"
        value={value}
        checked={checked}
        onChange={onChange}
      />
      <span>{label}</span>
    </label>
  );
}

/**
 * Current-Project Conversation lens (D4, §5.5): consumes ONLY the shared
 * `queryKeys.conversations` cache and selects rows whose normalized projectId
 * exactly equals the current Project. All/Agent filtering is synchronously
 * derived; Agent options come from current rows (dedupe by positive id, honest
 * name fallback); a confirmed dataset replacement that removed the selected
 * Agent falls back permanently to All while pending/failed refetches never
 * erase a still-valid selection. Mounts only after the Project identity is
 * confirmed because it is that owner's lens (§5.6).
 */
function ProjectConversationLens({ projectId }: { projectId: number }) {
  const conversationsQuery = useConversationsQuery();
  const presetsQuery = useVisiblePresetsQuery();

  const presetNames = useMemo(() => {
    const map = new Map<number, string>();
    for (const preset of presetsQuery.data ?? []) map.set(preset.id, preset.name);
    return map;
  }, [presetsQuery.data]);

  const rows = useMemo(
    () => rowsForProject(conversationsQuery.data ?? [], projectId),
    [conversationsQuery.data, projectId],
  );
  const agentOptions = useMemo(() => deriveAgentOptions(rows, presetNames), [rows, presetNames]);
  const agentIds = useMemo(() => new Set(agentOptions.map((option) => option.id)), [agentOptions]);

  const [filter, setFilter] = useState<AgentFilter>('all');
  // Route change resets the Project-local filter (Plan §5.4); belt-and-braces
  // because the component is also unmounted by the identity gate.
  useEffect(() => {
    setFilter('all');
  }, [projectId]);

  // §8.4 permanent fallback: a confirmed dataset replacement that removed the
  // selected Agent resets to All and never silently resurrects on a later refill.
  useEffect(() => {
    if (filter !== 'all' && !agentIds.has(filter)) setFilter('all');
  }, [filter, agentIds]);

  const activeFilter = resolveAgentFilter(filter, agentIds);
  const visibleRows = applyAgentFilter(rows, activeFilter);

  return (
    <section className="project-section" aria-labelledby="project-convs-title">
      <div className="project-section-heading">
        <h2 id="project-convs-title" className="app-h2">
          会话
        </h2>
      </div>
      {presetsQuery.isError ? (
        <div className="app-banner" role="alert">
          Agent 名称加载失败，将显示 Agent 编号。
          <button type="button" className="app-link-btn" onClick={() => void presetsQuery.refetch()}>
            重试
          </button>
        </div>
      ) : null}
      {conversationsQuery.isPending ? (
        <LoadingState label="正在加载会话…" />
      ) : conversationsQuery.isError ? (
        <ErrorState
          title="会话加载失败"
          detail={toAppApiError(conversationsQuery.error).message}
          onRetry={() => void conversationsQuery.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="该项目还没有会话"
          hint="从 Chat Home 新建会话并选择该项目后，它会出现在这里。"
        />
      ) : (
        <>
          <div className="project-filter-bar" role="radiogroup" aria-label="会话筛选">
            <FilterOption
              label="全部"
              value="all"
              checked={activeFilter === 'all'}
              onChange={() => setFilter('all')}
            />
            {agentOptions.map((option) => (
              <FilterOption
                key={option.id}
                label={option.label}
                value={String(option.id)}
                checked={activeFilter === option.id}
                onChange={() => setFilter(option.id)}
              />
            ))}
          </div>
          <ul className="app-recent-list" aria-label="该项目下的会话">
            {visibleRows.map((row) => (
              <li key={row.id} className="app-recent-item">
                <Link to={`/chat/${row.id}`} className="app-recent-row">
                  <span className="app-recent-name">{row.name || `会话 #${row.id}`}</span>
                  <span className="app-recent-time">
                    {formatDateTime(row.lastMessageAt ?? row.createdAt)}
                  </span>
                  <span className="app-recent-meta">
                    <span className="app-chip project-chip-clamp">{agentLabel(row, presetNames)}</span>
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
  );
}

function ProjectDetail({ projectId }: { projectId: number }) {
  const detailQuery = useProjectDetailQuery(projectId);
  const updateMutation = useUpdateProjectMutation();
  const navigate = useNavigate();
  const [editInitial, setEditInitial] = useState<ProjectFormValues | null>(null);
  const [createConversationOpen, setCreateConversationOpen] = useState(false);
  const [deleteSessionId, setDeleteSessionId] = useState<number | null>(null);
  const nextDeleteSessionRef = useRef(0);

  // Route change closes/neutralizes mutation dialogs from the old origin.
  useEffect(() => {
    setEditInitial(null);
    setCreateConversationOpen(false);
    setDeleteSessionId(null);
  }, [projectId]);

  const closeEdit = useCallback(() => setEditInitial(null), []);
  const closeDelete = useCallback(() => setDeleteSessionId(null), []);

  const project = detailQuery.data;

  return (
    <div className="app-page">
      <header className="app-topbar app-topbar--detail">
        <Link to="/projects" className="app-back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          项目 Hub
        </Link>
        <div className="app-topbar-title app-topbar-title--detail">
          <h1 className="app-h1">项目详情</h1>
          {project ? <span className="app-topbar-sub project-chip-clamp">{project.name}</span> : null}
        </div>
      </header>

      <div className="app-scroll">
        {detailQuery.isPending ? (
          <LoadingState label="正在加载项目…" />
        ) : detailQuery.isError ? (
          toAppApiError(detailQuery.error).status === 404 ? (
            <ProjectMissingState />
          ) : (
            <ErrorState
              title="项目详情加载失败"
              detail={toAppApiError(detailQuery.error).message}
              onRetry={() => void detailQuery.refetch()}
            />
          )
        ) : project ? (
          <div className="project-profile">
            <section className="project-section" aria-labelledby="project-config-title">
              <div className="project-section-heading">
                <h2 id="project-config-title" className="app-h2 project-identity-name">
                  {project.name || `项目 #${project.id}`}
                </h2>
                <div className="project-section-actions">
                  <button
                    type="button"
                    className="app-btn"
                    onClick={() => setCreateConversationOpen(true)}
                  >
                    <MessageSquarePlus size={16} aria-hidden="true" />
                    开始会话
                  </button>
                  <button
                    type="button"
                    className="app-btn"
                    onClick={() =>
                      setEditInitial({
                        name: project.name,
                        description: project.description ?? '',
                        prompt: project.prompt ?? '',
                        workDir: project.workDir ?? '',
                      })
                    }
                  >
                    <Pencil size={16} aria-hidden="true" />
                    编辑
                  </button>
                  <button
                    type="button"
                    className="app-btn app-btn--danger"
                    onClick={() => setDeleteSessionId(++nextDeleteSessionRef.current)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    删除项目
                  </button>
                </div>
              </div>
              <p className="project-identity-desc">
                {displayValue(project.description, '暂无描述')}
              </p>
              <dl className="project-facts">
                <FactRow
                  label="System Prompt"
                  value={displayValue(project.prompt, '未设置 System Prompt')}
                />
                <FactRow
                  label="工作目录"
                  value={displayValue(project.workDir, '未绑定工作目录')}
                />
              </dl>
            </section>

            {/* B01: each resource section owns an ORIGIN LIFETIME (a
            projectId-change effect retires its dialogs/feedback); direct
            prop changes and cached-route navigation both clear the old
            origin's local state without relying on a remount. */}
            <ProjectFilesSection projectId={projectId} />
            <ProjectKnowledgeSection projectId={projectId} />

            <ProjectConversationLens projectId={projectId} />
          </div>
        ) : null}
      </div>

      {editInitial ? (
        <ProjectFormDialog
          mode="edit"
          initialValues={editInitial}
          mutation={updateMutation}
          onClose={closeEdit}
          onConfirmed={() => setEditInitial(null)}
          // F01: the PATCH target identity is captured at dialog open; it rides
          // inside the mutation variables so settling after a route switch
          // still refreshes THIS Project's facts.
          submitProjectId={project?.id}
        />
      ) : null}
      {createConversationOpen && project ? (
        <CreateConversationDialog
          fixedProject={{ id: project.id, name: project.name }}
          onClose={() => setCreateConversationOpen(false)}
          onCreated={(result) => {
            setCreateConversationOpen(false);
            navigate(`/chat/${result.conversationId}`);
          }}
        />
      ) : null}
      {deleteSessionId !== null && project ? (
        <ProjectDeleteDialog
          key={deleteSessionId}
          project={{ id: project.id, name: project.name }}
          sessionId={deleteSessionId}
          onClose={closeDelete}
          onDeleted={() => navigate('/projects')}
        />
      ) : null}
    </div>
  );
}

/**
 * P2B Project Detail (L2, Chat area) — Plan §6.2 / D1.
 * Direct route loads the exact Project; invalid syntax mounts zero child
 * requests; 404 (Archived/absent) is distinct from request/contract failure;
 * the identity gate blocks child sections until the Project is confirmed.
 */
export function ProjectDetailPage() {
  const { projectId } = useParams();
  if (!isValidProjectId(projectId)) return <InvalidProjectState />;
  // Separate component: invalid IDs mount no query hooks at all (no requests).
  return <ProjectDetail projectId={Number(projectId)} />;
}