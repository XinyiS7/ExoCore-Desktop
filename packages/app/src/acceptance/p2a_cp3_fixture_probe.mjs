// Acceptance-owned. Execute with node; never modifies construction scripts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { URL } from 'node:url';
import test from 'node:test';

const source = readFileSync(new URL('../../scripts/p2a_browser_probe.mjs', import.meta.url), 'utf8');
const start = source.indexOf('const LONG_NAME');
const end = source.indexOf('class CDP');
assert.ok(start >= 0 && end > start, 'construction fixture/handler extraction boundaries must exist');
const context = vm.createContext({});
vm.runInContext(source.slice(start, end), context);
const evaluate = expression => vm.runInContext(expression, context);
// Same state installed by navigate(..., 'long'). R5 source inspection confirmed
// Fetch.requestPaused now calls routeHandlers(path, method, body), with no mode
// argument. This diagnostic follows that seam; no signature is a product gate.
evaluate("Object.keys(endpointMode).forEach(key => { endpointMode[key] = 'long'; })");
const actual = path => evaluate(`routeHandlers(${JSON.stringify(path)}, 'GET', undefined)[1]`);

test('CP3 fixture entry: long Hub actually receives the long Agent identity', () => {
  const row = actual('/api/agents/presets/').find(item => item.id === 5);
  assert.equal(row.name, evaluate('LONG_NAME'));
});
test('CP3 fixture entry: long Profile actually receives the unbroken and multiline Prompt', () => {
  assert.equal(actual('/api/agents/presets/5/').system_prompt, evaluate('LONG_PROMPT'));
});
test('CP3 fixture entry: long Conversation lens actually receives long Conversation and Project names', () => {
  const rows = actual('/api/agents/conversations/');
  assert.equal(rows.find(item => item.id === 321).name, evaluate('LONG_CONV'));
  assert.equal(rows.find(item => item.project === 8)?.project_name, evaluate('LONG_PROJ'));
});
test('CP3 fixture entry: long Memory actually receives the long tag', () => {
  assert.ok(actual('/api/memory/plasmids/').some(item => item.tags.includes(evaluate('LONG_TAG'))));
});
