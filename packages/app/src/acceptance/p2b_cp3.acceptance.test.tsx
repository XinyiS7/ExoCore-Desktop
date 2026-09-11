import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { ProjectDeleteDialog } from '../features/projects/ProjectDeleteDialog';
import { CreateConversationDialog } from '../features/chat/CreateConversationDialog';

const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const deferred=()=>{let resolve!:(r:Response)=>void;const promise=new Promise<Response>(r=>{resolve=r;});return {promise,resolve};};
const preview=(ids=[71,72])=>({conversations_to_archive:2,files:ids.map(id=>({id,name:`file-${id}.md`,size:20})),files_total_size:ids.length*20});
const clients:QueryClient[]=[];
afterEach(()=>{cleanup();clients.forEach(c=>c.clear());clients.length=0;vi.unstubAllGlobals();});
function harness(){
  const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity},mutations:{retry:false}}});clients.push(client);
  const reads:ReturnType<typeof deferred>[]=[],writes:{gate:ReturnType<typeof deferred>;body:unknown;path:string}[]=[];
  const deleted=vi.fn();
  vi.stubGlobal('fetch',vi.fn((input:RequestInfo|URL,init?:RequestInit)=>{const path=new URL(String(input),'http://localhost').pathname;
    if(path.endsWith('/delete-preview/')){const gate=deferred();reads.push(gate);return gate.promise;}
    if(init?.method==='DELETE'){const gate=deferred();writes.push({gate,body:JSON.parse(String(init.body)),path});return gate.promise;}
    return Promise.resolve(json({error:`UNEXPECTED ${path}`},500));
  }));
  function Entry(){const [session,setSession]=useState(1);const [open,setOpen]=useState(true);const [project,setProject]=useState(31);
    return <><button onClick={()=>{setSession(s=>s+1);setOpen(true);}}>reopen</button><button onClick={()=>{setOpen(false);setProject(32);}}>leave-project</button><span>origin-{project}</span>{open&&<ProjectDeleteDialog key={session} project={{id:project,name:`Project ${project}`}} sessionId={session} onClose={()=>setOpen(false)} onDeleted={()=>deleted()}/>}</>;
  }
  render(<QueryClientProvider client={client}><Entry/></QueryClientProvider>);
  return {client,reads,writes,deleted};
}
const confirm=()=>screen.getByRole('button',{name:'确认归档并删除'});
async function initial(h:ReturnType<typeof harness>,body:unknown=preview()) {await waitFor(()=>expect(h.reads).toHaveLength(1));await act(async()=>h.reads[0].resolve(json(body)));await waitFor(()=>expect(confirm()).toBeEnabled());}

it.each([[],[71],[71,72]].map(ids=>({ids})))('CP3 explicit recovery IDs  and stale-before-local-success',async ({ids})=>{
  const h=harness();const keys=[['projects'],['conversations'],['control','project',31],['control','project-files',31],['project-knowledge',31],['conversation',91],['control','cache',91],['conversation',93],['control','cache',93],['control','project-tree-root',31],['control','project-tree-levels',31],['control','project-tree-level',31,'src']];
  keys.forEach(key=>h.client.setQueryData(key,key[0]==='conversations'?[{id:91,projectId:31}]:key[0]==='conversation'?{id:91,projectId:31}:{fixture:true}));h.client.setQueryData(['control','project-files',32],{fixture:true});
  await initial(h);ids.forEach(id=>fireEvent.click(screen.getByRole('checkbox',{name:new RegExp(`file-${id}`)})));fireEvent.click(confirm());
  await waitFor(()=>expect(h.writes).toHaveLength(1));expect(h.writes[0].body).toEqual({keep_file_ids:ids});expect(h.writes[0].path).toBe('/api/core/projects/31/');
  h.deleted.mockImplementation(()=>keys.forEach(key=>expect(h.client.getQueryState(key)?.isInvalidated).toBe(true)));
  await act(async()=>h.writes[0].gate.resolve(new Response(null,{status:204})));await waitFor(()=>expect(h.deleted).toHaveBeenCalledTimes(1));expect(h.client.getQueryState(['control','project-files',32])?.isInvalidated).toBe(false);
});

it.each(['failed','malformed'] as const)('CP3 %s replacement preview must revoke destructive eligibility',async kind=>{
  const h=harness();await initial(h);fireEvent.click(screen.getByRole('checkbox',{name:/file-71/}));fireEvent.click(screen.getByRole('button',{name:'重新获取预览'}));
  await waitFor(()=>expect(h.reads).toHaveLength(2));expect(confirm()).toBeDisabled();
  await act(async()=>h.reads[1].resolve(kind==='failed'?json({error:'replacement failed'},503):json({files:'bad'})));
  await screen.findByRole('button',{name:'重试预览'});
  expect.soft(confirm()).toBeDisabled();fireEvent.click(confirm());await act(async()=>Promise.resolve());expect(h.writes).toHaveLength(0);
});

it('CP3 replacement success clears all prior selections even when rows match',async()=>{
  const h=harness();await initial(h);fireEvent.click(screen.getByRole('checkbox',{name:/file-71/}));fireEvent.click(screen.getByRole('button',{name:'重新获取预览'}));await waitFor(()=>expect(h.reads).toHaveLength(2));await act(async()=>h.reads[1].resolve(json(preview())));
  await waitFor(()=>expect(confirm()).toBeEnabled());expect(screen.getByRole('checkbox',{name:/file-71/})).not.toBeChecked();
});

it('CP3 old pending preview cannot populate reopened session',async()=>{
  const h=harness();await waitFor(()=>expect(h.reads).toHaveLength(1));fireEvent.click(screen.getByRole('button',{name:'取消'}));fireEvent.click(screen.getByRole('button',{name:'reopen'}));await waitFor(()=>expect(h.reads).toHaveLength(2));
  await act(async()=>h.reads[0].resolve(json(preview([71]))));expect(confirm()).toBeDisabled();expect(screen.queryByText('file-71.md')).toBeNull();await act(async()=>h.reads[1].resolve(json(preview([72]))));await waitFor(()=>expect(confirm()).toBeEnabled());expect(screen.getByRole('checkbox',{name:/file-72/})).not.toBeChecked();
});

it.each([{}, {conversations_to_archive:0,files:[{id:'kf_1',name:'bad',size:1}],files_total_size:1},preview([71,71])])('CP3 invalid initial preview cannot authorize deletion %#',async body=>{
  const h=harness();await waitFor(()=>expect(h.reads).toHaveLength(1));await act(async()=>h.reads[0].resolve(json(body)));await screen.findByRole('button',{name:'重试预览'});expect(confirm()).toBeDisabled();expect(h.writes).toHaveLength(0);
});

it('CP3 pending destructive request retains focus and suppresses duplicate/Escape',async()=>{
  const h=harness();await initial(h);fireEvent.click(confirm());await waitFor(()=>expect(h.writes).toHaveLength(1));const dialog=screen.getByRole('dialog');expect(dialog.contains(document.activeElement)).toBe(true);fireEvent.keyDown(document,{key:'Escape'});expect(dialog).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'正在删除…'}));expect(h.writes).toHaveLength(1);
});

it('CP3 old success updates shared truth but never navigates another origin',async()=>{
  const h=harness();h.client.setQueryData(['projects'],[]);await initial(h);fireEvent.click(confirm());await waitFor(()=>expect(h.writes).toHaveLength(1));fireEvent.click(screen.getByRole('button',{name:'leave-project'}));await act(async()=>h.writes[0].gate.resolve(new Response(null,{status:204})));await waitFor(()=>expect(h.client.getQueryState(['projects'])?.isInvalidated).toBe(true));expect(h.deleted).not.toHaveBeenCalled();expect(screen.getByText('origin-32')).toBeInTheDocument();
});

it('CP3 file rollback failure warns honestly and never auto-retries',async()=>{
  const h=harness();await initial(h);fireEvent.click(confirm());await waitFor(()=>expect(h.writes).toHaveLength(1));await act(async()=>h.writes[0].gate.resolve(json({error:'partial restoration',code:'file_rollback_failed'},409)));await screen.findByText(/请手动检查服务器文件系统/);expect(screen.getByText(/file_rollback_failed/)).toBeInTheDocument();expect(h.deleted).not.toHaveBeenCalled();expect(h.writes).toHaveLength(1);
});

it.each(['standard','g045'] as const)('CP3 fixed project canonical %s creation captures primary and permissions',async type=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});clients.push(client);const posts:unknown[]=[];const done=vi.fn();
  vi.stubGlobal('fetch',vi.fn((input:RequestInfo|URL,init?:RequestInit)=>{const path=new URL(String(input),'http://localhost').pathname;
    if(path==='/api/agents/presets/')return Promise.resolve(json([{id:5,name:'Fixture agent',agent_type:type,description:null,default_model:null,system_prompt:null,is_visible:true}]));
    if(path==='/api/core/projects/')return Promise.resolve(json([{id:31,name:'Primary'},{id:32,name:'Other'}]));
    if(path==='/api/agents/sessions/init/'){posts.push(JSON.parse(String(init?.body)));return Promise.resolve(json({data:{conversation_id:101,session_name:'Fixture created'}},201));}
    return Promise.resolve(json([]));
  }));
  render(<QueryClientProvider client={client}><CreateConversationDialog fixedProject={{id:31,name:'Primary'}} onClose={()=>{}} onCreated={done}/></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('radio',{name:/Fixture agent/}));expect(screen.queryByRole('combobox')).toBeNull();
  if(type==='g045'){fireEvent.click(await screen.findByRole('checkbox',{name:/Other/}));expect(screen.queryByRole('checkbox',{name:/Primary/})).toBeNull();}
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'创建会话'}));await waitFor(()=>expect(posts).toHaveLength(1));expect(posts[0]).toEqual(type==='g045'?{preset_id:5,project_id:31,thinking_level:'auto',frozen_project_ids:[32]}:{preset_id:5,project_id:31,thinking_level:'auto'});await waitFor(()=>expect(done).toHaveBeenCalledTimes(1));
});
it.each(['failed','malformed'] as const)('CP3 %s background replacement cannot submit hidden retained recovery IDs',async kind=>{
  const h=harness();await initial(h);fireEvent.click(screen.getByRole('checkbox',{name:/file-71/}));
  await act(async()=>{void h.client.refetchQueries({queryKey:['project-delete-preview',31]});});await waitFor(()=>expect(h.reads).toHaveLength(2));
  await act(async()=>h.reads[1].resolve(kind==='failed'?json({error:'reconnect failure'},503):json({files:[]})));
  await screen.findByRole('button',{name:'重试预览'});expect.soft(confirm()).toBeDisabled();fireEvent.click(confirm());await act(async()=>Promise.resolve());expect(h.writes).toHaveLength(0);
});

it('CP3 failed replacement can recover only through a new successful preview',async()=>{
  const h=harness();await initial(h);fireEvent.click(screen.getByRole('checkbox',{name:/file-71/}));fireEvent.click(screen.getByRole('button',{name:'重新获取预览'}));await waitFor(()=>expect(h.reads).toHaveLength(2));await act(async()=>h.reads[1].resolve(json({error:'temporary'},503)));
  fireEvent.click(await screen.findByRole('button',{name:'重试预览'}));await waitFor(()=>expect(h.reads).toHaveLength(3));expect(confirm()).toBeDisabled();await act(async()=>h.reads[2].resolve(json(preview([73]))));await waitFor(()=>expect(confirm()).toBeEnabled());expect(screen.getByRole('checkbox',{name:/file-73/})).not.toBeChecked();fireEvent.click(confirm());await waitFor(()=>expect(h.writes).toHaveLength(1));expect(h.writes[0].body).toEqual({keep_file_ids:[]});
});