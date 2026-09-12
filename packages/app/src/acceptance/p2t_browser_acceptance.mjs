/* global Buffer, fetch, WebSocket, console, process */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import { URL } from 'node:url';

const PORT=5201, CDP=9351;
const dist=resolve('packages/app/dist');
const out=resolve('Plan/evidence/p2t-acceptance');
const chromeExe='C:/Program Files/Google/Chrome/Application/chrome.exe';
assert.ok(existsSync(join(dist,'index.html')),'production dist exists');
assert.ok(existsSync(chromeExe),'Chrome exists');
mkdirSync(out,{recursive:true});
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
function wav(seconds=4, rate=8000){const samples=seconds*rate,b=Buffer.alloc(44+samples*2);b.write('RIFF',0);b.writeUInt32LE(36+samples*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples*2,40);return b;}
const audio=wav();
const preset={id:5,name:'Fixture',description:null,agent_type:'standard',default_model:'deepseek-v4-flash',system_prompt:null,is_visible:true};
const catalog={models:[{name:'deepseek-v4-flash',family:'deepseek',abilities:[],compatible_endpoint_ids:[7]}],endpoints:[{id:7,name:'Fixture',provider:'deepseek',execution_type:'direct_api',execution_adapter:'internal_http',payload_format:'openai',cache_transport:'inline_chunk',attachment_transports:[],configured:true,enabled:true}],roles:{main:[{model:'deepseek-v4-flash',default_endpoint:7}],support:{}},providers:[]};
const conv={id:7,name:'P2T independent geometry',created_at:'2026-09-01T00:00:00Z',frozen_project_ids:[],project:0,project_name:null,agent_type:'standard',agent_preset_id:5,last_message_at:null,thinking_level:'auto',memory_injection_enabled:null};
const msg=(id,text,directed=false)=>({id,role:'assistant',content:text,reasoning_content:null,platform:'deepseek',model_version:'v4-flash',token_count:null,index_in_session:id,attachment_ids:[],attachments_meta:null,created_at:'2026-09-12T10:00:00Z',voice:{available:true,directed,cached:id===72}});
const rows=[msg(71,'未生成入口。'),msg(72,'可播放并验证 Range 拖动。',true),msg(73,'生成中。'),msg(74,'失败状态必须显示真实原因。')];
const requests=[];const responses=[];
const server=createServer((req,res)=>{try{
  const path=new URL(req.url,`http://127.0.0.1:${PORT}`).pathname;
  if(path.startsWith('/api/')){requests.push({path,method:req.method,range:req.headers.range??null});let body,status=200;
    if(path==='/api/agents/presets/') body=[preset];
    else if(path==='/api/core/model-catalog/') body=catalog;
    else if(path==='/api/agents/conversations/7/') body=conv;
    else if(path==='/api/agents/conversations/7/cache/') body={active:false,platform:null,has_snapshot:false};
    else if(path==='/api/agents/chat/7/') body={messages:rows,total_count:rows.length,has_more:false};
    else if(path==='/api/agents/conversations/7/messages/72/tts/'&&req.method==='POST') body={status:'playable',content_url:'/api/agents/conversations/7/messages/72/tts/content/',duration_ms:4000};
    else if(path==='/api/agents/conversations/7/messages/73/tts/'&&req.method==='POST'){status=202;body={status:'generating',retry_after_ms:60000};}
    else if(path==='/api/agents/conversations/7/messages/74/tts/'&&req.method==='POST'){status=503;body={status:'failed_retryable',code:'runtime_offline',message:'Voice runtime is offline.'};}
    else if(path==='/api/agents/conversations/7/messages/72/tts/content/'){
      const range=req.headers.range;let start=0,end=audio.length-1,responseStatus=200;
      const match=typeof range==='string'?/^bytes=([0-9]*)-([0-9]*)$/.exec(range):null;
      if(match&&(match[1]||match[2])){if(match[1]){start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),audio.length-1):audio.length-1;}else{const suffix=Number(match[2]);start=Math.max(0,audio.length-suffix);}responseStatus=206;}
      const bodySlice=audio.subarray(start,end+1);const headers={'Content-Type':'audio/wav','Content-Length':bodySlice.length,'Cache-Control':'private, no-cache, max-age=0','Content-Disposition':'inline; filename="msg_72.wav"','Accept-Ranges':'bytes'};
      if(responseStatus===206)headers['Content-Range']=`bytes ${start}-${end}/${audio.length}`;
      responses.push({path,status:responseStatus,range:range??null,contentRange:headers['Content-Range']??null,contentLength:bodySlice.length});res.writeHead(responseStatus,headers);res.end(bodySlice);return;
    } else {status=404;body={error:'not_found'};}
    res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));return;
  }
  let rel=path.replace(/^\/app\/?/,'');let file=join(dist,rel);if(!extname(file)||!existsSync(file))file=join(dist,'index.html');
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
  res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(readFileSync(file));
}catch(e){res.writeHead(500);res.end(String(e));}});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(PORT,'127.0.0.1',ok)});
const profile=mkdtempSync(join(tmpdir(),'p2t-accept-'));
const chrome=spawn(chromeExe,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${CDP}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
let ws,seq=0;const pending=new Map();
async function send(method,params={}){const id=++seq;const p=new Promise((ok,fail)=>pending.set(id,{ok,fail}));ws.send(JSON.stringify({id,method,params}));return Promise.race([p,sleep(10000).then(()=>{throw new Error(`CDP timeout ${method}`)})]);}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;}
async function until(expr,label=expr){for(let i=0;i<100;i++){if(await evaluate(expr))return;await sleep(100);}throw new Error(`timeout: ${label}`);}
async function point(selector,ratio=.5){return evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect(),x=r.left+r.width*${ratio},y=r.top+r.height/2,h=document.elementFromPoint(x,y);return{x,y,ok:!!h&&(h===e||e.contains(h)),w:r.width,h:r.height};})()`);}
async function click(selector,ratio=.5){const p=await point(selector,ratio);assert.ok(p?.ok,`reachable ${selector}`);await send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',buttons:1,clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',buttons:0,clickCount:1});return p;}
const results=[];
try{
 let target;for(let i=0;i<100;i++){try{const tabs=await(await fetch(`http://127.0.0.1:${CDP}/json`)).json();target=tabs.find(t=>t.type==='page');if(target)break;}catch{/* Acceptance polling/cleanup is intentionally best-effort. */}await sleep(100);}assert.ok(target,'CDP target');
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((ok,fail)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',fail,{once:true})});ws.addEventListener('message',ev=>{const m=JSON.parse(String(ev.data));if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.fail(new Error(JSON.stringify(m.error))):p?.ok(m.result)}});await send('Page.enable');await send('Runtime.enable');
 // Reach a service-worker-controlled steady state before measured interaction.
 // First installation deliberately reloads the already-open app on controllerchange.
 await send('Page.navigate',{url:`http://127.0.0.1:${PORT}/app/chat/7?warmup=1`});
 let controlled=false;for(let i=0;i<100;i++){try{controlled=await evaluate('!!navigator.serviceWorker.controller');}catch{/* First activation replaces the execution context. */}if(controlled)break;await sleep(100);}assert.ok(controlled,'PWA installation reached controlled steady state');await sleep(500);console.log('PWA_READY',await evaluate("({navigation:performance.getEntriesByType('navigation')[0]?.type,controller:navigator.serviceWorker.controller?.scriptURL})"));
 for(const width of [320,390,1280]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:720,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:`http://127.0.0.1:${PORT}/app/chat/7?w=${width}`});
  await until("document.querySelectorAll('[aria-label=\"朗读此条消息\"]').length===4",'four voice entries');
  await click('article:nth-of-type(2) [aria-label="朗读此条消息"]');
  await until("!!document.querySelector('article:nth-of-type(2) [role=slider]')",'playable slider');
  await click('article:nth-of-type(3) [aria-label="朗读此条消息"]');
  await until("!!document.querySelector('article:nth-of-type(3) [aria-label=\"语音生成中\"]')",'generating');
  await click('article:nth-of-type(4) [aria-label="朗读此条消息"]');
  await until("!!document.querySelector('article:nth-of-type(4) [aria-label=\"重试生成语音\"]')",'retry state');
  await until("(()=>{const a=document.querySelector('article:nth-of-type(2) audio');return a&&Number.isFinite(a.duration)&&a.duration>0})()",'accepted Range WAV metadata');
  const pauseSel='article:nth-of-type(2) [aria-label="暂停朗读"]';if(await evaluate(`!!document.querySelector(${JSON.stringify(pauseSel)})`))await click(pauseSel);
  const slider='article:nth-of-type(2) [role="slider"]';const before=await evaluate("(()=>{const a=document.querySelector('article:nth-of-type(2) audio');return {time:a.currentTime,duration:a.duration,readyState:a.readyState,networkState:a.networkState,buffered:[...Array(a.buffered.length)].map((_,i)=>[a.buffered.start(i),a.buffered.end(i)]),seekable:[...Array(a.seekable.length)].map((_,i)=>[a.seekable.start(i),a.seekable.end(i)])}})()");console.log("MEDIA_BEFORE",width,JSON.stringify(before));await click(slider,.5);await sleep(150);const after=await evaluate("(()=>{const a=document.querySelector('article:nth-of-type(2) audio');return a?a.currentTime:null})()");
  const data=await evaluate(`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};const rangeBoxes=e=>{const t=[...e.childNodes].filter(n=>n.nodeType===3);if(!t.length)return 0;const q=document.createRange();q.selectNodeContents(e);return q.getClientRects().length};const heads=[...document.querySelectorAll('.app-msg-head')].map(e=>({rect:rect(e),scroll:e.scrollWidth,client:e.clientWidth,modelLines:e.querySelector('.app-msg-model')?rangeBoxes(e.querySelector('.app-msg-model')):0,branchLines:e.querySelector('.app-msg-actions button:last-child')?rangeBoxes(e.querySelector('.app-msg-actions button:last-child')):0}));const controls=[...document.querySelectorAll('.app-voice-control')].map(e=>{const r=rect(e),b=e.querySelector('button'),br=rect(b);const points=[.25,.5,.75].map(f=>{const h=document.elementFromPoint(br.left+br.width*f,br.top+br.height/2);return !!h&&(h===b||b.contains(h))});return{rect:r,scroll:e.scrollWidth,client:e.clientWidth,button:br,points}});const retry=[...document.querySelectorAll('article')].find(e=>e.textContent.includes('失败状态必须显示真实原因'))?.querySelector('[aria-label="重试生成语音"]')??null;let tx={width:0,height:0};if(retry){const tr=document.createRange();tr.selectNodeContents(retry);tx=rect(tr)}return{viewport:innerWidth,doc:document.documentElement.scrollWidth,scroller:(()=>{const s=document.querySelector('.app-scroll');return s?{scroll:s.scrollWidth,client:s.clientWidth}:{scroll:null,client:null}})(),heads,controls,retry:retry?{text:retry.textContent.trim(),font:parseFloat(getComputedStyle(retry).fontSize),textRect:tx,title:retry.title,aria:retry.getAttribute('aria-label')}:{text:null,font:null,textRect:tx,title:null,aria:null},slider:(()=>{const s=document.querySelector('article:nth-of-type(2) [role=slider]');return s?{max:Number(s.getAttribute('aria-valuemax')),text:s.getAttribute('aria-valuetext')}:{max:null,text:null}})()}})()`);
  const violations=[];if(data.doc>width+1)violations.push('document overflow');if(data.scroller.scroll===null||data.scroller.scroll>data.scroller.client+1)violations.push('scroller missing/overflow');data.heads.forEach((h,i)=>{if(h.scroll>h.client+1||h.rect.right>width+1)violations.push(`head${i+1} overflow`)});data.controls.forEach((c,i)=>{if(c.scroll>c.client+1||c.rect.right>width+1||!c.points.every(Boolean))violations.push(`control${i+1} geometry/hit`)});
  if(data.retry.text!=='语音服务未就绪'||data.retry.font<=0||data.retry.textRect.width<=0||data.retry.textRect.height<=0)violations.push('retry reason not visibly rendered');
  if(!(before.duration>0&&Math.abs(after-before.duration*.5)<1))violations.push(`seek failed against accepted Range contract: ${JSON.stringify({before,after})}`);
  if(!(data.slider.max>0&&/共 0:0[1-9]/.test(data.slider.text)))violations.push('slider timing not truthful');
  const shot=await send('Page.captureScreenshot',{format:'png'});writeFileSync(join(out,`p2t-final-${width}.png`),Buffer.from(shot.data,'base64'));
  results.push({width,before,after,data,violations});
 }
 const assets=[];for(const f of ['index.html'])assets.push({file:f,sha256:sha(join(dist,f))});
 const record={result:results.every(r=>r.violations.length===0)?'PASS':'FAIL',contract:'production dist + mocked JSON + byte responses mirroring independently accepted Django Range contract; paired live-server Chrome gate recorded in R7',assets,requests,responses,results};writeFileSync(join(out,'p2t-final-browser.json'),JSON.stringify(record,null,2));console.log(JSON.stringify({result:record.result,results:results.map(r=>({width:r.width,violations:r.violations,seek:{before:r.before,after:r.after},retry:r.data.retry,wrap:r.data.heads.map(h=>({model:h.modelLines,branch:h.branchLines})),buttons:r.data.controls.map(c=>c.button)}))},null,2));if(record.result!=='PASS')process.exitCode=1;
}finally{ws?.close();chrome.kill();server.closeAllConnections();await new Promise(ok=>server.close(ok));await sleep(300);try{rmSync(profile,{recursive:true,force:true})}catch{/* Acceptance polling/cleanup is intentionally best-effort. */}}