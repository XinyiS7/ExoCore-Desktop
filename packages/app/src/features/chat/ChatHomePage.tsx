import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bot, FolderKanban, Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queries';
import type { CreateConversationResult } from './types';
import { RecentConversationList } from './RecentConversationList';
import { CreateConversationDialog } from './CreateConversationDialog';
import { MoreMenu } from '../../shell/PrimaryNavigation';

/**
 * V4 Chat Home — the package root.
 * P1A scope: Recent ordinary Conversations + the canonical create action.
 * No search, no Agent/Project Hub aggregation (those belong to P2).
 */
export function ChatHomePage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleCreated = (result: CreateConversationResult) => {
    setDialogOpen(false);
    // Canonical conversation_id is contract-required (P1A-B0); navigate once.
    navigate(`/chat/${result.conversationId}`);
  };

  const openCreate = () => setDialogOpen(true);
  const closeCreate = () => {
    setDialogOpen(false);
    void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
  };

  return (
    <div className="app-page">
      <header className="app-topbar">
        <div className="app-topbar-title">
          <h1 className="app-h1">Chat</h1>
          <span className="app-topbar-sub">最近会话 · V4 P1A</span>
        </div>
        <div className="app-topbar-actions">
          {/* P2A: secondary Chat-area entry into the Agent Hub (D4). */}
          <Link to="/agents" className="app-btn app-btn-ghost">
            <Bot size={16} aria-hidden="true" />
            Agent Hub
          </Link>
          {/* P2B: secondary Chat-area entry into the Project Hub (D8). */}
          <Link to="/projects" className="app-btn app-btn-ghost">
            <FolderKanban size={16} aria-hidden="true" />
            项目 Hub
          </Link>
          <button type="button" className="app-btn" onClick={openCreate}>
            <Plus size={16} aria-hidden="true" />
            新建会话
          </button>
          {/* X1 mobile: avatar/More lives in the page top bar; desktop keeps it in the sidebar. */}
          <MoreMenu className="app-more--top" />
        </div>
      </header>
      <RecentConversationList onRequestCreate={openCreate} />
      {dialogOpen ? <CreateConversationDialog onClose={closeCreate} onCreated={handleCreated} /> : null}
    </div>
  );
}
