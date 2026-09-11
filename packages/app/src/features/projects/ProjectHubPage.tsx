import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useConversationsQuery, useProjectsQuery } from '../chat/queries';
import { toAppApiError } from '../chat/api';
import { EmptyState, ErrorState, LoadingState } from '../../shared/AsyncState';
import { useCreateProjectMutation } from './queries';
import { ProjectFormDialog } from './ProjectFormDialog';

/**
 * P2B Project Hub (L1, Chat area) — Plan §6.1 / D9.
 * Renders the backend array in backend order (never archived — the backend
 * queryset excludes "Archived Project"); no search/sort/pagination. Cards carry
 * a derived Conversation count from the SHARED Conversations cache; a
 * Conversation-query failure shows an explicit unavailable state, never zero,
 * and never erases Project cards.
 * Create: confirmed write invalidates the canonical Projects list (mutation
 * hook) and navigates EXACTLY once by the returned id (dialog origin guard).
 */
export function ProjectHubPage() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const projectsQuery = useProjectsQuery();
  const conversationsQuery = useConversationsQuery();
  const createMutation = useCreateProjectMutation();

  const openCreate = useCallback(() => setDialogOpen(true), []);
  const closeCreate = useCallback(() => setDialogOpen(false), []);

  const countState = (projectId: number): { text: string; error: boolean } => {
    if (conversationsQuery.isError) return { text: '会话数暂不可用', error: true };
    if (!conversationsQuery.data) return { text: '正在统计会话…', error: false };
    const count = conversationsQuery.data.filter((row) => row.projectId === projectId).length;
    return { text: `${count} 个会话`, error: false };
  };

  return (
    <div className="app-page">
      <header className="app-topbar">
        <div className="app-topbar-title">
          <h1 className="app-h1">项目</h1>
          <span className="app-topbar-sub">项目工作区 · 后端顺序</span>
        </div>
        <div className="app-topbar-actions">
          <button type="button" className="app-btn" onClick={openCreate}>
            <Plus size={16} aria-hidden="true" />
            新建项目
          </button>
        </div>
      </header>

      <div className="app-scroll">
        {projectsQuery.isPending ? (
          <LoadingState label="正在加载项目…" />
        ) : projectsQuery.isError ? (
          <ErrorState
            title="项目列表加载失败"
            detail={toAppApiError(projectsQuery.error).message}
            onRetry={() => void projectsQuery.refetch()}
          />
        ) : (projectsQuery.data ?? []).length === 0 ? (
          <EmptyState
            title="还没有项目"
            hint="创建第一个项目，集中管理它的会话与文件。"
            action={
              <button type="button" className="app-btn" onClick={openCreate}>
                <Plus size={16} aria-hidden="true" />
                新建项目
              </button>
            }
          />
        ) : (
          <ul className="project-hub-grid" aria-label="项目列表">
            {projectsQuery.data.map((project) => {
              const count = countState(project.id);
              return (
                <li key={project.id}>
                  <Link to={`/projects/${project.id}`} className="project-card">
                    <span className="project-card-name">{project.name || `项目 #${project.id}`}</span>
                    {project.description ? (
                      <span className="project-card-desc">{project.description}</span>
                    ) : null}
                    <span className={`project-card-meta${count.error ? ' project-card-meta--error' : ''}`}>
                      {project.work_dir ? <span className="project-chip-clamp">{project.work_dir}</span> : null}
                      <span>{count.text}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {dialogOpen ? (
        <ProjectFormDialog
          mode="create"
          mutation={createMutation}
          onClose={closeCreate}
          onConfirmed={(project) => {
            setDialogOpen(false);
            navigate(`/projects/${project.id}`);
          }}
        />
      ) : null}
    </div>
  );
}