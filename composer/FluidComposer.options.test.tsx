// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderSlot } from '@get-bb/plugin-sdk/testing/app';
import type { ExperimentalComposerRendererApi } from '@get-bb/plugin-sdk/app';
import { PromptBoxInternal } from './src/PromptBoxInternal';
import { FluidComposer } from './FluidComposer';
import { injectFluidComposer } from '../lib/fluid-composer';

// 기존 방식의 계약은 토글을 끈 상태에서 계속 검증한다.
beforeEach(()=>{sessionStorage.setItem('bb-chat-ui:fluid-slot-picker','off');vi.stubGlobal('matchMedia',(media:string)=>({media,matches:false,onchange:null,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},dispatchEvent(){return true;}}));});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
// 실제 BB와 같은 그룹 구조로 메타정보가 들어 있는 작성창을 만든다.
function mount(nativeFooter=false, withPinnedMetadata=false, surface:'thread'|'new-thread'='thread',
 environment:{name:string|null;branchName:string|null;environmentProviderId?:string}={name:null,branchName:'master'}){
 const run=vi.fn();
 const renderer:ExperimentalComposerRendererApi={key:'options-test',inputLocked:false,focusComposerShortcut:null,decorationSources:[],
  view:{scope:surface==='thread' ? {kind:'thread',threadId:'thr_options_test'} : {kind:'new-thread',projectId:'proj_options_test'},
   layout:'expanded',draft:{text:'보관할 초안',isEmpty:false,attachmentCount:0},run:{isRunning:false,isSubmitting:false}},
  input:{surface,autoFocus:false,mentionTriggers:[],commandTriggers:[],resolveMentionLink:()=>null,mentionMenuPlacement:'top',
   executionControls:<button type="button">모델 선택</button>,
   promptActions:[{kind:'goal',text:'/goal '},{kind:'skills',text:'$'},{kind:'plan',text:'/plan '}],
   attachments:{onAttachFiles:vi.fn()},
   submission:{enter:{kind:'send',requiresInput:true,shortcut:{ariaKeyshortcuts:'Enter',label:'Enter'},run},modifier:null,showModifierInMenu:false}},
  threadLinks:{parse:()=>null,cached:()=>null,resolve:async()=>{}},clipboard:{readMessage:()=>null,readMessageImage:async()=>new File([],'unused')},dispatchAppCommandKey:()=>false,showError:vi.fn(),attachmentSrc:()=>''};
 // 같은 컴포넌트 경로로 다시 그려 실제 입력 수명을 검사한다.
 const TestComposer=()=> {
  const box=withPinnedMetadata ? <FluidComposer/> : <PromptBoxInternal {...renderer.input} fluid/>;
  return nativeFooter ? <div data-promptbox-shell="" data-app-composer="" data-app-composer-role="primary">
   {box}
   <div {...(surface==='thread' ? {'data-follow-up-composer-footer':''} : {'data-new-thread-footer':''})}><div><button>Project</button></div><div>
    {surface==='new-thread' ? <button data-promptbox-hide-tiny="">Worktree</button> : null}<button>Permission</button>
   </div></div>
  </div> : box;
 };
 const v=renderSlot({component:TestComposer},{},{composer:{scope:renderer.view.scope,text:'보관할 초안',
  selection:{providerId:'codex',permissionMode:'auto'}},composerRenderer:renderer,
  experimental_panelTabs:{open:false,selectedKey:null,tabs:[{key:'info',title:'Info',status:null,closable:false,detail:{kind:'info'}}]},
  experimental_panel:{selectTab:()=>true},
  environmentProviders:{status:'ready',providers:[{id:'project-checkout',displayName:'Project checkout',
   description:null,icon:null,logoUrl:null,pluginId:'builtin',machineProviderId:null}]},
  sdk:{subscribe:()=>vi.fn(),
   projects:{get:vi.fn().mockResolvedValue({name:'Composer test project'})},
   threads:{
    get:vi.fn().mockResolvedValue({projectId:'proj_options_test',environmentId:'env_options_test',sectionId:'section_test',pinnedAt:1,
      environment:{status:'ready',hostLifecycle:'active',path:'/project',...environment}}),
    context:async()=>({usage:{usedTokens:200,modelContextWindow:1000,estimated:false}}),
    timeline:vi.fn().mockResolvedValue({sessionOptions:[],activePromptMode:null}),
   }}});
 return{v,renderer,run,TestComposer};
}
// 작업트리 이름을 먼저 표시하고, 클릭은 기존 브랜치 복사로 연결한다.
it.each(['Project checkout',null])('shows the worktree name when available and copies the branch (%s)',async worktreeName=>{
 const {v}=mount(false,true,'thread',{name:worktreeName,branchName:'master'});
 try{
  const button=await screen.findByRole('button',{name:/^Worktree:.*Copy branch/});
  expect(button.textContent).toBe(worktreeName ?? 'master');
  expect(button.getAttribute('aria-label')).toContain(worktreeName ?? 'master');
  expect(button.getAttribute('aria-label')).toContain('master');
  expect(button.getAttribute('title')).toContain('master');
  fireEvent.click(button);
  expect(v.inspection.experimental_clipboardWrites).toEqual([{text:'master'}]);
 }finally{v.unmount();}
});

// Git 브랜치가 없는 프로젝트 체크아웃은 BB에 등록된 환경 이름을 표시한다.
it('names a resolved checkout with no worktree name or branch',async()=>{
 const {v}=mount(false,true,'thread',{name:null,branchName:null,environmentProviderId:'project-checkout'});
 try{
  const checkout=await screen.findByLabelText('Worktree: Project checkout');
  expect(checkout.textContent).toBe('Project checkout');
  expect(screen.queryByRole('button',{name:/^Worktree:/})).toBeNull();
 }finally{v.unmount();}
});

// 포커스가 바뀌어도 입력 아래의 같은 행과 컨텍스트 읽기를 유지한다.
it('keeps all composer information and actions below the same editor through focus, blur and options',async()=>{
 const stop=injectFluidComposer(document),{v}=mount(false,true);
 try{
  const row=await screen.findByRole('group',{name:'Composer metadata'});
  const footer=screen.getByRole('group',{name:'Composer footer'});
  const newThread=await screen.findByRole('button',{name:'New thread in this environment'});
  const permissions=screen.getByRole('combobox',{name:'Permission mode'});
  const details=screen.getByRole('button',{name:'Thread details'});
  const usage=await screen.findByLabelText('Context window 20% used');
  const form=v.container.querySelector('form')!;
  const editor=form.querySelector<HTMLElement>('.ProseMirror')!;
  expect(form.compareDocumentPosition(footer)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(form.contains(footer)).toBe(false);
  expect(footer.contains(newThread) && footer.contains(permissions) && footer.contains(details)).toBe(true);
  expect(screen.queryByRole('button',{name:'정보와 설정'})).toBeNull();
  expect(permissions.getAttribute('data-routing-id')).toBe('env_options_test');
  expect(getComputedStyle(row).display).toBe('grid');
  editor.focus();
  expect(screen.getByRole('group',{name:'Composer metadata'})).toBe(row);
  editor.blur();
  fireEvent.click(screen.getByRole('button',{name:'Prompt actions'}));
  await screen.findByRole('region',{name:'컴포저 옵션'});
  expect(screen.getByRole('group',{name:'Composer metadata'})).toBe(row);
  expect(screen.getByRole('combobox',{name:'Permission mode'})).toBe(permissions);
  expect(screen.getByRole('button',{name:'New thread in this environment'})).toBe(newThread);
  expect(usage.closest('details')?.querySelector('p')?.textContent).toContain(`200 / ${(1000).toLocaleString()} tokens`);
 }finally{v.unmount();stop();}
});

// 하단 설정에서 BB의 권한, 스레드 패널, 같은 환경 새 초안 동작을 사용한다.
it('routes footer actions through BB and hides the duplicate host footer',async()=>{
 const stop=injectFluidComposer(document),{v}=mount(true,true);
 try{
  const newThread=await screen.findByRole('button',{name:'New thread in this environment'});
  const native=v.container.querySelector<HTMLElement>('[data-follow-up-composer-footer]')!;
  expect(getComputedStyle(native).display).toBe('none');
  fireEvent.change(screen.getByRole('combobox',{name:'Permission mode'}),{target:{value:'accept-edits'}});
  await waitFor(()=>expect(v.inspection.composer.selections.at(-1)?.permissionMode).toBe('accept-edits'));
  fireEvent.click(screen.getByRole('button',{name:'Thread details'}));
  expect(v.inspection.experimental_panelCalls.at(-1)).toMatchObject({method:'selectTab',key:'info'});
  fireEvent.click(newThread);
  expect(v.inspection.navigateCalls.at(-1)).toEqual({method:'toCompose',options:{projectId:'proj_options_test',environmentId:'env_options_test',
    placement:{sectionId:'section_test',pinned:true},focusPrompt:true}});
 }finally{v.unmount();stop();}
});

// 새 스레드에서 BB가 제공하는 프로젝트와 작업트리 선택기를 하단에 유지한다.
it('restores native new-thread selectors without opening the info pill',async()=>{
 const stop=injectFluidComposer(document),{v}=mount(true,true,'new-thread');
 try{
  const editor=await waitFor(()=>{
   const node=v.container.querySelector<HTMLElement>('.ProseMirror');
   expect(node).toBeTruthy();
   return node!;
  });
  const footer=v.container.querySelector<HTMLElement>('[data-new-thread-footer]')!;
  const project=screen.getByRole('button',{name:'Project'});
  expect(footer.contains(project)).toBe(true);
  expect(getComputedStyle(footer).display).toBe('flex');
  expect(getComputedStyle(screen.getByRole('button',{name:'Worktree'})).display).toBe('inline-flex');
  expect(screen.queryByRole('button',{name:'정보와 설정'})).toBeNull();
  editor.focus();
  expect(screen.getByRole('button',{name:'Project'})).toBe(project);
  editor.blur();
  expect(screen.getByRole('button',{name:'Project'})).toBe(project);
 }finally{v.unmount();stop();}
});
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
// 필이 많아도 입력창을 밀지 않고 가로 한 줄 안에서 끝까지 이동한다.
it('keeps options on one horizontal scroll row instead of wrapping above the composer',async()=>{
 const stop=injectFluidComposer(document),{v}=mount();
 try{
  fireEvent.click(screen.getByRole('button',{name:'Prompt actions'}));
  const list=await screen.findByRole('menu',{name:'추가 옵션'}),css=getComputedStyle(list);
  expect(css.flexWrap).toBe('nowrap');expect(css.overflowX).toBe('auto');expect(css.overflowY).toBe('hidden');
  for(const item of screen.getAllByRole('menuitem')){expect(getComputedStyle(item).whiteSpace).toBe('nowrap');expect(getComputedStyle(item).flexShrink).toBe('0');}
 }finally{v.unmount();stop();}
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

// 실제 브라우저의 inert 속성 반영을 사용해 두 비활성 처리의 복구 충돌을 재현한다.
it('restores pointer and keyboard access to the information pills after options finish closing',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'inert');
 Object.defineProperty(HTMLElement.prototype,'inert',{configurable:true,get(){return this.hasAttribute('inert');},set(value){this.toggleAttribute('inert',!!value);}});
 const {v}=mount(),shell=document.createElement('div'),bar=document.createElement('div');
 shell.setAttribute('data-promptbox-shell','');bar.setAttribute('data-bb-chat-ui-info-bar','');bar.innerHTML='<button>Goal</button>';
 document.body.append(shell);shell.append(bar,v.container);
 try{
  await waitFor(()=>expect(v.container.querySelector('.ProseMirror')).toBeTruthy());
  await v.setComposerText('보존할 초안');
  const goal=screen.getByRole('button',{name:'Goal'});
  fireEvent.click(screen.getByRole('button',{name:'Prompt actions'}));
  await screen.findByRole('region',{name:'컴포저 옵션'});
  expect(bar.hasAttribute('inert')).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Prompt actions'}));
  await waitFor(()=>expect(v.container.querySelector('[data-bb-chat-ui-fluid-panel]')).toBeNull());
  expect(bar.hasAttribute('inert')).toBe(false);
  expect(goal.closest('[inert]')).toBeNull();
 }finally{v.unmount();shell.remove();if(descriptor)Object.defineProperty(HTMLElement.prototype,'inert',descriptor);else delete (HTMLElement.prototype as any).inert;}
});
