import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  ensureTestLocalStorage,
  installFetch,
  jsonResponse,
  renderApp,
  unmockFetch,
  type MockRoute,
} from './helpers';
import { USER_AVATAR_KEY } from '../shared/userAvatar';

const MOCK_USER_PRESET = {
  id: 2,
  name: 'Alicia',
  description: 'Primary User',
  agent_type: 'user',
  default_model: 'Human',
  system_prompt: 'Helpful and sharp assistant.',
  is_visible: true,
};

const MOCK_AGENT_PRESET = {
  id: 1,
  name: 'Alessandro',
  description: 'Lead Agent',
  agent_type: 'g045',
  default_model: 'claude-3-5-sonnet',
  system_prompt: 'Rigorous order.',
  is_visible: true,
};

const MOCK_USAGE_DATA = {
  daily: [
    {
      date: '09/10',
      models: [
        {
          model: 'claude-3-5-sonnet',
          input_tokens: 1500,
          output_tokens: 600,
          cached_tokens: 300,
          conversation_count: 3,
        },
      ],
    },
    {
      date: '09/11',
      models: [
        {
          model: 'claude-3-5-sonnet',
          input_tokens: 2000,
          output_tokens: 800,
          cached_tokens: 500,
          conversation_count: 4,
        },
        {
          model: 'deepseek-v4-flash',
          input_tokens: 1000,
          output_tokens: 400,
          cached_tokens: 0,
          conversation_count: 2,
        },
      ],
    },
  ],
  from: '2026-09-07',
  to: '2026-09-13',
  is_current: true,
};

describe('Phase 2C CP C-1 — Shell, Routes, Title & Account', () => {
  beforeEach(() => {
    ensureTestLocalStorage();
    localStorage.clear();
  });

  afterEach(() => {
    unmockFetch();
    localStorage.clear();
    document.title = 'ExoCore V4';
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Routes & Shell Policy
  // ───────────────────────────────────────────────────────────────────────────
  describe('Routes, Shell & MoreMenu Navigation', () => {
    it('redirects /user to canonical /account and hides mobile bottom bar', async () => {
      const routes: MockRoute[] = [
        { test: '/api/agents/presets/', handler: () => jsonResponse([MOCK_AGENT_PRESET, MOCK_USER_PRESET]) },
        { test: '/api/telemetry/usage/', handler: () => jsonResponse(MOCK_USAGE_DATA) },
      ];
      installFetch(routes);

      const { container } = renderApp(['/user']);

      // Renders Account page
      expect(await screen.findByRole('heading', { name: '账号' })).toBeInTheDocument();
      expect(await screen.findByRole('heading', { name: '个人资料' })).toBeInTheDocument();

      // Mobile bottom bar is hidden on /account (Plan §3 D2)
      expect(container.querySelector('.app-bottombar')).toBeNull();
      expect(container.querySelector('.app-main--bb')).toBeNull();

      // Direct-open back link to Chat exists
      const backLink = container.querySelector<HTMLAnchorElement>('a.app-back-link');
      expect(backLink).not.toBeNull();
      expect(backLink).toHaveAttribute('href', '/');
      expect(backLink).toHaveTextContent('Chat');
    });

    it('activates Account item in MoreMenu while keeping Settings and Notifications disabled', async () => {
      const routes: MockRoute[] = [
        { test: '/api/core/conversations/', handler: () => jsonResponse([]) },
        { test: '/api/agents/presets/', handler: () => jsonResponse([MOCK_AGENT_PRESET, MOCK_USER_PRESET]) },
        { test: '/api/telemetry/usage/', handler: () => jsonResponse(MOCK_USAGE_DATA) },
      ];
      installFetch(routes);

      renderApp(['/']);

      // Open MoreMenu
      const moreButtons = await screen.findAllByRole('button', { name: '更多菜单' });
      fireEvent.click(moreButtons[0]);

      // Account is enabled link
      const accountLink = screen.getByRole('menuitem', { name: /账号 \/ Profile/i });
      expect(accountLink.tagName.toLowerCase()).toBe('a');
      expect(accountLink).toHaveAttribute('href', '/account');

      // Settings is activated link pointing to /settings/keys in CP C-3
      const settingsLink = screen.getByRole('menuitem', { name: /设置中心/i });
      expect(settingsLink.tagName.toLowerCase()).toBe('a');
      expect(settingsLink).toHaveAttribute('href', '/settings/keys');

      // Notifications is activated direct link in CP C-2
      const notificationsLink = screen.getByRole('menuitem', { name: /通知/i });
      expect(notificationsLink.tagName.toLowerCase()).toBe('a');
      expect(notificationsLink).toHaveAttribute('href', '/settings/notifications');

      // Clicking Account navigates to /account and closes the menu
      fireEvent.click(accountLink);
      expect(await screen.findByRole('heading', { name: '账号' })).toBeInTheDocument();
      expect(screen.queryByRole('menu')).toBeNull();
    });

    it('closes MoreMenu on Escape and outside pointer down', async () => {
      const routes: MockRoute[] = [
        { test: '/api/core/conversations/', handler: () => jsonResponse([]) },
      ];
      installFetch(routes);

      renderApp(['/']);

      const moreButtons = await screen.findAllByRole('button', { name: '更多菜单' });
      const moreBtn = moreButtons[0];
      fireEvent.click(moreBtn);
      expect(screen.getByRole('menu')).toBeInTheDocument();

      // Escape closes
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('menu')).toBeNull();

      // Outside pointer down closes
      fireEvent.click(moreBtn);
      expect(screen.getByRole('menu')).toBeInTheDocument();
      fireEvent.pointerDown(document.body);
      expect(screen.queryByRole('menu')).toBeNull();
    });

    it('restores focus to More trigger when Escape closes a focused menu item', async () => {
      installFetch([{ test: '/api/core/conversations/', handler: () => jsonResponse([]) }]);
      renderApp(['/']);

      const triggers = await screen.findAllByRole('button', { name: '更多菜单' });
      const trigger = triggers[0];
      fireEvent.click(trigger);

      const accountItem = screen.getByRole('menuitem', { name: /账号 \/ Profile/i });
      accountItem.focus();
      expect(accountItem).toHaveFocus();

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(screen.queryByRole('menu')).toBeNull();
      expect(trigger).toHaveFocus();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Document Title Management
  // ───────────────────────────────────────────────────────────────────────────
  describe('Document Title Management (Plan §3 D3)', () => {
    it('updates document.title across routes with uniform suffix and cleans up', async () => {
      const routes: MockRoute[] = [
        { test: '/api/core/conversations/', handler: () => jsonResponse([]) },
        { test: '/api/agents/presets/', handler: () => jsonResponse([MOCK_AGENT_PRESET, MOCK_USER_PRESET]) },
        { test: '/api/core/projects/', handler: () => jsonResponse([]) },
        { test: '/api/telemetry/usage/', handler: () => jsonResponse(MOCK_USAGE_DATA) },
      ];
      installFetch(routes);

      renderApp(['/']);
      await waitFor(() => {
        expect(document.title).toBe('Chat · ExoCore V4');
      });

      // Account page
      renderApp(['/account']);
      await waitFor(() => {
        expect(document.title).toBe('账号 · ExoCore V4');
      });

      // Agent Hub
      renderApp(['/agents']);
      await waitFor(() => {
        expect(document.title).toBe('Agent Hub · ExoCore V4');
      });

      // Project Hub
      renderApp(['/projects']);
      await waitFor(() => {
        expect(document.title).toBe('项目 · ExoCore V4');
      });

      // Not Found page
      renderApp(['/non-existent-route']);
      await waitFor(() => {
        expect(document.title).toBe('页面不存在 · ExoCore V4');
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. User Profile Resolution & Error Cases
  // ───────────────────────────────────────────────────────────────────────────
  describe('User Profile Resolution (Plan §3 D4)', () => {
    it('renders User Profile when exactly one user preset is present', async () => {
      const routes: MockRoute[] = [
        { test: '/api/agents/presets/', handler: () => jsonResponse([MOCK_AGENT_PRESET, MOCK_USER_PRESET]) },
        { test: '/api/telemetry/usage/', handler: () => jsonResponse(MOCK_USAGE_DATA) },
      ];
      installFetch(routes);

      renderApp(['/account']);

      expect(await screen.findByDisplayValue('Alicia')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Primary User')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Human')).toBeInTheDocument();
      expect(screen.getByText('Helpful and sharp assistant.')).toBeInTheDocument();
    });

    it('shows explicit error and sends no PATCH when user preset is missing (0 items)', async () => {
      const patchSpy = vi.fn();
      const routes: MockRoute[] = [
        { test: '/api/agents/presets/', handler: () => jsonResponse([MOCK_AGENT_PRESET]) },
        { test: '/api/telemetry/usage/', handler: () => jsonResponse(MOCK_USAGE_DATA) },
        { test: /\/api\/agents\/presets\/\d+\//, method: 'PATCH', handler: patchSpy },
      ];
      installFetch(routes);

      renderApp(['/account']);

      expect(await screen.findByText('用户资料未配置')).toBeInTheDocument();
      expect(screen.getByText(/当前可见预设列表中未找到用户资料/)).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Alicia')).toBeNull();
      expect(patchSpy).not.toHaveBeenCalled();
    });

    it('shows contract error and refuses to guess when multiple user presets exist', async () => {
      const patchSpy = vi.fn();
      const duplicateUser = { ...MOCK_USER_PRESET, id: 99, name: 'Duplicate User' };
      const routes: MockRoute[] = [
        { test: '/api/agents/presets/', handler: () => jsonResponse([MOCK_USER_PRESET, duplicateUser]) },
        { test: '/api/telemetry/usage/', handler: () => jsonResponse(MOCK_USAGE_DATA) },
        { test: /\/api\/agents\/presets\/\d+\//, method: 'PATCH', handler: patchSpy },
      ];
      installFetch(routes);

      renderApp(['/account']);

      expect(await screen.findByText('用户资料契约异常')).toBeInTheDocument();
      expect(screen.getByText('可见预设列表中存在多条用户资料记录，无法确定唯一身份')).toBeInTheDocument();
      expect(patchSpy).not.toHaveBeenCalled();
    });

    it('rejects malformed user preset fields as explicit contract error without editable form', async () => {
      const patchSpy = vi.fn();
      const malformedUser = {
        ...MOCK_USER_PRESET,
        id: -1,
        name: 12345,
        is_visible: 'invalid-boolean',
      };
      const routes: MockRoute[] = [
        { test: '/api/agents/presets/', handler: () => jsonResponse([malformedUser]) },
        { test: '/api/telemetry/usage/', handler: () => jsonResponse(MOCK_USAGE_DATA) },
        { test: /\/api\/agents\/presets\/\d+\//, method: 'PATCH', handler: patchSpy },
      ];
      installFetch(routes);

      renderApp(['/account']);

      expect(await screen.findByText('用户资料契约异常')).toBeInTheDocument();
      expect(screen.getByText('用户资料数据不符合契约要求')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '保存修改' })).toBeNull();
      expect(patchSpy).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. User Profile 4-field PATCH & Prompt Dialog
  // ───────────────────────────────────────────────────────────────────────────
  describe('Profile Modification & Field Isolation', () => {
    it('submits only allowlisted fields in PATCH and updates server truth on success', async () => {
      let patchBody: unknown = null;
      let currentPreset = { ...MOCK_USER_PRESET };

      const routes: MockRoute[] = [
        {
          test: '/api/agents/presets/',
          handler: () => jsonResponse([MOCK_AGENT_PRESET, currentPreset]),
        },
        {
          test: `/api/agents/presets/${MOCK_USER_PRESET.id}/`,
          method: 'PATCH',
          handler: async (_url, init) => {
            patchBody = JSON.parse(String(init?.body));
            currentPreset = {
              ...currentPreset,
              ...(patchBody as Record<string, unknown>),
            };
            return jsonResponse(currentPreset);
          },
        },
        { test: '/api/telemetry/usage/', handler: () => jsonResponse(MOCK_USAGE_DATA) },
      ];
      installFetch(routes);

      renderApp(['/account']);

      const nameInput = await screen.findByDisplayValue('Alicia');
      const descInput = screen.getByDisplayValue('Primary User');
      const modelInput = screen.getByDisplayValue('Human');

      // Edit fields
      fireEvent.change(nameInput, { target: { value: 'Alicia Sovereign' } });
      fireEvent.change(descInput, { target: { value: 'Order & Clarity' } });
      fireEvent.change(modelInput, { target: { value: 'Custom Model Tag' } });

      const saveBtn = screen.getByRole('button', { name: '保存修改' });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByText('资料保存成功')).toBeInTheDocument();
      });

      // Verify request payload only contains allowlisted fields (Plan §3 D4)
      expect(patchBody).toEqual({
        name: 'Alicia Sovereign',
        description: 'Order & Clarity',
        default_model: 'Custom Model Tag',
      });
      // Non-allowlisted fields NEVER sent
      expect(patchBody).not.toHaveProperty('id');
      expect(patchBody).not.toHaveProperty('agent_type');
      expect(patchBody).not.toHaveProperty('is_visible');
    });

    it('rejects empty name with field error without sending PATCH', async () => {
      const patchSpy = vi.fn();
      const routes: MockRoute[] = [
        { test: '/api/agents/presets/', handler: () => jsonResponse([MOCK_AGENT_PRESET, MOCK_USER_PRESET]) },
        { test: `/api/agents/presets/${MOCK_USER_PRESET.id}/`, method: 'PATCH', handler: patchSpy },
        { test: '/api/telemetry/usage/', handler: () => jsonResponse(MOCK_USAGE_DATA) },
      ];
      installFetch(routes);

      renderApp(['/account']);

      const nameInput = await screen.findByDisplayValue('Alicia');
      fireEvent.change(nameInput, { target: { value: '   ' } });

      const saveBtn = screen.getByRole('button', { name: '保存修改' });
      fireEvent.click(saveBtn);

      expect(await screen.findByText('用户名不能为空')).toBeInTheDocument();
      expect(patchSpy).not.toHaveBeenCalled();
    });

    it('handles DRF 400 field error and preserves draft', async () => {
      const routes: MockRoute[] = [
        { test: '/api/agents/presets/', handler: () => jsonResponse([MOCK_AGENT_PRESET, MOCK_USER_PRESET]) },
        {
          test: `/api/agents/presets/${MOCK_USER_PRESET.id}/`,
          method: 'PATCH',
          handler: () =>
            jsonResponse({ name: ['该用户名已被保留。'] }, 400),
        },
        { test: '/api/telemetry/usage/', handler: () => jsonResponse(MOCK_USAGE_DATA) },
      ];
      installFetch(routes);

      renderApp(['/account']);

      const nameInput = await screen.findByDisplayValue('Alicia');
      fireEvent.change(nameInput, { target: { value: 'ReservedName' } });

      const saveBtn = screen.getByRole('button', { name: '保存修改' });
      fireEvent.click(saveBtn);

      expect(await screen.findByText('该用户名已被保留。')).toBeInTheDocument();
      // Draft preserved
      expect(nameInput).toHaveValue('ReservedName');
    });

    it('opens UserPromptDialog, submits prompt PATCH, and updates display', async () => {
      let patchBody: unknown = null;
      let currentPreset = { ...MOCK_USER_PRESET };

      const routes: MockRoute[] = [
        {
          test: '/api/agents/presets/',
          handler: () => jsonResponse([MOCK_AGENT_PRESET, currentPreset]),
        },
        {
          test: `/api/agents/presets/${MOCK_USER_PRESET.id}/`,
          method: 'PATCH',
          handler: async (_url, init) => {
            patchBody = JSON.parse(String(init?.body));
            currentPreset = {
              ...currentPreset,
              ...(patchBody as Record<string, unknown>),
            };
            return jsonResponse(currentPreset);
          },
        },
        { test: '/api/telemetry/usage/', handler: () => jsonResponse(MOCK_USAGE_DATA) },
      ];
      installFetch(routes);

      renderApp(['/account']);

      expect(await screen.findByText('Helpful and sharp assistant.')).toBeInTheDocument();

      // Open Dialog
      fireEvent.click(screen.getByRole('button', { name: /编辑 Prompt/i }));
      expect(await screen.findByRole('heading', { name: '编辑 System Prompt' })).toBeInTheDocument();

      const textarea = screen.getByPlaceholderText('输入 System Prompt…');
      expect(textarea).toHaveValue('Helpful and sharp assistant.');

      // Update prompt
      fireEvent.change(textarea, { target: { value: 'New Sovereign System Prompt.' } });
      fireEvent.click(screen.getByRole('button', { name: '保存' }));

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: '编辑 System Prompt' })).toBeNull();
      });

      expect(patchBody).toEqual({
        system_prompt: 'New Sovereign System Prompt.',
      });
      expect(screen.getByText('New Sovereign System Prompt.')).toBeInTheDocument();
    });

    it('handles malformed 2xx PATCH response by rejecting false success, preserving draft, and displaying error', async () => {
      let patchCount = 0;
      const routes: MockRoute[] = [
        { test: '/api/agents/presets/', handler: () => jsonResponse([MOCK_AGENT_PRESET, MOCK_USER_PRESET]) },
        {
          test: /\/api\/agents\/presets\/2\//,
          method: 'PATCH',
          handler: () => {
            patchCount++;
            return jsonResponse({ id: 2, name: 'Malformed Partial' });
          },
        },
        { test: '/api/telemetry/usage/', handler: () => jsonResponse(MOCK_USAGE_DATA) },
      ];
      installFetch(routes);

      renderApp(['/account']);

      const nameInput = await screen.findByDisplayValue('Alicia');
      fireEvent.change(nameInput, { target: { value: 'Attempted Name' } });
      fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

      await waitFor(() => {
        expect(screen.queryByText('资料保存成功')).toBeNull();
        expect(screen.getByRole('alert')).toHaveTextContent('更新预设接口返回数据异常');
      });

      expect(nameInput).toHaveValue('Attempted Name');
      expect(patchCount).toBe(1);
    });

    it('rejects malformed 2xx response in UserPromptDialog, preserving draft without closing', async () => {
      const routes: MockRoute[] = [
        { test: '/api/agents/presets/', handler: () => jsonResponse([MOCK_AGENT_PRESET, MOCK_USER_PRESET]) },
        {
          test: /\/api\/agents\/presets\/2\//,
          method: 'PATCH',
          handler: () => jsonResponse({ id: 2, name: 'Alicia' }),
        },
        { test: '/api/telemetry/usage/', handler: () => jsonResponse(MOCK_USAGE_DATA) },
      ];
      installFetch(routes);

      renderApp(['/account']);
      await screen.findByText('Helpful and sharp assistant.');

      fireEvent.click(screen.getByRole('button', { name: /编辑 Prompt/i }));
      const textarea = await screen.findByPlaceholderText('输入 System Prompt…');
      fireEvent.change(textarea, { target: { value: 'New Ambiguous Prompt' } });
      fireEvent.click(screen.getByRole('button', { name: '保存' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('更新预设接口返回数据异常');
      });

      expect(screen.getByRole('heading', { name: '编辑 System Prompt' })).toBeInTheDocument();
      expect(textarea).toHaveValue('New Ambiguous Prompt');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Local Avatar & StorageEvent Synchronization
  // ───────────────────────────────────────────────────────────────────────────
  describe('Avatar Observer & Local Persistence (Plan §3 D5)', () => {
    it('syncs avatar across components via StorageEvent and falls back on image error', async () => {
      const routes: MockRoute[] = [
        { test: '/api/agents/presets/', handler: () => jsonResponse([MOCK_AGENT_PRESET, MOCK_USER_PRESET]) },
        { test: '/api/telemetry/usage/', handler: () => jsonResponse(MOCK_USAGE_DATA) },
      ];
      installFetch(routes);

      renderApp(['/account']);

      // Initially no local avatar in localStorage -> fallback icon is shown
      await screen.findByRole('heading', { name: '账号' });
      expect(screen.getAllByLabelText(/用户头像|更多菜单/).length).toBeGreaterThan(0);

      // Simulate local avatar change with StorageEvent
      const sampleDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      act(() => {
        localStorage.setItem(USER_AVATAR_KEY, sampleDataUrl);
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: USER_AVATAR_KEY,
            newValue: sampleDataUrl,
          }),
        );
      });

      await waitFor(() => {
        const imgs = screen.getAllByRole('img', { name: '用户头像' });
        expect(imgs.length).toBeGreaterThan(0);
        expect(imgs[0]).toHaveAttribute('src', sampleDataUrl);
      });

      // Simulating image load error falls back to User icon gracefully
      const avatarImg = screen.getAllByRole('img', { name: '用户头像' })[0];
      fireEvent.error(avatarImg);

      await waitFor(() => {
        // img replaced by svg icon
        expect(avatarImg).not.toBeInTheDocument();
      });
    });

    it('rejects non-image files with explicit error', async () => {
      const routes: MockRoute[] = [
        { test: '/api/agents/presets/', handler: () => jsonResponse([MOCK_AGENT_PRESET, MOCK_USER_PRESET]) },
        { test: '/api/telemetry/usage/', handler: () => jsonResponse(MOCK_USAGE_DATA) },
      ];
      installFetch(routes);

      const { container } = renderApp(['/account']);

      await screen.findByDisplayValue('Alicia');
      const fileInput = container.querySelector<HTMLInputElement>('.account-hidden-file');
      expect(fileInput).not.toBeNull();

      const textFile = new File(['not an image'], 'doc.txt', { type: 'text/plain' });
      fireEvent.change(fileInput!, { target: { files: [textFile] } });

      expect(await screen.findByText('请选择有效的图片文件')).toBeInTheDocument();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Telemetry Cards, Table & Period Navigation
  // ───────────────────────────────────────────────────────────────────────────
  describe('Telemetry Usage Summary (Plan §3 D6)', () => {
    it('renders accurate totals in 4 summary cards and details table without chart dependency', async () => {
      const routes: MockRoute[] = [
        { test: '/api/agents/presets/', handler: () => jsonResponse([MOCK_AGENT_PRESET, MOCK_USER_PRESET]) },
        { test: '/api/telemetry/usage/', handler: () => jsonResponse(MOCK_USAGE_DATA) },
      ];
      installFetch(routes);

      renderApp(['/account']);

      // 4 Summary cards
      // Input tokens: 1500 + 2000 + 1000 = 4,500
      expect(await screen.findByText('4,500')).toBeInTheDocument();
      const summaryGrid = screen.getByLabelText('用量汇总');
      // Output tokens: 600 + 800 + 400 = 1,800
      expect(within(summaryGrid).getByText('1,800')).toBeInTheDocument();
      // Cached tokens: 300 + 500 + 0 = 800
      expect(within(summaryGrid).getByText('800')).toBeInTheDocument();
      // Conversations: 3 + 4 + 2 = 9
      expect(within(summaryGrid).getByText('9')).toBeInTheDocument();

      // Detail Table
      const table = screen.getByRole('table', { name: '模型用量明细' });
      expect(table).toBeInTheDocument();
      expect(screen.getAllByText('claude-3-5-sonnet').length).toBe(2);
      expect(screen.getByText('deepseek-v4-flash')).toBeInTheDocument();

      // Explicit negative check: No platform filter selector rendered (Plan §3 D6)
      expect(screen.queryByRole('combobox', { name: /平台/i })).toBeNull();
      expect(screen.queryByText('Gemini')).toBeNull();
    });

    it('switches period between week and 30-day mode, requesting correct parameters', async () => {
      let requestedMode = 'week';
      const routes: MockRoute[] = [
        { test: '/api/agents/presets/', handler: () => jsonResponse([MOCK_AGENT_PRESET, MOCK_USER_PRESET]) },
        {
          test: '/api/telemetry/usage/',
          handler: (url) => {
            requestedMode = url.searchParams.get('mode') || 'week';
            return jsonResponse(MOCK_USAGE_DATA);
          },
        },
      ];
      installFetch(routes);

      renderApp(['/account']);

      await screen.findByText('4,500');
      expect(requestedMode).toBe('week');

      // Click "30 日用量"
      const monthBtn = screen.getByRole('radio', { name: '30 日用量' });
      fireEvent.click(monthBtn);

      await waitFor(() => {
        expect(requestedMode).toBe('month');
      });
    });

    it('renders true empty state when no usage records exist', async () => {
      const emptyUsage = {
        daily: [
          { date: '09/10', models: [] },
          { date: '09/11', models: [] },
        ],
        from: '2026-09-07',
        to: '2026-09-13',
        is_current: true,
      };

      const routes: MockRoute[] = [
        { test: '/api/agents/presets/', handler: () => jsonResponse([MOCK_AGENT_PRESET, MOCK_USER_PRESET]) },
        { test: '/api/telemetry/usage/', handler: () => jsonResponse(emptyUsage) },
      ];
      installFetch(routes);

      renderApp(['/account']);

      // 0 is rendered as real 0 in cards (Plan §7.4)
      expect(await screen.findAllByText('0')).toHaveLength(4);

      // True empty state message
      expect(screen.getByText('当前周期暂无用量记录')).toBeInTheDocument();
      expect(screen.queryByRole('table', { name: '模型用量明细' })).toBeNull();
    });

    it('displays error state with retry on telemetry failure', async () => {
      let shouldFail = true;
      const routes: MockRoute[] = [
        { test: '/api/agents/presets/', handler: () => jsonResponse([MOCK_AGENT_PRESET, MOCK_USER_PRESET]) },
        {
          test: '/api/telemetry/usage/',
          handler: () => {
            if (shouldFail) return jsonResponse({ error: 'Server unavailable' }, 500);
            return jsonResponse(MOCK_USAGE_DATA);
          },
        },
      ];
      installFetch(routes);

      renderApp(['/account']);

      expect(await screen.findByText('用量数据加载失败')).toBeInTheDocument();

      // Retry
      shouldFail = false;
      fireEvent.click(screen.getByRole('button', { name: '重试' }));

      expect(await screen.findByText('4,500')).toBeInTheDocument();
    });

    it('rejects invalid or negative telemetry metrics with contract error without coercing to zero', async () => {
      const invalidTelemetry = {
        daily: [
          {
            date: '09/12',
            models: [
              {
                model: 'model-broken',
                input_tokens: -50,
                output_tokens: 100,
                cached_tokens: 20,
                conversation_count: 1,
              },
            ],
          },
        ],
        from: '2026-09-07',
        to: '2026-09-13',
        is_current: true,
      };

      const routes: MockRoute[] = [
        { test: '/api/agents/presets/', handler: () => jsonResponse([MOCK_AGENT_PRESET, MOCK_USER_PRESET]) },
        { test: '/api/telemetry/usage/', handler: () => jsonResponse(invalidTelemetry) },
      ];
      installFetch(routes);

      renderApp(['/account']);

      expect(await screen.findByText('用量数据加载失败')).toBeInTheDocument();
      expect(screen.queryByRole('table', { name: '模型用量明细' })).toBeNull();
    });
  });
});
