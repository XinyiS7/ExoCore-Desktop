import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { installFetch, jsonResponse, renderApp, unmockFetch, type MockRoute } from './helpers';

describe('V4 Agent Profile System Prompt Editing (#7)', () => {
  afterEach(() => {
    unmockFetch();
  });

  const PRESET_ALARIC = {
    id: 1,
    name: 'Alaric',
    description: 'Order and rational vigilance',
    agent_type: 'g045',
    default_model: 'gemini-3.6-flash',
    system_prompt: 'Strict order and unwavering guard.',
    is_visible: true,
  };

  it('renders system prompt in dedicated card and opens edit dialog on button click', async () => {
    installFetch([
      { test: '/api/agents/presets/1/', handler: () => jsonResponse(PRESET_ALARIC) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
    ]);

    renderApp(['/agents/1']);

    expect(await screen.findByRole('heading', { name: /Alaric/ })).toBeInTheDocument();
    expect(screen.getByText('Strict order and unwavering guard.')).toBeInTheDocument();

    const editBtn = screen.getByRole('button', { name: /编辑 Prompt/ });
    expect(editBtn).toBeInTheDocument();

    fireEvent.click(editBtn);

    expect(await screen.findByRole('heading', { name: '编辑 System Prompt' })).toBeInTheDocument();
    const textarea = screen.getByPlaceholderText('输入 System Prompt…');
    expect(textarea).toHaveValue('Strict order and unwavering guard.');

    // Cancel closes dialog without saving
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('heading', { name: '编辑 System Prompt' })).toBeNull();
  });

  it('successfully updates and persists system prompt via PATCH', async () => {
    let patchPayload: unknown = null;
    let currentPrompt = PRESET_ALARIC.system_prompt;

    const routes: MockRoute[] = [
      {
        test: '/api/agents/presets/1/',
        method: 'GET',
        handler: () => jsonResponse({ ...PRESET_ALARIC, system_prompt: currentPrompt }),
      },
      {
        test: '/api/agents/presets/1/',
        method: 'PATCH',
        handler: async (_url, init) => {
          patchPayload = JSON.parse(init?.body as string);
          currentPrompt = (patchPayload as { system_prompt: string }).system_prompt;
          return jsonResponse({
            ...PRESET_ALARIC,
            system_prompt: currentPrompt,
          });
        },
      },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
    ];
    installFetch(routes);

    renderApp(['/agents/1']);

    await screen.findByText('Strict order and unwavering guard.');
    fireEvent.click(screen.getByRole('button', { name: /编辑 Prompt/ }));

    const textarea = await screen.findByPlaceholderText('输入 System Prompt…');
    fireEvent.change(textarea, { target: { value: 'Revised covenant of the Order.' } });

    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '编辑 System Prompt' })).toBeNull();
    });

    expect(patchPayload).toEqual({
      system_prompt: 'Revised covenant of the Order.',
    });

    expect(await screen.findByText('Revised covenant of the Order.')).toBeInTheDocument();
    expect(screen.getByText('System Prompt 保存成功')).toBeInTheDocument();
  });

  it('displays API error inside dialog on failure and preserves draft', async () => {
    const routes: MockRoute[] = [
      { test: '/api/agents/presets/1/', method: 'GET', handler: () => jsonResponse(PRESET_ALARIC) },
      {
        test: '/api/agents/presets/1/',
        method: 'PATCH',
        handler: () => jsonResponse({ error: '保存失败，权限不足', code: 'permission_denied' }, 403),
      },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
    ];
    installFetch(routes);

    renderApp(['/agents/1']);

    await screen.findByText('Strict order and unwavering guard.');
    fireEvent.click(screen.getByRole('button', { name: /编辑 Prompt/ }));

    const textarea = await screen.findByPlaceholderText('输入 System Prompt…');
    fireEvent.change(textarea, { target: { value: 'Failed modification attempt' } });

    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('保存失败，权限不足');
    // Dialog remains open and draft is preserved
    expect(screen.getByRole('heading', { name: '编辑 System Prompt' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('输入 System Prompt…')).toHaveValue('Failed modification attempt');
  });
});
