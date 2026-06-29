import React, { createContext, useContext, useState, useCallback } from 'react';
import NewSessionModal from '../components/modals/NewSessionModal';
import DestructorModal from '../components/modals/DestructorModal';
import CreateProjectModal from '../components/modals/CreateProjectModal';
import CreatePresetModal from '../components/modals/CreatePresetModal';

const ModalContext = createContext(null);

/**
 * ModalProvider — lifts modal state above Routes so modals are rendered
 * exactly once and available from every page.  Previously each route
 * component called useAppStateBridge() independently, creating isolated
 * modal states — so NewSessionModal / DestructorModal only actually
 * appeared on the Dashboard route.
 */
export function ModalProvider({ children, appState, setView }) {
  const [newSessionConfig, setNewSessionConfig] = useState({
    isOpen: false,
    initialContext: null,
    onSuccess: null,
  });
  const [destructorConfig, setDestructorConfig] = useState({
    isOpen: false,
    title: '',
    description: '',
    onArchive: null,
    onDelete: null,
  });
  const [createProjectConfig, setCreateProjectConfig] = useState({ isOpen: false });
  const [createPresetConfig, setCreatePresetConfig] = useState({ isOpen: false, onSuccess: null });

  const openNewSession = useCallback(
    (ctx, cb) => setNewSessionConfig({ isOpen: true, initialContext: ctx, onSuccess: cb || null }),
    [],
  );
  const closeNewSession = useCallback(
    () => setNewSessionConfig({ isOpen: false, initialContext: null, onSuccess: null }),
    [],
  );

  const openDestructor = useCallback(
    (cfg) => setDestructorConfig({ ...cfg, isOpen: true }),
    [],
  );
  const closeDestructor = useCallback(
    () => setDestructorConfig({ isOpen: false }),
    [],
  );

  const openCreateProject = useCallback(
    () => setCreateProjectConfig({ isOpen: true }),
    [],
  );
  const closeCreateProject = useCallback(
    () => setCreateProjectConfig({ isOpen: false }),
    [],
  );

  const openCreatePreset = useCallback(
    (cb) => setCreatePresetConfig({ isOpen: true, onSuccess: cb || null }),
    [],
  );
  const closeCreatePreset = useCallback(
    () => setCreatePresetConfig({ isOpen: false, onSuccess: null }),
    [],
  );

  const ctx = {
    newSessionConfig,
    openNewSession,
    closeNewSession,
    destructorConfig,
    openDestructor,
    closeDestructor,
    createProjectConfig,
    openCreateProject,
    closeCreateProject,
    createPresetConfig,
    openCreatePreset,
    closeCreatePreset,
  };

  // ── onSuccess fallback for NewSessionModal ──
  const handleSessionCreated = useCallback(
    (sessionId) => {
      if (newSessionConfig.onSuccess) {
        newSessionConfig.onSuccess(sessionId);
      } else {
        // Default: navigate to the new session
        appState.setActiveSessionId(sessionId);
        setView('chat', { sessionId, sessionTitle: '' });
      }
    },
    [newSessionConfig.onSuccess, appState.setActiveSessionId, setView],
  );

  return (
    <ModalContext.Provider value={ctx}>
      {children}

      {/* ── Modals rendered at provider level, available on every route ── */}
      {newSessionConfig.isOpen && (
        <NewSessionModal
          isOpen={newSessionConfig.isOpen}
          onClose={closeNewSession}
          projects={appState.projects}
          presets={appState.presets}
          initialContext={newSessionConfig.initialContext}
          onSuccess={handleSessionCreated}
          setActiveSessionId={appState.setActiveSessionId}
          setView={setView}
        />
      )}

      {destructorConfig.isOpen && (
        <DestructorModal
          isOpen={destructorConfig.isOpen}
          onClose={closeDestructor}
          title={destructorConfig.title}
          description={destructorConfig.description}
          onArchive={destructorConfig.onArchive}
          onDelete={destructorConfig.onDelete}
        />
      )}

      {createProjectConfig.isOpen && (
        <CreateProjectModal
          isOpen={createProjectConfig.isOpen}
          onClose={closeCreateProject}
          setProjects={appState.setProjects}
        />
      )}

      {createPresetConfig.isOpen && (
        <CreatePresetModal
          isOpen={createPresetConfig.isOpen}
          onClose={closeCreatePreset}
          onCreated={() => {
            createPresetConfig.onSuccess?.();
          }}
        />
      )}
    </ModalContext.Provider>
  );
}

export function useModalContext() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModalContext must be used inside <ModalProvider>');
  return ctx;
}