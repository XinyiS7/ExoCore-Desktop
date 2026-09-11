// Acceptance-owned CP2 pending-modal focus probe, local mocked HTTP only.
// Optional CDP screenshot transport was unreliable; screenshots remain a CP4 obligation, not an assertion bypass.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import console from 'node:console';
import { URL } from 'node:url';

const root=resolve('packages/app/dist'), out=resolve('Plan/.p2b-acceptance-shots/cp2-focus');
assert.ok(existsSync(join(root,'index.html')), 'built app exists');
mkdirSync(out,{recursive:true});
const name='长项目名称'.repeat(24), path='D:/'+ 'unbroken_directory_segment'.repeat(20);
const project={id:41,name,description:'项目说明'.repeat(90),prompt:'SystemPrompt'.repeat(80),work_dir:path,created_at:'2026-01-01T00:00:00Z'};
const requests=[], observations=[]; let pendingResponse;
const server=createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1:5198').pathname;
  if(pathname.startsWith('/api/')) {
    requests.push({path:pathname,method:req.method});
    if(req.method==='PATCH' && pathname==='/api/memory/knowledge/201/'){pendingResponse=res;return;} assert.equal(req.method,'GET','only isolated mocked Knowledge PATCH is allowed');
    let data;
    if(pathname==='/api/core/projects/41/files/') data=[]; else if(pathname==='/api/memory/knowledge/') data=[{id:201,title:'Focus fragment',source_type:'obsidian_md',tags:[],keywords:['plain'],abstract:'original',updated_at:'2026-01-01T00:00:00Z'}]; else if(pathname==='/api/core/projects/') data=[project];
    else if(pathname==='/api/core/projects/41/') data=project;
    else if(pathname==='/api/agents/conversations/' || pathname==='/api/agents/presets/') data=[];
    else { res.writeHead(500,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:'unmocked request'})); return; }
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); return;
  }
  let file=join(root,pathname.replace(/^\/app\/?/,''));
  if(!extname(file) || !existsSync(file)) file=join(root,'index.html');
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
  res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':'no-store','Content-Security-Policy':"connect-src 'self';"}); res.end(readFileSync(file));
});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(5198,'127.0.0.1',ok);});
const profile=mkdtempSync(join(tmpdir(),'p2b-cp1-'));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9348',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
let ws, seq=0;
const pending=new Map();
async function send(method,params={}) { const id=++seq; const answer=new Promise((ok,fail)=>{ pending.set(id,{ok,fail});ws.send(JSON.stringify({id,method,params})); }); return Promise.race([answer,sleep(10000).then(()=>{if(pending.has(id))throw new Error('CDP timeout '+method);})]); }
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;}
async function until(expression){for(let n=0;n<80;n++){if(await evaluate(expression))return;await sleep(100);}throw new Error(`timeout ${expression}`);}
async function click(selector){const point=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;const hit=document.elementFromPoint(x,y);return {x,y,hit:!!hit&&(e===hit||e.contains(hit))};})()`);assert.ok(point?.hit,'real reachable hit target');await send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});}
try {
  let target;
  for(let n=0;n<80;n++){try{const tabs=await(await globalThis.fetch('http://127.0.0.1:9348/json')).json();target=tabs.find(t=>t.type==='page');if(target)break;}catch{/* Chrome CDP may not yet be listening; bounded startup polling. */}await sleep(100);}
  assert.ok(target,'Chrome CDP available');ws=new globalThis.WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',fail,{once:true});});
  ws.addEventListener('message',event=>{const msg=JSON.parse(String(event.data));if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);if(msg.error)p?.fail(new Error(JSON.stringify(msg.error)));else p?.ok(msg.result);}});
  await send('Page.enable');await send('Runtime.enable');
  const width=390;
  await send('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:5198/app/projects/41'});
  await until("!!document.querySelector('.project-knowledge-row button')");
  await click('.project-knowledge-row button');await until("document.activeElement?.id==='knowledge-abstract'");
  await evaluate("(()=>{const el=document.querySelector('#knowledge-abstract');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'edited');el.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await click('.app-dialog button[type=submit]');
  await until("!!document.querySelector('.app-dialog button[type=submit]:disabled')");
  assert.ok(pendingResponse,'mock HTTP PATCH reached isolated server');
  const pendingFocus=await evaluate("({inside:!!document.querySelector('[role=dialog]')?.contains(document.activeElement),tag:document.activeElement?.tagName,id:document.activeElement?.id,disabled:document.activeElement?.disabled})");
  observations.push({stage:'pending-knowledge-write',pendingFocus});
  console.log('PENDING_FOCUS',JSON.stringify(pendingFocus));
  writeFileSync(join(out,'observations.json'),JSON.stringify({observations,requests},null,2));
  // Release fixture response before asserting, so teardown cannot leave a request live.
  pendingResponse.writeHead(200,{'Content-Type':'application/json'});pendingResponse.end(JSON.stringify({msg:'已保存。',updated:['abstract']}));
  assert.ok(pendingFocus.inside,'pending modal must retain focus inside its origin');
  writeFileSync(join(out,'observations.json'),JSON.stringify({result:'PASS',widths:[390],environment:'isolated production bundle /app; mocked HTTP only',observations,requests},null,2));
  console.log(JSON.stringify({result:'PASS',scenarios:observations.length,widths:[390],requests:requests.length,output:out}));
} finally {ws?.close();chrome.kill();server.closeAllConnections();await new Promise(ok=>server.close(ok));await sleep(500);try{rmSync(profile,{recursive:true,force:true});}catch{console.warn('Chrome profile cleanup delayed:',profile);}}