// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, screen, waitFor} from '@testing-library/react';
import {renderSlot} from '@get-bb/plugin-sdk/testing/app';
import type {ExperimentalComposerRendererApi} from '@get-bb/plugin-sdk/app';
import {Composer} from '../app';

beforeEach(() => vi.stubGlobal('matchMedia', (media: string) => ({media, matches: false, onchange: null, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){}, dispatchEvent(){return true;}})));
afterEach(() => {cleanup(); vi.unstubAllGlobals();});

// BB를 대신하는 합성 초안과 전송 콜백으로 독립 슬롯을 연다.
function mount(text = '보관할 초안') {
 const run = vi.fn();
 const scope = {kind: 'thread', threadId: 'thr_standalone_fixture'} as const;
 const renderer: ExperimentalComposerRendererApi = {
  key:'standalone-fluid-test', inputLocked:false, focusComposerShortcut:null, decorationSources:[],
  view:{scope, layout:'expanded', draft:{text, isEmpty:!text, attachmentCount:0}, run:{isRunning:false,isSubmitting:false}},
  input:{surface:'thread', autoFocus:false, mentionTriggers:[], commandTriggers:[], resolveMentionLink:()=>null, mentionMenuPlacement:'top',
   promptActions:[{kind:'goal',text:'/goal '}],
   submission:{enter:{kind:'send',requiresInput:true,shortcut:{ariaKeyshortcuts:'Enter',label:'Enter'},run},modifier:null,showModifierInMenu:false}},
  threadLinks:{parse:()=>null,cached:()=>null,resolve:async()=>{}}, clipboard:{readMessage:()=>null,readMessageImage:async()=>new File([],'unused')},
  dispatchAppCommandKey:()=>false, showError:vi.fn(), attachmentSrc:()=>'',
 };
 return {run, mounted:renderSlot({component:Composer},{},{composer:{scope,text},composerRenderer:renderer})};
}

it('installs Fluid only while the standalone composer is mounted and restores prior root state', async () => {
 const attr='data-bb-chat-ui-fluid-mode';
 expect(document.getElementById('bb-chat-ui-fluid-composer')).toBeNull();
 document.documentElement.setAttribute(attr,'prior-owner');
 const {mounted}=mount();
 try {
  await waitFor(()=>expect(mounted.container.querySelector('.ProseMirror')).toBeTruthy());
  expect(document.documentElement.getAttribute(attr)).toBe('');
  expect(document.documentElement.getAttribute('data-bb-chat-ui-root-device')).toBe('desktop');
  expect(mounted.container.querySelector('[data-bb-chat-ui-fluid-composer]')).toBeTruthy();
  expect(document.querySelectorAll('#bb-chat-ui-fluid-composer')).toHaveLength(1);
 } finally {mounted.unmount();}
 await Promise.resolve();
 expect(document.getElementById('bb-chat-ui-fluid-composer')).toBeNull();
 expect(document.documentElement.getAttribute(attr)).toBe('prior-owner');
 document.documentElement.removeAttribute(attr);
});

it('keeps the mounted editor and draft through standalone options and only calls the fixture send action', async () => {
 const {mounted,run}=mount();
 try {
  await waitFor(()=>expect(mounted.container.querySelector('.ProseMirror')).toBeTruthy());
  const editor=mounted.container.querySelector<HTMLElement>('.ProseMirror')!;
  fireEvent.click(screen.getByRole('button',{name:'Prompt actions'}));
  await screen.findByRole('region',{name:'컴포저 옵션'});
  fireEvent.keyDown(document.activeElement!,{key:'Escape'});
  await waitFor(()=>expect(mounted.container.querySelector('[data-bb-chat-ui-fluid-composer]')?.getAttribute('data-bb-chat-ui-fluid-view')).toBe('input'));
  expect(mounted.container.querySelector('.ProseMirror')).toBe(editor);
  expect(mounted.inspection.composer.text).toBe('보관할 초안');
  fireEvent.keyDown(editor,{key:'Enter'});
  await waitFor(()=>expect(run).toHaveBeenCalledTimes(1));
 } finally {mounted.unmount();}
});

// 최초 자식 layout effect가 CSS 없는 높이를 저장하면 첫 paint 뒤 접히는 결함을 막는다.
it.each([false,true])('styles the real renderer before its first height measurement (phone=%s)', async phone => {
 vi.stubGlobal('matchMedia',(media:string)=>({media,matches:phone && ['(hover: none)','(pointer: coarse)','(any-pointer: coarse)'].includes(media),onchange:null,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},dispatchEvent(){return true;}}));
 const reads:{styled:boolean;device:string|null}[]=[];
 const original=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'offsetHeight')!.get!;
 const height=vi.spyOn(HTMLElement.prototype,'offsetHeight','get').mockImplementation(function(this:HTMLElement){
  if(!this.hasAttribute('data-bb-chat-ui-fluid-content'))return original.call(this) as number;
  const styled=!!document.getElementById('bb-chat-ui-fluid-composer');
  const device=this.closest('form')?.getAttribute('data-bb-composer-device')??null;
  reads.push({styled,device});
  return styled?(device==='phone'?52:48):148;
 });
 const {mounted}=mount('');
 try{
  await waitFor(()=>expect(mounted.container.querySelector('.ProseMirror')).toBeTruthy());
  expect(reads.length).toBeGreaterThan(0);
  expect(reads.every(read=>read.styled)).toBe(true);
  expect(reads[0].device).toBe(phone?'phone':'desktop');
  expect(mounted.container.querySelector<HTMLElement>('[data-bb-chat-ui-fluid-height]')!.style.height).toBe(phone?'52px':'48px');
 }finally{mounted.unmount();height.mockRestore();}
});

it('shares styles with peers and installs them again after renderer deselection', async()=>{
 const a=mount(''),b=mount('');
 try{
  await waitFor(()=>expect(b.mounted.container.querySelector('.ProseMirror')).toBeTruthy());
  const style=document.getElementById('bb-chat-ui-fluid-composer');
  expect(document.querySelectorAll('#bb-chat-ui-fluid-composer')).toHaveLength(1);
  a.mounted.unmount();expect(document.getElementById('bb-chat-ui-fluid-composer')).toBe(style);
  b.mounted.unmount();expect(document.getElementById('bb-chat-ui-fluid-composer')).toBeNull();
  const c=mount('');
  try{await waitFor(()=>expect(c.mounted.container.querySelector('.ProseMirror')).toBeTruthy());expect(document.querySelectorAll('#bb-chat-ui-fluid-composer')).toHaveLength(1);}finally{c.mounted.unmount();}
  expect(document.getElementById('bb-chat-ui-fluid-composer')).toBeNull();
 }finally{a.mounted.unmount();b.mounted.unmount();}
});
