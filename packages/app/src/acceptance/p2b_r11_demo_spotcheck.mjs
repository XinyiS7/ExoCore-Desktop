// Acceptance-owned R11 real-demo spot check (read-only): after the fix, the
// live production bundle at :8080 must not scroll the document when the
// project-lens agent filter is used below the fold. GETs + client-side filter
// clicks only; no mutations, no paid providers.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = 'http://localhost:8080/app';
const outDir = resolve('Plan/.p2b-acceptance-shots/r11-lens-scroll');
mkdirSync(outDir, { recursive: true });

// Reachability probe first.
let reachable = true;
try {
  const r = await fetch(BASE + '/projects', { signal: AbortSignal.timeout(5000) });
  if (r.status !== 200) reachable = false;
} catch { reachable = false; }
if (!reachable) {
  writeFileSync(resolve(outDir, 'observations-demo.json'), JSON.stringify({ skipped: 'backend unreachable' }, null, 2));
  console.log('SKIP: :8080 unreachable — mock-probe evidence stands');
  process.exit(0);
}

const profile = mkdtempSync(joinTmp());
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9349', `--user-data-dir=${profile}`], { stdio: 'ignore' });
let ws, seq = 0; const pending = new Map();
function joinTmp() { return tmpdir() + '/p2b-r11-demo-' + Math.random().toString(36).slice(2); }
async function send(method, params = {}) {
  const id = ++seq;
  const answer = new Promise((ok, fail) => { pending.set(id, { ok, fail }); ws.send(JSON.stringify({ id, method, params })); });
  return Promise.race([answer, sleep(15000).then(() => { if (pending.has(id)) throw new Error('CDP timeout ' + method); })]);
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  assert.ok(!r.exceptionDetails, JSON.stringify(r.exceptionDetails?.exception?.description ?? r.exceptionDetails));
  return r.result.value;
}
async function until(expression, label, tries = 120) {
  for (let n = 0; n < tries; n++) { try { if (await evaluate(expression)) return; } catch { /* page mid-navigation */ } await sleep(100); }
  throw new Error('timeout ' + label);
}
const SNAP = `(()=>{const sc=document.scrollingElement,app=document.querySelector('.app-scroll');const chip=[...document.querySelectorAll('.project-filter-option')].find(e=>e.querySelector('input:checked'));return{url:location.pathname,docScrollTop:sc.scrollTop,docOverflow:+(sc.scrollHeight-sc.clientHeight).toFixed(1),appScrollTop:app?+app.scrollTop.toFixed(1):null,rows:document.querySelectorAll('.app-recent-row').length,checked:chip?.querySelector('input')?.value??null,chips:[...document.querySelectorAll('.project-filter-option')].map(e=>e.textContent.trim().slice(0,12))};})()`;

const results = { scenario: 'project-detail agent filter below fold', viewport: '1280x480', base: BASE };
try {
  let target;
  for (let n = 0; n < 80; n++) { try { const tabs = await (await fetch('http://127.0.0.1:9349/json')).json(); target = tabs.find(t => t.type === 'page'); if (target) break; } catch { /* booting */ } await sleep(100); }
  assert.ok(target, 'chrome cdp');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { ws.addEventListener('open', ok, { once: true }); ws.addEventListener('error', fail, { once: true }); });
  ws.addEventListener('message', ev => { const m = JSON.parse(String(ev.data)); if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p?.fail(new Error(JSON.stringify(m.error))) : p?.ok(m.result); } });
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 480, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE + '/projects' });
  await until(`document.querySelectorAll('a[href*="/projects/"]').length>0 || !!document.querySelector('.app-recent-row, .project-card, .project-hub')`, 'hub list');
  await sleep(800);
  // Read project ids from the real backend (read-only) — the Hub link hrefs are
  // basename-dependent, so don't rely on selector patterns for discovery.
  const sizes = await evaluate(`(async()=>{try{const r=await fetch('/api/core/projects/',{headers:{Accept:'application/json'}});const rows=await r.json();return (rows||[]).map(p=>String(p.id)).slice(0,8);}catch(e){return [];}})()`);
  results.candidateIds = sizes;
  const pick = await evaluate(`(async()=>{let best=null,bestN=-1;for(const id of ${JSON.stringify(sizes)}){try{const r=await fetch('/api/agents/conversations/',{headers:{Accept:'application/json'}});const rows=await r.json();const n=(rows||[]).filter(x=>String(x.project)===String(id)).length;if(n>bestN){bestN=n;best=id;}}catch{}}return {id:best,rows:bestN};})()`);
  if (!pick.id) { results.note = 'no projects/conversations available on real backend'; writeFileSync(resolve(outDir, 'observations-demo.json'), JSON.stringify(results, null, 2)); console.log(JSON.stringify(results)); process.exit(0); }
  results.picked = pick;
  await send('Page.navigate', { url: `${BASE}/projects/${pick.id}` });
  await until(`document.querySelectorAll('.app-recent-row').length>=1`, 'detail rows');
  await sleep(500);
  const snapshots = {};
  snapshots.before = await evaluate(SNAP);
  if (snapshots.before.chips.length < 2) { results.note = 'no agent chip available on this project'; writeFileSync(resolve(outDir, 'observations-demo.json'), JSON.stringify({ ...results, snapshots }, null, 2)); console.log(JSON.stringify({ ...results, snapshots })); process.exit(0); }
  // wheel-scroll the filter bar into view (via .app-scroll only)
  await evaluate(`(()=>{const app=document.querySelector('.app-scroll');const bar=document.querySelector('.project-filter-bar');if(!app||!bar)return;const ar=app.getBoundingClientRect(),br=bar.getBoundingClientRect();app.scrollTop += br.top-ar.top-60;})()`);
  await sleep(200);
  snapshots.afterWheel = await evaluate(SNAP);
  // find a non-全部 chip and click it
  const pt = await evaluate(`(()=>{const l=[...document.querySelectorAll('.project-filter-option')].find(e=>{const i=e.querySelector('input');return i&&i.value!=='all'});if(!l)return null;const r=l.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,label:l.textContent.trim().slice(0,12)};})()`);
  if (pt) {
    snapshots.clickChip = pt.label;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
    await sleep(300);
    snapshots.afterClick = await evaluate(SNAP);
    // keyboard back to 全部
    for (let s = 0; s < 6; s++) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft' });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft' });
      await sleep(100);
      if ((await evaluate(SNAP)).checked === 'all') break;
    }
    snapshots.afterBackToAll = await evaluate(SNAP);
  }
  results.snapshots = snapshots;
  const ok = ['before', 'afterWheel', 'afterClick', 'afterBackToAll'].every(k => snapshots[k] && snapshots[k].docScrollTop === 0 && snapshots[k].docOverflow === 0);
  results.pass = ok;
  writeFileSync(resolve(outDir, 'observations-demo.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  ws?.close(); chrome.kill(); await sleep(400); try { rmSync(profile, { recursive: true, force: true }); } catch { console.warn('cleanup delayed'); }
}