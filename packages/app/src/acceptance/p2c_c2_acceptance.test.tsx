import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import {
  ensureTestLocalStorage,
  installFetch,
  jsonResponse,
  renderApp,
  unmockFetch,
} from '../test/helpers';

const PRESETS = [
  {
    id: 1,
    name: 'Alessandro',
    description: 'G045 助手',
    agent_type: 'g045',
    default_model: 'deepseek-v4-pro',
    system_prompt: '',
    is_visible: true,
  },
  {
    id: 2,
    name: 'Alicia',
    description: '用户预设',
    agent_type: 'user',
    default_model: 'Human',
    system_prompt: '',
    is_visible: true,
  },
];

const CONFIG = {
  self_check_preset_ids: [1],
  deep_org_preset_ids: [1],
  active_start: '09:00',
  active_end: '22:00',
  deep_org_weekday: 0,
  deep_org_hour: 3,
};

describe('P2C CP C-2 independent acceptance', () => {
  beforeEach(() => {
    unmockFetch();
    ensureTestLocalStorage();
    localStorage.clear();
    document.title = 'ExoCore V4';
  });

  it('gives the bare canonical Settings route an honest not-found state and title', async () => {
    installFetch([{ test: '/api/core/conversations/', handler: () => jsonResponse([]) }]);
    const { container } = renderApp(['/settings']);

    await waitFor(() => expect(container.querySelector('.settings-page')).not.toBeNull());
    expect(container.querySelector('.settings-content')).toBeEmptyDOMElement();
    expect(container.querySelector('.app-error-page')).toBeNull();
    await waitFor(() => expect(document.title).toBe('页面不存在 · ExoCore V4'));
  });

  it('uses the section document title while keeping the generic shell header', async () => {
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse(PRESETS) },
      { test: '/api/core/config/', handler: () => jsonResponse(CONFIG) },
    ]);

    renderApp(['/settings/routine']);
    expect(await screen.findByRole('heading', { name: '后台例行' })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('例行设置 · ExoCore V4'));

    renderApp(['/settings/appearance']);
    expect(await screen.findByRole('heading', { name: '外观与体验' })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('外观设置 · ExoCore V4'));
  });

  it('does not report Routine success while the config truth is still stale', async () => {
    let patchSeen = false;
    installFetch([
      { test: '/api/agents/presets/', handler: () => jsonResponse(PRESETS) },
      {
        test: '/api/core/config/',
        method: 'GET',
        handler: () => jsonResponse(CONFIG),
      },
      {
        test: '/api/core/config/',
        method: 'PATCH',
        handler: async (_url, _init) => {
          patchSeen = true;
          return new Promise<Response>(() => {});
        },
      },
    ]);

    renderApp(['/settings/routine']);
    expect(await screen.findByRole('heading', { name: '后台例行' })).toBeInTheDocument();
    const checkbox = screen.getByRole('checkbox', { name: /Alessandro/i });
    checkbox.click();
    screen.getByRole('button', { name: '保存例行配置' }).click();

    await waitFor(() => expect(patchSeen).toBe(true));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '保存中...' })).toBeDisabled()
    );
    expect(screen.queryByText('例行任务配置保存成功')).not.toBeInTheDocument();
  });
});
