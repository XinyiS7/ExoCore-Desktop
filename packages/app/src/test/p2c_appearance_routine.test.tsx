import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  jsonResponse,
  MockRoute,
  renderApp,
} from './helpers';

describe('Phase 2C CP C-2 — Settings Shell, Appearance, Routine & Notifications', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;
  let activeRoutes: MockRoute[] = [];

  const defaultPresets = [
    {
      id: 1,
      name: 'Alessandro',
      description: 'G045 助手',
      agent_type: 'g045',
      default_model: 'deepseek-v4-pro',
      system_prompt: 'System prompt 1',
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
    {
      id: 4,
      name: 'Archived G045 Chat',
      description: '历史任务',
      agent_type: 'g045',
      default_model: 'deepseek-v4-flash',
      system_prompt: '',
      is_visible: true,
    },
    {
      id: 5,
      name: 'Ecki',
      description: '标准代理',
      agent_type: 'standard',
      default_model: 'gemini-2.5-flash',
      system_prompt: '',
      is_visible: true,
    },
  ];

  const defaultConfig = {
    self_check_preset_ids: [1],
    deep_org_preset_ids: [1],
    active_start: '09:00',
    active_end: '22:00',
    deep_org_weekday: 0, // 周日
    deep_org_hour: 3,
  };

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-font-system');
    document.documentElement.removeAttribute('data-font-message');
    document.documentElement.removeAttribute('data-font-code');
    document.documentElement.style.removeProperty('--exo-font-scale');

    // Remove any leftover meta theme-color tag and recreate standard one
    const existingMeta = document.querySelector('meta[name="theme-color"]');
    if (existingMeta) existingMeta.remove();
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', '#0a0a0c');
    document.head.appendChild(meta);

    activeRoutes = [
      {
        test: '/api/agents/presets/',
        handler: () => jsonResponse(defaultPresets),
      },
      {
        test: '/api/core/config/',
        method: 'GET',
        handler: () => jsonResponse(defaultConfig),
      },
    ];

    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
        'http://localhost',
      );
      const method = (init?.method ?? 'GET').toUpperCase();

      for (const r of activeRoutes) {
        const matchesPath =
          typeof r.test === 'string'
            ? url.pathname === r.test
            : r.test.test(url.pathname);
        const matchesMethod = !r.method || r.method.toUpperCase() === method;
        if (matchesPath && matchesMethod) {
          return r.handler(url, init);
        }
      }
      return jsonResponse({ error: `Not found: ${method} ${url.pathname}` }, 404);
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ── 1. Settings Layout & Navigation ──────────────────────────────────────────
  describe('Settings Layout & Shell Navigation', () => {
    it('renders Settings rail and only activates C-2 sections (Appearance, Routine, Notifications)', async () => {
      renderApp(['/settings/appearance']);

      // Desktop rail links
      const rail = screen.getByRole('navigation', { name: '设置分区导航' });
      expect(rail).toBeInTheDocument();

      const appearanceLink = within(rail).getByRole('link', { name: /外观与体验/i });
      const routineLink = within(rail).getByRole('link', { name: /后台例行/i });
      const notificationsLink = within(rail).getByRole('link', { name: /通知设置/i });

      expect(appearanceLink).toHaveAttribute('href', '/settings/appearance');
      expect(routineLink).toHaveAttribute('href', '/settings/routine');
      expect(notificationsLink).toHaveAttribute('href', '/settings/notifications');

      // Active C-3 & C-4 sections exist in rail
      expect(within(rail).getByRole('link', { name: /密钥与通道/i })).toHaveAttribute('href', '/settings/keys');
      expect(within(rail).getByRole('link', { name: /模型角色/i })).toHaveAttribute('href', '/settings/models');
      expect(within(rail).getByRole('link', { name: /MCP 与工具抽屉/i })).toHaveAttribute('href', '/settings/mcp');
    });

    it('navigates between sections using desktop rail and mobile tabs', async () => {
      renderApp(['/settings/appearance']);

      expect(await screen.findByRole('heading', { name: '外观与体验' })).toBeInTheDocument();

      const rail = screen.getByRole('navigation', { name: '设置分区导航' });

      // Click routine link
      const routineLink = within(rail).getByRole('link', { name: /后台例行/i });
      fireEvent.click(routineLink);

      expect(await screen.findByRole('heading', { name: '后台例行' })).toBeInTheDocument();

      // Click notifications link
      const notifLink = within(rail).getByRole('link', { name: /通知设置/i });
      fireEvent.click(notifLink);

      expect(await screen.findByRole('heading', { name: '通知设置' })).toBeInTheDocument();
    });

    it('hides mobile bottom bar on /settings routes and provides back button to Chat', async () => {
      renderApp(['/settings/routine']);

      expect(await screen.findByRole('heading', { name: '后台例行' })).toBeInTheDocument();

      // Mobile bottom bar is hidden on /settings
      expect(screen.queryByRole('navigation', { name: '主导航' })).toBeNull();

      // Topbar provides back button to Chat
      const backBtn = screen.getByRole('link', { name: '返回聊天' });
      expect(backBtn).toBeInTheDocument();
      expect(backBtn).toHaveAttribute('href', '/');
    });

    it('falls back to 404 for unconstructed settings routes', async () => {
      renderApp(['/settings/nonexistent']);

      expect(await screen.findByText('页面不存在')).toBeInTheDocument();
    });

    it('gives bare canonical /settings an honest not-found document title without masquerading as valid section', async () => {
      renderApp(['/settings']);

      await waitFor(() => {
        expect(document.title).toBe('页面不存在 · ExoCore V4');
      });
      // Settings rail is mounted
      expect(screen.getByRole('navigation', { name: '设置分区导航' })).toBeInTheDocument();
      // Content container is empty, not a fake landing page or unreleased section
      const content = document.querySelector('.settings-content');
      expect(content).toBeEmptyDOMElement();
    });

    it('activates Notifications in MoreMenu and navigates directly to /settings/notifications', async () => {
      renderApp(['/']);

      // Open MoreMenu
      const moreBtn = screen.getAllByRole('button', { name: '更多菜单' })[0];
      fireEvent.click(moreBtn);

      const notifItem = screen.getByRole('menuitem', { name: /通知/i });
      expect(notifItem.tagName.toLowerCase()).toBe('a');
      expect(notifItem).toHaveAttribute('href', '/settings/notifications');

      // Click notification item navigates to /settings/notifications
      fireEvent.click(notifItem);

      expect(await screen.findByRole('heading', { name: '通知设置' })).toBeInTheDocument();
      expect(screen.queryByRole('menu')).toBeNull();
    });
  });

  // ── 2. Appearance Panel & Provider (Theme, Font, Scale) ─────────────────────
  describe('Appearance Panel & Provider', () => {
    it('toggles dark and light themes, sets data-theme, and updates meta theme-color to V4 bg', async () => {
      renderApp(['/settings/appearance']);

      expect(await screen.findByRole('heading', { name: '外观与体验' })).toBeInTheDocument();

      const darkRadio = screen.getByRole('radio', { name: /深色模式/i });
      const lightRadio = screen.getByRole('radio', { name: /浅色模式/i });

      // Default is dark
      expect(darkRadio).toHaveAttribute('aria-checked', 'true');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      const meta = document.querySelector('meta[name="theme-color"]');
      expect(meta?.getAttribute('content')).toBe('#0a0a0c');

      // Switch to light
      fireEvent.click(lightRadio);
      expect(lightRadio).toHaveAttribute('aria-checked', 'true');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(localStorage.getItem('exo_theme')).toBe('light');
      // V4 light theme background is #f8f9fb (never V3 #050505)
      expect(meta?.getAttribute('content')).toBe('#f8f9fb');

      // Switch back to dark
      fireEvent.click(darkRadio);
      expect(darkRadio).toHaveAttribute('aria-checked', 'true');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(localStorage.getItem('exo_theme')).toBe('dark');
      expect(meta?.getAttribute('content')).toBe('#0a0a0c');
    });

    it('configures system, message, and code fonts independently', async () => {
      renderApp(['/settings/appearance']);

      expect(await screen.findByRole('heading', { name: '外观与体验' })).toBeInTheDocument();

      // System font switch to wenkai
      const sysGroup = screen.getByRole('radiogroup', { name: '系统界面字体' });
      const wenkaiSys = within(sysGroup).getByRole('radio', { name: /霞鹜文楷/i });
      fireEvent.click(wenkaiSys);

      expect(localStorage.getItem('exo_font_system')).toBe('wenkai');
      expect(document.documentElement.getAttribute('data-font-system')).toBe('wenkai');

      // Message font switch to maple
      const msgGroup = screen.getByRole('radiogroup', { name: '会话正文字体' });
      const mapleMsg = within(msgGroup).getByRole('radio', { name: /Maple Mono/i });
      fireEvent.click(mapleMsg);

      expect(localStorage.getItem('exo_font_message')).toBe('maple');
      expect(document.documentElement.getAttribute('data-font-message')).toBe('maple');

      // Code font switch to sarasa
      const codeGroup = screen.getByRole('radiogroup', { name: '代码与标记字体' });
      const sarasaCode = within(codeGroup).getByRole('radio', { name: /Sarasa Gothic Mono/i });
      fireEvent.click(sarasaCode);

      expect(localStorage.getItem('exo_font_code')).toBe('sarasa');
      expect(document.documentElement.getAttribute('data-font-code')).toBe('sarasa');
    });

    it('adjusts font scale via slider and preset chips (80% to 150%) and sets --exo-font-scale', async () => {
      renderApp(['/settings/appearance']);

      expect(await screen.findByRole('heading', { name: '外观与体验' })).toBeInTheDocument();

      const slider = screen.getByRole('slider', { name: '文本缩放比例' });
      expect(slider).toHaveAttribute('aria-valuenow', '100');

      // Click preset chip 80%
      const chip80 = screen.getByRole('button', { name: '80%' });
      fireEvent.click(chip80);

      expect(slider).toHaveAttribute('aria-valuenow', '80');
      expect(localStorage.getItem('exo_font_scale')).toBe('80');
      expect(document.documentElement.style.getPropertyValue('--exo-font-scale')).toBe('0.8');

      // Click preset chip 150%
      const chip150 = screen.getByRole('button', { name: '150%' });
      fireEvent.click(chip150);

      expect(slider).toHaveAttribute('aria-valuenow', '150');
      expect(localStorage.getItem('exo_font_scale')).toBe('150');
      expect(document.documentElement.style.getPropertyValue('--exo-font-scale')).toBe('1.5');

      // Slider change to 110%
      fireEvent.change(slider, { target: { value: '110' } });
      expect(slider).toHaveAttribute('aria-valuenow', '110');
      expect(localStorage.getItem('exo_font_scale')).toBe('110');
      expect(document.documentElement.style.getPropertyValue('--exo-font-scale')).toBe('1.1');
    });

    it('renders real-time live preview cards for system, message, and code blocks', async () => {
      renderApp(['/settings/appearance']);

      expect(await screen.findByRole('heading', { name: '外观与体验' })).toBeInTheDocument();
      expect(screen.getByText('系统界面 (System UI)')).toBeInTheDocument();
      expect(screen.getByText('会话正文 (Message Typography)')).toBeInTheDocument();
      expect(screen.getByText('代码语法 (Code & Syntax)')).toBeInTheDocument();
    });
  });

  // ── 3. Routine Panel ────────────────────────────────────────────────────────
  describe('Routine Panel', () => {
    it('filters only g045 agents from canonical presets and sorts checked-first', async () => {
      renderApp(['/settings/routine']);

      expect(await screen.findByRole('heading', { name: '后台例行' })).toBeInTheDocument();

      // Only Alessandro (g045) and Archived G045 Chat (g045) should appear
      expect(screen.getByText('Alessandro')).toBeInTheDocument();
      expect(screen.getByText('Archived G045 Chat')).toBeInTheDocument();

      // Alicia (user) and Ecki (standard) must NOT appear in the routine checklist
      expect(screen.queryByText('Alicia')).toBeNull();
      expect(screen.queryByText('Ecki')).toBeNull();

      // Alessandro (id=1) is in defaultConfig.self_check_preset_ids -> checked
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toBeChecked(); // Alessandro is first (checked-first)
      expect(checkboxes[1]).not.toBeChecked(); // Archived G045 Chat is unchecked
    });

    it('toggles agents and saves identical deduplicated positive ID arrays to self_check and deep_org', async () => {
      let patchBody: unknown = null;
      activeRoutes.push({
        test: '/api/core/config/',
        method: 'PATCH',
        handler: async (_url, init) => {
          patchBody = JSON.parse(init?.body as string);
          return jsonResponse({
            ...defaultConfig,
            ...(patchBody as Record<string, unknown>),
          });
        },
      });

      renderApp(['/settings/routine']);

      expect(await screen.findByRole('heading', { name: '后台例行' })).toBeInTheDocument();

      // Toggle Archived G045 Chat (id=4)
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]);

      // Save
      const saveBtn = screen.getByRole('button', { name: '保存例行配置' });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByText('例行任务配置保存成功')).toBeInTheDocument();
      });

      // Both fields must receive the identical deduplicated array [1, 4]
      expect(patchBody).toEqual({
        self_check_preset_ids: [1, 4],
        deep_org_preset_ids: [1, 4],
      });
      // Absolutely no time fields sent in patch
      expect(patchBody).not.toHaveProperty('active_start');
      expect(patchBody).not.toHaveProperty('active_end');
    });

    it('preserves selection draft and shows explicit error banner when PATCH fails', async () => {
      activeRoutes.push({
        test: '/api/core/config/',
        method: 'PATCH',
        handler: () => jsonResponse({ error: 'Failed to update config' }, 500),
      });

      renderApp(['/settings/routine']);

      expect(await screen.findByRole('heading', { name: '后台例行' })).toBeInTheDocument();

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]); // Check id=4

      const saveBtn = screen.getByRole('button', { name: '保存例行配置' });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Draft is preserved: checkboxes[1] remains checked
      expect(checkboxes[1]).toBeChecked();
    });

    it('displays read-only schedule preview with active window and deep org day/hour', async () => {
      renderApp(['/settings/routine']);

      expect(await screen.findByRole('heading', { name: '后台例行' })).toBeInTheDocument();

      // Active window: 09:00 – 22:00
      expect(screen.getByText('09:00 – 22:00')).toBeInTheDocument();

      // Deep org: 周日 03:00 (weekday=0, hour=3)
      expect(screen.getByText('周日 03:00')).toBeInTheDocument();

      // Read-only indicator present
      expect(screen.getByText('只读展示')).toBeInTheDocument();

      // No interactive time setting button
      expect(screen.queryByRole('button', { name: /时间设置|编辑时间/i })).toBeNull();
    });

    it('renders explicit error state when config query fails, refusing fake empty', async () => {
      activeRoutes = [
        {
          test: '/api/agents/presets/',
          handler: () => jsonResponse(defaultPresets),
        },
        {
          test: '/api/core/config/',
          handler: () => jsonResponse({ error: 'Server error' }, 500),
        },
      ];

      renderApp(['/settings/routine']);

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('无法加载例行任务配置')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
    });
  });

  // ── 4. Notifications Panel Delivery & Invariants ─────────────────────────
  describe('Notifications Panel Delivery & Invariants', () => {
    it('renders NotificationsPanel surface on /settings/notifications', async () => {
      renderApp(['/settings/notifications']);

      expect(await screen.findByRole('heading', { name: '通知设置' })).toBeInTheDocument();
      expect(screen.getByText('推送服务状态')).toBeInTheDocument();
      expect(screen.getByText('设备名称')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: '设备名称' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '保存设备名' })).toBeInTheDocument();
    });

    it('strictly satisfies negative invariants on mount: no unprompted pushApi or subscription calls', async () => {
      renderApp(['/settings/notifications']);

      expect(await screen.findByRole('heading', { name: '通知设置' })).toBeInTheDocument();

      // No push API calls were made (subscription / device registration)
      const pushCalls = fetchMock.mock.calls.filter((call) => {
        const urlStr = typeof call[0] === 'string' ? call[0] : (call[0] as Request).url;
        return urlStr.includes('/api/push') && !urlStr.includes('/assistant-arrivals/');
      });
      expect(pushCalls.length).toBe(0);
    });
  });
});
