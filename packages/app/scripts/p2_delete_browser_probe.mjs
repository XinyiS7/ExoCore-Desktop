#!/usr/bin/env node
/**
 * p2_delete_browser_probe.mjs — single-conversation delete (T1) real-browser
 * evidence, five widths x dev/prod.
 *
 * Zero new deps: Chrome headless=new over CDP (Node>=22 WebSocket), same
 * instrumented model as the accepted P2A/P2B probes. ALL /api/* traffic is
 * intercepted via CDP Fetch and answered with in-process fixtures — no
 * backend/provider/real-DB interaction. SW registration disabled at document
 * level for deterministic measurement (dist sw.js untouched; first-takeover
 * remains an Acceptance-owned native observation).
 *
 * Scenarios per width: home rows + trigger reachability + dialog a11y
 * (focus entry/Tab containment/Escape restore), cancel = zero DELETE, confirm
 * 204 = one DELETE + row leaves the canonical list after refetch, busy lease
 * gate (localStorage seed -> alert + disabled confirm + zero DELETE),
 * 409 busy = one DELETE + alert + no auto-retry; agent + project entrances
 * open the same shared dialog.
 *
 * Usage: dev  node scripts/p2_delete_browser_probe.mjs --app=http://127.0.0.1:5176
 *         prod node scripts/p2_delete_browser_probe.mjs --app=http://127.0.0.1:5177 --base=/app
 * Exit 0 = all assertions pass; 1 = FAILs; 2 = crash.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ARGV = process.argv;
const grab = (name) => { const eq = ARGV.find((a) => a.startsWith(name + '=')); if (eq !== undefined) return eq.slice(name.length + 1); const i = ARGV.indexOf(name); return i >= 0 ? ARGV[i + 1] : undefined; };
const APP = grab('--app') ?? 'http://127.0.0.1:5176';
const BASE = grab('--base') ?? '';
const ORIGIN = new URL(APP).origin;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDP_PORT = 9338;
const SHOTS_DIR = join(fileURLToPath(new URL('.', import.meta.url)), '.p2-delete-shots');
const WIDTHS = [320, 390, 767, 768, 1280];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const LONG_CONV = '很长的会话标题'.repeat(10);
const PRESETS = [
  { id: 5, name: 'Ecki', description: 'fast', agent_type: 'standard', default_model: null, system_prompt: null, is_visible: true },
];
const wireConv = (id, project, projectName, extra = {}) => ({
  id, name: `会话 ${id}`, created_at: '2026-09-01T10:00:00Z',
  frozen_project_ids: [], project, project_name: projectName,
  agent_type: 'standard', agent_preset_id: 5, last_message_at: '2026-09-01T10:00:00Z',
  thinking_level: 'auto', memory_injection_enabled: null, ...extra,
});
const CONVERSATIONS = [
  wireConv(321, 7, 'Alpha'),
  wireConv(322, 7, 'Alpha', { name: LONG_CONV }),
  wireConv(323, 0, null),
];
const PROJECT_7 = { id: 7, name: 'Alpha', description: '项目描述', prompt: '提示词', work_dir: null, created_at: '2026-08-01T00:00:00Z' };
const PROJECTS = [PROJECT_7, { id: 8, name: 'Project 8', description: null, prompt: null, work_dir: null, created_at: '2026-08-02T00:00:00Z' }, { id: 9, name: 'Project 9', description: null, prompt: null, work_dir: null, created_at: '2026-08-03T00:00:00Z' }];

let deletedIds = new Set();
const requestLog = [];
function routeHandlers(urlPath, method, postData) {
  const p = urlPath;
  if (p === '/api/agents/presets/') return [200, PRESETS];
  if (p === '/api/agents/presets/5/') return [200, PRESETS[0]];
  if (p === '/api/core/projects/') return [200, PROJECTS];
  if (p === '/api/core/projects/7/' && method === 'GET') return [200, PROJECT_7];
  if (p === '/api/core/projects/7/files/') return [200, []];
  if (p === '/api/memory/knowledge/' && method === 'GET') return [200, []];
  if (p === '/api/agents/conversations/' && method === 'DELETE') {
    const id = Number(p.match(/conversations\/(\d+)\/$/ )?.[1]);
    return [409, { code: 'conversation_busy', message: '该会话正在生成回复或处于活动运行时状态，无法删除' }];
  }
  if (p.startsWith('/api/agents/conversations/') && method === 'DELETE') {
    const id = Number(p.match(/conversations\/(\d+)\/$/)?.[1]);
    if (id === 323) return [409, { code: 'conversation_busy', message: '该会话正在生成回复或处于活动运行时状态，无法删除' }];
    deletedIds.add(id);
    return [204, null];
  }
  if (p === '/api/agents/conversations/') return [200, CONVERSATIONS.filter((c) => !deletedIds.has(c.id))];
  return [404, { detail: 'unexpected endpoint in probe', p }];
}

class CDP {
  constructor(ws) { this.ws = ws; this.nextId = 0; this.pending = new Map(); this.handlers = new Map();
    ws.addEventListener('message', (event) => { const message = JSON.parse(event.data);
      if (message.id !== undefined) { const entry = this.pending.get(message.id); if (entry) { this.pending.delete(message.id);
        if (message.error) entry.reject(new Error(message.error.message)); else entry.resolve(message.result); } }
      else if (message.method) { for (const handler of this.handlers.get(message.method) ?? []) handler(message.params); } }); }
  send(method, params = {}) { const id = ++this.nextId;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); }); }
  on(method, handler) { if (!this.handlers.has(method)) this.handlers.set(method, []); this.handlers.get(method).push(handler); }
}

async function launchChrome() {
  const profileDir = mkdtempSync(join(tmpdir(), 'p2-delete-chrome-'));
  const args = ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1280,800', 'about:blank'];
  const proc = spawn(CHROME, args, { stdio: 'ignore' });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`); const targets = await res.json();
      const page = targets.find((target) => target.type === 'page'); if (page) return { proc, profileDir, wsUrl: page.webSocketDebuggerUrl }; } catch { /* retry */ }
    await sleep(250);
  }
  throw new Error(`Chrome debugging endpoint not reachable on port ${CDP_PORT}`);
}

async function evalJs(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) { const desc = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
    throw new Error(`page exception in ${expression.slice(0, 90)}… :: ${desc}`); }
  return result.result.value;
}
async function waitFor(cdp, expression, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) { const value = await evalJs(cdp, `(() => { try { return !!(${expression}); } catch { return false; } })()`); if (value) return true; await sleep(150); }
  let _dbg = '';
    _dbg = await evalJs(cdp, 'JSON.stringify({ dialog: !!document.querySelector("[role=dialog]"), triggers: [...document.querySelectorAll(".conversation-menu-trigger")].map((b) => b.getAttribute("aria-label")), rows: [...document.querySelectorAll(".app-recent-name")].map((el) => el.textContent), body: (document.body?.textContent ?? "").slice(0, 120) })');
  throw new Error('waitFor timeout: ' + expression + ' — ' + String(_dbg));  throw new Error('waitFor timeout: ' + expression + ' — ' + String(_dbg));  throw new Error('waitFor timeout: ' + expression + ' — ' + _dbg);
  throw new Error(`waitFor timeout: ${expression} — ${_state}`);
}
async function navigate(cdp, path) {
  await cdp.send('Page.navigate', { url: `${APP}${BASE}${path}` });
  await waitFor(cdp, `document.querySelector('.app-page') !== null && document.querySelector('.app-spinner') === null`);
  await sleep(400);
}
async function key(cdp, vk, code, keyName) {
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, code, key: keyName });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, code, key: keyName });
}
async function shoot(cdp, name, width) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const env = BASE === '/app' ? 'prod' : 'dev';
  writeFileSync(join(SHOTS_DIR, `${env}-${name}-${width}.png`), Buffer.from(result.data, 'base64'));
}

const results = [];
function check(ok, label, detail = '') { results.push({ ok, label, detail }); }

const MEASURE = `(() => {
  const doc = document.documentElement;
  const triggers = [...document.querySelectorAll('.conversation-menu-trigger')];
  const dialog = document.querySelector('[role="dialog"]');
  const dr = dialog ? dialog.getBoundingClientRect() : null;
  const active = document.activeElement;
  return {
    docOverflowX: doc.scrollWidth > doc.clientWidth,
    bodyOverflowX: document.body.scrollWidth > document.body.clientWidth,
    triggerCount: triggers.length,
    triggersInViewport: triggers.map((el) => { const r = el.getBoundingClientRect(); return r.right <= window.innerWidth + 1 && r.left >= -1; }),
    longNameVisible: [...document.querySelectorAll('.app-recent-name')].some((el) => (el.textContent ?? '').length > 30 && el.getBoundingClientRect().width > 0),
    dialog: dr ? { width: Math.round(dr.width), withinViewport: dr.right <= window.innerWidth + 1 && dr.left >= -1 } : null,
    activeInsideDialog: dialog ? dialog.contains(active) : null,
    activeText: active ? (active.textContent ?? '').trim().slice(0, 24) : null,
    alertText: (() => { const a = document.querySelector('[role="alert"]'); return a ? a.textContent : null; })(),
    confirmDisabled: (() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent ?? '').includes('确认删除') || (x.textContent ?? '').includes('无法删除')); return b ? b.disabled : null; })(),
    pathname: location.pathname,
    rowTexts: [...document.querySelectorAll('.app-recent-name')].map((el) => el.textContent ?? ''),
    dialogOpen: !!dialog,
  };
})()`;

async function openDialogOnRow(cdp, needle) {
  // Menu button on the row -> open menu -> activate the 删除会话 item -> dialog.
  await evalJs(cdp, `(() => {
    const li = [...document.querySelectorAll('.app-recent-item')].find((el) => ((el.querySelector('.app-recent-name')?.textContent ?? '') + (el.textContent ?? '')).includes(${JSON.stringify(needle)}));
    const btn = li?.querySelector('.conversation-menu-trigger');
    btn?.focus(); btn?.click(); return !!btn;
  })()`);
  await waitFor(cdp, `document.querySelector('[role="menu"]') !== null`);
  await evalJs(cdp, `(() => { const item = [...document.querySelectorAll('button[role="menuitem"]')].find((b) => (b.textContent ?? '').includes('删除会话')); item?.click(); return !!item; })()`);
  await waitFor(cdp, `document.querySelector('[role="dialog"]') !== null`);
  await sleep(200);
}

async function runScenarios(cdp) {
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Accessibility.enable');
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `Object.defineProperty(navigator.serviceWorker, 'register', { value: () => Promise.reject(new Error('probe: service worker disabled')) });`,
  });
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: `${ORIGIN}/api/*`, requestStage: 'Request' }] });
  cdp.on('Fetch.requestPaused', async (params) => {
    const url = new URL(params.request.url);
    requestLog.push(`${params.request.method} ${url.pathname}${url.search}`);
    const [status, payload] = routeHandlers(url.pathname, params.request.method, params.request.postData);
    const body = payload === null || payload === undefined ? '' : Buffer.from(JSON.stringify(payload)).toString('base64');
    const headers = payload === null || payload === undefined ? [] : [{ name: 'Content-Type', value: 'application/json' }];
    await cdp.send('Fetch.fulfillRequest', { requestId: params.requestId, responseCode: status, responseHeaders: headers, body });
  });
  mkdirSync(SHOTS_DIR, { recursive: true });

  const deletesFor = (id) => requestLog.filter((r) => r.startsWith('DELETE') && r.includes(`conversations/${id}/`)).length;
  const listGets = () => requestLog.filter((r) => r.startsWith('GET') && r.includes('/api/agents/conversations/')).length;

  for (const width of WIDTHS) {
    const mobile = width < 768;
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: 1 });
    deletedIds = new Set(); // fresh fixtures per width
    requestLog.length = 0; // per-width counts

    // Home: rows + triggers + long-name reachability.
    await navigate(cdp, '/');
    await waitFor(cdp, `document.querySelectorAll('.conversation-menu-trigger').length >= 3`);
    let m = await evalJs(cdp, MEASURE);
    check(!m.docOverflowX && !m.bodyOverflowX, `home@${width} no document overflow`, JSON.stringify({ doc: m.docOverflowX, body: m.bodyOverflowX }));
    check(m.triggerCount === 3, `home@${width} three delete triggers`, String(m.triggerCount));
    check(m.triggersInViewport.every(Boolean), `home@${width} all triggers in viewport`, JSON.stringify(m.triggersInViewport));
    check(m.longNameVisible, `home@${width} long conversation name rendered`, '');
    check(m.rowTexts.filter((t) => t.includes('会话 321')).length === 1, `home@${width} row 321 present`, JSON.stringify(m.rowTexts));

    // Open dialog for 321: named, focus inside, within viewport.
    await openDialogOnRow(cdp, '321');
    m = await evalJs(cdp, MEASURE);
    check(m.dialog?.withinViewport === true, `home-dialog@${width} dialog within viewport`, JSON.stringify(m.dialog));
    check(!m.docOverflowX && !m.bodyOverflowX, `home-dialog@${width} no document overflow`, '');
    check(m.activeInsideDialog === true, `home-dialog@${width} focus inside on open`, JSON.stringify(m.activeText));
    check(m.activeText.includes('确认删除') || m.activeText === '' || m.activeText.includes('取消') || m.activeText.includes('关闭'), `home-dialog@${width} focus on an action`, String(m.activeText));
    await shoot(cdp, 'home-dialog', width);
    await key(cdp, 27, 'Escape', 'Escape');
    await sleep(250);
    check((await evalJs(cdp, `document.querySelector('[role="dialog"]') === null`)), `home-dialog@${width} Escape closes`, '');
    const restored = await evalJs(cdp, `(() => { const el = document.activeElement; return el ? (el.getAttribute('aria-label') ?? el.textContent ?? '').trim() : null; })()`);
    check(restored.includes('会话操作'), `home-dialog@${width} focus restored to trigger`, String(restored));

    // Cancel: zero DELETE.
    await openDialogOnRow(cdp, '321');
    await evalJs(cdp, `(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent ?? '').includes('取消')); b?.click(); return true; })()`);
    await sleep(250);
    check(deletesFor(321) === 0, `home-cancel@${width} cancel sends zero DELETE`, String(deletesFor(321)));

    // Confirm 204: exactly one DELETE, row leaves list after refetch.
    await openDialogOnRow(cdp, '321');
    await evalJs(cdp, `(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent ?? '').includes('确认删除')); b?.click(); return true; })()`);
    await waitFor(cdp, `![...document.querySelectorAll('.app-recent-name')].some((el) => (el.textContent ?? '').includes('会话 321'))`);
    await sleep(200);
    check(deletesFor(321) === 1, `home-confirm@${width} exactly one DELETE to /321/`, String(deletesFor(321)));
    m = await evalJs(cdp, MEASURE);
    check(!m.rowTexts.some((t) => t.includes('会话 321')), `home-confirm@${width} row 321 removed from list`, JSON.stringify(m.rowTexts));
    check(m.rowTexts.some((t) => t.includes('很长的会话标题')) && m.rowTexts.some((t) => t.includes('会话 323')), `home-confirm@${width} siblings 322/323 intact`, JSON.stringify(m.rowTexts));
    check(listGets() >= 2, `home-confirm@${width} canonical list refetch observed`, String(listGets()));

    // Busy gate: seed pending lease for 322 -> alert + disabled confirm + zero DELETE.
    await evalJs(cdp, `window.localStorage.setItem('exo:v4:chat-runtime:322', ${JSON.stringify(JSON.stringify({ version: 1, conversationId: 322, operation: 'send', transport: 'sse', disposition: 'pending', startedAt: Date.now() - 1000, updatedAt: Date.now() - 1000 }))})`);
    await openDialogOnRow(cdp, '很长的会话标题');
    m = await evalJs(cdp, MEASURE);
    check(m.alertText !== null && (m.alertText.includes('正在进行') || m.alertText.includes('等待确认')), `home-busy@${width} busy alert shown`, String(m.alertText));
    check(m.confirmDisabled === true, `home-busy@${width} confirm disabled (无法删除)`, String(m.confirmDisabled));
    await shoot(cdp, 'home-busy', width);
    await key(cdp, 27, 'Escape', 'Escape');
    await sleep(250);
    check(deletesFor(322) === 0, `home-busy@${width} zero DELETE while lease busy`, String(deletesFor(322)));

    // 409 busy from backend (no local lease): one DELETE, alert, no auto-retry.
    await openDialogOnRow(cdp, '323');
    await evalJs(cdp, `(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent ?? '').includes('确认删除')); b?.click(); return true; })()`);
    await waitFor(cdp, `(document.querySelector('[role="alert"]')?.textContent ?? '').includes('运行中') || (document.querySelector('[role="alert"]')?.textContent ?? '').includes('无法删除')`);
    await sleep(900);
    check(deletesFor(323) === 1, `home-409@${width} exactly one DELETE to /323/`, String(deletesFor(323)));
    m = await evalJs(cdp, MEASURE);
    check(m.dialogOpen === true && m.confirmDisabled === true, `home-409@${width} dialog stays, confirm disabled after 409`, JSON.stringify({ open: m.dialogOpen, disabled: m.confirmDisabled }));
    check(m.rowTexts.some((t) => t.includes('会话 323')), `home-409@${width} row 323 NOT deleted`, JSON.stringify(m.rowTexts));
    await key(cdp, 27, 'Escape', 'Escape');
    await sleep(250);

    // Agent entrance: same shared dialog on agent-owned rows.
    await navigate(cdp, '/agents/5');
    await waitFor(cdp, `document.querySelectorAll('.conversation-menu-trigger').length >= 2`);
    m = await evalJs(cdp, MEASURE);
    check(m.triggerCount >= 2, `agent@${width} delete triggers on agent rows`, String(m.triggerCount));
    check(!m.docOverflowX && !m.bodyOverflowX, `agent@${width} no document overflow`, '');
    await openDialogOnRow(cdp, '很长的会话标题');
    m = await evalJs(cdp, MEASURE);
    check(m.dialog?.withinViewport === true && m.activeInsideDialog === true, `agent-dialog@${width} shared dialog opens with focus inside`, JSON.stringify(m.dialog));
    await shoot(cdp, 'agent-dialog', width);
    await key(cdp, 27, 'Escape', 'Escape');
    await sleep(250);

    // Project entrance: canonical lens rows carry the same trigger.
    await navigate(cdp, '/projects/7');
    await waitFor(cdp, `document.querySelectorAll('.conversation-menu-trigger').length >= 1`);
    m = await evalJs(cdp, MEASURE);
    check(m.triggerCount >= 1, `project@${width} delete trigger on project lens rows`, String(m.triggerCount));
    check(!m.docOverflowX && !m.bodyOverflowX, `project@${width} no document overflow`, '');
    await openDialogOnRow(cdp, '很长的会话标题');
    m = await evalJs(cdp, MEASURE);
    check(m.dialog?.withinViewport === true && m.activeInsideDialog === true, `project-dialog@${width} shared dialog opens with focus inside`, JSON.stringify(m.dialog));
    await shoot(cdp, 'project-dialog', width);
    await key(cdp, 27, 'Escape', 'Escape');
    await sleep(250);
    check(deletesFor(322) === 0, `project@${width} no accidental DELETE`, String(deletesFor(322)));
  }

  // Keyboard containment sweep at 320 + 768 (full Tab cycle inside the dialog).
  for (const width of [320, 768]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: width < 768 });
    await navigate(cdp, '/');
    await waitFor(cdp, `document.querySelectorAll('.conversation-menu-trigger').length >= 2`);
    await openDialogOnRow(cdp, '323');
    const sweep = await evalJs(cdp, `(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const steps = [];
      for (let i = 0; i < 6; i += 1) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        steps.push({ inside: dialog.contains(document.activeElement), tag: document.activeElement?.tagName, txt: ((document.activeElement?.textContent ?? '').trim() || document.activeElement?.getAttribute('aria-label') || '').slice(0, 18) });
      }
      let shiftOk = true;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
      shiftOk = dialog.contains(document.activeElement);
      return { steps, shiftOk };
    })()`);
    check(sweep.steps.every((s) => s.inside), `tab-trap@${width} all Tab steps stay inside dialog`, JSON.stringify(sweep.steps));
    check(sweep.shiftOk, `tab-trap@${width} Shift+Tab stays inside`, '');
    await key(cdp, 27, 'Escape', 'Escape');
    await sleep(250);
    check((await evalJs(cdp, `document.querySelector('[role="dialog"]') === null`)), `tab-trap@${width} Escape closes after sweep`, '');
  }
  // per-width list refetch evidence asserted inside home-confirm
}

async function main() {
  const { proc, profileDir, wsUrl } = await launchChrome();
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
  const cdp = new CDP(ws);
  try { await runScenarios(cdp); } finally {
    try { ws.close(); } catch { /* ignore */ }
    proc.kill(); await sleep(300);
    try { const { rmSync } = await import('node:fs'); rmSync(profileDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  const failed = results.filter((row) => !row.ok);
  console.log(`P2 DELETE browser probe (${BASE === '/app' ? 'prod' : 'dev'}): ${results.length - failed.length}/${results.length} assertions passed`);
  for (const row of failed) console.log(`  FAIL  ${row.label}  ${row.detail}`);
  console.log(`Screenshots: ${SHOTS_DIR}`);
  process.exit(failed.length === 0 ? 0 : 1);
}
main().catch((error) => { console.error('PROBE CRASH:', error.message); process.exit(2); });