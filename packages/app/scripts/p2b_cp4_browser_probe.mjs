#!/usr/bin/env node
/**
 * p2b_cp4_browser_probe.mjs — P2B Stage D (CP4) real-browser evidence.
 *
 * Zero new dependencies: drives a real Chrome (headless=new) over the Chrome
 * DevTools Protocol using Node's built-in WebSocket (Node >= 22). Same
 * instrumentation model as the accepted P2A probe (scripts/p2a_browser_probe.mjs).
 *
 * ALL /api/* traffic is intercepted at the CDP Fetch domain and answered with
 * in-process fixtures — no backend, network, real-DB or provider interaction.
 * The intercepted surface is the ONLY traffic the page sees, so dev-server
 * proxy targets are irrelevant to isolation.
 *
 * Service-worker note (R7/H08): a fresh production profile's first SW
 * takeover reloads the page once. This probe disables SW *registration* at
 * the document level for deterministic layout measurement (same as the
 * accepted P2A probe); the real sw.js bundle stays intact in dist and no
 * product code is changed. Initial-takeover behaviour itself is an
 * Acceptance-owned native observation, not measured here.
 *
 * Usage:
 *   dev : node scripts/p2b_cp4_browser_probe.mjs --app=http://127.0.0.1:5176
 *   prod: node scripts/p2b_cp4_browser_probe.mjs --app=http://127.0.0.1:5177 --base=/app
 * Exit 0 = all assertions passed; 1 = FAILs; 2 = crash.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ARGV = process.argv;
const APP = ARGV.includes('--app') ? ARGV[ARGV.indexOf('--app') + 1] : 'http://127.0.0.1:5176';
const BASE = ARGV.includes('--base') ? ARGV[ARGV.indexOf('--base') + 1] : '';
const ORIGIN = new URL(APP).origin;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9337;
const SHOTS_DIR = join(fileURLToPath(new URL('.', import.meta.url)), '.p2b-cp4-shots');
const WIDTHS = [320, 390, 767, 768, 1280];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Fixtures (P2B Stage A–C construction test shapes) ─────────────────────

const LONG_PROJ_NAME = '超级无敌长的项目名称'.repeat(12); // CJK, no break opportunities
const LONG_WORKDIR = 'D:\\x\\' + 'y'.repeat(220); // unbreakable-ish path
const LONG_DESC = '很长的项目描述文本用于验证换行不会撑破布局，重复填充内容以便实际溢出。'.repeat(10);
const LONG_PROMPT = 'S'.repeat(180) + '\n' + '很长的系统提示词用于验证身份事实区换行。'.repeat(10);
const LONG_FILE_NAME = '极其冗长的上传文件名'.repeat(6) + '.md';
const LONG_ABSTRACT = '这是一段非常长的知识摘要，用于验证摘要文本在列表和编辑框中换行显示而不撑破视口。'.repeat(9);
const LONG_KEYWORD = '包含,逗号和空格的原子关键词条目数据'.repeat(4);
const LONG_TAG = '超长记忆标签'.repeat(9);
const LONG_CONV = '很长的会话标题'.repeat(10);

const PRESETS = [
  { id: 5, name: 'Ecki', description: 'fast', agent_type: 'standard', default_model: null, system_prompt: null, is_visible: true },
  { id: 6, name: 'Solaire', description: null, agent_type: 'standard', default_model: null, system_prompt: null, is_visible: true },
];

const wireConv = (id, project, projectName, extra = {}) => ({
  id,
  name: `会话 ${id}`,
  created_at: '2026-09-01T10:00:00Z',
  frozen_project_ids: [],
  project,
  project_name: projectName,
  agent_type: 'standard',
  agent_preset_id: 5,
  last_message_at: '2026-09-01T10:00:00Z',
  thinking_level: 'auto',
  memory_injection_enabled: null,
  ...extra,
});

const CONVERSATIONS = [
  wireConv(321, 7, 'Alpha'),
  wireConv(322, 7, 'Alpha', { name: LONG_CONV }),
  wireConv(323, 0, null),
];

const PROJECT_7 = {
  id: 7,
  name: 'Alpha',
  description: LONG_DESC,
  prompt: LONG_PROMPT,
  work_dir: LONG_WORKDIR,
  created_at: '2026-08-01T00:00:00Z',
};

const PROJECTS = [
  PROJECT_7,
  { id: 8, name: LONG_PROJ_NAME, description: null, prompt: null, work_dir: LONG_WORKDIR, created_at: '2026-08-02T00:00:00Z' },
  { id: 9, name: 'Project 9', description: null, prompt: null, work_dir: null, created_at: '2026-08-03T00:00:00Z' },
];

const FILES = [
  { id: 11, name: LONG_FILE_NAME, file_type: 'text/plain', size: 2048, file: 'http://x/11', source: 'web_upload', created_at: '2026-08-01T00:00:00Z' },
  { id: 'kf_42', name: 'note.md', file_type: 'text/markdown', size: 0, file: null, source: 'obsidian_sync', created_at: '2026-08-02T00:00:00Z' },
  { id: 13, name: 'readme.txt', file_type: 'text/plain', size: 512, file: 'http://x/13', source: null, created_at: '2026-08-03T00:00:00Z' },
];

const KNOWLEDGE = [
  {
    id: 7,
    uid: 'u7',
    title: 'Alpha 知识',
    topic: 'project',
    status: 'active',
    source_type: 'obsidian_md',
    tags: [LONG_TAG, 'deep'],
    keywords: [LONG_KEYWORD, 'alpha', 'beta', ''],
    abstract: LONG_ABSTRACT,
    project: 7,
    created_at: '2026-08-03T00:00:00Z',
    updated_at: '2026-08-04T00:00:00Z',
  },
  {
    id: 8,
    uid: 'u8',
    title: 'short row',
    topic: 'project',
    status: 'active',
    source_type: 'web_upload',
    tags: [],
    keywords: [],
    abstract: '短摘要。',
    project: 7,
    created_at: '2026-08-03T00:00:00Z',
    updated_at: '2026-08-04T00:00:00Z',
  },
];

const DELETE_PREVIEW = {
  conversations_to_archive: 2,
  files: [
    { id: 11, name: LONG_FILE_NAME, size: 2048 },
    { id: 13, name: 'readme.txt', size: 512 },
  ],
  files_total_size: 2560,
};

const capturedInits = [];
const requestLog = [];

function routeHandlers(urlPath, method, postData) {
  const p = urlPath;
  if (p === '/api/agents/presets/') return [200, PRESETS];
  if (p === '/api/agents/conversations/') return [200, CONVERSATIONS];
  if (p === '/api/core/projects/') return [200, PROJECTS];
  if (p === '/api/core/projects/7/') return [200, PROJECT_7];
  if (p === '/api/core/projects/7/files/') return [200, FILES];
  if (p === '/api/memory/knowledge/' && method === 'GET') return [200, KNOWLEDGE];
  if (p === '/api/core/projects/7/delete-preview/') return [200, DELETE_PREVIEW];
  if (p === '/api/agents/sessions/init/' && method === 'POST') {
    capturedInits.push(postData ? JSON.parse(postData) : null);
    return [200, { data: { conversation_id: 901, session_name: 'Probe Session' } }];
  }
  return [404, { detail: 'unexpected endpoint in probe', p }];
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
          if (message.error) entry.reject(new Error(message.error.message));
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

async function launchChrome() {
  const profileDir = mkdtempSync(join(tmpdir(), 'p2b-cp4-chrome-'));
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
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find((target) => target.type === 'page');
      if (page) return { proc, profileDir, wsUrl: page.webSocketDebuggerUrl };
    } catch { /* not up yet */ }
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
    outOfViewport: pick('.app-topbar, .app-topbar-actions, .app-topbar-title, .project-section-heading, .project-section-actions, .project-card, .project-card-meta, .project-facts, .project-file-row, .project-knowledge-row, .project-filter-bar, .app-dialog, .project-profile')
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.right > window.innerWidth + 2 || r.left < -2;
      })
      .map((el) => ({ cls: typeof el.className === 'string' ? el.className : el.tagName, right: Math.round(el.getBoundingClientRect().right), left: Math.round(el.getBoundingClientRect().left) })),
    profileSafeAreaRule: (() => {
      const rules = [];
      for (const sheet of document.styleSheets) {
        let cssRules;
        try { cssRules = sheet.cssRules; } catch { continue; }
        for (const rule of cssRules) {
          if (rule.selectorText && rule.selectorText.includes('.project-profile')) rules.push(rule.cssText);
        }
      }
      return rules.filter((text) => text.includes('env(safe-area-inset-bottom)')).length;
    })(),
    longTextFits: (() => {
      const els = document.querySelectorAll('.project-identity-name, .project-identity-desc, .project-fact-value, .project-file-name, .project-knowledge-title, .project-knowledge-abstract, .project-card-name, .project-card-desc, .project-card-meta');
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
        withinViewport: r.right <= window.innerWidth + 1 && r.left >= -1 && r.width >= 240,
      };
    })(),
    activeElement: (() => {
      const el = document.activeElement;
      if (!el) return null;
      return { tag: el.tagName, cls: typeof el.className === 'string' ? el.className : '', id: el.id, type: el.type ?? null };
    })(),
    checkedFilterWeight: (() => {
      const label = document.querySelector('.project-filter-option:has(input:checked)');
      return label ? getComputedStyle(label).fontWeight : null;
    })(),
    uncheckedFilterWeight: (() => {
      const label = document.querySelector('.project-filter-option:not(:has(input:checked))');
      return label ? getComputedStyle(label).fontWeight : null;
    })(),
    chatNavActive: (() => {
      const el = document.querySelector('.app-nav-item[aria-current="page"] .app-nav-label');
      return el ? el.textContent : null;
    })(),
    hubCardOrder: (() => {
      return [...document.querySelectorAll('.project-hub-grid .project-card-name')].map((el) => el.textContent ?? '');
    })(),
    sectionCount: (() => {
      return [...document.querySelectorAll('.project-section')].map((el) => el.querySelector('h2')?.textContent ?? '');
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
    body: document.body?.textContent?.slice(0, 500) ?? '',
  })`);
  throw new Error(`waitFor timeout: ${expression} — ${text}`);
}

async function navigate(cdp, path) {
  await cdp.send('Page.navigate', { url: `${APP}${BASE}${path}` }).catch((error) => {
    throw new Error(`navigate failed for ${APP}${BASE}${path}: ${error.message}`);
  });
  await waitFor(cdp, `document.querySelector('.app-page') !== null && document.querySelector('.app-spinner') === null`);
  await sleep(300);
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
    if (!['link', 'button', 'radio', 'radiogroup', 'dialog', 'heading', 'alert', 'navigation', 'textbox', 'combobox', 'checkbox', 'list', 'listitem'].includes(role)) continue;
    const props = {};
    for (const prop of node.properties ?? []) props[prop.name] = prop.value?.value;
    rows.push({ role, name: node.name?.value ?? null, props });
  }
  return rows;
}

async function key(cdp, vk, code, keyName, text) {
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown', windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, code, key: keyName, text,
  });
  if (text !== undefined) await cdp.send('Input.dispatchKeyEvent', { type: 'char', text });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp', windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, code, key: keyName,
  });
}

async function shoot(cdp, name, width) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const env = BASE === '/app' ? 'prod' : 'dev';
  writeFileSync(join(SHOTS_DIR, `${env}-${name}-${width}.png`), Buffer.from(result.data, 'base64'));
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
  // Deterministic layout measurement: block SW registration at document level
  // (dist/sw.js and product code remain untouched; see header note).
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `Object.defineProperty(navigator.serviceWorker, 'register', { value: () => Promise.reject(new Error('probe: service worker disabled')) });`,
  });
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: `${ORIGIN}/api/*`, requestStage: 'Request' }] });
  cdp.on('Fetch.requestPaused', async (params) => {
    const url = new URL(params.request.url);
    requestLog.push(`${params.request.method} ${url.pathname}${url.search}`);
    const [status, payload] = routeHandlers(url.pathname, params.request.method, params.request.postData);
    const body = Buffer.from(JSON.stringify(payload)).toString('base64');
    await cdp.send('Fetch.fulfillRequest', {
      requestId: params.requestId,
      responseCode: status,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
      body,
    });
  });

  mkdirSync(SHOTS_DIR, { recursive: true });

  const scenarios = [
    ['hub', '/projects', 'hub'],
    ['detail', '/projects/7', 'detail'],
  ];

  for (const width of WIDTHS) {
    const mobile = width < 768;
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: 1 });

    for (const [name, path, kind] of scenarios) {
      await navigate(cdp, path);

      // Prove the long fixtures actually reached the DOM before measuring.
      const dom = await evalJs(cdp, `(() => {
        const t = document.body.textContent;
        return {
          longProj: t.includes(${JSON.stringify(LONG_PROJ_NAME)}),
          longWorkdir: t.includes(${JSON.stringify(LONG_WORKDIR)}),
          longDesc: t.includes(${JSON.stringify(LONG_DESC.slice(0, 16))}),
          longPrompt: t.includes('S'.repeat(40)),
          longFile: t.includes(${JSON.stringify(LONG_FILE_NAME)}),
          longAbstract: t.includes(${JSON.stringify(LONG_ABSTRACT.slice(0, 16))}),
          longKeyword: t.includes(${JSON.stringify(LONG_KEYWORD.slice(0, 16))}),
          kfRow: t.includes('kf_42') || t.includes('note.md'),
          unknownSource: t.includes('readme.txt'),
        };
      })()`);
      const expect = kind === 'hub'
        ? ['longProj', 'longWorkdir']
        : ['longDesc', 'longPrompt', 'longFile', 'longAbstract', 'longKeyword', 'kfRow', 'unknownSource'];
      const missing = expect.filter((k) => !dom[k]);
      check(missing.length === 0, `${name}@${width} long fixtures actually rendered`, JSON.stringify({ missing, dom }));

      const metrics = await evalJs(cdp, MEASURE);
      const isDetail = kind === 'detail';

      check(!metrics.docOverflowX && !metrics.bodyOverflowX,
        `${name}@${width} no document overflow`, `doc=${metrics.docOverflowX} body=${metrics.bodyOverflowX}`);
      check(metrics.outOfViewport.length === 0,
        `${name}@${width} no element out of viewport`, JSON.stringify(metrics.outOfViewport));
      const allowedOwners = ['app-scroll'];
      const badOwners = metrics.scrollOwners.filter((owner) => !allowedOwners.some((allowed) => owner.cls.includes(allowed)));
      check(badOwners.length === 0, `${name}@${width} single main scroll owner`, JSON.stringify(metrics.scrollOwners));
      check(metrics.longTextFits, `${name}@${width} long text fits or truncates`, '');

      const ax = await axSnapshot(cdp);
      const names = ax.map((row) => `${row.role}:${row.name}`).join(' | ');
      check(metrics.chatNavActive === 'Chat', `${name}@${width} chat nav active via aria-current`, String(metrics.chatNavActive));

      if (kind === 'hub') {
        check(metrics.bottomBar === (mobile ? 'flex' : 'none'), `${name}@${width} hub bottom bar ${mobile ? 'visible' : 'hidden'}`, metrics.bottomBar);
        const order = metrics.hubCardOrder;
        check(order.length === 3, `${name}@${width} three project cards`, JSON.stringify(order));
        check(ax.some((row) => row.role === 'link' && (row.name ?? '').includes(LONG_PROJ_NAME.slice(0, 8))), `${name}@${width} long-name card link named`, names.slice(0, 200));
        check(ax.some((row) => row.role === 'button' && row.name === '新建项目'), `${name}@${width} create button named`, names.slice(0, 200));
      }

      if (kind === 'detail') {
        check(metrics.bottomBar === 'none' || metrics.bottomBar === 'absent', `${name}@${width} detail bottom bar hidden`, metrics.bottomBar);
        check(metrics.sidebar === (mobile ? 'none' : 'flex'), `${name}@${width} detail sidebar ${mobile ? 'hidden' : 'visible'}`, metrics.sidebar);
        check(metrics.profileSafeAreaRule > 0, `${name}@${width} detail safe-area rule present`, `rules=${metrics.profileSafeAreaRule}`);
        const sections = metrics.sectionCount;
        check(sections.length === 4 && sections[1] === '项目文件' && sections[2] === '项目知识' && sections[3] === '会话',
          `${name}@${width} four project sections in order`, JSON.stringify(sections));
        check(sections[0] === 'Alpha', `${name}@${width} first section is the project name`, JSON.stringify(sections[0]));
        check(ax.some((row) => row.role === 'radiogroup' && row.name === '会话筛选'), `${name}@${width} filter radiogroup named`, names.slice(0, 260));
        check(ax.some((row) => row.role === 'button' && row.name === '删除项目'), `${name}@${width} destructive action named`, names.slice(0, 260));
        check(ax.some((row) => row.role === 'button' && row.name === '编辑'), `${name}@${width} edit action named`, names.slice(0, 260));
        check(ax.some((row) => row.role === 'link' && (row.name ?? '').includes(LONG_CONV)), `${name}@${width} long conversation link named`, names.slice(0, 260));
        check(metrics.checkedFilterWeight === '600' && metrics.uncheckedFilterWeight === '400',
          `${name}@${width} filter selected not color-only (600 vs 400)`, JSON.stringify({ checked: metrics.checkedFilterWeight, unchecked: metrics.uncheckedFilterWeight }));
      }

      await shoot(cdp, name, width);
    }

    // ── Dialog scenarios at this width ──────────────────────────────────
    // Edit dialog: focus entry + containment + Escape restore.
    await navigate(cdp, '/projects/7');
    await evalJs(cdp, `(() => { const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '编辑'); btn?.focus(); btn?.click(); return true; })()`);
    await sleep(500);
    let m = await evalJs(cdp, MEASURE);
    check(m.dialog !== null, `edit-dialog@${width} dialog opened`, JSON.stringify(m.dialog));
    check(m.dialog?.withinViewport === true, `edit-dialog@${width} dialog within viewport`, JSON.stringify(m.dialog));
    check(!m.docOverflowX && !m.bodyOverflowX, `edit-dialog@${width} no document overflow`, '');
    check(m.activeElement?.id === 'project-name', `edit-dialog@${width} focus entry on first field`, JSON.stringify(m.activeElement));
    let ax = await axSnapshot(cdp);
    let names = ax.map((row) => `${row.role}:${row.name}`).join(' | ');
    check(ax.some((row) => row.role === 'dialog' && row.name === '编辑项目'), `edit-dialog@${width} dialog named`, names.slice(0, 200));
    await shoot(cdp, 'edit-dialog', width);
    await key(cdp, 27, 'Escape', 'Escape');
    await sleep(250);
    check((await evalJs(cdp, `document.querySelector('.app-dialog') === null`)), `edit-dialog@${width} Escape closes`, '');
    const restored = await evalJs(cdp, `(() => { const el = document.activeElement; return el && el.tagName === 'BUTTON' ? el.textContent.trim() : (el?.id ?? el?.tagName); })()`);
    check(restored === '编辑', `edit-dialog@${width} focus restored to trigger`, String(restored));

    // File delete confirmation dialog (mixed-id row).
    await navigate(cdp, '/projects/7');
    await evalJs(cdp, `(() => { const btn = [...document.querySelectorAll('.project-file-delete')][0]; btn?.click(); return true; })()`);
    await sleep(500);
    m = await evalJs(cdp, MEASURE);
    check(m.dialog !== null && m.dialog?.withinViewport === true, `file-delete-dialog@${width} dialog within viewport`, JSON.stringify(m.dialog));
    check(m.dialog !== null && !m.docOverflowX && !m.bodyOverflowX, `file-delete-dialog@${width} no document overflow`, '');
    check(m.dialog !== null && (await evalJs(cdp, `(() => { const d = document.querySelector('.app-dialog'); return d ? d.contains(document.activeElement) : false; })()`)), `file-delete-dialog@${width} focus inside modal on open`, JSON.stringify(m.activeElement));
    ax = await axSnapshot(cdp);
    names = ax.map((row) => `${row.role}:${row.name}`).join(' | ');
    check(ax.some((row) => row.role === 'dialog' && row.name === '删除文件'), `file-delete-dialog@${width} dialog named`, names.slice(0, 200));
    check(ax.some((row) => row.role === 'button' && row.name === '确认删除'), `file-delete-dialog@${width} destructive confirm named`, names.slice(0, 200));
    await shoot(cdp, 'file-delete-dialog', width);
    await key(cdp, 27, 'Escape', 'Escape');
    await sleep(250);
    check((await evalJs(cdp, `document.querySelector('.app-dialog') === null`)), `file-delete-dialog@${width} Escape closes`, '');

    // Knowledge editor dialog: long abstract/keywords, focus entry.
    await navigate(cdp, '/projects/7');
    await evalJs(cdp, `(() => { const btn = [...document.querySelectorAll('.project-knowledge-row button')].find((b) => b.textContent.includes('编辑')); btn?.click(); return true; })()`);
    await sleep(500);
    m = await evalJs(cdp, MEASURE);
    check(m.dialog !== null && m.dialog?.withinViewport === true, `knowledge-dialog@${width} dialog within viewport`, JSON.stringify(m.dialog));
    check(m.dialog !== null && !m.docOverflowX && !m.bodyOverflowX, `knowledge-dialog@${width} no document overflow`, '');
    check(m.activeElement?.id === 'knowledge-abstract', `knowledge-dialog@${width} focus entry on abstract`, JSON.stringify(m.activeElement));
    ax = await axSnapshot(cdp);
    names = ax.map((row) => `${row.role}:${row.name}`).join(' | ');
    check(ax.some((row) => row.role === 'dialog' && (row.name ?? '').includes('摘要')), `knowledge-dialog@${width} dialog named`, names.slice(0, 200));
    await shoot(cdp, 'knowledge-dialog', width);
    await key(cdp, 27, 'Escape', 'Escape');
    await sleep(250);
    check((await evalJs(cdp, `document.querySelector('.app-dialog') === null`)), `knowledge-dialog@${width} Escape closes`, '');

    // Delete-project preview dialog: destructive reachability + recovery rows.
    await navigate(cdp, '/projects/7');
    await evalJs(cdp, `(() => { const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('删除项目')); btn?.click(); return true; })()`);
    await sleep(900);
    m = await evalJs(cdp, MEASURE);
    check(m.dialog !== null && m.dialog?.withinViewport === true, `delete-dialog@${width} dialog within viewport`, JSON.stringify(m.dialog));
    check(m.dialog !== null && !m.docOverflowX && !m.bodyOverflowX, `delete-dialog@${width} no document overflow`, '');
    const bodyText = await evalJs(cdp, `document.body.textContent`);
    check(bodyText.includes('归档并删除项目'), `delete-dialog@${width} destructive title present`, '');
    check(bodyText.includes(LONG_FILE_NAME.slice(0, 12)), `delete-dialog@${width} long recovery row visible`, '');
    check(bodyText.includes('2 个直接关联会话将归档'), `delete-dialog@${width} archive copy present`, '');
    ax = await axSnapshot(cdp);
    names = ax.map((row) => `${row.role}:${row.name}`).join(' | ');
    check(ax.some((row) => row.role === 'dialog' && row.name === '归档并删除项目'), `delete-dialog@${width} dialog named`, names.slice(0, 200));
    check(ax.some((row) => row.role === 'checkbox'), `delete-dialog@${width} recovery checkboxes exposed`, names.slice(0, 300));
    await shoot(cdp, 'delete-dialog', width);
    await key(cdp, 27, 'Escape', 'Escape');
    await sleep(250);
    check((await evalJs(cdp, `document.querySelector('.app-dialog') === null`)), `delete-dialog@${width} Escape closes`, '');
  }

  // ── Focus/escape keyboard sweeps at widths 320 and 768 ────────────────
  for (const width of [320, 768]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: width < 768 });
    await navigate(cdp, '/projects/7');
    await evalJs(cdp, `(() => { const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '编辑'); btn?.focus(); btn?.click(); return true; })()`);
    await sleep(500);
    let insideBefore = await evalJs(cdp, `(() => { const d = document.querySelector('.app-dialog'); return d ? d.contains(document.activeElement) : false; })()`);
    check(insideBefore, `edit focus entry direct@${width}`, '');
    // Tab cycle: focus must stay inside after several Tabs.
    for (let i = 0; i < 8; i += 1) {
      await key(cdp, 9, 'Tab', 'Tab');
      await sleep(60);
      const stillInside = await evalJs(cdp, `(() => { const d = document.querySelector('.app-dialog'); return d ? d.contains(document.activeElement) : false; })()`);
      check(stillInside, `edit tab cycle step ${i + 1}@${width}`, JSON.stringify(await evalJs(cdp, `({ tag: document.activeElement?.tagName, cls: document.activeElement?.className, id: document.activeElement?.id })`)));
    }
    await key(cdp, 27, 'Escape', 'Escape');
    await sleep(250);
    check((await evalJs(cdp, `document.querySelector('.app-dialog') === null`)), `edit Escape after tab cycle@${width}`, '');
    const restoredBack = await evalJs(cdp, `(() => { const el = document.activeElement; return el && el.tagName === 'BUTTON' ? el.textContent.trim() : (el?.id ?? el?.tagName); })()`);
    check(restoredBack === '编辑', `edit focus restored after tab cycle@${width}`, String(restoredBack));
  }
  // ── D01/D02 constructor evidence (CP4 R8): fixed-Project create Tab
  //     containment in the real renderer, and long-keyword chip wrap/remove
  //     geometry inside the Knowledge editor. ──────────────────────────────
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 800, deviceScaleFactor: 1, mobile: true });
  await navigate(cdp, '/projects/7');
  // D01: open canonical creation via 开始会话; every Tab/Shift+Tab must stay
  // inside the dialog across the full control set.
  await evalJs(cdp, `(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('开始会话'));
    btn?.focus(); btn?.click(); return true;
  })()`);
  await sleep(500);
  {
    const containment = await evalJs(cdp, `(async () => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return { opened: false };
      const all = [...dialog.querySelectorAll('input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')];
      const focusables = all.map((el) => el.id || el.tagName + '.' + (typeof el.className === 'string' ? el.className.split(' ')[0] : ''));
      const steps = [];
      const press = (shift) => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true }));
      for (let i = 0; i < 10; i += 1) {
        press(false);
        steps.push({ inside: dialog.contains(document.activeElement), tag: document.activeElement?.tagName, id: document.activeElement?.id ?? null, cls: document.activeElement?.className ?? null });
      }
      for (let i = 0; i < 4; i += 1) {
        press(true);
        steps.push({ inside: dialog.contains(document.activeElement), tag: document.activeElement?.tagName, id: document.activeElement?.id ?? null, cls: document.activeElement?.className ?? null });
      }
      const insideAll = steps.every((s) => s.inside);
      const distinct = new Set(steps.map((s) => s.id + '|' + s.tag + '|' + String(s.cls))).size;
      return { opened: true, insideAll, distinct, steps, focusables };
    })()`);
    check(containment.opened === true, 'cp4 D01@320 create dialog opened', JSON.stringify(containment).slice(0, 160));
    check(containment.insideAll === true, 'cp4 D01@320 all Tab/Shift+Tab stay inside modal', JSON.stringify(containment.steps));
    check(containment.distinct >= 4, 'cp4 D01@320 trap cycles across multiple controls: ' + JSON.stringify(containment.focusables ?? []), String(containment.distinct));
    await shoot(cdp, 'cp4-d01-create-trap-320', 320);
  }
  // D02: knowledge editor — long atomic keyword wraps inside its chip and the
  // remove control stays within the modal body.
  await navigate(cdp, '/projects/7');
  await waitFor(cdp, `document.querySelectorAll('.project-knowledge-row button').length > 0`);
  await evalJs(cdp, `(() => {
    const btn = [...document.querySelectorAll('.project-knowledge-row button')].find((b) => b.textContent.includes('编辑'));
    btn?.click(); return true;
  })()`);
  await waitFor(cdp, `document.querySelector('[role="dialog"]') !== null`);
  await waitFor(cdp, `document.querySelectorAll('.project-keyword-chip').length > 0`);
  await sleep(200);
  {
    const geo = await evalJs(cdp, `(() => {
      const chips = [...document.querySelectorAll('.project-keyword-chip')];
      const chip = chips.find((c) => c.textContent.length > 40);
      const dialog = document.querySelector('.app-dialog');
      if (!chip || !dialog) return { found: false, chipCount: chips.length, chipLens: chips.map((c) => c.textContent?.length), dialogPresent: !!dialog };
      const body = dialog.querySelector('.app-dialog-body');
      const text = chip.querySelector('.project-keyword-text');
      const remove = chip.querySelector('.project-chip-remove');
      const chipR = chip.getBoundingClientRect();
      const textR = text.getBoundingClientRect();
      const removeR = remove.getBoundingClientRect();
      const bodyR = body.getBoundingClientRect();
      return {
        found: true,
        chipW: Math.round(chipR.width),
        textH: Math.round(textR.height),
        textW: Math.round(textR.width),
        chipTextWrap: getComputedStyle(text).whiteSpace,
        removeVisibleInBody: removeR.right <= bodyR.right + 1 && removeR.left >= bodyR.left - 1,
        removeInViewport: removeR.right <= window.innerWidth + 1 && removeR.left >= 0,
        bodyRight: Math.round(bodyR.right),
        removeRight: Math.round(removeR.right),
        docOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    })()`);
    check(geo.found === true, 'cp4 D02@320 long keyword chip present', JSON.stringify(geo).slice(0, 200));
    check(geo.chipTextWrap === 'normal', 'cp4 D02@320 keyword text wraps (white-space normal)', String(geo.chipTextWrap));
    check(geo.removeVisibleInBody === true && geo.removeInViewport === true,
      'cp4 D02@320 remove control visible in modal body', JSON.stringify(geo).slice(0, 240));
    check(geo.docOverflowX === false, 'cp4 D02@320 no document overflow', String(geo.docOverflowX));
    await shoot(cdp, 'cp4-d02-knowledge-320', 320);
  }
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await navigate(cdp, '/projects/7');
  await waitFor(cdp, `document.querySelectorAll('.project-knowledge-row button').length > 0`);
  await evalJs(cdp, `(() => {
    const btn = [...document.querySelectorAll('.project-knowledge-row button')].find((b) => b.textContent.includes('编辑'));
    btn?.click(); return true;
  })()`);
  await waitFor(cdp, `document.querySelector('[role="dialog"]') !== null`);
  await waitFor(cdp, `document.querySelectorAll('.project-keyword-chip').length > 0`);
  await sleep(200);
  {
    const geo = await evalJs(cdp, `(() => {
      const chips = [...document.querySelectorAll('.project-keyword-chip')];
      const chip = chips.find((c) => c.textContent.length > 40);
      const dialog = document.querySelector('.app-dialog');
      if (!chip || !dialog) return { found: false, chipCount: chips.length, chipLens: chips.map((c) => c.textContent?.length), dialogPresent: !!dialog };
      const body = dialog.querySelector('.app-dialog-body');
      const text = chip.querySelector('.project-keyword-text');
      const remove = chip.querySelector('.project-chip-remove');
      const textR = text.getBoundingClientRect();
      const removeR = remove.getBoundingClientRect();
      const bodyR = body.getBoundingClientRect();
      return {
        found: true,
        textW: Math.round(textR.width),
        textH: Math.round(textR.height),
        textWraps: textR.height > Math.round(textR.height / 16) && textR.width <= bodyR.width,
        removeVisible: removeR.right <= bodyR.right + 1,
        bodyRight: Math.round(bodyR.right),
        removeRight: Math.round(removeR.right),
        docOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    })()`);
    check(geo.found === true && geo.textWraps === true, 'cp4 D02@1280 long keyword wraps inside body', JSON.stringify(geo).slice(0, 240));
    check(geo.removeVisible === true, 'cp4 D02@1280 remove control visible', JSON.stringify(geo).slice(0, 200));
    check(geo.docOverflowX === false, 'cp4 D02@1280 no document overflow', String(geo.docOverflowX));
    await shoot(cdp, 'cp4-d02-knowledge-1280', 1280);
  }
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
    try { const { rmSync } = await import('node:fs'); rmSync(profileDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  const failed = results.filter((row) => !row.ok);
  console.log(`P2B CP4 browser probe (${BASE === '/app' ? 'prod' : 'dev'}): ${results.length - failed.length}/${results.length} assertions passed`);
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