// API core
export { baseUrl, getCsrfToken, apiFetch, MODEL_REGISTRY, AVAILABLE_MODELS, getConvProjectId } from './api';

// Auth
export { fetchCurrentUser, isAuthenticated } from './auth';

// Models
export { getModelInfo } from './models';

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
