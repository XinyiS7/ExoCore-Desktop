import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import ChatArea from './ChatArea';
import StageHeader from './StageHeader';
import ProjectFilesDrawer from '../project/ProjectFilesDrawer';
import { conversationsApi, projectsApi } from 'exo-shared';

/**
 * ChatShell — the outer shell that hosts ChatArea.
 *
 * Responsibilities:
 * - StageHeader with back-navigation context
 * - ChatArea (the core conversation container)
 * - ProjectFilesDrawer (right slide-out, project context only)
 * - useProjectFilesPoller heartbeat
 */
export default function ChatShell({
  presets,
  activeSessionId,
  setActiveSessionId,
  setRefreshKey,
  openNewSession,
  openDestructor,
}) {
  const { sessionId } = useParams();
  const location = useLocation();
  const state = location.state || {};

  const [project, setProject] = useState(null);
  const [filesDrawerOpen, setFilesDrawerOpen] = useState(false);
  const [projectFiles, setProjectFiles] = useState([]);

  // Resolve session ID from URL param or active session
  const resolvedSessionId = sessionId ? Number(sessionId) : activeSessionId;

  // Sync active session
  useEffect(() => {
    if (resolvedSessionId && resolvedSessionId !== activeSessionId) {
      setActiveSessionId(resolvedSessionId);
    }
  }, [resolvedSessionId, activeSessionId, setActiveSessionId]);

  // Load project info if in project context
  useEffect(() => {
    if (state.from === 'project' && state.projectId) {
      projectsApi.getProject(state.projectId)
        .then(setProject)
        .catch(() => setProject(null));
    } else {
      setProject(null);
    }
  }, [state.from, state.projectId]);

  // ---- Project files polling heartbeat ----
  const pollIntervalRef = useRef(null);

  const fetchProjectFiles = useCallback(() => {
    if (!project?.id) return;
    projectsApi.listProjectFiles(project.id)
      .then(data => setProjectFiles(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [project?.id]);

  // Poll every 30s when ProjectFilesDrawer is open or project has work_dir
  useEffect(() => {
    if (!project?.id) return;
    // Initial fetch
    fetchProjectFiles();
    // Set up interval
    pollIntervalRef.current = setInterval(fetchProjectFiles, 30000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [project?.id, fetchProjectFiles]);

  // Derive a stable session key for ChatArea
  const chatKey = resolvedSessionId ? `chat-${resolvedSessionId}` : 'chat-empty';

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-chat-bg relative">
      {/* Stage Header */}
      <StageHeader
        onToggleFilesDrawer={() => setFilesDrawerOpen(v => !v)}
        project={project}
      />

      {/* ChatArea */}
      <ChatArea
        key={chatKey}
        activeSessionId={resolvedSessionId}
        setActiveSessionId={setActiveSessionId}
        setRefreshKey={setRefreshKey}
        setShowConvList={() => {}}
        openNewSession={openNewSession}
        presets={presets}
        onBack={() => {}} // Always truthy → v2 header mode
      />

      {/* Project Files Drawer */}
      <ProjectFilesDrawer
        isOpen={filesDrawerOpen}
        onClose={() => setFilesDrawerOpen(false)}
        project={project}
        projectFiles={projectFiles}
      />
    </div>
  );
}
