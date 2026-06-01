import { useState, useEffect } from 'react';
import { baseUrl } from '../utils/api';
import { listCouncilSessions } from '../utils/councilApi';

export function useAppState() {
  const [activeSessionId, setActiveSessionId] = useState(() => {
    const saved = localStorage.getItem('exo_active_session');
    return saved ? Number(saved) : null;
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [projects, setProjects] = useState([]);
  const [presets, setPresets] = useState([]);
  const [activeFileProjectId, setActiveFileProjectId] = useState(null);

  // Council state
  const [activeCouncilId, setActiveCouncilId] = useState(null);
  const [councilSessions, setCouncilSessions] = useState([]);

  // Modals
  const [destructorConfig, setDestructorConfig] = useState({ isOpen: false });
  const [newSessionConfig, setNewSessionConfig] = useState({ isOpen: false, initialContext: null });
  const [createProjectConfig, setCreateProjectConfig] = useState({ isOpen: false });
  const [showCouncilCreate, setShowCouncilCreate] = useState(false);

  // Profile panel
  const [showProfilePanel, setShowProfilePanel] = useState(false);

  // Persist activeSessionId
  useEffect(() => {
    if (activeSessionId) localStorage.setItem('exo_active_session', String(activeSessionId));
    else localStorage.removeItem('exo_active_session');
  }, [activeSessionId]);

  // Fetch projects & presets on mount
  useEffect(() => {
    fetch(`${baseUrl}/api/core/projects/`, { credentials: 'include' })
      .then(res => res.json())
      .then(setProjects)
      .catch(err => console.error('Projects load failed', err));

    fetch(`${baseUrl}/api/agents/presets/`, { credentials: 'include' })
      .then(res => res.json())
      .then(setPresets)
      .catch(err => console.error('Presets load failed', err));
  }, []);

  const refreshPresets = () => {
    fetch(`${baseUrl}/api/agents/presets/`, { credentials: 'include' })
      .then(res => res.json())
      .then(setPresets)
      .catch(err => console.error('Presets refresh failed', err));
  };

  const refreshCouncilSessions = () => {
    listCouncilSessions()
      .then(setCouncilSessions)
      .catch(err => console.error('Council list load failed:', err));
  };

  useEffect(() => { refreshCouncilSessions(); }, [refreshKey]);

  const openDestructor = (config) => setDestructorConfig({ ...config, isOpen: true });
  const openNewSession = (initialContext = null, onSuccess = null) => setNewSessionConfig({ isOpen: true, initialContext, onSuccess });
  const openCreateProject = () => setCreateProjectConfig({ isOpen: true });

  return {
    // Data
    projects, setProjects,
    presets, setPresets,
    // Session
    activeSessionId, setActiveSessionId,
    refreshKey, setRefreshKey,
    activeFileProjectId, setActiveFileProjectId,
    // Council
    activeCouncilId, setActiveCouncilId,
    councilSessions, setCouncilSessions,
    showCouncilCreate, setShowCouncilCreate,
    // Modals
    destructorConfig, setDestructorConfig,
    newSessionConfig, setNewSessionConfig,
    createProjectConfig, setCreateProjectConfig,
    openDestructor, openNewSession, openCreateProject,
    // Profile
    showProfilePanel, setShowProfilePanel,
    // Refresh
    refreshPresets, refreshCouncilSessions,
  };
}
