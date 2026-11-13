// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderSlot } from '@get-bb/plugin-sdk/testing/app';
import type { ExperimentalComposerRendererApi } from '@get-bb/plugin-sdk/app';
import { PromptBoxInternal } from './src/PromptBoxInternal';
import { injectFluidComposer } from '../lib/fluid-composer';

beforeEach(()=>{
  sessionStorage.clear();
  vi.stubGlobal('matchMedia',(media:string)=>({media,matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
});
afterEach(()=>{cleanup();sessionStorage.clear();vi.unstubAllGlobals();});

// 실제 입력·전송·기존 메뉴를 가진 같은 제품 컴포저를 준비한다.
function mount() {
  const run=vi.fn();
  const renderer:ExperimentalComposerRendererApi={key:'picker-integration',inputLocked:false,focusComposerShortcut:null,decorationSources:[],
    view:{scope:{kind:'thread',threadId:'thread'},layout:'expanded',draft:{text:'원래 초안',isEmpty:false,attachmentCount:0},run:{isRunning:false,isSubmitting:false}},
    input:{surface:'thread',autoFocus:false,mentionTriggers:[],commandTriggers:[],resolveMentionLink:()=>null,mentionMenuPlacement:'top',
      executionControls:<button type="button" data-native-model="">기존 모델 선택</button>,promptActions:[],
      submission:{enter:{kind:'send',requiresInput:true,shortcut:{ariaKeyshortcuts:'Enter',label:'Enter'},run},modifier:null,showModifierInMenu:false}},
    threadLinks:{parse:()=>null,cached:()=>null,resolve:async()=>{}},clipboard:{readMessage:()=>null,readMessageImage:async()=>new File([],'unused')},
    dispatchAppCommandKey:()=>false,showError:vi.fn(),attachmentSrc:()=>''};
  const models=vi.fn(async()=>({models:[{id:'Opus',model:'Opus',displayName:'Opus',isDefault:true,defaultReasoningEffort:'medium',supportedReasoningEfforts:[{reasoningEffort:'medium'},{reasoningEffort:'high'}]}],selectedOnlyModels:[]}));
  const view=renderSlot({component:()=> <PromptBoxInternal {...renderer.input} fluid/>},{},{composerRenderer:renderer,
    composer:{scope:renderer.view.scope,text:'원래 초안',selection:{providerId:'claude',model:'Opus',reasoningLevel:'medium'}},
    providers:{status:'ready',providers:[{id:'claude',displayName:'Claude',logoUrl:null}] as any},
    sdk:{providers:{models},threads:{get:vi.fn(async()=>({environmentId:'environment'})) as any}}});
  return {view,run,models};
}

// 두 방식에서 실제 편집기와 기존 메뉴 노드를 같은 수명으로 유지한다.
it('keeps the real editor and native picker mounted across mode toggles',async()=>{
  const stop=injectFluidComposer(document),{view,models}=mount();
  try {
    await waitFor(()=>expect(view.container.querySelector('.ProseMirror')).toBeTruthy());
    const editor=view.container.querySelector('.ProseMirror'),native=view.container.querySelector('[data-native-model]');
    const toggle=screen.getByRole('button',{name:'06 슬롯'});
    expect(screen.queryByRole('button',{name:'기존 모델 선택'})).toBeNull();
    await view.setComposerText('새로 작성한 초안');
    fireEvent.click(toggle);
    expect(screen.getByRole('button',{name:'기존 모델 선택'})).toBe(native);
    expect(screen.getByRole('button',{name:'정보와 설정'}).closest('[data-bb-chat-ui-slot-toolbar]')).toBeTruthy();
    fireEvent.click(toggle);
    expect(view.container.querySelector('.ProseMirror')).toBe(editor);
    expect(view.container.querySelector('[data-native-model]')).toBe(native);
    expect(editor?.textContent).toBe('새로 작성한 초안');
    expect(screen.getByRole('button',{name:'정보와 설정'}).closest('[data-bb-chat-ui-slot-toolbar]')).toBeTruthy();
    expect(models).not.toHaveBeenCalled();
  } finally {view.unmount();stop();}
});

// 슬롯의 Enter와 합성 submit은 대화 전송을 실행하지 않는다.
it('blocks accidental sending while slots are open and preserves the draft after cancellation',async()=>{
  const {view,run}=mount();
  await waitFor(()=>expect(view.container.querySelector('.ProseMirror')).toBeTruthy());
  fireEvent.click(screen.getByRole('button',{name:'모델과 Effort 설정'}));
  await screen.findByRole('option',{name:'Opus'});
  fireEvent.keyDown(screen.getByRole('listbox',{name:'Effort'}),{key:'Enter'});
  fireEvent.submit(view.container.querySelector('form')!);
  expect(run).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole('listbox',{name:'Effort'}),{key:'Escape'});
  expect(screen.queryByRole('group',{name:'모델 슬롯'})).toBeNull();
  expect(view.inspection.composer.text).toBe('원래 초안');
  expect(view.inspection.composer.selections).toHaveLength(0);
  fireEvent.submit(view.container.querySelector('form')!);
  expect(run).toHaveBeenCalledOnce();
});
