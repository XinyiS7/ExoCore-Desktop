/**
 * #126 模型角色面板：主模型下拉避重、新增行避重、保存后 draft 直接来自响应体。
 *
 * 这里最关键的回归是「保存成功后 draft 被旧缓存刷回」：ModelRolesPanel 的
 * useEffect 在 !isDirty 时用 catalogQuery.data.roles 覆盖 draft，如果 mutation
 * 只 invalidate 而不先 setQueryData，refetch 未返回前缓存仍是旧配置，刚保存的
 * 结果会被立刻覆盖回去。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { jsonResponse, MockRoute, renderApp, unmockFetch } from './helpers';
import type { ModelCatalog } from 'exo-shared/models';
import { getErrorMessage } from '../features/settings/api';
import type { RoleConfigPayload } from '../features/settings/types';

const baseCatalog: ModelCatalog = {
  models: [
    {
      name: 'deepseek-v4-pro',
      family: 'deepseek',
      abilities: ['chat', 'fc'],
      compatible_endpoint_ids: [1],
    },
    {
      name: 'gemini-2.5-flash',
      family: 'gemini',
      abilities: ['chat', 'vision', 'fc'],
      compatible_endpoint_ids: [2],
    },
    {
      name: 'flux-1-schnell',
      family: 'flux',
      abilities: ['image_gen', 'fc'],
      compatible_endpoint_ids: [3],
    },
  ],
  endpoints: [
    {
      id: 1,
      name: 'DeepSeek Direct',
      provider: 'deepseek',
      configured: true,
      enabled: true,
      execution_type: 'direct_api',
      execution_adapter: 'internal_http',
      payload_format: 'openai',
      cache_transport: 'inline_chunk',
      attachment_transports: ['inline_text'],
    },
    {
      id: 2,
      name: 'Gemini Direct',
      provider: 'gemini',
      configured: true,
      enabled: true,
      execution_type: 'direct_api',
      execution_adapter: 'internal_http',
      payload_format: 'gemini',
      cache_transport: 'remote_reference',
      attachment_transports: ['inline_text'],
    },
    {
      id: 3,
      name: 'Gemini Image',
      provider: 'gemini',
      configured: true,
      enabled: true,
      execution_type: 'direct_api',
      execution_adapter: 'internal_http',
      payload_format: 'gemini',
      cache_transport: 'remote_reference',
      attachment_transports: ['inline_text'],
    },
  ],
  roles: {
    main: [
      { model: 'deepseek-v4-pro', default_endpoint: 1, style_shadow: null, position: 0 },
      { model: 'gemini-2.5-flash', default_endpoint: 2, style_shadow: null, position: 1 },
    ],
    support: {
      general_sub_agent: { model: 'deepseek-v4-pro', default_endpoint: 1 },
      vision_helper: { model: 'gemini-2.5-flash', default_endpoint: 2 },
      grounding: { model: 'gemini-2.5-flash', default_endpoint: 2 },
      image_gen: { model: 'flux-1-schnell', default_endpoint: 3 },
    },
  },
  providers: [
    { id: 'deepseek', display_name: 'DeepSeek', execution_type: 'direct_api' },
    { id: 'gemini', display_name: 'Gemini', execution_type: 'direct_api' },
  ],
} as ModelCatalog;

function mainSelect(index: number): HTMLSelectElement {
  return screen.getByLabelText('基础模型', {
    selector: `#main-role-model-${index}`,
  }) as HTMLSelectElement;
}

function optionValues(select: HTMLSelectElement): string[] {
  return Array.from(select.options).map((option) => option.value);
}

describe('#126 model roles panel dedup and post-save draft', () => {
  let activeRoutes: MockRoute[] = [];

  const installFetch = () => {
    globalThis.fetch = vi.fn().mockImplementation((req: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof req === 'string' ? req : req instanceof URL ? req.toString() : req.url;
      const method = (
        init?.method ?? (typeof req === 'object' && 'method' in req ? req.method : 'GET')
      ).toUpperCase();
      for (let i = activeRoutes.length - 1; i >= 0; i--) {
        const route = activeRoutes[i];
        const matchesUrl =
          typeof route.test === 'string' ? urlStr.includes(route.test) : route.test.test(urlStr);
        const matchesMethod = !route.method || route.method.toUpperCase() === method;
        if (matchesUrl && matchesMethod) {
          return route.handler(new URL(urlStr, 'http://localhost'), init);
        }
      }
      return jsonResponse({ detail: 'Not Found' }, { status: 404 });
    }) as unknown as typeof fetch;
  };

  beforeEach(() => {
    unmockFetch();
    activeRoutes = [
      { test: '/api/core/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/core/model-catalog/', handler: () => jsonResponse(baseCatalog) },
    ];
    installFetch();
  });

  afterEach(() => {
    cleanup();
    unmockFetch();
  });

  it('主模型下拉过滤掉其它行已选的模型，并保留本行当前值', async () => {
    renderApp(['/settings/models']);
    await screen.findByText('主模型角色 (Main Roles)');

    // 第 1 行当前是 deepseek-v4-pro，不允许选走第 2 行的 gemini-2.5-flash
    expect(optionValues(mainSelect(0))).toEqual(['deepseek-v4-pro', 'flux-1-schnell']);
    // 第 2 行当前是 gemini-2.5-flash，不允许与第 1 行重复
    expect(optionValues(mainSelect(1))).toEqual(['gemini-2.5-flash', 'flux-1-schnell']);
  });

  it('添加主角色使用第一个未被占用的模型', async () => {
    renderApp(['/settings/models']);
    await screen.findByText('主模型角色 (Main Roles)');

    fireEvent.click(screen.getByRole('button', { name: '添加主角色' }));

    await waitFor(() => expect(screen.getByRole('button', { name: '删除角色 #3' })).toBeInTheDocument());
    expect(mainSelect(2).value).toBe('flux-1-schnell');
  });

  it('所有模型都被占用时拒绝新增并给出中文原因', async () => {
    activeRoutes.push({
      test: '/api/core/model-catalog/',
      handler: () =>
        jsonResponse({
          ...baseCatalog,
          roles: {
            ...baseCatalog.roles,
            main: [
              ...baseCatalog.roles.main,
              { model: 'flux-1-schnell', default_endpoint: 3, style_shadow: null, position: 2 },
            ],
          },
        }),
    });
    renderApp(['/settings/models']);
    await screen.findByText('主模型角色 (Main Roles)');

    fireEvent.click(screen.getByRole('button', { name: '添加主角色' }));

    expect(
      await screen.findByText(/所有已登记模型都已被主模型池占用，无法再添加主角色/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '删除角色 #4' })).toBeNull();
  });

  it('保存成功后用响应体重建 draft，且 refetch 未返回时不会被旧缓存刷回', async () => {
    let catalogCalls = 0;
    const savedConfig: RoleConfigPayload = {
      main: [
        { model: 'deepseek-v4-pro', default_endpoint: 1, style_shadow: null, position: 0 },
      ],
      support: baseCatalog.roles.support,
    };

    activeRoutes.push({
      // 首次加载给完整目录；保存后的 invalidate refetch 永不返回，模拟慢网络
      test: '/api/core/model-catalog/',
      handler: () => {
        catalogCalls += 1;
        if (catalogCalls > 1) return new Promise<Response>(() => {});
        return jsonResponse(baseCatalog);
      },
    });
    activeRoutes.push({
      test: '/api/core/config/roles/',
      method: 'PUT',
      handler: () => jsonResponse(savedConfig),
    });

    renderApp(['/settings/models']);
    await screen.findByText('主模型角色 (Main Roles)');

    // 删掉第 2 行再保存：服务端确认只剩一行
    fireEvent.click(screen.getByRole('button', { name: '删除角色 #2' }));
    fireEvent.click(screen.getByRole('button', { name: '保存角色配置' }));

    expect(
      await screen.findByText('模型角色配置已成功更新并生效。'),
    ).toBeInTheDocument();
    // 旧缓存里还有两行；若 mutation 只 invalidate，这里会被刷回第 2 行
    await waitFor(() => expect(screen.queryByRole('button', { name: '删除角色 #2' })).toBeNull());
    expect(mainSelect(0).value).toBe('deepseek-v4-pro');
  });
});

describe('#126 getErrorMessage prefers readable message over code', () => {
  const asTransportError = (body: unknown) =>
    ({ status: 400, body, message: '请求失败 (400)' }) as unknown;

  it('优先取 message 字段，不把 code 当成给用户看的文案', () => {
    expect(
      getErrorMessage(
        asTransportError({
          code: ['duplicate_main_model'],
          model: ['gemini-4-carbon'],
          message: ['主模型池不允许重复：gemini-4-carbon'],
        }),
      ),
    ).toBe('主模型池不允许重复：gemini-4-carbon');
  });

  it('只有 code 时逐级回落，不返回英文错误码', () => {
    expect(getErrorMessage(asTransportError({ code: ['duplicate_main_model'] }))).toBe(
      '请求失败 (400)',
    );
  });

  it('没有 message 字段时仍能取到普通字段错误', () => {
    expect(getErrorMessage(asTransportError({ alias: ['别名已存在'] }))).toBe('别名已存在');
  });
});
