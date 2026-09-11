// Acceptance-owned CP4 five-width/dev+production native matrix, mocked HTTP only.
// Preserve R8 failing artifacts; each review's output has its own directory.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import console from 'node:console';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';

const root=resolve('packages/app/dist'), out=resolve('Plan/.p2b-acceptance-shots/cp4-r2');
assert.ok(existsSync(join(root,'index.html')), 'built app exists');
mkdirSync(out,{recursive:true});
const name='长项目名称'.repeat(24), path='D:/'+ 'unbroken_directory_segment'.repeat(20);
const project={id:41,name,description:'项目说明'.repeat(90),prompt:'SystemPrompt'.repeat(80),work_dir:path,created_at:'2026-01-01T00:00:00Z'};
const requests=[], observations=[];
const server=createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1:5198').pathname;
  if(pathname.startsWith('/api/')) {
    requests.push({path:pathname,method:req.method});
    assert.equal(req.method,'GET','only isolated mocked Knowledge PATCH is allowed');
    let data;
    if(pathname==='/api/core/projects/41/delete-preview/') data={conversations_to_archive:2,files:[{id:101,name:'recovery-file-'+ 'long'.repeat(24)+'.md',size:40}],files_total_size:40}; else if(pathname==='/api/core/projects/41/files/') data=[{id:101,name:'file-'+ 'long'.repeat(24)+'.md',source:'upload',size:40,url:null},{id:'kf_201',name:'Synced file',source:'obsidian_sync',size:20,url:null}]; else if(pathname==='/api/memory/knowledge/') data=[{id:201,title:'Knowledge title '+ '长知识'.repeat(30),source_type:'obsidian_md',tags:[],keywords:['one,two','longkeyword'.repeat(25)],abstract:'长摘要'.repeat(100),updated_at:'2026-01-01T00:00:00Z'}]; else if(pathname==='/api/core/projects/') data=[project];
    else if(pathname==='/api/core/projects/41/') data=project;
    else if(pathname==='/api/agents/conversations/') data=[{id:91,name:'Conversation '+ '长会话'.repeat(35),project:41,project_name:name,agent_type:'standard',agent_preset_id:5,created_at:'2026-01-01T00:00:00Z',last_message_at:'2026-01-01T00:00:00Z'}]; else if(pathname==='/api/agents/presets/') data=[{id:5,name:'Agent '+ '长名字'.repeat(35),agent_type:'standard',description:null,default_model:null,system_prompt:null,is_visible:true}];
    else { res.writeHead(500,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:'unmocked request'})); return; }
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); return;
  }
  let file=join(root,pathname.replace(/^\/app\/?/,''));
  if(!extname(file) || !existsSync(file)) file=join(root,'index.html');
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
  res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':'no-store','Content-Security-Policy':"connect-src 'self';"}); res.end(readFileSync(file));
});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(5198,'127.0.0.1',ok);});
const vite=spawn(process.execPath,[resolve('packages/app/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5196'],{cwd:resolve('packages/app'),stdio:'ignore'});
const profile=mkdtempSync(join(tmpdir(),'p2b-cp1-'));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9348',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
let ws, seq=0;
const pending=new Map();
async function send(method,params={}) { const id=++seq; const answer=new Promise((ok,fail)=>{ pending.set(id,{ok,fail});ws.send(JSON.stringify({id,method,params})); }); return Promise.race([answer,sleep(20000).then(()=>{if(pending.has(id))throw new Error('CDP timeout '+method);})]); }
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
  // Intercept BOTH actual Vite dev and production API calls before any proxy/backend.
  ws.addEventListener('message',async event=>{const msg=JSON.parse(String(event.data));if(msg.method!=='Fetch.requestPaused')return;const {requestId,request}=msg.params;try{assert.equal(request.method,'GET','layout sweep must not mutate');const url=new URL(request.url);const response=await globalThis.fetch('http://127.0.0.1:5198'+url.pathname+url.search);assert.equal(response.status,200,'all APIs explicitly mocked');await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(await response.text()).toString('base64')});}catch(error){console.error(error);await send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});}});
  await send('Fetch.enable',{patterns:[{urlPattern:'*/api/*',requestStage:'Request'}]});
  const failures=[];let checks=0;
  const check=(truth,label)=>{checks++;if(!truth)failures.push(label);};
  const key=async(key,code=key,modifiers=0)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,modifiers});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,modifiers:0});};
  const paint=()=>evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const mark=async(label,attr,scope='document')=>evaluate(`(()=>{const root=${scope};const el=[...root.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!el)throw new Error('missing '+${JSON.stringify(label)});el.setAttribute(${JSON.stringify(attr)},'true');})()`);
  const hit=async selector=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;const top=document.elementFromPoint(x,y);return r.width>0&&r.height>0&&x>=0&&x<innerWidth&&y>=0&&y<innerHeight&&(top===e||e.contains(top));})()`);
  let ready=false;for(let n=0;n<100;n++){try{ready=(await globalThis.fetch('http://127.0.0.1:5196/')).ok;}catch{/* bounded Vite startup */}if(ready)break;await sleep(100);}assert.ok(ready,'real Vite server ready');
  for(const env of ['dev','prod']){
    const origin=env==='dev'?'http://127.0.0.1:5196':'http://127.0.0.1:5198/app';
    if(env==='prod'){
      await send('Page.navigate',{url:origin+'/projects/41'});let controlled=false;
      for(let n=0;n<100;n++){try{controlled=await evaluate('!!navigator.serviceWorker.controller');}catch{/* native initial takeover reload */}if(controlled)break;await sleep(100);}assert.ok(controlled,'real production SW controlled');await sleep(500);
    }
    for(const width of [320,390,767,768,1280]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:850,deviceScaleFactor:1,mobile:false});
      await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
      await send('Page.navigate',{url:origin+'/projects'});await until("document.querySelectorAll('.project-card').length>0 || [...document.querySelectorAll('button')].some(e=>e.textContent.trim()==='新建项目')");await paint();
      const observe=async scene=>{await paint();const geometry=await evaluate("({width:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,dialogs:document.querySelectorAll('[role=dialog]').length})");check(geometry.doc<=width+1&&geometry.body<=width+1,`${env}-${width}-${scene}:no horizontal overflow`);check(geometry.reduced,`${env}-${width}-${scene}:reduced media`);const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});writeFileSync(join(out,`${env}-${width}-${scene}.png`),Buffer.from(shot.data,'base64'));observations.push({env,width,scene,...geometry});};
      const dialogCheck=async(scene,lastSelector)=>{
        await paint();check(await evaluate("!!document.querySelector('[role=dialog]')?.contains(document.activeElement)"),`${env}-${width}-${scene}:initial focus`);
        if(lastSelector)check(await hit(lastSelector),`${env}-${width}-${scene}:scroll hit last action`);
        for(let n=0;n<18;n++){await key('Tab');check(await evaluate("!!document.querySelector('[role=dialog]')?.contains(document.activeElement)"),`${env}-${width}-${scene}:Tab${n}`);}
        for(let n=0;n<5;n++){await key('Tab','Tab',8);check(await evaluate("!!document.querySelector('[role=dialog]')?.contains(document.activeElement)"),`${env}-${width}-${scene}:ShiftTab${n}`);}
        await observe(scene);await key('Escape');await until("!document.querySelector('[role=dialog]')");
      };
      await observe('hub');await mark('新建项目','data-hub-create');check(await hit('[data-hub-create]'),`${env}-${width}:create reachable`);await click('[data-hub-create]');await until("!!document.querySelector('[role=dialog]')");await dialogCheck('create-project','[role=dialog] button[type=submit]');check(await evaluate("document.activeElement?.hasAttribute('data-hub-create')"),`${env}-${width}:create restore`);
      await send('Page.navigate',{url:origin+'/projects/41'});await until("!!document.querySelector('.project-file-delete') && !!document.querySelector('.project-knowledge-row button')");await paint();
      check(await evaluate("document.querySelectorAll('.project-file-row').length===2 && document.querySelectorAll('.project-knowledge-row').length===1"),`${env}-${width}:real fixtures present`);await observe('detail');
      for(const [label,scene] of [['编辑','edit-project'],['开始会话','fixed-create'],['删除项目','archive-preview']]){
        await mark(label,'data-main-action',"document.querySelector('.project-section-actions')");check(await hit('[data-main-action]'),`${env}-${width}-${scene}:trigger reachable`);await click('[data-main-action]');await until("!!document.querySelector('[role=dialog]')");if(scene==='archive-preview')await until("!!document.querySelector('[role=dialog] input[type=checkbox]')");
        await dialogCheck(scene,scene==='archive-preview'?'[role=dialog] .app-dialog-actions button:last-child':'[role=dialog] button[type=submit]');
        check(await evaluate("document.activeElement?.hasAttribute('data-main-action')"),`${env}-${width}-${scene}:trigger restored`);await evaluate("document.querySelector('[data-main-action]')?.removeAttribute('data-main-action')");
      }
      await click('.project-file-delete');await until("!!document.querySelector('[role=dialog]')");await dialogCheck('file-confirm','[role=dialog] .app-dialog-actions button:last-child');
      await click('.project-knowledge-row button');await until("!!document.querySelector('[role=dialog]')");await dialogCheck('knowledge-edit','[role=dialog] button[type=submit]');
    }
  }
  writeFileSync(join(out,'observations.json'),JSON.stringify({result:failures.length?'FAIL':'PASS',checks,failures,observations,requests,environment:'real Vite dev+production PWA controlled; API intercepted/mock only'},null,2));
  console.log(JSON.stringify({result:failures.length?'FAIL':'PASS',checks,failed:failures.length,observations:observations.length,failures,output:out}));
  assert.equal(failures.length,0,'all frozen native layout/accessibility checks');
} finally {ws?.close();chrome.kill();vite.kill();server.closeAllConnections();await new Promise(ok=>server.close(ok));await sleep(500);try{rmSync(profile,{recursive:true,force:true});}catch{console.warn('Chrome profile cleanup delayed:',profile);}}