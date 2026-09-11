#!/usr/bin/env node
/**
 * p2a_browser_probe.mjs — P2A Stage C real-browser measurement instrument.
 *
 * Zero new dependencies: drives a real Chrome (headless=new) over the Chrome
 * DevTools Protocol using Node's built-in WebSocket (Node >= 22).
 *
 * All /api/* traffic is intercepted at the CDP Fetch domain and answered with
 * in-process fixtures — no backend, network or real-DB interaction. This is
 * the default isolation for browser creation scenarios (Solaire / Stage C
 * instructions).
 *
 * jsdom is NOT used for browser evidence (§8.7); every observation below is
 * measured in the real renderer.
 *
 * Usage: node scripts/p2a_browser_probe.mjs [--app=http://localhost:5176]
 * Exit code 0 = every assertion passed; 1 = at least one FAIL.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = process.argv.includes('--app')
  ? process.argv[process.argv.indexOf('--app') + 1]
  : 'http://localhost:5176';
const BASE = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : '';
const ORIGIN = new URL(APP).origin;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9333;
const SHOTS_DIR = join(fileURLToPath(new URL('.', import.meta.url)), '.p2a-shots');
const WIDTHS = [320, 390, 767, 768, 1280];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Fixtures ──────────────────────────────────────────────────────────────

const LONG_NAME = '超长Agent名称'.repeat(22); // CJK, no break opportunities
const LONG_DESC = '这是一段特别长的描述文本用于验证卡片描述的多行截断行为不会撑破布局。'.repeat(8);
const LONG_PROMPT = 'S'.repeat(170) + '\n' + '这是一段特别长的系统提示词，用于验证身份事实区能够换行显示而不会撑破页面。'.repeat(12);
const LONG_CONV = '很长的会话名称'.repeat(24);
const LONG_PROJ = '非常长的项目名称'.repeat(11);
const LONG_TAG = '长长的记忆标签'.repeat(12);
const LONG_MODEL = 'deepseek-v4-flash-plus-ultra-max-experimental'.repeat(2);

const preset = (id, name, agentType, extra = {}) => ({
  id,
  name,
  description: null,
  agent_type: agentType,
  default_model: 'deepseek-v4-flash',
  system_prompt: null,
  is_visible: true,
  ...extra,
});

const PRESETS = {
  normal: [
    preset(5, 'Ecki', 'standard'),
    preset(2, 'G045 助手', 'g045'),
    preset(9, 'Gemini 搭档', 'superior'),
  ],
  long: [
    preset(5, LONG_NAME, 'standard', {
      description: LONG_DESC,
      default_model: LONG_MODEL,
      system_prompt: LONG_PROMPT,
    }),
    preset(2, 'G045 助手', 'g045'),
    preset(9, 'Gemini 搭档', 'superior'),
  ],
};

const wireConv = (id, project, projectName, extra = {}) => ({
  id,
  name: `会话 ${id}`,
  created_at: '2026-01-01T00:00:00Z',
  frozen_project_ids: [],
  project,
  project_name: projectName,
  agent_type: 'standard',
  agent_preset_id: 5,
  last_message_at: null,
  thinking_level: 'auto',
  memory_injection_enabled: null,
  ...extra,
});

const CONVERSATIONS = {
  normal: [
    wireConv(321, 7, 'Project 7'),
    wireConv(322, 0, null),
    wireConv(323, 7, 'Project 7'),
  ],
  long: [
    wireConv(321, 7, 'Project 7', { name: LONG_CONV }),
    wireConv(322, 0, null),
    wireConv(324, 9, null), // positive id, unavailable name → Project #9
    wireConv(325, 8, LONG_PROJ),
  ],
};

const PROJECTS = [
  { id: 7, name: 'Project 7', description: null, prompt: null, work_dir: null, created_at: '2026-01-01T00:00:00Z' },
  { id: 8, name: LONG_PROJ, description: null, prompt: null, work_dir: null, created_at: '2026-01-01T00:00:00Z' },
  { id: 9, name: 'Project 9', description: null, prompt: null, work_dir: null, created_at: '2026-01-01T00:00:00Z' },
];

const MEMORY = {
  normal: [
    { id: 1, tags: ['tag-a', 'tag-b', 'tag-a', ' tag-c '], preset_id: 5 },
  ],
  long: [
    { id: 1, tags: [LONG_TAG, 'tag-b'], preset_id: 5 },
  ],
};

// Per-endpoint fixture mode, mutable at runtime per scenario. The Fetch
// handler reads ONLY this state — the mode set by navigate() is the single
// source of truth for every intercepted request.
const endpointMode = { presets: 'normal', conv: 'normal', memory: 'normal', projects: 'normal' };
const capturedInits = []; // POST bodies captured from /api/agents/sessions/init/
const requestLog = []; // recent intercepted requests: METHOD path

function routeHandlers(urlPath, method, postData) {
  const p = urlPath;
  const modeOf = (name) => endpointMode[name];
  if (p === '/api/agents/presets/') {
    if (modeOf('presets') === 'error') return [500, { error: 'boom' }];
    return [200, PRESETS[modeOf('presets')]];
  }
  const detail = p.match(/^\/api\/agents\/presets\/(\d+)\/$/);
  if (detail) {
    const id = Number(detail[1]);
    const list = PRESETS[modeOf('presets')];
    const found = list.find((row) => row.id === id);
    return found ? [200, found] : [404, { detail: '未找到。' }];
  }
  if (p === '/api/agents/conversations/') {
    if (modeOf('conv') === 'error') return [500, { error: 'boom' }];
    return [200, CONVERSATIONS[modeOf('conv')]];
  }
  if (/^\/api\/agents\/conversations\/\d+\/$/.test(p)) {
    // Post-creation destination page (canonical Chat, C1 surface). Return a
    // minimal truthful error envelope — Stage C only observes the committed
    // route, never Chat rendering.
    return [200, { id: 901, name: 'Probe Session', created_at: '2026-01-01T00:00:00Z', project: 0, agent_preset_id: 5 }];
  }
  if (p === '/api/agents/sessions/init/' && method === 'POST') {
    capturedInits.push(postData ? JSON.parse(postData) : null);
    return [200, { data: { conversation_id: 901, session_name: 'Probe Session' } }];
  }
  if (p === '/api/core/projects/') {
    if (modeOf('projects') === 'error') return [500, { error: 'boom' }];
    return [200, PROJECTS];
  }
  if (p === '/api/memory/plasmids/') {
    if (modeOf('memory') === 'error') return [500, { error: 'boom' }];
    return [200, MEMORY[modeOf('memory')]];
  }
  // Unknown /api path: surface an honest error instead of hanging (SSE and
  // other endpoints are outside Stage C observation).
  return [404, { detail: 'unexpected endpoint in probe' }];
}

// ── CDP client ────────────────────────────────────────────────────────────

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.handlers = new Map();
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== undefined) {
        const entry = this.pending.get(message.id);
        if (entry) {
          this.pending.delete(message.id);
          if (message.error) entry.reject(new Error(`${message.error.message}`));
          else entry.resolve(message.result);
        }
      } else if (message.method) {
        for (const handler of this.handlers.get(message.method) ?? []) handler(message.params);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, handler) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(handler);
  }
}

// ── Chrome lifecycle ──────────────────────────────────────────────────────

async function launchChrome() {
  const profileDir = mkdtempSync(join(tmpdir(), 'p2a-chrome-'));
  const args = [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--window-size=1280,800',
    'about:blank',
  ];
  const proc = spawn(CHROME, args, { stdio: 'ignore' });
  // Wait for the debugging endpoint.
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find((target) => target.type === 'page');
      if (page) return { proc, profileDir, wsUrl: page.webSocketDebuggerUrl };
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error(`Chrome debugging endpoint not reachable on port ${CDP_PORT}`);
}

// ── Page helpers ──────────────────────────────────────────────────────────

const MEASURE = `(() => {
  const doc = document.documentElement;
  const pick = (selector) => [...document.querySelectorAll(selector)].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 || r.height > 0;
  });
  return {
    viewportW: doc.clientWidth,
    viewportH: window.innerHeight,
    docOverflowX: doc.scrollWidth > doc.clientWidth,
    bodyOverflowX: document.body.scrollWidth > document.body.clientWidth,
    scrollOwners: [...document.querySelectorAll('*')]
      .filter((el) => {
        const cs = getComputedStyle(el);
        return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') &&
          el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 0;
      })
      .map((el) => ({ cls: typeof el.className === 'string' ? el.className : el.tagName })),
    bottomBar: (() => {
      const el = document.querySelector('.app-bottombar');
      return el ? getComputedStyle(el).display : 'absent';
    })(),
    sidebar: (() => {
      const el = document.querySelector('.app-sidebar');
      return el ? getComputedStyle(el).display : 'absent';
    })(),
    outOfViewport: pick('.app-topbar, .app-topbar-actions, .app-topbar-title, .app-topbar-sub, .app-chip, .agent-profile-section, .agent-card, .app-recent-row, .app-dialog, .agent-filter-bar, .agent-filter-option, .agent-hub-grid')
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.right > window.innerWidth + 1 || r.left < -1;
      })
      .map((el) => ({ cls: typeof el.className === 'string' ? el.className : el.tagName, right: Math.round(el.getBoundingClientRect().right), left: Math.round(el.getBoundingClientRect().left) })),
    profilePadBottom: (() => {
      const el = document.querySelector('.agent-profile');
      return el ? getComputedStyle(el).paddingBottom : null;
    })(),
    profileSafeAreaRule: (() => {
      const rules = [];
      for (const sheet of document.styleSheets) {
        let cssRules;
        try { cssRules = sheet.cssRules; } catch { continue; }
        for (const rule of cssRules) {
          if (rule.selectorText && rule.selectorText.includes('.agent-profile')) rules.push(rule.cssText);
        }
      }
      return rules.filter((text) => text.includes('env(safe-area-inset-bottom)')).length;
    })(),
    checkedFilter: (() => {
      const input = document.querySelector('input[name="agent-conversation-filter"]:checked');
      return input ? input.value : null;
    })(),
    chatNavActive: (() => {
      const el = document.querySelector('.app-nav-item[aria-current="page"] .app-nav-label');
      return el ? el.textContent : null;
    })(),
    hubCardOrder: (() => {
      return [...document.querySelectorAll('.agent-hub-grid .agent-card-name')].map((el) => el.textContent ?? '');
    })(),
    checkedFilterWeight: (() => {
      const input = document.querySelector('input[name="agent-conversation-filter"]:checked');
      const label = input?.closest('label');
      return label ? getComputedStyle(label).fontWeight : null;
    })(),
    uncheckedFilterWeight: (() => {
      const label = document.querySelector('.agent-filter-option:not(:has(input:checked))');
      return label ? getComputedStyle(label).fontWeight : null;
    })(),
    longTextFits: (() => {
      const els = document.querySelectorAll('.agent-card-name, .agent-identity-name, .agent-identity-desc, .agent-fact-value, .app-recent-name');
      return [...els].map((el) => ({
        cls: el.className,
        fits: el.scrollWidth <= el.clientWidth + 1 || getComputedStyle(el).overflow === 'hidden',
      })).filter((row) => !row.fits).length === 0;
    })(),
    dialog: (() => {
      const el = document.querySelector('.app-dialog');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        width: Math.round(r.width),
        withinViewport: r.right <= window.innerWidth + 1 && r.width >= 260,
      };
    })(),
    activeElement: (() => {
      const el = document.activeElement;
      if (!el) return null;
      return { tag: el.tagName, cls: typeof el.className === 'string' ? el.className : '', id: el.id, type: el.type ?? null };
    })(),
    pathname: location.pathname,
  };
})()`;

async function waitFor(cdp, expression, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await evalJs(cdp, `(() => { try { return !!(${expression}); } catch { return false; } })()`);
    if (value) return true;
    await sleep(150);
  }
  const text = await evalJs(cdp, `JSON.stringify({
    body: document.body?.textContent?.slice(0, 600) ?? '',
    asyncs: [...document.querySelectorAll('.app-async')].map((el) => el.textContent.slice(0, 80)),
  })`);
  throw new Error(`waitFor timeout: ${expression} — ${text}`);
}

async function navigate(cdp, path, mode) {
  endpointMode.presets = mode ?? 'normal';
  endpointMode.conv = mode ?? 'normal';
  endpointMode.memory = mode ?? 'normal';
  endpointMode.projects = mode ?? 'normal';
  await cdp.send('Page.navigate', { url: `${APP}${BASE}${path}` }).catch((error) => {
    throw new Error(`navigate failed for ${APP}${BASE}${path}: ${error.message}`);
  });
  // .app-async is shared by loading, error AND empty states; only the
  // spinner marks loading. Edge states (/agents/0, 404) render instantly.
  await waitFor(cdp, `document.querySelector('.app-page') !== null && document.querySelector('.app-spinner') === null`);
  await sleep(250);
}

async function evalJs(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) {
    const desc = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
    throw new Error(`page exception in ${expression.slice(0, 90)}… :: ${desc}`);
  }
  return result.result.value;
}

async function axSnapshot(cdp) {
  const tree = await cdp.send('Accessibility.getFullAXTree');
  const rows = [];
  for (const node of tree.nodes) {
    const role = node.role?.value;
    if (!role) continue;
    if (!['link', 'button', 'radio', 'radiogroup', 'dialog', 'heading', 'alert', 'navigation', 'textbox', 'combobox', 'checkbox', 'list'].includes(role)) continue;
    const props = {};
    for (const prop of node.properties ?? []) props[prop.name] = prop.value?.value;
    rows.push({ role, name: node.name?.value ?? null, props });
  }
  return rows;
}

async function key(cdp, vk, code, keyName, text) {
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    windowsVirtualKeyCode: vk,
    nativeVirtualKeyCode: vk,
    code,
    key: keyName,
    text,
  });
  if (text !== undefined) await cdp.send('Input.dispatchKeyEvent', { type: 'char', text });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    windowsVirtualKeyCode: vk,
    nativeVirtualKeyCode: vk,
    code,
    key: keyName,
  });
}

async function shoot(cdp, name, width) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(SHOTS_DIR, `${name}-${width}.png`), Buffer.from(result.data, 'base64'));
}

// ── Assertion harness ─────────────────────────────────────────────────────

const results = [];
function check(ok, label, detail = '') {
  results.push({ ok, label, detail });
}

// ── Scenarios ─────────────────────────────────────────────────────────────

async function runScenarios(cdp) {
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Accessibility.enable');
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  // Production bundles register the P1A service worker. Layout observations
  // must run on the production bundle itself, so SW registration is disabled
  // at the document level for every page in this probe to keep measurements
  // deterministic (no precache/claim reloads during the run).
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `Object.defineProperty(navigator.serviceWorker, 'register', { value: () => Promise.reject(new Error('probe: service worker disabled')) });`,
  });
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: `${ORIGIN}/api/*`, requestStage: 'Request' }] });
  cdp.on('Fetch.requestPaused', async (params) => {
    const url = new URL(params.request.url);
    requestLog.push(`${params.request.method} ${url.pathname}${url.search}`);
    const [status, payload] = routeHandlers(
      url.pathname,
      params.request.method,
      params.request.postData,
    );
    const body = Buffer.from(JSON.stringify(payload)).toString('base64');
    await cdp.send('Fetch.fulfillRequest', {
      requestId: params.requestId,
      responseCode: status,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
      body,
    });
  });

  mkdirSync(SHOTS_DIR, { recursive: true });

  // ── 1. Per-width layout matrix ──────────────────────────────────────
  const scenarios = [
    ['hub-normal', '/agents', 'normal', false],
    ['hub-long', '/agents', 'long', false],
    ['profile-normal', '/agents/5', 'normal', false],
    ['profile-long', '/agents/5', 'long', false],
    ['profile-dialog', '/agents/5', 'long', true],
    ['home', '/', 'normal', false],
  ];
  for (const width of WIDTHS) {
    const mobile = width < 768;
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width, height: 800, deviceScaleFactor: 1, mobile,
    });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: 1 });

    for (const [name, path, mode, openDialog] of scenarios) {
      await navigate(cdp, path, mode);
      if (openDialog) {
        const clicked = await evalJs(cdp, `(() => {
          const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('使用此 Agent 新建会话'));
          if (!btn) return false;
          btn.click();
          return true;
        })()`);
        if (!clicked) check(false, `${name}@${width} dialog open`, 'button not found');
        await sleep(400);
      }
      const metrics = await evalJs(cdp, MEASURE);
      const isHub = name.startsWith('hub');
      const isProfile = name.startsWith('profile');
      const hasDialog = name === 'profile-dialog';

      // Pre-observation: prove the long fixtures actually reached the DOM
      // before any size/action measurement may count as long-content evidence.
      if (mode === 'long') {
        const expectAll = !isHub; // conversations/Memory exist only on Profile
        const longVisible = await evalJs(cdp, `(() => {
          const t = document.body.textContent;
          const clampOk = (el) => {
            const r = el.getBoundingClientRect();
            return r.right <= window.innerWidth + 1;
          };
          const modelChip = [...document.querySelectorAll('.app-topbar-sub .app-chip')].find((c) => c.textContent.length > 30);
          const filterChip = [...document.querySelectorAll('.agent-filter-option')].find((o) => o.textContent.length > 30);
          return {
            name: t.includes(${JSON.stringify(LONG_NAME)}),
            desc: t.includes(${JSON.stringify(LONG_DESC.slice(0, 20))}),
            prompt: t.includes('S'.repeat(40)),
            conv: t.includes(${JSON.stringify(LONG_CONV)}),
            proj: t.includes(${JSON.stringify(LONG_PROJ)}),
            tag: t.includes(${JSON.stringify(LONG_TAG)}),
            modelChipClamped: !modelChip || (clampOk(modelChip) && getComputedStyle(modelChip).textOverflow === 'ellipsis'),
            filterChipClamped: !filterChip || (clampOk(filterChip) && getComputedStyle(filterChip.querySelector('span')).textOverflow === 'ellipsis'),
          };
        })()`);
        const expected = expectAll
          ? ['name', 'desc', 'prompt', 'conv', 'proj', 'tag', 'modelChipClamped', 'filterChipClamped']
          : ['name', 'desc'];
        const missing = expected.filter((k) => !longVisible[k]);
        check(missing.length === 0,
          `${name}@${width} long fixtures actually rendered`,
          JSON.stringify({ missing, observed: longVisible }));
      }

      check(!metrics.docOverflowX && !metrics.bodyOverflowX,
        `${name}@${width} no document overflow`,
        `doc=${metrics.docOverflowX} body=${metrics.bodyOverflowX}`);
      check(metrics.outOfViewport.length === 0,
        `${name}@${width} no element out of viewport`,
        JSON.stringify(metrics.outOfViewport));

      const allowedOwners = hasDialog ? ['app-scroll', 'app-dialog-body'] : ['app-scroll'];
      const badOwners = metrics.scrollOwners.filter((owner) => !allowedOwners.some((allowed) => owner.cls.includes(allowed)));
      check(badOwners.length === 0,
        `${name}@${width} single main scroll owner`,
        JSON.stringify(metrics.scrollOwners));

      if (isHub) {
        check(metrics.bottomBar === (mobile ? 'flex' : 'none'), `${name}@${width} hub bottom bar ${mobile ? 'visible' : 'hidden'}`, metrics.bottomBar);
        check(metrics.sidebar === (mobile ? 'none' : 'flex'), `${name}@${width} hub sidebar ${mobile ? 'hidden' : 'visible'}`, metrics.sidebar);
      }
      if (isProfile) {
        check(metrics.bottomBar === 'none' || metrics.bottomBar === 'absent', `${name}@${width} profile bottom bar hidden`, metrics.bottomBar);
        check(metrics.sidebar === (mobile ? 'none' : 'flex'), `${name}@${width} profile sidebar ${mobile ? 'hidden' : 'visible'}`, metrics.sidebar);
        if (!hasDialog) {
          check(metrics.profileSafeAreaRule > 0,
            `${name}@${width} profile safe-area rule present`,
            `rules=${metrics.profileSafeAreaRule} pad=${metrics.profilePadBottom}`);
        }
      }
      if (name === 'home') {
        check(metrics.bottomBar === (mobile ? 'flex' : 'none'), `${name}@${width} home bottom bar ${mobile ? 'visible' : 'hidden'}`, metrics.bottomBar);
      }

      check(metrics.longTextFits, `${name}@${width} long text fits or truncates`, '');
      if (hasDialog) {
        check(metrics.dialog?.withinViewport === true, `${name}@${width} dialog within viewport`, JSON.stringify(metrics.dialog));
      }

      // AX names
      const ax = await axSnapshot(cdp);
      const names = ax.map((row) => `${row.role}:${row.name}`).join(' | ');
      if (isHub) {
        check(metrics.chatNavActive === 'Chat', `${name}@${width} chat nav active via aria-current`, String(metrics.chatNavActive));
        const cardNames = metrics.hubCardOrder;
        check(cardNames.length === 3 && cardNames[0].startsWith('G045 助手'),
          `${name}@${width} hub cards named and g045-first`, JSON.stringify(cardNames));
        const expectedIdentity = mode === 'long' ? LONG_NAME : 'Ecki';
        check(cardNames.includes(expectedIdentity) && cardNames.includes('Gemini 搭档'),
          `${name}@${width} hub shows every visible preset once`, JSON.stringify(cardNames));
      }
      if (isProfile) {
        check(metrics.chatNavActive === 'Chat', `${name}@${width} chat nav active via aria-current`, String(metrics.chatNavActive));
        check(ax.some((row) => row.role === 'radiogroup' && row.name === '会话筛选'), `${name}@${width} filter radiogroup name`, names);
        check(metrics.checkedFilter === 'all', `${name}@${width} All radio checked`, String(metrics.checkedFilter));
        check(ax.some((row) => row.role === 'radio' && row.name === 'Drift'), `${name}@${width} Drift radio named`, names);
        check(ax.some((row) => row.role === 'button' && (row.name ?? '').includes('使用此 Agent 新建会话')), `${name}@${width} create action named`, names);
        if (!hasDialog) {
          const convLinks = ax.filter((row) => row.role === 'link' && (row.name ?? '').includes('1/1 01:00'));
          if (mode === 'long') {
            check(convLinks.length === 4, `${name}@${width} four long conversation rows`, names);
            check(convLinks.some((row) => row.name.includes('Project #9')),
              `${name}@${width} unnamed positive project row shows Project #9`, names);
            check(convLinks.some((row) => row.name.includes('Drift')),
              `${name}@${width} long drift row present`, names);
          } else {
            check(convLinks.length === 3, `${name}@${width} three conversation rows`, names);
            check(convLinks.some((row) => row.name.includes('会话 321')),
              `${name}@${width} conversation link names`, names);
          }
        }
      }
      if (hasDialog) {
        check(ax.some((row) => row.role === 'dialog' && row.name === '新建会话'), `${name}@${width} dialog named`, names);
        check(ax.some((row) => row.role === 'button' && row.name === '关闭'), `${name}@${width} dialog close named`, names);
        check(ax.some((row) => row.role === 'button' && (row.name ?? '').includes('创建会话')), `${name}@${width} dialog submit named`, names);
      }
      if (name === 'home') {
        check(ax.some((row) => row.role === 'link' && row.name === 'Agent Hub'), 'home Hub entry link named', names);
      }

      await shoot(cdp, name, width);
    }
  }

  // ── 2. Filter keyboard + non-color-only selection (width 390) ──────────
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 800, deviceScaleFactor: 1, mobile: true });
  await navigate(cdp, '/agents/5', 'normal');
  let value = await evalJs(cdp, `(() => { const input = document.querySelector('input[name="agent-conversation-filter"]:checked'); input.focus(); return input.value; })()`);
  check(value === 'all', 'filter keyboard: initial All checked', value);
  await key(cdp, 39, 'ArrowRight', 'ArrowRight'); // native radio group next
  await sleep(150);
  value = await evalJs(cdp, `document.querySelector('input[name="agent-conversation-filter"]:checked')?.value`);
  check(value === 'drift', 'filter keyboard: ArrowRight moves to Drift', value);
  await key(cdp, 39, 'ArrowRight', 'ArrowRight');
  await sleep(150);
  value = await evalJs(cdp, `document.querySelector('input[name="agent-conversation-filter"]:checked')?.value`);
  check(value === 'project-7', 'filter keyboard: ArrowRight moves to Project 7', value);
  const weights = await evalJs(cdp, `(() => {
    const checked = document.querySelector('.agent-filter-option:has(input:checked)');
    const unchecked = document.querySelector('.agent-filter-option:not(:has(input:checked))');
    return { checked: checked ? getComputedStyle(checked).fontWeight : null, unchecked: unchecked ? getComputedStyle(unchecked).fontWeight : null };
  })()`);
  check(weights.checked === '600' && weights.unchecked === '400',
    'filter selected not color-only (font-weight 600 vs 400)', JSON.stringify(weights));
  const outline = await evalJs(cdp, `(() => {
    const label = document.querySelector('.agent-filter-option:has(input:checked)');
    return label ? getComputedStyle(label).outlineWidth : null;
  })()`);
  check(outline === '2px', 'filter keyboard focus-visible outline', String(outline));

  // ── 3. Hub error + retry by Enter ───────────────────────────────────────
  await navigate(cdp, '/agents', 'normal');
  endpointMode.presets = 'error';
  await evalJs(cdp, `window.location.reload(); true`);
  await waitFor(cdp, `document.querySelector('[role="alert"]') !== null`);
  let alertText = await evalJs(cdp, `document.querySelector('[role="alert"]')?.textContent ?? ''`);
  check(alertText.includes('Agent 列表加载失败'), 'hub error state visible', alertText.slice(0, 40));
  endpointMode.presets = 'normal';
  requestLog.length = 0;
  await evalJs(cdp, `(() => { const btn = document.querySelector('[role="alert"] .app-btn'); btn.focus(); return true; })()`);
  await key(cdp, 13, 'Enter', 'Enter', '\r');
  try {
    await waitFor(cdp, `document.querySelectorAll('.agent-hub-grid .agent-card').length > 0`);
  } catch (error) {
    console.log('RETRY DEBUG requests:', requestLog.join(' | '));
    throw error;
  }
  const gridCount = await evalJs(cdp, `document.querySelectorAll('.agent-hub-grid .agent-card').length`);
  check(gridCount === 3, 'hub retry by Enter recovers', `cards=${gridCount} requests=${requestLog.join(',')}`);

  // ── 4. Invalid + 404 + Memory-error independence (width 390) ────────────
  await navigate(cdp, '/agents/0', 'normal');
  let text = await evalJs(cdp, `document.body.textContent`);
  check(text.includes('无效的 Agent 地址'), 'invalid id shows recovery route', '');
  check((await evalJs(cdp, `document.querySelectorAll('a[href="${BASE}/agents"]').length`)) >= 1, 'invalid id has Hub link', '');
  await navigate(cdp, '/agents/99', 'normal'); // absent from fixtures → 404
  text = await evalJs(cdp, `document.body.textContent`);
  check(text.includes('Agent 不存在或未公开'), '404 distinct from invalid', '');
  await navigate(cdp, '/agents/5', 'normal');
  endpointMode.memory = 'error';
  await evalJs(cdp, `window.location.reload(); true`);
  await waitFor(cdp, `[...document.querySelectorAll('[role="alert"]')].some((el) => el.textContent.includes('记忆'))`);
  const memoryAlert = await evalJs(cdp, `[...document.querySelectorAll('[role="alert"]')].map((el) => el.textContent).join('|')`);
  check(memoryAlert.includes('记忆加载失败'), 'memory failure explicit', memoryAlert.slice(0, 60));
  const identityStillThere = await evalJs(cdp, `document.querySelector('.agent-identity-name')?.textContent ?? ''`);
  check(identityStillThere.includes('Ecki'), 'memory failure leaves identity intact', identityStillThere.slice(0, 30));
  endpointMode.memory = 'normal';

  // ── 5. Dialog keyboard + creation (width 390) ───────────────────────────
  await navigate(cdp, '/agents/5', 'long');
  await evalJs(cdp, `(() => { const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('使用此 Agent 新建会话')); btn.click(); return true; })()`);
  await sleep(400);
  const focused = await evalJs(cdp, MEASURE);
  check(focused.activeElement?.id === 'conv-name', 'dialog focus entry lands on first field', JSON.stringify(focused.activeElement));
  await key(cdp, 27, 'Escape', 'Escape');
  await sleep(200);
  check((await evalJs(cdp, `document.querySelector('.app-dialog') === null`)), 'Escape closes dialog', '');
  // reopen and submit
  await evalJs(cdp, `(() => { const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('使用此 Agent 新建会话')); btn.click(); return true; })()`);
  await sleep(400);
  capturedInits.length = 0;
  await evalJs(cdp, `(() => { const submit = [...document.querySelectorAll('.app-dialog button')].find((b) => b.textContent.includes('创建会话')); submit.click(); return true; })()`);
  await sleep(1200);
  const finalPath = await evalJs(cdp, `location.pathname`);
  check(finalPath === `${BASE}/chat/901`, 'creation navigates once to canonical /chat/:id', finalPath);
  const init = capturedInits[0];
  check(!!init && init.preset_id === 5 && init.project_id === 0 && init.thinking_level === 'auto' && !('frozen_project_ids' in init),
    'creation init body fixed preset 5 / drift / no frozen ids', JSON.stringify(init));

  // ── 5b. g045 fixed dialog: checkbox keyboard + permission body ──────────
  await navigate(cdp, '/agents/2', 'long');
  await evalJs(cdp, `(() => { const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('使用此 Agent 新建会话')); btn.click(); return true; })()`);
  await sleep(400);
  await evalJs(cdp, `(() => {
    const sel = document.querySelector('#conv-project');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setter.call(sel, '8');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    return sel.value;
  })()`);
  await sleep(300);
  capturedInits.length = 0;
  await evalJs(cdp, `(() => { const box = document.querySelector('.app-check-row input'); box.focus(); return true; })()`);
  await key(cdp, 32, 'Space', ' ', ' ');
  await sleep(150);
  const boxState = await evalJs(cdp, `document.querySelector('.app-check-row input')?.checked`);
  check(boxState === true, 'g045 permission checkbox toggles with Space', String(boxState));
  await evalJs(cdp, `(() => { const submit = [...document.querySelectorAll('.app-dialog button')].find((b) => b.textContent.includes('创建会话')); submit.click(); return true; })()`);
  await sleep(1200);
  const g045Path = await evalJs(cdp, `location.pathname`);
  check(g045Path === `${BASE}/chat/901`, 'g045 creation navigates once to canonical /chat/:id', g045Path);
  const g045Init = capturedInits[0];
  check(!!g045Init && g045Init.preset_id === 2 && g045Init.project_id === 8 && Array.isArray(g045Init.frozen_project_ids) && g045Init.frozen_project_ids.includes(7) && !g045Init.frozen_project_ids.includes(8),
    'g045 creation body: fixed preset 2, project 8, frozen [7] (primary excluded)', JSON.stringify(g045Init));
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const { proc, profileDir, wsUrl } = await launchChrome();
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  const cdp = new CDP(ws);
  try {
    await runScenarios(cdp);
  } finally {
    try { ws.close(); } catch { /* ignore */ }
    proc.kill();
    await sleep(300);
    try { import('node:fs').then(({ rmSync }) => rmSync(profileDir, { recursive: true, force: true })); } catch { /* ignore */ }
  }

  const failed = results.filter((row) => !row.ok);
  console.log(`P2A browser probe: ${results.length - failed.length}/${results.length} assertions passed`);
  for (const row of failed) {
    console.log(`  FAIL  ${row.label}  ${row.detail}`);
  }
  console.log(`Screenshots: ${SHOTS_DIR}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('PROBE CRASH:', error.message);
  process.exit(2);
});
