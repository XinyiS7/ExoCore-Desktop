import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ModelCatalog } from 'exo-shared/models';
import { AppApiError } from '../features/chat/api';
import {
  createApiKey,
  createEndpoint,
  putRoleConfig,
} from '../features/settings/api';
import { validateModelCatalog } from '../shared/modelCatalog';
import {
  ensureTestLocalStorage,
  installFetch,
  jsonResponse,
  renderApp,
  unmockFetch,
} from '../test/helpers';

const completeCatalog: ModelCatalog = {
  models: [
    {
      name: 'model-a',
      family: 'deepseek',
      abilities: ['fc'],
      compatible_endpoint_ids: [1, 2],
    },
  ],
  endpoints: [
    {
      id: 1,
      name: 'Usable direct',
      provider: 'deepseek',
      execution_type: 'direct_api',
      execution_adapter: 'internal_http',
      payload_format: 'openai',
      cache_transport: 'inline_chunk',
      attachment_transports: ['inline_text'],
      configured: true,
      enabled: true,
    },
    {
      id: 2,
      name: 'Disabled direct',
      provider: 'deepseek',
      execution_type: 'direct_api',
      execution_adapter: 'internal_http',
      payload_format: 'openai',
      cache_transport: 'inline_chunk',
      attachment_transports: ['inline_text'],
      configured: true,
      enabled: false,
    },
  ],
  roles: {
    main: [{ model: 'model-a', default_endpoint: 1, position: 0 }],
    support: {
      general_sub_agent: { model: 'model-a', default_endpoint: 1 },
      vision_helper: { model: 'model-a', default_endpoint: 1 },
      grounding: { model: 'model-a', default_endpoint: 1 },
      image_gen: { model: 'model-a', default_endpoint: 1 },
    },
  },
  providers: [
    {
      id: 'deepseek',
      display_name: 'DeepSeek',
      execution_type: 'direct_api',
      execution_adapter: 'internal_http',
      requires_endpoint_api_key: true,
    },
  ],
};

const endpointRows = [
  {
    id: 1,
    name: 'Usable direct',
    provider: 'deepseek',
    api_key_alias: 'main-key',
    enabled: true,
    configured: true,
    execution_type: 'direct_api',
    execution_adapter: 'internal_http',
  },
];

const apiKeyRows = [
  {
    alias: 'main-key',
    platform: 'deepseek',
    last_four: '1234',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
];

function expectAmbiguousContract(error: unknown): void {
  expect(error).toBeInstanceOf(AppApiError);
  expect((error as AppApiError).code).toBe('CONTRACT');
  expect((error as AppApiError).ambiguousWrite).toBe(true);
}

describe('P2C CP C-3 independent acceptance', () => {
  beforeEach(() => {
    ensureTestLocalStorage();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    unmockFetch();
  });

  it('rejects catalogs missing required provider, execution, or complete support facts', () => {
    const missingProviders = { ...completeCatalog, providers: undefined };
    const missingExecution = {
      ...completeCatalog,
      endpoints: completeCatalog.endpoints.map((endpoint, index) =>
        index === 0 ? { ...endpoint, execution_type: undefined } : endpoint,
      ),
    };
    const missingSupportRole = {
      ...completeCatalog,
      roles: {
        ...completeCatalog.roles,
        support: {
          general_sub_agent: completeCatalog.roles.support.general_sub_agent,
          vision_helper: completeCatalog.roles.support.vision_helper,
          grounding: completeCatalog.roles.support.grounding,
        },
      },
    };

    expect(() => validateModelCatalog(missingProviders)).toThrow(AppApiError);
    expect(() => validateModelCatalog(missingExecution)).toThrow(AppApiError);
    expect(() => validateModelCatalog(missingSupportRole)).toThrow(AppApiError);
  });

  it('marks malformed successful endpoint, key, and whole-role writes as ambiguous', async () => {
    installFetch([
      {
        test: '/api/core/endpoints/',
        method: 'POST',
        handler: () => jsonResponse({ id: 9, name: 'partial' }),
      },
      {
        test: '/api/core/apikeys/',
        method: 'POST',
        handler: () => jsonResponse({ alias: 'partial' }),
      },
      {
        test: '/api/core/config/roles/',
        method: 'PUT',
        handler: () => jsonResponse({}),
      },
    ]);

    await createEndpoint({
      name: 'new endpoint',
      provider: 'deepseek',
      api_key_alias: 'main-key',
      enabled: true,
    }).then(
      () => expect.unreachable('malformed endpoint write must reject'),
      expectAmbiguousContract,
    );

    await createApiKey({
      alias: 'new-key',
      platform: 'deepseek',
      key_value: 'secret-value',
    }).then(
      () => expect.unreachable('malformed API key write must reject'),
      expectAmbiguousContract,
    );

    await putRoleConfig({
      main: [{
        model: 'model-a',
        default_endpoint: 1,
        style_shadow: null,
        position: 0,
      }],
      support: {
        general_sub_agent: { model: 'model-a', default_endpoint: 1 },
        vision_helper: { model: 'model-a', default_endpoint: 1 },
        grounding: { model: 'model-a', default_endpoint: 1 },
        image_gen: { model: 'model-a', default_endpoint: 1 },
      },
    }).then(
      () => expect.unreachable('malformed role write must reject'),
      expectAmbiguousContract,
    );
  });

  it('shows backend field validation details inside endpoint write dialogs', async () => {
    installFetch([
      { test: '/api/core/model-catalog/', handler: () => jsonResponse(completeCatalog) },
      { test: '/api/core/endpoints/', method: 'GET', handler: () => jsonResponse(endpointRows) },
      { test: '/api/core/apikeys/', method: 'GET', handler: () => jsonResponse(apiKeyRows) },
      {
        test: '/api/core/endpoints/',
        method: 'POST',
        handler: () => jsonResponse({ name: ['This endpoint name is already in use.'] }, 400),
      },
    ]);

    renderApp(['/settings/keys'], { redirectSettings: true });
    fireEvent.click(await screen.findByRole('button', { name: '新建端点' }));
    fireEvent.change(screen.getByLabelText('端点名称 *'), { target: { value: 'duplicate' } });
    fireEvent.change(screen.getByLabelText('绑定 API Key 别名'), { target: { value: 'main-key' } });
    fireEvent.click(screen.getByRole('button', { name: '创建端点' }));

    expect(await screen.findByText('This endpoint name is already in use.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('keeps provider writable when editing an endpoint and uses catalog providers only', async () => {
    const twoProviderCatalog: ModelCatalog = {
      ...completeCatalog,
      providers: [
        ...completeCatalog.providers,
        {
          id: 'gemini',
          display_name: 'Gemini',
          execution_type: 'direct_api',
          execution_adapter: 'internal_http',
          requires_endpoint_api_key: true,
        },
      ],
    };
    installFetch([
      { test: '/api/core/model-catalog/', handler: () => jsonResponse(twoProviderCatalog) },
      { test: '/api/core/endpoints/', method: 'GET', handler: () => jsonResponse(endpointRows) },
      { test: '/api/core/apikeys/', method: 'GET', handler: () => jsonResponse(apiKeyRows) },
    ]);

    renderApp(['/settings/keys']);
    fireEvent.click(await screen.findByRole('button', { name: '编辑端点 Usable direct' }));

    const provider = screen.getByLabelText('供应商 Provider *') as HTMLSelectElement;
    expect(provider).toBeEnabled();
    expect(Array.from(provider.options).map((option) => option.value)).toEqual([
      'deepseek',
      'gemini',
    ]);
  });

  it('never offers a disabled current endpoint as a selectable role target', async () => {
    const staleRoleCatalog: ModelCatalog = {
      ...completeCatalog,
      roles: {
        main: [{ model: 'model-a', default_endpoint: 2, position: 0 }],
        support: completeCatalog.roles.support,
      },
    };
    installFetch([
      { test: '/api/core/model-catalog/', handler: () => jsonResponse(staleRoleCatalog) },
    ]);

    renderApp(['/settings/models']);

    const selector = await screen.findByLabelText('通道端点 (Endpoint)', {
      selector: '#main-role-endpoint-0',
    });
    const options = Array.from((selector as HTMLSelectElement).options);
    expect(options.map((option) => option.value)).toEqual(['1']);
    expect(screen.queryByText(/Disabled direct/)).toBeNull();
  });

  it('only offers FC-capable endpoint-compatible models as style shadows', async () => {
    const shadowCatalog: ModelCatalog = {
      ...completeCatalog,
      models: [
        ...completeCatalog.models,
        {
          name: 'no-fc-shadow',
          family: 'deepseek',
          abilities: [],
          compatible_endpoint_ids: [1],
        },
        {
          name: 'wrong-endpoint-shadow',
          family: 'gemini',
          abilities: ['fc'],
          compatible_endpoint_ids: [],
        },
      ],
    };
    installFetch([
      { test: '/api/core/model-catalog/', handler: () => jsonResponse(shadowCatalog) },
    ]);

    renderApp(['/settings/models']);

    const shadow = await screen.findByLabelText('风格阴影模型 (可选)');
    expect(Array.from((shadow as HTMLSelectElement).options).map((option) => option.value)).toEqual([
      '',
      'model-a',
    ]);
  });
});
