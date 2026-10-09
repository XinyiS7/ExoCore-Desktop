import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFetch, jsonResponse, renderApp, unmockFetch, type MockRoute } from './helpers';

describe('V4 Agent Profile Editing (Name, Bio, Model, Avatar)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    unmockFetch();
    localStorage.clear();
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

  it('renders avatar preview, edit profile button, and opens AgentEditDialog with current data', async () => {
    installFetch([
      { test: '/api/agents/presets/1/', handler: () => jsonResponse(PRESET_ALARIC) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
      { test: '/api/core/model-catalog/', handler: () => jsonResponse({
        models: [{ name: 'gemini-3.6-flash', family: 'gemini', abilities: [], compatible_endpoint_ids: [1] }],
        endpoints: [{ id: 1, name: 'ep', provider: 'google', execution_type: 'direct', execution_adapter: 'test', payload_format: 'json', cache_transport: 'none', attachment_transports: [], configured: true, enabled: true }],
        roles: { main: [{ model: 'gemini-3.6-flash', default_endpoint: 1 }], support: { general_sub_agent: { model: 'gemini-3.6-flash', default_endpoint: 1 }, vision_helper: { model: 'gemini-3.6-flash', default_endpoint: 1 }, grounding: { model: 'gemini-3.6-flash', default_endpoint: 1 }, image_gen: { model: 'gemini-3.6-flash', default_endpoint: 1 } } },
        providers: [{ id: 'google', display_name: 'Google', execution_type: 'direct' }],
      }) },
    ]);

    renderApp(['/agents/1']);

    expect(await screen.findByRole('heading', { name: /Alaric/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /更换头像/ })).toBeInTheDocument();
    const editBtn = screen.getByRole('button', { name: /编辑资料/ });
    expect(editBtn).toBeInTheDocument();

    fireEvent.click(editBtn);

    expect(await screen.findByRole('heading', { name: '编辑 Agent 资料' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Agent 名称/)).toHaveValue('Alaric');
    expect(screen.getByLabelText(/签名 \/ 简介/)).toHaveValue('Order and rational vigilance');
    expect(screen.getByLabelText(/默认模型/)).toHaveValue('gemini-3.6-flash');

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('heading', { name: '编辑 Agent 资料' })).toBeNull();
  });

  it('validates required name field in AgentEditDialog', async () => {
    installFetch([
      { test: '/api/agents/presets/1/', handler: () => jsonResponse(PRESET_ALARIC) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
    ]);

    renderApp(['/agents/1']);

    await screen.findByRole('heading', { name: /Alaric/ });
    fireEvent.click(screen.getByRole('button', { name: /编辑资料/ }));

    const nameInput = await screen.findByLabelText(/Agent 名称/);
    fireEvent.change(nameInput, { target: { value: '   ' } });

    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Agent 名称不能为空');
    expect(screen.getByRole('heading', { name: '编辑 Agent 资料' })).toBeInTheDocument();
  });

  it('successfully updates name, description, and default_model via PATCH', async () => {
    let patchPayload: unknown = null;
    let currentData = { ...PRESET_ALARIC };

    const routes: MockRoute[] = [
      {
        test: '/api/agents/presets/1/',
        method: 'GET',
        handler: () => jsonResponse(currentData),
      },
      {
        test: '/api/agents/presets/1/',
        method: 'PATCH',
        handler: async (_url, init) => {
          patchPayload = JSON.parse(init?.body as string);
          currentData = { ...currentData, ...(patchPayload as Record<string, unknown>) };
          return jsonResponse(currentData);
        },
      },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
      { test: '/api/core/model-catalog/', handler: () => jsonResponse({
        models: [
          { name: 'gemini-3.6-flash', family: 'gemini', abilities: [], compatible_endpoint_ids: [1] },
          { name: 'deepseek-v4-flash', family: 'deepseek', abilities: [], compatible_endpoint_ids: [1] },
        ],
        endpoints: [{ id: 1, name: 'ep', provider: 'google', execution_type: 'direct', execution_adapter: 'test', payload_format: 'json', cache_transport: 'none', attachment_transports: [], configured: true, enabled: true }],
        roles: { main: [{ model: 'gemini-3.6-flash', default_endpoint: 1 }], support: { general_sub_agent: { model: 'gemini-3.6-flash', default_endpoint: 1 }, vision_helper: { model: 'gemini-3.6-flash', default_endpoint: 1 }, grounding: { model: 'gemini-3.6-flash', default_endpoint: 1 }, image_gen: { model: 'gemini-3.6-flash', default_endpoint: 1 } } },
        providers: [{ id: 'google', display_name: 'Google', execution_type: 'direct' }],
      }) },
    ];
    installFetch(routes);

    renderApp(['/agents/1']);

    await screen.findByRole('heading', { name: /Alaric/ });
    fireEvent.click(screen.getByRole('button', { name: /编辑资料/ }));

    const nameInput = await screen.findByLabelText(/Agent 名称/);
    const descInput = screen.getByLabelText(/签名 \/ 简介/);
    const modelSelect = screen.getByLabelText(/默认模型/);

    fireEvent.change(nameInput, { target: { value: 'Alaric (Order Sovereign)' } });
    fireEvent.change(descInput, { target: { value: 'Absolute order and rational protection.' } });
    fireEvent.change(modelSelect, { target: { value: 'deepseek-v4-flash' } });

    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '编辑 Agent 资料' })).toBeNull();
    });

    expect(patchPayload).toEqual({
      name: 'Alaric (Order Sovereign)',
      description: 'Absolute order and rational protection.',
      default_model: 'deepseek-v4-flash',
    });

    expect(await screen.findByRole('heading', { name: /Alaric \(Order Sovereign\)/ })).toBeInTheDocument();
    expect(screen.getByText('Absolute order and rational protection.')).toBeInTheDocument();
    expect(screen.getByText('deepseek-v4-flash', { selector: 'dd' })).toBeInTheDocument();
  });

  it('displays API error inside AgentEditDialog on PATCH error', async () => {
    const routes: MockRoute[] = [
      { test: '/api/agents/presets/1/', method: 'GET', handler: () => jsonResponse(PRESET_ALARIC) },
      {
        test: '/api/agents/presets/1/',
        method: 'PATCH',
        handler: () => jsonResponse({ error: '预设名称已存在', code: 'duplicate' }, 400),
      },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
    ];
    installFetch(routes);

    renderApp(['/agents/1']);

    await screen.findByRole('heading', { name: /Alaric/ });
    fireEvent.click(screen.getByRole('button', { name: /编辑资料/ }));

    const nameInput = await screen.findByLabelText(/Agent 名称/);
    fireEvent.change(nameInput, { target: { value: 'Duplicate Alaric' } });

    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('预设名称已存在');
    expect(screen.getByRole('heading', { name: '编辑 Agent 资料' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Agent 名称/)).toHaveValue('Duplicate Alaric');
  });

  it('allows selecting an image file and triggers avatar cropping', async () => {
    installFetch([
      { test: '/api/agents/presets/1/', handler: () => jsonResponse(PRESET_ALARIC) },
      { test: '/api/agents/conversations/', handler: () => jsonResponse([]) },
      { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
    ]);

    // Mock URL.createObjectURL / revokeObjectURL for AvatarCropDialog
    const mockCreateObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-avatar-preview');
    const mockRevokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    renderApp(['/agents/1']);

    await screen.findByRole('heading', { name: /Alaric/ });
    const fileInput = screen.getByLabelText('上传新头像') as HTMLInputElement;

    const file = new File(['dummy avatar image content'], 'avatar.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // AvatarCropDialog should now be visible
    expect(await screen.findByRole('heading', { name: '裁剪头像' })).toBeInTheDocument();

    // Cancelling crop dialog closes it
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('heading', { name: '裁剪头像' })).toBeNull();

    mockCreateObjectURL.mockRestore();
    mockRevokeObjectURL.mockRestore();
  });
});
