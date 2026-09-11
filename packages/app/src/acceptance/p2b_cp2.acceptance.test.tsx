// Interaction selectors below describe the shipped UI, not a frozen editor architecture.
// Acceptance owns adapting these interactions for any equivalent lossless chip/list/text editor.
// Acceptance-owned CP2 behavioral probes. HTTP fixtures only; no provider/real data.
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { ProjectDetailPage } from '../features/projects/ProjectDetailPage';
import { ProjectFilesDrawer } from '../features/chat/project/ProjectFilesDrawer';
import { controlQueryKeys } from '../features/chat/control/queries';

const clients: QueryClient[]=[];
afterEach(()=>{cleanup();clients.forEach(c=>c.clear());clients.length=0;vi.unstubAllGlobals();});
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
function deferred(){let resolve!:(r:Response)=>void;const promise=new Promise<Response>(r=>{resolve=r;});return {promise,resolve};}
const project=(id:number)=>({id,name:`Project-${id}`,description:'',prompt:'',work_dir:'',created_at:'2026-01-01T00:00:00Z'});
const file=(id:number|string,name:string,source='web_upload')=>({id,name,source,file:null,file_type:'text/markdown',size:12,created_at:'2026-01-01T00:00:00Z'});
const knowledge=(id:number,title:string,keywords=['plain'])=>({id,title,source_type:'obsidian_md',tags:[],keywords,abstract:'original abstract',project:11,created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:00Z'});
function Navigation(){const go=useNavigate();return <><button onClick={()=>go('/projects/22')}>switch-project</button><button onClick={()=>go('/projects/11')}>return-project</button></>;}
function mount(options:{keywords?:string[];drawer?:boolean;files?:unknown;knowledgeBody?:unknown;filesFail?:boolean;knowledgeFail?:boolean}={}){
  const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity},mutations:{retry:false}}});clients.push(client);
  client.setQueryData(controlQueryKeys.projectDetail(22),{id:22,name:'Project-22',description:'',prompt:'',workDir:'',createdAt:''});
  let files:unknown=options.files??[file(101,'upload-A'),file('kf_201','sync-A','obsidian_sync')];
  let rows:unknown=options.knowledgeBody??[knowledge(201,'fragment-A',options.keywords),knowledge(203,'fragment-second')];
  const writes:{path:string;method:string;body:unknown;gate:ReturnType<typeof deferred>}[]=[];
  const requests:{path:string;method:string;search:string}[]=[];
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const url=new URL(String(input),'http://localhost'),method=init?.method??'GET';requests.push({path:url.pathname,method,search:url.search});
    if(method!=='GET'){
      const gate=deferred();writes.push({path:url.pathname,method,body:init?.body instanceof FormData?init.body:JSON.parse(String(init?.body??'null')),gate});return gate.promise;
    }
    if(url.pathname==='/api/agents/conversations/'||url.pathname==='/api/agents/presets/')return json([]);
    if(url.pathname==='/api/core/projects/11/')return json(project(11));
    if(url.pathname==='/api/core/projects/22/')return json(project(22));
    if(url.pathname==='/api/core/projects/11/files/')return options.filesFail?json({error:'files-down',code:'FILES_DOWN'},500):json(files);
    if(url.pathname==='/api/core/projects/22/files/')return json([file(102,'file-B')]);
    if(url.pathname==='/api/memory/knowledge/')return options.knowledgeFail?json({error:'knowledge-down'},500):json(url.searchParams.get('project')==='22'?[knowledge(202,'fragment-B')]:rows);
    throw new Error(`Unexpected ${method} ${url.pathname}`);
  }));
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/projects/11']}><Navigation/><Routes><Route path="/projects/:projectId" element={<ProjectDetailPage/>}/></Routes>{options.drawer?<aside aria-label="P1D-consumer"><ProjectFilesDrawer projectId={11} isOpen onClose={()=>{}} onInsertPath={()=>{}}/></aside>:null}</MemoryRouter></QueryClientProvider>);
  return {client,writes,requests,replace:(nextFiles:unknown,nextRows:unknown)=>{files=nextFiles;rows=nextRows;}};
}
async function sections(){return {files:await screen.findByRole('region',{name:'项目文件'}),knowledge:await screen.findByRole('region',{name:'项目知识'})};}
async function openKnowledge(title='fragment-A'){
  const {knowledge:section}=await sections();const row=(await within(section).findByText(title)).closest('li')!;
  const trigger=within(row).getByRole('button',{name:'编辑'});trigger.focus();fireEvent.click(trigger);return screen.findByRole('dialog',{name:'编辑知识摘要'});
}
async function openDelete(name='upload-A'){
  const {files:section}=await sections();const row=(await within(section).findByText(name)).closest('li')!;
  const trigger=within(row).getByRole('button',{name:'删除'});trigger.focus();fireEvent.click(trigger);return screen.findByRole('dialog',{name:'删除文件'});
}
async function settle(client:QueryClient){await waitFor(()=>expect(client.getMutationCache().getAll().some(m=>m.state.status==='pending')).toBe(false));}

it.each(['file','knowledge'] as const)('CP2 route change retires open %s dialog before any new submit',async kind=>{
  const h=mount();if(kind==='file')await openDelete();else await openKnowledge();
  fireEvent.click(screen.getByRole('button',{name:'switch-project'}));await screen.findByRole('heading',{name:'Project-22'});
  expect(screen.queryByRole('dialog')).toBeNull();expect(h.writes).toHaveLength(0);
});

it('CP2 old upload failure never renders as a B-local outcome',async()=>{
  const h=mount();const {files}=await sections();await within(files).findByText('upload-A');
  fireEvent.change(within(files).getByLabelText('选择要上传的文件'),{target:{files:[new File(['x'],'old-A.md',{type:'text/markdown'})]}});
  await waitFor(()=>expect(h.writes).toHaveLength(1));fireEvent.click(screen.getByRole('button',{name:'switch-project'}));await screen.findByRole('heading',{name:'Project-22'});
  await act(async()=>{h.writes[0].gate.resolve(json({error:'old-A-failure',code:'ORIGIN_A'},500));});await settle(h.client);
  expect(screen.queryByText(/old-A-failure/)).toBeNull();
});

it('CP2 close then different Knowledge editor does not inherit old failure',async()=>{
  const h=mount();const dialog=await openKnowledge();fireEvent.change(within(dialog).getByLabelText('摘要'),{target:{value:'changed'}});fireEvent.click(within(dialog).getByRole('button',{name:'保存'}));
  await waitFor(()=>expect(h.writes).toHaveLength(1));fireEvent.click(within(dialog).getByRole('button',{name:'关闭'}));
  await act(async()=>{h.writes[0].gate.resolve(json({error:'old-fragment-error'},400));});await settle(h.client);
  const newer=await openKnowledge('fragment-second');expect(within(newer).queryByText('old-fragment-error')).toBeNull();
});

it.each([['plain'],['project plan'],['alpha;beta'],['one,two']] as const)('CP2 untouched keyword %s survives no-op save without PATCH',async phrase=>{
  const h=mount({keywords:[phrase]});const dialog=await openKnowledge();fireEvent.click(within(dialog).getByRole('button',{name:'保存'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(h.writes).toHaveLength(0);
});

it('CP2 abstract-only edit must not rewrite existing phrase keywords',async()=>{
  const h=mount({keywords:['project plan']});const dialog=await openKnowledge();fireEvent.change(within(dialog).getByLabelText('摘要'),{target:{value:'new abstract'}});fireEvent.click(within(dialog).getByRole('button',{name:'保存'}));
  await waitFor(()=>expect(h.writes).toHaveLength(1));expect(h.writes[0].body).toEqual({abstract:'new abstract'});
});

it('CP2 trimmed-equal abstract response does not claim an index job started',async()=>{
  const h=mount();const dialog=await openKnowledge();fireEvent.change(within(dialog).getByLabelText('摘要'),{target:{value:' original abstract '}});fireEvent.click(within(dialog).getByRole('button',{name:'保存'}));
  await waitFor(()=>expect(h.writes).toHaveLength(1));await act(async()=>{h.writes[0].gate.resolve(json({msg:'已保存。',updated:[]}));});await settle(h.client);
  expect(within(dialog).queryByText(/后台索引刷新已启动/)).toBeNull();
});

it.each(['file','knowledge'] as const)('CP2 %s dialog establishes focus and safe Escape closes',async kind=>{
  mount();const dialog=kind==='file'?await openDelete():await openKnowledge();
  await waitFor(()=>expect(dialog.contains(document.activeElement)).toBe(true));
  fireEvent.keyDown(document,{key:'Escape',code:'Escape'});await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
});

it.each(['upload','numeric-delete','synced-delete'] as const)('CP2 %s updates both mounted sections and P1D shared consumer',async operation=>{
  const h=mount({drawer:true});const {files,knowledge:section}=await sections();await within(files).findByText('sync-A');await within(section).findByText('fragment-A');
  const drawer=screen.getByRole('complementary',{name:'P1D-consumer'});await within(drawer).findByText('sync-A');
  if(operation==='upload')fireEvent.change(within(files).getByLabelText('选择要上传的文件'),{target:{files:[new File(['# note'],'new.md',{type:'text/markdown'})]}});
  else {const dialog=await openDelete(operation==='numeric-delete'?'upload-A':'sync-A');fireEvent.click(within(dialog).getByRole('button',{name:'确认删除'}));}
  await waitFor(()=>expect(h.writes).toHaveLength(1));
  if(operation==='upload'){expect(h.writes[0].body).toBeInstanceOf(FormData);expect((h.writes[0].body as FormData).get('file')).toBeInstanceOf(File);}
  else expect(h.writes[0].path).toBe(`/api/core/projects/11/files/${operation==='numeric-delete'?101:'kf_201'}/`);
  h.replace([file(105,'server-file')],[knowledge(205,'server-fragment')]);
  await act(async()=>{h.writes[0].gate.resolve(operation==='upload'?json(file(105,'server-file'),201):new Response(null,{status:204}));});await settle(h.client);
  expect(await within(files).findByText('server-file')).toBeInTheDocument();expect(await within(section).findByText('server-fragment')).toBeInTheDocument();expect(await within(drawer).findByText('server-file')).toBeInTheDocument();
});

it.each(['abstract','keywords'] as const)('CP2 actual %s save rereads server truth with honest normal success',async kind=>{
  const h=mount();const dialog=await openKnowledge();if(kind==='abstract')fireEvent.change(within(dialog).getByLabelText('摘要'),{target:{value:'new abstract'}});else{fireEvent.click(within(dialog).getByRole('button',{name:'移除关键词 plain'}));fireEvent.change(within(dialog).getByLabelText('新增关键词'),{target:{value:'newkeyword'}});fireEvent.click(within(dialog).getByRole('button',{name:'追加'}));}fireEvent.click(within(dialog).getByRole('button',{name:'保存'}));
  await waitFor(()=>expect(h.writes).toHaveLength(1));expect(h.writes[0].path).toBe('/api/memory/knowledge/201/');expect(h.writes[0].body).toEqual(kind==='abstract'?{abstract:'new abstract'}:{keywords:['newkeyword']});
  h.replace([file(101,'upload-A')],[{...knowledge(201,'fragment-A'),abstract:'server normalized truth'}]);
  await act(async()=>{h.writes[0].gate.resolve(json({msg:'已保存。',updated:[kind]}));});await settle(h.client);
  expect(await screen.findByText('server normalized truth')).toBeInTheDocument();
  if(kind==='abstract')expect(within(dialog).getByText(/后台索引刷新已启动/)).toBeInTheDocument();else expect(within(dialog).queryByText(/后台索引刷新已启动/)).toBeNull();
});

it.each(['files','knowledge'] as const)('CP2 %s error does not erase other resource truth',async area=>{
  mount({filesFail:area==='files',knowledgeFail:area==='knowledge'});const {files,knowledge:section}=await sections();
  if(area==='files'){expect(await within(files).findByText('文件加载失败')).toBeInTheDocument();expect(await within(section).findByText('fragment-A')).toBeInTheDocument();}
  else{expect(await within(section).findByText('项目知识加载失败')).toBeInTheDocument();expect(await within(files).findByText('upload-A')).toBeInTheDocument();}
  expect(screen.getByRole('heading',{name:'Project-11'})).toBeInTheDocument();
});

it.each([{},[{id:'kf_0',name:'bad'}]])('CP2 malformed Files remains explicit error',async body=>{
  mount({files:body});const {files}=await sections();expect(await within(files).findByText('文件加载失败')).toBeInTheDocument();
});

it('CP2 malformed Knowledge envelope does not masquerade as empty',async()=>{
  mount({knowledgeBody:{results:[]}});const {knowledge:section}=await sections();expect(await within(section).findByText('项目知识加载失败')).toBeInTheDocument();expect(within(section).queryByText('暂无项目知识')).toBeNull();
});

it('CP2 valid mixed IDs with inconsistent source remain neutral usable rows',async()=>{
  mount({files:[file(101,'neutral-numeric','obsidian_sync'),file('kf_201','neutral-synced','future-source')]});const {files}=await sections();await within(files).findByText('neutral-numeric');
  expect(within(files).getAllByText('引用文件')).toHaveLength(2);expect(within(files).queryByText('文件加载失败')).toBeNull();expect(within(files).queryByRole('link')).toBeNull();
});
it('CP2 keyword replacement preserves newly entered phrase whitespace',async()=>{
  const h=mount();const dialog=await openKnowledge();fireEvent.click(within(dialog).getByRole('button',{name:'移除关键词 plain'}));fireEvent.change(within(dialog).getByLabelText('新增关键词'),{target:{value:'new phrase'}});fireEvent.click(within(dialog).getByRole('button',{name:'追加'}));fireEvent.click(within(dialog).getByRole('button',{name:'保存'}));
  await waitFor(()=>expect(h.writes).toHaveLength(1));expect(h.writes[0].body).toEqual({keywords:['new phrase']});
});

it.each(['file','knowledge'] as const)('CP2 safe Escape dismisses %s even independent of initial-focus observation',async kind=>{
  mount();if(kind==='file')await openDelete();else await openKnowledge();fireEvent.keyDown(document,{key:'Escape',code:'Escape'});await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
});
// R4 sibling coverage from the original B02 requirement, not a new UI-shape mandate.
// These interactions target the currently shipped append control; another lossless
// editor may use a different harness interaction while preserving the same array.
it('CP2 adding a keyword preserves an existing comma-bearing atomic entry',async()=>{
  const h=mount({keywords:['one,two','keep']});const dialog=await openKnowledge();
  fireEvent.change(within(dialog).getByLabelText('新增关键词'),{target:{value:'extra'}});
  fireEvent.click(within(dialog).getByRole('button',{name:'追加'}));fireEvent.click(within(dialog).getByRole('button',{name:'保存'}));
  await waitFor(()=>expect(h.writes).toHaveLength(1));expect(h.writes[0].body).toEqual({keywords:['one,two','keep','extra']});
});

it.each(['upload','delete'] as const)('CP2 retired %s session cannot resurrect feedback after A-B-A',async operation=>{
  const h=mount();const {files}=await sections();await within(files).findByText('upload-A');
  if(operation==='upload')fireEvent.change(within(files).getByLabelText('选择要上传的文件'),{target:{files:[new File(['x'],'retired-A.md',{type:'text/markdown'})]}});
  else {const dialog=await openDelete();fireEvent.click(within(dialog).getByRole('button',{name:'确认删除'}));}
  await waitFor(()=>expect(h.writes).toHaveLength(1));
  fireEvent.click(screen.getByRole('button',{name:'switch-project'}));await screen.findByRole('heading',{name:'Project-22'});
  fireEvent.click(screen.getByRole('button',{name:'return-project'}));await screen.findByRole('heading',{name:'Project-11'});
  await act(async()=>{h.writes[0].gate.resolve(json({error:'retired-origin-error',code:'RETIRED'},500));});await settle(h.client);
  expect(screen.queryByText(/retired-origin-error/)).toBeNull();
});