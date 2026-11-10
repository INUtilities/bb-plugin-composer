// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderSlot } from '@get-bb/plugin-sdk/testing/app';
import type { ExperimentalComposerRendererApi } from '@get-bb/plugin-sdk/app';
import { PromptBoxInternal } from './src/PromptBoxInternal';
import { injectFluidComposer } from '../lib/fluid-composer';

// 기존 방식의 계약은 토글을 끈 상태에서 계속 검증한다.
beforeEach(()=>{sessionStorage.setItem('bb-chat-ui:fluid-slot-picker','off');vi.stubGlobal('matchMedia',(media:string)=>({media,matches:false,onchange:null,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},dispatchEvent(){return true;}}));});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function mount(){
 const run=vi.fn();
 const renderer:ExperimentalComposerRendererApi={key:'options-test',inputLocked:false,focusComposerShortcut:null,decorationSources:[],
  view:{scope:{kind:'thread',threadId:'thr_options_test'},layout:'expanded',draft:{text:'보관할 초안',isEmpty:false,attachmentCount:0},run:{isRunning:false,isSubmitting:false}},
  input:{surface:'thread',autoFocus:false,mentionTriggers:[],commandTriggers:[],resolveMentionLink:()=>null,mentionMenuPlacement:'top',
   executionControls:<button type="button">모델 선택</button>,
   promptActions:[{kind:'goal',text:'/goal '},{kind:'skills',text:'$'},{kind:'plan',text:'/plan '}],
   attachments:{onAttachFiles:vi.fn()},
   submission:{enter:{kind:'send',requiresInput:true,shortcut:{ariaKeyshortcuts:'Enter',label:'Enter'},run},modifier:null,showModifierInMenu:false}},
  threadLinks:{parse:()=>null,cached:()=>null,resolve:async()=>{}},clipboard:{readMessage:()=>null,readMessageImage:async()=>new File([],'unused')},dispatchAppCommandKey:()=>false,showError:vi.fn(),attachmentSrc:()=>''};
 // 같은 컴포넌트 경로로 다시 그려 실제 입력 수명을 검사한다.
 const TestComposer=()=> <PromptBoxInternal {...renderer.input} fluid/>;
 const v=renderSlot({component:TestComposer},{},{composer:{scope:renderer.view.scope,text:'보관할 초안'},composerRenderer:renderer});
 return{v,renderer,run,TestComposer};
}
// 옵션 필을 열어도 같은 입력과 전송을 사용할 수 있는지 확인한다.
it('opens options above the unchanged input and allows editing and submitting while they remain open',async()=>{
 const{v,run}=mount();
 await waitFor(()=>expect(v.container.querySelector('.ProseMirror')).toBeTruthy());
 const editor=v.container.querySelector<HTMLElement>('.ProseMirror')!;
 const viewport=v.container.querySelector<HTMLElement>('[data-bb-chat-ui-fluid-height]')!;
 const toggle=screen.getByRole('button',{name:'Prompt actions'});
 fireEvent.click(toggle);
 const panel=await screen.findByRole('region',{name:'컴포저 옵션'});
 expect(viewport.contains(panel)).toBe(false);
 expect(panel.compareDocumentPosition(viewport)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(viewport.getAttribute('data-bb-chat-ui-fluid-view')).toBe('input');
 expect(editor.closest('[inert],[aria-hidden="true"]')).toBeNull();
 expect(editor.getAttribute('contenteditable')).toBe('true');
 expect(screen.getByRole('button',{name:'Prompt actions'})).toBe(toggle);
 await v.setComposerText('계속 작성한 초안');
 await waitFor(()=>expect(editor.textContent).toBe('계속 작성한 초안'));
 expect(screen.getByRole('region',{name:'컴포저 옵션'})).toBe(panel);
 fireEvent.submit(v.container.querySelector('form')!);
 expect(run).toHaveBeenCalledOnce();
 expect(screen.queryByRole('region',{name:'컴포저 옵션'})).toBeNull();
 expect(v.inspection.composer.text).toBe('계속 작성한 초안');
 v.unmount();
});
// 정보 필을 컴포저 위로 옮기고 기존 정보와 초안을 유지한다.
it('places the information pill above the input and reuses the existing information region',async()=>{
 const {v,run}=mount();await waitFor(()=>expect(v.container.querySelector('.ProseMirror')).toBeTruthy());
 const editor=v.container.querySelector('.ProseMirror'),toggle=screen.getByRole('button',{name:'정보와 설정'}),send=screen.getByRole('button',{name:'Submit (Enter)'});
 const actions=v.container.querySelector('[data-bb-chat-ui-fluid-actions]')!;
 expect(actions.contains(toggle)).toBe(false);expect(actions.contains(send)).toBe(true);
 expect(toggle.closest('[data-bb-chat-ui-slot-toolbar]')).toBeTruthy();
 expect(toggle.compareDocumentPosition(send)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(toggle.querySelector('svg[data-bb-chat-ui-fluid-settings-icon]')).toBeTruthy();
 fireEvent.click(toggle);const region=screen.getByRole('region',{name:'컴포저 정보와 설정'});
 expect(v.container.querySelector('[data-bb-chat-ui-fluid-height]')!.contains(region)).toBe(false);
 expect(screen.getByRole('button',{name:'모델 선택'})).toBeTruthy();expect(v.container.querySelector('.ProseMirror')).toBe(editor);
 fireEvent.keyDown(region,{key:'Escape'});expect(toggle.getAttribute('aria-expanded')).toBe('false');expect(document.activeElement).toBe(toggle);expect(run).not.toHaveBeenCalled();v.unmount();
});
it('keeps the expanded desktop send controls inside one rounded pill and preserves its menu',async()=>{
 const stop=injectFluidComposer(document),{v,renderer}=mount();
 try{
  renderer.input.submission.modifier={kind:'queue',requiresInput:true,shortcut:{ariaKeyshortcuts:'Shift+Enter',label:'Shift+Enter'},run:vi.fn()};
  renderer.input.submission.showModifierInMenu=true;
  v.rerender(<PromptBoxInternal {...renderer.input} fluid/>);
  await waitFor(()=>expect(v.container.querySelector('[data-promptbox-send-menu]')).toBeTruthy());
  const group=v.container.querySelector<HTMLElement>('[data-promptbox-send-menu]')!;
  expect(getComputedStyle(group).borderRadius).toBe('999px');
  expect(getComputedStyle(group).overflow).toBe('hidden');
  fireEvent.keyDown(screen.getByRole('button',{name:'Send options'}),{key:'ArrowDown'});
  await screen.findByRole('menuitem',{name:'Queue'});
 }finally{v.unmount();stop();}
});
it.each(['data-follow-up-composer-footer','data-new-thread-footer'])('opens the original information and controls from a local round button with %s',async footerMark=>{
 const stop=injectFluidComposer(document),{v,run}=mount();
 const shell=document.createElement('div'),other=document.createElement('div');
 shell.setAttribute('data-promptbox-shell','');other.setAttribute('data-promptbox-shell','');
 const bar=document.createElement('div'),footer=document.createElement('div'),unrelated=document.createElement('div');
 bar.setAttribute('data-bb-chat-ui-info-bar','');footer.setAttribute(footerMark,'');unrelated.setAttribute(footerMark,'');
 bar.innerHTML='<button type="button">Goal</button>';footer.textContent='Project · Branch · Permission · Context';
 document.body.append(shell,other);shell.append(bar,v.container,footer);other.append(unrelated);
 try{
  await waitFor(()=>expect(v.container.querySelector('.ProseMirror')).toBeTruthy());
  const editor=v.container.querySelector('.ProseMirror'),model=screen.getByText('모델 선택');
  const toggle=screen.getByRole('button',{name:'정보와 설정'});
  expect(toggle.getAttribute('type')).toBe('button');expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(getComputedStyle(toggle).borderRadius).toBe('999px');expect(screen.getByRole('button',{name:'모델 선택'})).toBeTruthy();
  expect(getComputedStyle(bar).display).toBe('flex');expect(getComputedStyle(footer).display).toBe('none');
  fireEvent.click(toggle);
  const details=screen.getByRole('region',{name:'컴포저 정보와 설정'});
  const wheel=new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:40});details.dispatchEvent(wheel);
  expect(wheel.defaultPrevented).toBe(true);
  expect(toggle.getAttribute('aria-controls')).toBe(details.id);expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('button',{name:'모델 선택'})).toBe(model);
  expect(getComputedStyle(bar).display).toBe('flex');expect(getComputedStyle(footer).display).toBe('flex');
  expect(getComputedStyle(footer).position).toBe('absolute');
  expect(getComputedStyle(unrelated).display).toBe('none');
  const replacement=document.createElement('div');replacement.setAttribute(footerMark,'');footer.replaceWith(replacement);
  expect(getComputedStyle(replacement).display).toBe('flex');
  fireEvent.keyDown(details,{key:'Escape'});
  expect(toggle.getAttribute('aria-expanded')).toBe('false');expect(document.activeElement).toBe(toggle);
  expect(getComputedStyle(replacement).display).toBe('none');expect(screen.getByRole('button',{name:'모델 선택'})).toBeTruthy();
  expect(v.container.querySelector('.ProseMirror')).toBe(editor);expect(v.inspection.composer.text).toBe('보관할 초안');
  fireEvent.click(toggle);expect(getComputedStyle(replacement).display).toBe('flex');
  expect(run).not.toHaveBeenCalled();v.unmount();expect(shell.hasAttribute('data-bb-chat-ui-fluid-details-open')).toBe(false);
 }finally{v.unmount();shell.remove();other.remove();stop();}
});
it('asks a collapsed host to mount its footer without leaving focus on the editor',async()=>{
 const stop=injectFluidComposer(document),{v,run}=mount();
 const shell=document.createElement('div'),owner=document.createElement('div');
 shell.setAttribute('data-promptbox-shell','');owner.setAttribute('data-follow-up-composer','');
 document.body.append(shell);shell.append(owner);owner.append(v.container);
 try{
  await waitFor(()=>expect(v.container.querySelector('.ProseMirror')).toBeTruthy());
  const editor=v.container.querySelector<HTMLElement>('.ProseMirror')!;
  editor.addEventListener('focus',()=>{
   owner.setAttribute('data-follow-up-composer-expanded','');
   const footer=document.createElement('div');footer.setAttribute('data-follow-up-composer-footer','');footer.textContent='Project · Permission';owner.append(footer);
  },{once:true});
  fireEvent.click(screen.getByRole('button',{name:'Prompt actions'}));
  await screen.findByRole('region',{name:'컴포저 옵션'});
  const toggle=screen.getByRole('button',{name:'정보와 설정'});toggle.focus();fireEvent.click(toggle);
  await waitFor(()=>expect(owner.querySelector('[data-follow-up-composer-footer]')).toBeTruthy());
  expect(getComputedStyle(owner.querySelector('[data-follow-up-composer-footer]')!).display).toBe('flex');
  expect(document.activeElement).toBe(toggle);expect(v.inspection.composer.text).toBe('보관할 초안');expect(run).not.toHaveBeenCalled();
  expect(v.container.querySelector('form')!.getAttribute('data-bb-chat-ui-fluid-view')).toBe('input');
 }finally{v.unmount();shell.remove();stop();}
});
// 같은 form의 입력과 옵션 필을 유지하고 Escape는 전송 없이 필만 닫는다.
it('keeps the input and options in the same form and returns to the mounted editor on Escape',async()=>{
 const {v,run}=mount();await waitFor(()=>expect(v.container.querySelector('.ProseMirror')).toBeTruthy());
 const form=v.container.querySelector('form')!,editor=v.container.querySelector('.ProseMirror')!;
 fireEvent.click(screen.getByRole('button',{name:'Prompt actions'}));
 const panel=await screen.findByRole('region',{name:'컴포저 옵션'});
 expect(form.contains(panel)).toBe(true);expect(v.container.querySelector('form')).toBe(form);
 expect(v.container.querySelector('.ProseMirror')).toBe(editor);
 expect(screen.getByRole('button',{name:'모델 선택'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Submit (Enter)'})).toBeTruthy();
 expect(document.querySelector('[data-persistent-drawer-content],[data-radix-popper-content-wrapper]')).toBeNull();
 expect(run).not.toHaveBeenCalled();
 fireEvent.keyDown(panel,{key:'Escape'});
 await waitFor(()=>expect(screen.queryByRole('region',{name:'컴포저 옵션'})).toBeNull());
 expect(v.container.querySelector('.ProseMirror')).toBe(editor);expect(v.inspection.composer.text).toBe('보관할 초안');
 await waitFor(()=>expect(editor.getAttribute('contenteditable')).toBe('true'));
 v.unmount();
});
it('returns to the draft when choosing a native prompt action without submitting',async()=>{
 const{v,run}=mount();await waitFor(()=>expect(v.container.querySelector('.ProseMirror')).toBeTruthy());
 fireEvent.click(screen.getByRole('button',{name:'Prompt actions'}));
 fireEvent.click(await screen.findByRole('menuitem',{name:'Plan'}));
 await waitFor(()=>expect(screen.queryByRole('region',{name:'컴포저 옵션'})).toBeNull());
 await waitFor(()=>expect(v.inspection.composer.text).toContain('/plan'));
 expect(v.inspection.composer.text).toContain('보관할 초안');expect(run).not.toHaveBeenCalled();v.unmount();
});
it('opens the existing attachment picker once and restores the input view',async()=>{
 const{v}=mount();await waitFor(()=>expect(v.container.querySelector('.ProseMirror')).toBeTruthy());
 const pick=vi.spyOn(HTMLInputElement.prototype,'click').mockImplementation(()=>{});
 try{fireEvent.click(screen.getByRole('button',{name:'Prompt actions'}));fireEvent.click(await screen.findByRole('menuitem',{name:'Attach files'}));
 expect(pick).toHaveBeenCalledTimes(1);expect(screen.queryByRole('region',{name:'컴포저 옵션'})).toBeNull();expect(v.inspection.composer.text).toBe('보관할 초안');}finally{pick.mockRestore();v.unmount();}
});
it('keeps native model controls visible inside the input independently of information',async()=>{
 const{v}=mount();await waitFor(()=>expect(v.container.querySelector('.ProseMirror')).toBeTruthy());
 expect(screen.getByRole('button',{name:'모델 선택'})).toBeTruthy();
 expect(v.container.querySelector('[data-bb-chat-ui-fluid-native-controls] button')?.textContent).toBe('모델 선택');
 expect(screen.getByRole('button',{name:'Prompt actions'})).toBeTruthy();
 v.unmount();
});
it('keeps the same accessible toggle outside the hidden input while the headerless menu is open',async()=>{
 const{v}=mount();await waitFor(()=>expect(v.container.querySelector('.ProseMirror')).toBeTruthy());
 const toggle=screen.getByRole('button',{name:'Prompt actions'});
 fireEvent.click(toggle);await screen.findByRole('region',{name:'컴포저 옵션'});
 expect(screen.getByRole('button',{name:'Prompt actions'})).toBe(toggle);
 expect(toggle.closest('[inert]')).toBeNull();expect(toggle.getAttribute('aria-expanded')).toBe('true');
 expect(v.container.querySelector('[data-bb-chat-ui-fluid-panel-header]')).toBeNull();
 expect(screen.queryByRole('button',{name:'입력으로 돌아가기'})).toBeNull();
 fireEvent.click(toggle);await waitFor(()=>expect(screen.queryByRole('region',{name:'컴포저 옵션'})).toBeNull());
 expect(screen.getByRole('button',{name:'Prompt actions'})).toBe(toggle);expect(toggle.getAttribute('aria-expanded')).toBe('false');v.unmount();
});
it('blurs the focused editor before opening options and preserves its mounted draft',async()=>{
 const{v}=mount();await waitFor(()=>expect(v.container.querySelector('.ProseMirror')).toBeTruthy());
 const editor=v.container.querySelector<HTMLElement>('.ProseMirror')!;editor.focus();
 let menuAtBlur:boolean|undefined;
 editor.addEventListener('blur',()=>{menuAtBlur=!!v.container.querySelector('[data-bb-chat-ui-fluid-panel]');},{once:true});
 fireEvent.click(screen.getByRole('button',{name:'Prompt actions'}));
 await screen.findByRole('region',{name:'컴포저 옵션'});
 expect(menuAtBlur).toBe(false);expect(document.activeElement).not.toBe(editor);
 expect(v.container.querySelector('.ProseMirror')).toBe(editor);expect(v.inspection.composer.text).toBe('보관할 초안');
 fireEvent.keyDown(screen.getByRole('region',{name:'컴포저 옵션'}),{key:'Escape'});
 await waitFor(()=>expect(editor.getAttribute('contenteditable')).toBe('true'));
 expect(v.inspection.composer.text).toBe('보관할 초안');v.unmount();
});
it('does not return focus to the editor when options reopen before the closing focus frame',async()=>{
 const{v}=mount();await waitFor(()=>expect(v.container.querySelector('.ProseMirror')).toBeTruthy());
 const editor=v.container.querySelector<HTMLElement>('.ProseMirror')!,toggle=screen.getByRole('button',{name:'Prompt actions'});
 fireEvent.click(toggle);await screen.findByRole('region',{name:'컴포저 옵션'});
 const refocus=vi.fn();editor.addEventListener('focus',refocus);
 fireEvent.click(toggle);fireEvent.click(toggle);
 await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
 expect(toggle.getAttribute('aria-expanded')).toBe('true');expect(refocus).not.toHaveBeenCalled();
 expect(document.activeElement?.closest('[data-bb-chat-ui-fluid-panel]')).toBeTruthy();v.unmount();
});
it('keeps the plus button and glyph at their base size through pointer activation',async()=>{
 const stop=injectFluidComposer(document),{v}=mount();
 try{
  await waitFor(()=>expect(v.container.querySelector('.ProseMirror')).toBeTruthy());
  const toggle=screen.getByRole('button',{name:'Prompt actions'}),glyph=toggle.querySelector('[data-bb-chat-ui-fluid-toggle-glyph]')!;
  const height=getComputedStyle(glyph).height;
  const animate=vi.fn();toggle.animate=animate;
  fireEvent.pointerDown(toggle,{pointerId:1,isPrimary:true,button:0});fireEvent.pointerUp(toggle,{pointerId:1});fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');expect(getComputedStyle(glyph).height).toBe(height);expect(animate).not.toHaveBeenCalled();
 }finally{v.unmount();stop();}
});

// 대화가 바뀌어도 입력 배치를 다시 만들지 않고 열린 정보만 닫는다.
it('closes details on a scope change without remounting the input layout',async()=>{
 const {v,renderer,TestComposer}=mount();await waitFor(()=>expect(v.container.querySelector('.ProseMirror')).toBeTruthy());
 const viewport=v.container.querySelector('[data-bb-chat-ui-fluid-height]');
 fireEvent.click(screen.getByRole('button',{name:'정보와 설정'}));
 expect(screen.getByRole('region',{name:'컴포저 정보와 설정'})).toBeTruthy();
 renderer.view.scope={kind:'thread',threadId:'thr_next_options_test'};
 v.rerender(<TestComposer/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'정보와 설정'}).getAttribute('aria-expanded')).toBe('false'));
 expect(v.container.querySelector('[data-bb-chat-ui-fluid-height]')).toBe(viewport);v.unmount();
});

// 시안과 실제 입력창이 같은 고정 SVG를 쓰고 호스트의 이름 해석을 거치지 않는지 확인한다.
it('renders the information drawing directly in the upper metadata pill',async()=>{
 const {v,run}=mount();await waitFor(()=>expect(v.container.querySelector('.ProseMirror')).toBeTruthy());
 const button=screen.getByRole('button',{name:'정보와 설정'}),icon=button.querySelector<SVGSVGElement>('svg[data-bb-chat-ui-fluid-settings-icon]')!;
 expect(icon).toBeTruthy();expect(icon.getAttribute('viewBox')).toBe('0 0 24 24');
 expect(icon.getAttribute('width')).toBe('16');expect(icon.getAttribute('height')).toBe('16');
 expect(icon.style.width).toBe('16px');expect(icon.style.height).toBe('16px');
 expect(icon.getAttribute('stroke')).toBe('currentColor');expect(icon.getAttribute('stroke-width')).toBe('2');expect(icon.getAttribute('aria-hidden')).toBe('true');
 expect([...icon.querySelectorAll('path')].map(path=>path.getAttribute('d'))).toEqual(['M12 11v6M12 7h.01']);
 expect([...icon.querySelectorAll('circle')].map(circle=>[circle.getAttribute('cx'),circle.getAttribute('cy'),circle.getAttribute('r')])).toEqual([['12','12','9']]);
 expect(button.querySelector('[data-icon="Settings2"]')).toBeNull();
 fireEvent.click(button);expect(screen.getByRole('region',{name:'컴포저 정보와 설정'})).toBeTruthy();expect(run).not.toHaveBeenCalled();v.unmount();
});
