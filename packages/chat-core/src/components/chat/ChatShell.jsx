import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import ChatArea from './ChatArea';
import StageHeader from './StageHeader';
import ProjectFilesDrawer from '../project/ProjectFilesDrawer';
import { conversationsApi, projectsApi, getConvProjectId } from 'exo-shared';

/**
 * ChatShell — the outer shell that hosts ChatArea.
 *
 * Responsibilities:
 * - StageHeader with back-navigation context
 * - ChatArea (the core conversation container)
 * - ProjectFilesDrawer (right slide-out, project context only)
 * - Session → project → work_dir resolution (ANY entry point)
 * - Directory tree fetch + 30s polling + lazy load
 * - pendingInsert callback line: Drawer → ChatArea
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
  const [fileTree, setFileTree] = useState(null);           // { path, entries: [...] }
  const [treeLoading, setTreeLoading] = useState(false);
  const [pendingInsert, setPendingInsert] = useState(null);  // { path, type } | null

  // Resolve session ID from URL param or active session
  const resolvedSessionId = sessionId ? Number(sessionId) : activeSessionId;

  // Sync active session
  useEffect(() => {
    if (resolvedSessionId && resolvedSessionId !== activeSessionId) {
      setActiveSessionId(resolvedSessionId);
    }
  }, [resolvedSessionId, activeSessionId, setActiveSessionId]);

  // Resolve project from session → conversation.project → project.work_dir
  // Works for ANY session entry point (home, agent, project detail, etc.)
  useEffect(() => {
    if (!resolvedSessionId) return;
    let cancelled = false;

    conversationsApi.getConversation(resolvedSessionId)
      .then(conv => {
        if (cancelled) return;
        const pid = getConvProjectId(conv);
        if (pid && pid !== 0) {
          return projectsApi.getProject(pid);
        }
        return null;
      })
      .then(proj => {
        if (cancelled) return;
        if (proj) {
          setProject(proj);
        } else {
          setProject(null);
          setFileTree(null);
        }
      })
      .catch(() => {
        if (!cancelled) { setProject(null); setFileTree(null); }
      });

    return () => { cancelled = true; };
  }, [resolvedSessionId]);

  // ---- Project files polling heartbeat ----
  const pollIntervalRef = useRef(null);

  const fetchProjectFiles = useCallback(() => {
    if (!project?.id) return;
    projectsApi.listProjectFiles(project.id)
      .then(data => setProjectFiles(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [project?.id]);

  // ---- Directory tree fetch (single request, backend returns full tree) ----

  /**
   * Fetch the project's work_dir directory tree.
   * Backend handles: recursive scan, exclude rules, sorting.
   * Frontend receives a static nested structure and searches it locally.
   * Subdirectory lazy-load: fetchFileTree(dirPath) for single-level loading
   * when the user expands a directory in the Drawer that hasn't been loaded yet.
   */
  const fetchFileTree = useCallback((relPath = '') => {
    if (!project?.id || !project?.work_dir) return;
    setTreeLoading(true);
    projectsApi.listDirectory(project.id, relPath)
      .then(data => {
        if (relPath) {
          // Merge subdirectory result into existing tree
          setFileTree(prev => {
            if (!prev) return data;
            const clone = JSON.parse(JSON.stringify(prev));
            const parts = relPath.split('/').filter(Boolean);
            let node = clone;
            for (const part of parts) {
              const child = node.entries?.find(e => e.name === part && e.type === 'dir');
              if (!child) return prev;
              node = child;
            }
            node.entries = data.entries;
            return clone;
          });
        } else {
          setFileTree(data);
        }
      })
      .catch(() => {})
      .finally(() => setTreeLoading(false));
  }, [project?.id, project?.work_dir]);

  // Initial fetch + 30s polling
  useEffect(() => {
    if (!project?.id) return;
    fetchProjectFiles();
    fetchFileTree();  // Single request — backend returns full recursive tree
    pollIntervalRef.current = setInterval(() => {
      fetchProjectFiles();
      if (project?.work_dir) fetchFileTree();
    }, 30000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [project?.id, fetchProjectFiles, fetchFileTree]);

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
        fileTree={fileTree}
        pendingInsert={pendingInsert}
        onInsertConsumed={() => setPendingInsert(null)}
        onLoadDirectory={fetchFileTree}
        project={project}
      />

      {/* Project Files Drawer */}
      <ProjectFilesDrawer
        isOpen={filesDrawerOpen}
        onClose={() => setFilesDrawerOpen(false)}
        project={project}
        projectFiles={projectFiles}
        fileTree={fileTree}
        treeLoading={treeLoading}
        onLoadDirectory={fetchFileTree}
        onFileClick={(path, type) => {
          setPendingInsert({ path, type });
          setFilesDrawerOpen(false);
        }}
      />
    </div>
  );
}
