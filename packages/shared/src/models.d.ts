/**
 * TypeScript declaration surface for `exo-shared/models` (V4, P1C).
 *
 * Declaration-only: runtime behavior lives in `models.js` and is NEVER
 * forked (Plan §5.2 — adjacent declaration allowed when strict TS cannot
 * otherwise consume the verified shared resolver).
 */

export interface ModelCatalogModel {
  name: string;
  family: string;
  abilities: string[];
  compatible_endpoint_ids: number[];
}

export interface ModelCatalogEndpoint {
  id: number;
  name: string;
  provider: string;
  execution_type: string;
  execution_adapter: string;
  payload_format: string;
  cache_transport: string;
  attachment_transports: string[];
  configured: boolean;
  enabled: boolean;
}

export interface ModelCatalogRoleMain {
  model: string;
  default_endpoint: number;
}

export interface ModelCatalog {
  models: ModelCatalogModel[];
  endpoints: ModelCatalogEndpoint[];
  roles: {
    main: ModelCatalogRoleMain[];
    support: Record<string, { model: string; default_endpoint: number }>;
  };
  providers: Array<{ id: number; display_name: string; execution_type: string }>;
}

export interface InitialSessionTarget {
  model: string;
  endpoint: number | null;
}

/**
 * Resolve the automatic initial target (model + endpoint) for a session.
 * Matches `resolveInitialSessionTarget(catalog, preset)` runtime behavior.
 */
export function resolveInitialSessionTarget(
  catalog: ModelCatalog | null | undefined,
  preset: { default_model?: string | null } | null | undefined,
): InitialSessionTarget;

export function getModelInfo(modelId: string): {
  provider: string;
  id: string;
  label: string;
  roles: string[];
};

export function getMainRoles(catalog: ModelCatalog | null | undefined): Array<{
  role?: string;
  model?: string;
  default_endpoint?: number;
  endpoint?: number;
}>;

export function getCompatibleEndpoints(
  catalog: ModelCatalog | null | undefined,
  modelName: string,
): ModelCatalogEndpoint[];

export function changeTargetModel(
  catalog: ModelCatalog | null | undefined,
  currentTarget: InitialSessionTarget | null,
  nextModel: string,
):
  | { model: string; endpoint: number | null; status: 'retained' }
  | { model: string; endpoint: number | null; status: 'switched'; changedTo: ModelCatalogEndpoint }
  | { model: string; endpoint: number | null; status: 'requires_select' }
  | { model: string; endpoint: number | null; status: 'no_endpoints' };