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

const root=resolve('packages/app/dist'), out=resolve('Plan/.p2b-acceptance-shots/cp3');
assert.ok(existsSync(join(root,'index.html')), 'built app exists');
mkdirSync(out,{recursive:true});
const name='长项目名称'.repeat(24), path='D:/'+ 'unbroken_directory_segment'.repeat(20);
const project={id:41,name,description:'项目说明'.repeat(90),prompt:'SystemPrompt'.repeat(80),work_dir:path,created_at:'2026-01-01T00:00:00Z'};
const requests=[], observations=[]; let previewCalls=0, removed=false; const deletes=[];
const server=createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1:5198').pathname;
  if(pathname.startsWith('/api/')) {
    requests.push({path:pathname,method:req.method});
    if(req.method==='DELETE' && pathname==='/api/core/projects/41/'){let body='';req.on('data',chunk=>{body+=chunk;});req.on('end',()=>deletes.push({res,body:JSON.parse(body)}));return;} if(pathname==='/api/core/projects/41/delete-preview/'){previewCalls++;res.writeHead(previewCalls===2?503:200,{'Content-Type':'application/json'});res.end(JSON.stringify(previewCalls===2?{error:'fresh preview unavailable'}:{conversations_to_archive:2,files:[{id:previewCalls===1?71:72,name:previewCalls===1?'original.md':'fresh.md',size:20}],files_total_size:20}));return;} assert.equal(req.method,'GET','only isolated mocked Knowledge PATCH is allowed');
    let data;
    if(pathname==='/api/core/projects/41/files/') data=[]; else if(pathname==='/api/memory/knowledge/') data=[{id:201,title:'Focus fragment',source_type:'obsidian_md',tags:[],keywords:['plain'],abstract:'original',updated_at:'2026-01-01T00:00:00Z'}]; else if(pathname==='/api/core/projects/') data=removed?[]:[project];
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
  const key=async(key,code=key,modifiers=0)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,modifiers});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,modifiers:0});};
  const paint=()=>evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const mark=async(text,attr)=>evaluate(`(()=>{const el=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!el)throw new Error('missing button');el.setAttribute(${JSON.stringify(attr)},'true');})()`);
  const fit=async(stage,width)=>{const d=await evaluate('({viewport:innerWidth,body:document.documentElement.scrollWidth})');assert.ok(d.body<=d.viewport+1,JSON.stringify(d));observations.push({stage,width,...d});};
  // Warm the real PWA before user interactions: first-install controllerchange
  // deliberately reloads this existing app, outside the preview lifecycle.
  await send('Page.navigate',{url:'http://127.0.0.1:5198/app/projects/41'});
  let controlled=false;
  for(let n=0;n<100;n++){try{controlled=await evaluate('!!navigator.serviceWorker.controller');}catch{/* First activation replaces the execution context. */}if(controlled)break;await sleep(100);}
  assert.ok(controlled,'PWA installation reached controlled steady state');await sleep(500);
  console.log('PWA_READY',await evaluate("({navigation:performance.getEntriesByType('navigation')[0]?.type,controller:navigator.serviceWorker.controller?.scriptURL})"));
  for(const width of [390,1280]){
    previewCalls=0;removed=false;const startDeletes=deletes.length;
    await send('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:'http://127.0.0.1:5198/app/projects/41'});
    await until("[...document.querySelectorAll('button')].some(e=>e.textContent.trim()==='开始会话')");
    await mark('开始会话','data-create');await click('[data-create]');await until("!!document.querySelector('[role=dialog]')");await paint();
    assert.ok(await evaluate("document.querySelector('[role=dialog]').contains(document.activeElement)"));
    assert.ok(await evaluate("!document.querySelector('[role=dialog] select')"),'fixed project mode has no Drift selector');await fit('fixed-project-create',width);
    await key('Escape');await until("!document.querySelector('[role=dialog]')");assert.ok(await evaluate("document.activeElement?.hasAttribute('data-create')"));
    await mark('删除项目','data-delete');await click('[data-delete]');await until("!!document.querySelector('[role=dialog] input[type=checkbox]')");await paint();await fit('archive-preview',width);
    await click('[role=dialog] input[type=checkbox]');await mark('重新获取预览','data-refresh');await click('[data-refresh]');
    await until("document.querySelector('[role=dialog]')?.textContent.includes('fresh preview unavailable')");
    await mark('确认归档并删除','data-confirm');assert.ok(await evaluate("document.querySelector('[data-confirm]').disabled"));await click('[data-confirm]');assert.equal(deletes.length,startDeletes,'native failed preview cannot DELETE');
    observations.push({stage:'failed-preview-blocked',width});
    await mark('重试预览','data-retry');await click('[data-retry]');await until("document.querySelector('[role=dialog]')?.textContent.includes('fresh.md')");
    assert.ok(await evaluate("!document.querySelector('[role=dialog] input[type=checkbox]').checked"));
    await click('[data-confirm]');for(let n=0;n<80&&deletes.length===startDeletes;n++)await sleep(100);assert.equal(deletes.length,startDeletes+1);await paint();
    assert.deepEqual(deletes[startDeletes].body,{keep_file_ids:[]});assert.ok(await evaluate("document.querySelector('[role=dialog]').contains(document.activeElement)"));
    await key('Tab');await key('Tab','Tab',8);await key('Escape');assert.ok(await evaluate("document.querySelector('[role=dialog]').contains(document.activeElement)"));
    await click('[data-confirm]');assert.equal(deletes.length,startDeletes+1,'pending duplicate blocked');observations.push({stage:'delete-pending-contained',width});
    deletes[startDeletes].res.writeHead(409,{'Content-Type':'application/json'});deletes[startDeletes].res.end(JSON.stringify({error:'partial restore',code:'file_rollback_failed'}));
    await until("document.querySelector('[role=dialog]')?.textContent.includes('请手动检查服务器文件系统')");await fit('rollback-warning',width);assert.equal(deletes.length,startDeletes+1,'error never auto retries');
    await click('[data-confirm]');for(let n=0;n<80&&deletes.length===startDeletes+1;n++)await sleep(100);assert.equal(deletes.length,startDeletes+2);removed=true;
    deletes[startDeletes+1].res.writeHead(204);deletes[startDeletes+1].res.end();await until("location.pathname==='/app/projects' && !document.querySelector('[role=dialog]')");observations.push({stage:'204-hub-navigation',width});
  }
  assert.equal(requests.filter(r=>r.method!=='GET'&&r.method!=='DELETE').length,0);
  writeFileSync(join(out,'observations.json'),JSON.stringify({result:'PASS',environment:'production bundle mocked HTTP; no real deletion',observations,requests},null,2));
  console.log(JSON.stringify({result:'PASS',observations:observations.length,deletes:deletes.length,output:out}));
} catch(error) { console.error('CP3_DIAGNOSTIC',JSON.stringify({previewCalls,requests,dom:await evaluate('document.body.innerText')})); throw error; } finally {ws?.close();chrome.kill();server.closeAllConnections();await new Promise(ok=>server.close(ok));await sleep(500);try{rmSync(profile,{recursive:true,force:true});}catch{console.warn('Chrome profile cleanup delayed:',profile);}}