// Acceptance-owned CP4 D01 sibling checks. No App/router helper is imported:
// this directly exercises the canonical three-mode creation component.
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { CreateConversationDialog } from '../features/chat/CreateConversationDialog';
import type { AgentPresetRow } from '../features/chat/types';

const agent:AgentPresetRow={id:5,name:'Fixture g045',agent_type:'g045',description:null,default_model:null,system_prompt:null,is_visible:true};
const json=(data:unknown)=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
const clients:QueryClient[]=[];
afterEach(()=>{cleanup();clients.forEach(c=>c.clear());clients.length=0;vi.unstubAllGlobals();});
const cases=(['home','agent','project'] as const).flatMap(mode=>(['ordinary','pending','ambiguous'] as const).map(phase=>({mode,phase})));
it.each(cases)('CP4 D01 $mode / $phase contains both Tab boundaries without changing safe-close policy',async({mode,phase})=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});clients.push(client);client.setQueryData(['conversations'],[]);
  let resolve!:(response:Response)=>void;const response=new Promise<Response>(r=>{resolve=r;});let posts=0;const created=vi.fn();
  vi.stubGlobal('fetch',vi.fn((input:RequestInfo|URL,init?:RequestInit)=>{
    const path=new URL(String(input),'http://localhost').pathname;
    if(path==='/api/agents/presets/')return Promise.resolve(json([agent]));
    if(path==='/api/core/projects/')return Promise.resolve(json([{id:31,name:'Primary'},{id:32,name:'Other'}]));
    if(path==='/api/agents/sessions/init/'&&init?.method==='POST'){posts++;return response;}
    return Promise.resolve(json([]));
  }));
  function Entry(){const [open,setOpen]=useState(false);return <><button onClick={()=>setOpen(true)}>open creation</button>{open&&<CreateConversationDialog onClose={()=>setOpen(false)} onCreated={created} {...(mode==='agent'?{fixedPreset:agent}:mode==='project'?{fixedProject:{id:31,name:'Primary'}}:{})}/>}</>;}
  render(<QueryClientProvider client={client}><Entry/></QueryClientProvider>);
  const trigger=screen.getByRole('button',{name:'open creation'});trigger.focus();fireEvent.click(trigger);
  if(mode!=='agent')fireEvent.click(await screen.findByRole('radio',{name:/Fixture g045/}));
  fireEvent.click(await screen.findByRole('checkbox',{name:'Other'}));
  if(phase!=='ordinary'){
    fireEvent.click(screen.getByRole('button',{name:'创建会话'}));await waitFor(()=>expect(posts).toBe(1));
    if(phase==='ambiguous'){await act(async()=>resolve(json({data:{session_id:101}})));await screen.findByRole('button',{name:'创建已锁定'});}
    else await screen.findByRole('button',{name:'创建中…'});
  }
  const dialog=screen.getByRole('dialog');
  const controls=Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])'));
  expect(controls.length).toBeGreaterThan(2);const first=controls[0],last=controls[controls.length-1];
  last.focus();fireEvent.keyDown(document,{key:'Tab',code:'Tab'});expect(document.activeElement).toBe(first);
  first.focus();fireEvent.keyDown(document,{key:'Tab',code:'Tab',shiftKey:true});expect(document.activeElement).toBe(last);
  fireEvent.keyDown(document,{key:'Escape',code:'Escape'});await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(document.activeElement).toBe(trigger);
  if(phase==='pending'){await act(async()=>resolve(json({data:{conversation_id:101,session_name:'Late created'}})));await waitFor(()=>expect(client.getQueryState(['conversations'])?.isInvalidated).toBe(true));expect(created).not.toHaveBeenCalled();}
  expect(posts).toBe(phase==='ordinary'?0:1);
});