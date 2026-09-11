// Acceptance-owned R11 verification: hidden filter radio/file inputs with an
// ICB-absolute containing block escape the single scroll owner (.app-scroll),
// extend the document's scrollable overflow, and get focus-scrolled on click/
// keyboard activation. The document has hidden overflow (body overflow:hidden)
// so the resulting shift cannot be undone by the user.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import console from 'node:console';
import process from 'node:process';
import { URL } from 'node:url';

const wantFixed = process.env.EXPECT_FIXED === '1';
const validateFix = process.env.VALIDATE_FIX === '1';
const root = resolve('packages/app/dist'), out = resolve('Plan/.p2b-acceptance-shots/r11-lens-scroll');
assert.ok(existsSync(join(root, 'index.html')), 'built app exists');
mkdirSync(out, { recursive: true });

const preset = (id, name) => ({ id, name, agent_type: 'standard', description: null, default_model: null, system_prompt: null, is_visible: true });
const projects = [
  { id: 41, name: '毕设', description: '诊断夹具', prompt: null, work_dir: null, created_at: '2026-01-01T00:00:00Z' },
  { id: 42, name: 'Side project', description: null, prompt: null, work_dir: null, created_at: '2026-01-02T00:00:00Z' },
];
const presets = [preset(5, 'Alessandro'), preset(6, 'Beatrice')];
let currentSize = 90, currentAgentRows = 'mixed';
const requestLog = [];
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:5198');
  const pathname = url.pathname;
  if (pathname.startsWith('/api/')) {
    requestLog.push({ path: pathname, method: req.method });
    assert.equal(req.method, 'GET', 'diagnostic is read-only');
    let data;
    if (pathname === '/api/core/projects/') data = projects;
    else if (pathname === '/api/core/projects/41/') data = projects[0];
    else if (pathname === '/api/core/projects/41/files/') data = [];
    else if (pathname === '/api/memory/knowledge/') data = [];
    else if (pathname === '/api/agents/presets/') data = presets;
    else if (pathname === '/api/agents/presets/5/') data = presets[0];
    else if (pathname === '/api/memory/plasmids/') data = [];
    else if (pathname === '/api/agents/conversations/') data = Array.from({ length: currentSize }, (_, i) => ({
      id: 1000 + i, name: `会话 ${i + 1}`, project: currentAgentRows === 'agent-page' ? (i % 7 === 0 ? 42 : 41) : 41,
      project_name: currentAgentRows === 'agent-page' && i % 7 === 0 ? 'Side project' : '毕设',
      agent_type: 'standard', agent_preset_id: currentAgentRows === 'agent-page' ? 5 : (i < Math.ceil(currentSize * 0.78) ? 5 : 6),
      created_at: '2026-01-01T00:00:00Z', last_message_at: '2026-01-05T00:00:00Z',
    }));
    else { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'unmocked' })); return; }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
    return;
  }
  let file = join(root, pathname.replace(/^\/app\/?/, ''));
  if (!extname(file) || !existsSync(file)) file = join(root, 'index.html');
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
  res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((ok, fail) => { server.once('error', fail); server.listen(5198, '127.0.0.1', ok); });
const profile = mkdtempSync(join(tmpdir(), 'p2b-r11-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9348', `--user-data-dir=${profile}`], { stdio: 'ignore' });
let ws, seq = 0; const pending = new Map();
async function send(method, params = {}) {
  const id = ++seq;
  const answer = new Promise((ok, fail) => { pending.set(id, { ok, fail }); ws.send(JSON.stringify({ id, method, params })); });
  return Promise.race([answer, sleep(15000).then(() => { if (pending.has(id)) throw new Error('CDP timeout ' + method); })]);
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  assert.ok(!r.exceptionDetails, JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function until(expression, label) {
  for (let n = 0; n < 120; n++) { if (await evaluate(expression)) return; await sleep(100); }
  const diag = await evaluate(`(()=>({href:location.href,rowCount:document.querySelectorAll('.app-recent-row').length,err:document.querySelector('.app-error-page')?.textContent?.slice(0,120),bodyHasSections:!!document.querySelector('.project-profile'),pre:document.querySelector('.project-profile')?.textContent?.slice(0,120)}))()`).catch(e=>String(e));
  throw new Error(`timeout ${label ?? expression} \n diag: ${JSON.stringify(diag)}`);
}
const SNAP = `(()=>{
  const rect = e => e ? { top: +e.getBoundingClientRect().top.toFixed(2), bottom: +e.getBoundingClientRect().bottom.toFixed(2) } : null;
  const sc = document.scrollingElement, app = document.querySelector('.app-scroll');
  const input = document.querySelector('.project-filter-option input') ?? document.querySelector('.agent-filter-option input') ?? document.querySelector('.project-file-input');
  const a = app?.getBoundingClientRect(), r = input ? input.getBoundingClientRect() : null;
  const chip = [...document.querySelectorAll('.project-filter-option, .agent-filter-option')].find(e => e.querySelector('input:checked'));
  return {
    docScrollTop: sc.scrollTop, docOverflow: +(sc.scrollHeight - sc.clientHeight).toFixed(2),
    appScrollTop: app.scrollTop,
    appRect: rect(app), topbar: rect(document.querySelector('.app-topbar')),
    filterBar: rect(document.querySelector('.project-filter-bar, .agent-filter-bar')),
    rowCount: document.querySelectorAll('.app-recent-row').length,
    checkedValue: chip?.querySelector('input')?.value ?? null,
    active: { tag: document.activeElement?.tagName, cls: String(document.activeElement?.className ?? '') },
    hiddenInput: { inputRect: rect(input), appRect: rect(app) },
  };
})()`;
const results = {};
async function scenario(name, path, chipText, rowCond, height = 520) {
  currentSize = 90; currentAgentRows = name.includes('agent') ? 'agent-page' : 'mixed';
  await send('Emulation.setDeviceMetricsOverride', { width: 1000, height, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:5198${path}?r11=${name}` });
  await until(rowCond, name + ' rows');
  if (validateFix) {
    // Runtime-only mechanism validation (no source change): contains the
    // hidden inputs inside the scroll owner exactly like the planned repair.
    await evaluate(`document.head.insertAdjacentHTML('beforeend','<style>.project-filter-option{position:relative!important}.agent-filter-option{position:relative!important}.project-file-input{display:none!important}</style>')`);
  }
  await sleep(250);
  const snap = async () => evaluate(SNAP);
  const s = {};
  s.before = await snap();
  // User-like wheel scroll: bring the filter bar into view inside .app-scroll.
  await evaluate(`(()=>{const app=document.querySelector('.app-scroll');const bar=document.querySelector('${chipText.barSel}');const ar=app.getBoundingClientRect(),br=bar.getBoundingClientRect();app.scrollTop += br.top - ar.top - 60;})()`);
  await sleep(150);
  s.afterWheelScroll = await snap();
  // Mouse click on the target chip.
  const point = await evaluate(`(()=>{const l=[...document.querySelectorAll('${chipText.chipSel}')].find(e=>e.textContent.trim()==='${chipText.label}');if(!l)return null;const r=l.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,top:+r.top.toFixed(2)};})()`);
  assert.ok(point, name + ' chip exists');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await until(`document.querySelector('${chipText.chipSel} input:checked')?.value!=='all'`, name + ' filtered');
  await sleep(300);
  s.afterFilterClick = await snap();
  // Keyboard: ArrowLeft from the focused chip reaches 全部. Pre-fix this both
  // re-selects all rows AND focus-scrolls the document again (restoration of
  // the offset is impossible for the user either way).
  // Keyboard: ArrowLeft repeatedly until 全部 is reached (chip order varies
  // between the two pages). Pre-fix this both re-selects all rows AND
  // focus-scrolls the document again (restoration impossible either way).
  for (let step = 0; step < 5; step++) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft' });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft' });
    await sleep(120);
    if (await evaluate(`document.querySelector('${chipText.chipSel} input:checked')?.value==='all'`)) break;
  }
  await until(`document.querySelector('${chipText.chipSel} input:checked')?.value==='all'`, name + ' back to all (keyboard)');
  await sleep(200);
  s.afterBackToAll = await snap();
  // Keyboard activation path: ArrowRight selects the next chip again.
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight' });
  await until(`document.querySelector('${chipText.chipSel} input:checked')?.value!=='all'`, name + ' next chip via keyboard');
  await sleep(200);
  s.afterKeyboard = await snap();
  results[name] = { ...s, height, hiddenInput: s.afterWheelScroll.hiddenInput };
  if (wantFixed) {
    for (const k of ['before', 'afterWheelScroll', 'afterFilterClick', 'afterBackToAll', 'afterKeyboard']) {
      assert.equal(s[k].docScrollTop, 0, `${name}/${k}: document must not scroll`);
      assert.equal(s[k].docOverflow, 0, `${name}/${k}: document must have no hidden overflow`);
    }
    const ir = results[name].hiddenInput.inputRect, ar = results[name].hiddenInput.appRect;
    assert.ok(ir && ar && ir.top >= ar.top - 1 && ir.bottom <= ar.bottom + 1, `${name}: hidden input must stay within the scroll owner ir=${JSON.stringify(ir)} ar=${JSON.stringify(ar)}`);
  }
}
try {
  let target;
  for (let n = 0; n < 80; n++) { try { const tabs = await (await globalThis.fetch('http://127.0.0.1:9348/json')).json(); target = tabs.find(t => t.type === 'page'); if (target) break; } catch { /* chrome booting */ } await sleep(100); }
  assert.ok(target, 'Chrome CDP available');
  ws = new globalThis.WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { ws.addEventListener('open', ok, { once: true }); ws.addEventListener('error', fail, { once: true }); });
  ws.addEventListener('message', event => { const msg = JSON.parse(String(event.data)); if (msg.id) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p?.fail(new Error(JSON.stringify(msg.error))); else p?.ok(msg.result); } });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:5198/app/projects/41?r11=files' });
  let controlled = false;
  for (let n = 0; n < 100; n++) { try { controlled = await evaluate('!!navigator.serviceWorker.controller'); } catch { /* SW takeover reload */ } if (controlled) break; await sleep(100); }
  assert.ok(controlled, 'production SW controlled');
  await sleep(400);
  await scenario('project-lens', '/app/projects/41', { chipSel: '.project-filter-option', barSel: '.project-filter-bar', label: 'Alessandro' }, `document.querySelectorAll('.app-recent-row').length===90`);
  await scenario('agent-profile', '/app/agents/5', { chipSel: '.agent-filter-option', barSel: '.agent-filter-bar', label: '毕设' }, `document.querySelectorAll('.app-recent-row').length>=80`, 520);
  // Squashed-height sample: pushes the agent filter bar below the fold so the
  // same family defect (if present) must manifest pre-fix / stay clean post-fix.
  await scenario('agent-profile-squashed', '/app/agents/5', { chipSel: '.agent-filter-option', barSel: '.agent-filter-bar', label: '毕设' }, `document.querySelectorAll('.app-recent-row').length>=80`, 360);
  currentSize = 90; currentAgentRows = 'mixed';
  await send('Page.navigate', { url: 'http://127.0.0.1:5198/app/projects/41?r11=files' });
  await until(`document.querySelectorAll('.app-recent-row').length===90`, 'files rows');
  if (validateFix) {
    await evaluate(`document.head.insertAdjacentHTML('beforeend','<style>.project-filter-option{position:relative!important}.agent-filter-option{position:relative!important}.project-file-input{display:none!important}</style>')`);
  }
  await sleep(250);
  const fs = {};
  fs.before = await evaluate(SNAP);
  await evaluate(`(()=>{const app=document.querySelector('.app-scroll');const bar=document.querySelector('.project-filter-bar');const ar=app.getBoundingClientRect(),br=bar.getBoundingClientRect();app.scrollTop += br.top - ar.top - 60;})()`);
  await sleep(150);
  fs.afterWheelScroll = await evaluate(SNAP);
  fs.hiddenInput = fs.afterWheelScroll.hiddenInput;
  const btn = await evaluate(`(()=>{const b=[...document.querySelectorAll('.app-btn')].find(e=>e.textContent.includes('上传文件'));if(!b)return null;const r=b.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,disabled:b.disabled};})()`);
  assert.ok(btn && !btn.disabled, 'upload button clickable');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: btn.x, y: btn.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: btn.x, y: btn.y, button: 'left', clickCount: 1 });
  await sleep(300);
  fs.afterUploadClick = await evaluate(SNAP);
  results['files-upload'] = fs;
  if (wantFixed || validateFix) {
    assert.equal(fs.afterUploadClick.docScrollTop, 0, 'files/upload: document must not scroll');
    assert.equal(fs.afterUploadClick.docOverflow, 0, 'files/upload: document must have no hidden overflow');
    assert.equal(fs.before.docOverflow, 0, 'files/upload: no overflow before interaction');
  }
  if (validateFix) { for (const [k, v] of Object.entries(results)) if (v.before) assert.equal(v.before.docOverflow, 0, `validate ${k}: no overflow`); }
  writeFileSync(join(out, `observations-${wantFixed ? 'after' : 'before'}.json`), JSON.stringify({ wantFixed, results, requestLog }, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); await new Promise(ok => server.close(ok));
  await sleep(400); try { rmSync(profile, { recursive: true, force: true }); } catch { console.warn('profile cleanup delayed'); }
}