// Acceptance-owned browser observer. Reuses Construction's CDP transport and
// scenarios, but adds owner-selected DOM/hit-target observations and writes
// screenshots to a separate directory. Never edits the Construction tool.
import assert from 'node:assert/strict';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { resolve, join } from 'node:path';

const toolUrl = new URL('../../scripts/p2a_browser_probe.mjs', import.meta.url);
const shots = resolve(process.env.P2A_ACCEPTANCE_SHOTS ?? 'Plan/.p2a-acceptance-shots');
mkdirSync(shots, { recursive: true });
let source = readFileSync(toolUrl, 'utf8');
function replaceOnce(oldText, newText) {
  assert.equal(source.split(oldText).length - 1, 1, `verified instrumentation seam: ${oldText}`);
  source = source.replace(oldText, newText);
}
replaceOnce("const SHOTS_DIR = join(fileURLToPath(new URL('.', import.meta.url)), '.p2a-shots');", `const SHOTS_DIR = ${JSON.stringify(shots)};`);
replaceOnce('await shoot(cdp, name, width);', 'await shoot(cdp, name, width); await globalThis.__p2aAcceptanceObserve(cdp, { name, width, mode }, evalJs, check);');
source = source.replaceAll('import.meta.url', JSON.stringify(toolUrl.href));

const observations = [];
let assertions = 0;
let failures = 0;
globalThis.__p2aAcceptanceObserve = async (cdp, scenario, evaluate, check) => {
  const { name, width, mode } = scenario;
  const assertObservation = (ok, label, details) => {
    assertions += 1;
    if (!ok) failures += 1;
    check(ok, `Independent ${name}@${width}: ${label}`, JSON.stringify(details));
  };
  const data = await evaluate(cdp, `(() => {
    const body = document.body.textContent;
    const longName = '超长Agent名称'.repeat(22);
    const prompt = 'S'.repeat(170);
    const longConversation = '很长的会话名称'.repeat(24);
    const longProject = '非常长的项目名称'.repeat(11);
    const longTag = '长长的记忆标签'.repeat(12);
    const actualWidth = document.documentElement.clientWidth;
    const actualViewport = window.innerWidth;
    const clipBounds = [...document.querySelectorAll('.app-topbar-sub .app-chip, .agent-filter-option, .app-recent-meta .app-chip')].map(el => {
      const rect = el.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width, text: el.textContent?.slice(0, 35) };
    });
    return {
      actualWidth, actualViewport,
      overflow: document.documentElement.scrollWidth > actualWidth,
      namePresent: body.includes(longName),
      promptPresent: body.includes(prompt),
      conversationPresent: body.includes(longConversation),
      projectPresent: body.includes(longProject),
      tagPresent: body.includes(longTag),
      clipBounds,
    };
  })()`);
  assertObservation(data.actualWidth === width && data.actualViewport === width, 'renderer really uses requested CSS width', data);
  assertObservation(!data.overflow, 'document does not expand beyond the viewport', data);
  if (mode === 'long') {
    assertObservation(data.namePresent, 'long Agent identity is actually in the rendered document', data);
    if (!name.startsWith('hub')) {
      assertObservation(data.promptPresent && data.conversationPresent && data.projectPresent && data.tagPresent, 'all long Profile fields actually reached the DOM', data);
      assertObservation(data.clipBounds.every(rect => rect.left >= -1 && rect.right <= width + 1), 'Profile labels remain inside viewport bounds', data.clipBounds);
    }
  }

  // Test reachability after normal scrolling, rather than accepting a scripted
  // element.click() on an off-screen/covered action as a touch-path observation.
  const target = name === 'profile-dialog'
    ? ".app-dialog button[type='submit']"
    : name.startsWith('profile')
      ? 'profile-create'
      : name.startsWith('hub') ? '.agent-card' : "a[href$='/agents']";
  const reachable = await evaluate(cdp, `(() => {
    const selector = ${JSON.stringify(target)};
    const el = selector === 'profile-create'
      ? [...document.querySelectorAll('button')].find(button => button.textContent.includes('使用此 Agent 新建会话'))
      : document.querySelector(selector);
    if (!el) return { found: false };
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { found: true, width: rect.width, height: rect.height, left: rect.left, right: rect.right,
      top: rect.top, bottom: rect.bottom, hit: !!hit && (el === hit || el.contains(hit)), label: el.textContent.trim().slice(0, 80) };
  })()`);
  assertObservation(reachable.found && reachable.width > 0 && reachable.height > 0 && reachable.hit, 'main action is an actual reachable hit target after scrolling', reachable);
  if (name.startsWith('profile') && mode === 'long') {
    const capture = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(shots, `${name}-action-${width}.png`), Buffer.from(capture.data, 'base64'));
  }
  observations.push({ ...scenario, data, reachable });
  writeFileSync(join(shots, 'independent-observations.json'), JSON.stringify({ source: fileURLToPath(toolUrl), assertions, failures, observations }, null, 2));
  console.log(`INDEPENDENT ${name}@${width}: cumulative ${assertions - failures}/${assertions}`);
};

// All imports in the reused instrument are node built-ins. Its self-contained
// main controls Chrome teardown and returns its ordinary assertion exit code.
await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
