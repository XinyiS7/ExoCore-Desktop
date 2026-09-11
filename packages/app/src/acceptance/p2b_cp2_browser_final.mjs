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

const root=resolve('packages/app/dist'), out=resolve('Plan/.p2b-acceptance-shots/cp2-final');
assert.ok(existsSync(join(root,'index.html')), 'built app exists');
mkdirSync(out,{recursive:true});
const name='长项目名称'.repeat(24), path='D:/'+ 'unbroken_directory_segment'.repeat(20);
const project={id:41,name,description:'项目说明'.repeat(90),prompt:'SystemPrompt'.repeat(80),work_dir:path,created_at:'2026-01-01T00:00:00Z'};
const requests=[], observations=[]; let branchResponse;
const conv=id=>({id,name:`conv ${id}`,created_at:'2026-09-01T10:00:00Z',frozen_project_ids:[],project:null,project_name:null,agent_type:'standard',agent_preset_id:5,last_message_at:'2026-09-01T10:00:00Z',thinking_level:'auto',memory_injection_enabled:null});
const msg=(id,role,content,index)=>({id,role,content,reasoning_content:null,platform:'deepseek',model_version:'deepseek-v4-flash',token_count:null,index_in_session:index,attachment_ids:[],attachments_meta:null,created_at:'2026-09-01T10:00:00Z'});
const preset={id:5,name:'Fixture agent',description:null,agent_type:'standard',default_model:'deepseek-v4-flash',system_prompt:null,is_visible:true};
const server=createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1:5198').pathname;
  if(pathname.startsWith('/api/')) {
    requests.push({path:pathname,method:req.method});
    if(req.method==='POST' && pathname==='/api/agents/conversations/1/branch/'){branchResponse=res;return;} assert.equal(req.method,'GET','only isolated mocked Knowledge PATCH is allowed');
    let data;
    if(pathname==='/api/agents/conversations/1/' || pathname==='/api/agents/conversations/111/') data=conv(Number(pathname.split('/')[4])); else if(pathname==='/api/agents/chat/1/' || pathname==='/api/agents/chat/111/') data={messages:[msg(1001,'user','question',0),msg(1002,'assistant','Branch fixture response',1)],total_count:2,has_more:false}; else if(pathname==='/api/core/model-catalog/') data={models:[{name:'deepseek-v4-flash',family:'deepseek',abilities:['fc'],compatible_endpoint_ids:[7]}],endpoints:[{id:7,name:'Fixture',provider:'deepseek',execution_type:'direct_api',execution_adapter:'internal_http',payload_format:'openai',cache_transport:'inline_chunk',attachment_transports:['inline_text'],configured:true,enabled:true}],roles:{main:[{model:'deepseek-v4-flash',default_endpoint:7}],support:{}},providers:[]}; else if(pathname==='/api/agents/presets/') data=[preset]; else if(pathname==='/api/agents/conversations/') data=[conv(1)]; else if(pathname==='/api/core/projects/41/files/') data=[{id:101,name:'reference-document.md',size:99,source:'upload',url:null},{id:'kf_201',name:'Synced reference.md',source:'obsidian_sync',url:null}]; else if(pathname==='/api/memory/knowledge/') data=[{id:201,title:'Focus fragment',source_type:'obsidian_md',tags:[],keywords:['plain'],abstract:'original',updated_at:'2026-01-01T00:00:00Z'}]; else if(pathname==='/api/core/projects/') data=[project];
    else if(pathname==='/api/core/projects/41/') data=project;
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
  const inside=()=>evaluate("!!document.querySelector('[role=dialog]')?.contains(document.activeElement)");
  const fit=async stage=>{const d=await evaluate('({viewport:innerWidth,body:document.documentElement.scrollWidth})');assert.ok(d.body<=d.viewport+1,`${stage} horizontal overflow ${JSON.stringify(d)}`);observations.push({stage,...d});};
  for(const width of [390,1280]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:'http://127.0.0.1:5198/app/projects/41'});
    await until("document.querySelectorAll('.project-file-row').length===2 && !!document.querySelector('.project-knowledge-row button')");
    await fit(`resources-${width}`);
    await click('.project-file-delete');await until("!!document.querySelector('[role=dialog]')");assert.ok(await inside());await fit(`delete-${width}`);
    await key('Escape');await until("!document.querySelector('[role=dialog]')");
    assert.ok(await evaluate("document.activeElement?.classList.contains('project-file-delete')"),'delete trigger restored');
    await click('.project-knowledge-row button');await until("document.activeElement?.id==='knowledge-abstract'");await fit(`knowledge-${width}`);
    await click('[aria-label="新增关键词"]');await key('Tab');assert.ok(await inside());
    await key('Escape');await until("!document.querySelector('[role=dialog]')");
    assert.ok(await evaluate("document.activeElement===document.querySelector('.project-knowledge-row button')"),'knowledge trigger restored');
  }
  for(const result of ['success','ambiguous']){
    branchResponse=undefined;
    await send('Page.navigate',{url:'http://127.0.0.1:5198/app/chat/1'});
    await until("!!document.querySelector('[aria-label=\"从该回答派生新会话\"]')");
    await click('[aria-label="从该回答派生新会话"]');await until("!!document.querySelector('[role=dialog]')");
    await key('Escape');await until("!document.querySelector('[role=dialog]')");
    assert.ok(await evaluate("document.activeElement?.getAttribute('aria-label')==='从该回答派生新会话'"),'ordinary available branch trigger restored');
    await click('[aria-label="从该回答派生新会话"]');await until("!!document.querySelector('[role=dialog]')");
    await evaluate("[...document.querySelectorAll('[role=dialog] button')].find(e=>e.textContent.includes('确认创建分支')).setAttribute('data-acceptance-confirm','true')");
    const before=requests.filter(r=>r.method==='POST').length;
    await click('[data-acceptance-confirm]');await until("document.querySelector('[data-acceptance-confirm]')?.disabled===true");
    for(let n=0;n<80&&!branchResponse;n++)await sleep(100);assert.ok(branchResponse,'real branch POST fixture reached');
    // Observe the committed lock transition after React's passive focus effects and a paint.
    await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    console.log('BRANCH_PENDING',result,await evaluate("({tag:document.activeElement?.tagName,text:document.activeElement?.textContent,disabled:document.activeElement?.disabled,inside:!!document.querySelector('[role=dialog]')?.contains(document.activeElement)})"));
    assert.ok(await inside(),'Branch pending keeps native browser focus inside');
    assert.ok(await evaluate("document.activeElement?.textContent.trim()==='取消'"),'Branch pending has enabled cancel anchor');
    await key('Escape');assert.ok(await inside(),'Branch locked Escape suppressed');
    await click('[data-acceptance-confirm]');assert.equal(requests.filter(r=>r.method==='POST').length,before+1,'disabled confirmation never duplicates POST');
    branchResponse.writeHead(201,{'Content-Type':'application/json'});branchResponse.end(JSON.stringify(result==='success'?{conversation_id:111,name:'Fixture branch'}:{session_id:111}));
    if(result==='success')await until("location.pathname==='/app/chat/111' && !document.querySelector('[role=dialog]')");
    else {await until("document.querySelector('[role=dialog]')?.textContent.includes('缺少有效的会话编号')");assert.ok(await evaluate("document.querySelector('[data-acceptance-confirm]')?.disabled"));await key('Escape');assert.ok(await inside());await evaluate("[...document.querySelectorAll('[role=dialog] button')].find(e=>e.textContent.trim()==='取消').setAttribute('data-acceptance-cancel','true')");await click('[data-acceptance-cancel]');await until("!document.querySelector('[role=dialog]')");assert.ok(await evaluate("document.querySelector('[aria-label=\"从该回答派生新会话\"]')?.disabled"),'ambiguous cancellation preserves unavailable trigger and durable lock');}
    observations.push({stage:`branch-${result}`,insidePending:true,singlePost:true});
  }
  assert.equal(requests.filter(r=>r.method!=='GET' && !r.path.endsWith('/branch/')).length,0,'only isolated branch fixture writes');
  writeFileSync(join(out,'observations.json'),JSON.stringify({result:'PASS',environment:'isolated production bundle /app, mocked HTTP only',observations,requests},null,2));
  console.log(JSON.stringify({result:'PASS',observations:observations.length,requests:requests.length,output:out}));
} finally {ws?.close();chrome.kill();server.closeAllConnections();await new Promise(ok=>server.close(ok));await sleep(500);try{rmSync(profile,{recursive:true,force:true});}catch{console.warn('Chrome profile cleanup delayed:',profile);}}