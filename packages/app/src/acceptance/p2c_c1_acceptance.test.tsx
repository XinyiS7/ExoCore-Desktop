import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import {
  ensureTestLocalStorage,
  installFetch,
  jsonResponse,
  renderApp,
  unmockFetch,
  type MockRoute,
} from '../test/helpers';

const USER = {
  id: 2,
  name: 'Alicia',
  description: 'Primary User',
  agent_type: 'user',
  default_model: 'Human',
  system_prompt: 'Prompt',
  is_visible: true,
};

const EMPTY_USAGE = {
  daily: [],
  from: '2026-09-07',
  to: '2026-09-13',
  is_current: true,
};

function accountRoutes(overrides: MockRoute[] = []): MockRoute[] {
  return [
    ...overrides,
    { test: '/api/agents/presets/', handler: () => jsonResponse([USER]) },
    { test: '/api/telemetry/usage/', handler: () => jsonResponse(EMPTY_USAGE) },
  ];
}

describe('P2C CP C-1 independent acceptance', () => {
  beforeEach(() => {
    unmockFetch();
    ensureTestLocalStorage();
    localStorage.clear();
  });

  it('rejects a malformed user-preset row as an explicit account contract error', async () => {
    installFetch([
      {
        test: '/api/agents/presets/',
        handler: () => jsonResponse([{ ...USER, id: 0 }]),
      },
    ]);

    renderApp(['/account']);

    expect(await screen.findByText('用户资料契约异常')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存修改' })).not.toBeInTheDocument();
  });

  it('rejects missing rendered telemetry numbers instead of converting them to zero', async () => {
    installFetch(
      accountRoutes([
        {
          test: '/api/telemetry/usage/',
          handler: () =>
            jsonResponse({
              ...EMPTY_USAGE,
              daily: [
                {
                  date: '09/13',
                  models: [
                    {
                      model: 'model-a',
                      input_tokens: 10,
                      output_tokens: 5,
                      cached_tokens: 2,
                    },
                  ],
                },
              ],
            }),
        },
      ]),
    );

    renderApp(['/account']);

    expect(await screen.findByText('用量数据加载失败')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: '模型用量明细' })).not.toBeInTheDocument();
  });

  it('restores focus to the More trigger when Escape closes a focused menu item', async () => {
    installFetch([{ test: '/api/core/conversations/', handler: () => jsonResponse([]) }]);
    renderApp(['/']);

    const trigger = (await screen.findAllByRole('button', { name: '更多菜单' }))[0];
    fireEvent.click(trigger);
    const accountItem = screen.getByRole('menuitem', { name: /账号 \/ Profile/i });
    accountItem.focus();
    expect(accountItem).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('does not report success for an accepted-but-malformed profile PATCH response', async () => {
    installFetch(
      accountRoutes([
        {
          test: '/api/agents/presets/2/',
          method: 'PATCH',
          handler: () => jsonResponse({ id: 2, name: 'Changed', agent_type: 'user' }),
        },
      ]),
    );

    renderApp(['/account']);
    const nameInput = await screen.findByDisplayValue('Alicia');
    fireEvent.change(nameInput, { target: { value: 'Changed' } });
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => {
      expect(screen.queryByText('资料保存成功')).not.toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('返回数据异常');
    });
  });
});
