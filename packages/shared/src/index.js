// API core
export { baseUrl, getCsrfToken, apiFetch, MODEL_REGISTRY, AVAILABLE_MODELS, MAIN_MODEL_IDS, getConvProjectId } from './api';

// Auth
export { fetchCurrentUser, isAuthenticated } from './auth';

// Models
export { getModelInfo, getMainRoles, getCompatibleEndpoints, resolveInitialSessionTarget, changeTargetModel } from './models';

// Hooks
export { useApi } from './hooks/useApi';
export { useCsrf } from './hooks/useCsrf';

// Endpoints (namespaced re-exports to avoid collisions)
export * as agentsApi        from './endpoints/agents';
export * as conversationsApi from './endpoints/conversations';
export * as chronicleApi     from './endpoints/chronicle';
export * as projectsApi      from './endpoints/projects';
export * as tweetsApi        from './endpoints/tweets';
export * as configApi        from './endpoints/config';
export * as memoryApi        from './endpoints/memory';
export * as tasksApi         from './endpoints/tasks';
export * as telemetryApi     from './endpoints/telemetry';
export * as systemApi        from './endpoints/system';
export * as pushApi          from './endpoints/push';
export * as groupchatApi     from './endpoints/groupchat';
export * as heartbeatApi     from './endpoints/heartbeat';

// Profile — unified user identity (avatar, nickname, agent avatars)
export { getUserAvatar, setUserAvatar, getUserNick, setUserNick, getAgentAvatar, setAgentAvatar, getAllAgentAvatars } from './profile';

// Hooks — useProfile and useFont
export { useProfile } from './hooks/useProfile';
export { useFont, AVAILABLE_FONTS, FONT_SCALE_CONFIG, getFontStack } from './hooks/useFont';
export { useTheme, THEMES } from './hooks/useTheme';

// Avatar utility
export { resizeAndStoreAvatar } from './utils/avatar';
