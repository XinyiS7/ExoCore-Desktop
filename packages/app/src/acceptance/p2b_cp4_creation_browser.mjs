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

const root=resolve('packages/app/dist'), out=resolve('Plan/.p2b-acceptance-shots/cp4-creation-r2');
assert.ok(existsSync(join(root,'index.html')), 'built app exists');
mkdirSync(out,{recursive:true});
const name='长项目名称'.repeat(24), path='D:/'+ 'unbroken_directory_segment'.repeat(20);
const project={id:41,name,description:'项目说明'.repeat(90),prompt:'SystemPrompt'.repeat(80),work_dir:path,created_at:'2026-01-01T00:00:00Z'};
const requests=[], observations=[]; const creations=[];
const server=createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1:5198').pathname;
  if(pathname.startsWith('/api/')) {
    requests.push({path:pathname,method:req.method});
    if(req.method==='POST' && pathname==='/api/agents/sessions/init/'){let body='';req.on('data',c=>body+=c);req.on('end',()=>creations.push({res,body:JSON.parse(body)}));return;} assert.equal(req.method,'GET','only isolated creation fixture may write');
    let data;
    if(pathname==='/api/core/projects/41/files/') data=[]; else if(pathname==='/api/memory/knowledge/') data=[{id:201,title:'Focus fragment',source_type:'obsidian_md',tags:[],keywords:['longkeyword'.repeat(25)],abstract:'original',updated_at:'2026-01-01T00:00:00Z'}]; else if(pathname==='/api/core/projects/') data=[project,{...project,id:42,name:'Extra permission project'}];
    else if(pathname==='/api/core/projects/41/') data=project;
    else if(pathname==='/api/agents/conversations/') data=[]; else if(pathname==='/api/agents/presets/') data=[{id:5,name:'Native g045',agent_type:'g045',description:null,default_model:null,system_prompt:null,is_visible:true}];
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
  await send('Page.navigate',{url:'http://127.0.0.1:5198/app/projects/41'});let controlled=false;
  for(let n=0;n<100;n++){try{controlled=await evaluate('!!navigator.serviceWorker.controller');}catch{/* native initial SW takeover */}if(controlled)break;await sleep(100);}assert.ok(controlled);await sleep(500);

  const failures=[];let checks=0;const check=(ok,label)=>{checks++;if(!ok)failures.push(label);};
  const key=async(key,modifiers=0)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,modifiers});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,modifiers:0});};
  for(const width of [320,1280])for(const phase of ['ordinary','pending','ambiguous']){
    await send('Emulation.setDeviceMetricsOverride',{width,height:850,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:'http://127.0.0.1:5198/app/projects/41'});
    await until("[...document.querySelectorAll('button')].some(e=>e.textContent.trim()==='开始会话')");await evaluate("[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='开始会话').setAttribute('data-native-create','true')");await click('[data-native-create]');await until("!!document.querySelector('[role=dialog] input[type=radio]')");await click('[role=dialog] input[type=radio]');await until("!!document.querySelector('[role=dialog] input[type=checkbox]')");await click('[role=dialog] input[type=checkbox]');
    let current;
    if(phase!=='ordinary'){
      const count=creations.length;await click('[role=dialog] button[type=submit]');for(let n=0;n<80&&creations.length===count;n++)await sleep(100);assert.equal(creations.length,count+1);current=creations[count];
      if(phase==='ambiguous'){current.res.writeHead(200,{'Content-Type':'application/json'});current.res.end(JSON.stringify({data:{session_id:999}}));await until("document.querySelector('[role=dialog]')?.textContent.includes('创建已锁定')");}
      else await until("document.querySelector('[role=dialog]')?.textContent.includes('创建中')");
    }
    const before=await evaluate("({inside:!!document.querySelector('[role=dialog]')?.contains(document.activeElement),tag:document.activeElement?.tagName})");
    for(let n=0;n<18;n++){await key('Tab');check(await evaluate("!!document.querySelector('[role=dialog]')?.contains(document.activeElement)"),width+' '+phase+' Tab'+n);}
    for(let n=0;n<6;n++){await key('Tab',8);check(await evaluate("!!document.querySelector('[role=dialog]')?.contains(document.activeElement)"),width+' '+phase+' ShiftTab'+n);}
    await key('Escape');await until("!document.querySelector('[role=dialog]')");check(await evaluate("document.activeElement?.hasAttribute('data-native-create')"),width+' '+phase+' restore');
    if(phase==='pending'){current.res.writeHead(200,{'Content-Type':'application/json'});current.res.end(JSON.stringify({data:{conversation_id:101,session_name:'Late native'}}));await sleep(300);check(await evaluate("location.pathname==='/app/projects/41'&&!document.querySelector('[role=dialog]')"),width+' late completion isolation');}
    observations.push({width,phase,beforeTab:before});
  }
  writeFileSync(join(out,'observations.json'),JSON.stringify({result:failures.length?'FAIL':'PASS',checks,failures,observations,requests},null,2));console.log(JSON.stringify({checks,failures,observations}));assert.equal(failures.length,0);
} finally {ws?.close();chrome.kill();server.closeAllConnections();await new Promise(ok=>server.close(ok));await sleep(500);try{rmSync(profile,{recursive:true,force:true});}catch{console.warn('Chrome profile cleanup delayed:',profile);}}