// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderSlot } from '@get-bb/plugin-sdk/testing/app';
import type { ExperimentalComposerRendererApi } from '@get-bb/plugin-sdk/app';
import { PromptBoxInternal } from './src/PromptBoxInternal';

class Pointer extends MouseEvent {
  pointerId=1;pointerType='touch';isPrimary=true;
}
class Recorder extends EventTarget {
  static isTypeSupported(){return true;}
  mimeType='audio/webm';state='inactive';
  start(){this.state='recording';}
  stop(){this.state='inactive';queueMicrotask(()=>{const e=new Event('dataavailable');Object.assign(e,{data:new Blob(['voice'],{type:'audio/webm'})});this.dispatchEvent(e);this.dispatchEvent(new Event('stop'));});}
}
class Speech {
 static instances:Speech[]=[];continuous=false;interimResults=false;lang='';
 onresult:((event:{results:{0:{transcript:string}}[]})=>void)|null=null;
 onerror:(()=>void)|null=null;onend:(()=>void)|null=null;
 start(){}abort(){}constructor(){Speech.instances.push(this);}
}
let originalMedia:PropertyDescriptor|undefined;
beforeEach(()=>{
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
 originalMedia=Object.getOwnPropertyDescriptor(navigator,'mediaDevices');
 Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:vi.fn(async()=>({getTracks:()=>[{stop:vi.fn()}]}))}});
 vi.stubGlobal('MediaRecorder',Recorder);vi.stubGlobal('PointerEvent',Pointer);
 Speech.instances=[];vi.stubGlobal('SpeechRecognition',Speech);
 vi.stubGlobal('matchMedia',(media:string)=>({media,matches:false,onchange:null,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},dispatchEvent(){return true;}}));
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();if(originalMedia)Object.defineProperty(navigator,'mediaDevices',originalMedia);else Reflect.deleteProperty(navigator,'mediaDevices');});

for(const [label,send,blocked,held]of [['음성 입력 중지',false,false,false],['음성 내용 전송',true,false,false],['음성 내용 전송',true,true,false],['음성 입력 중지',false,false,true]]as const){
 it(`the real editor ${held?'held release inserts without sending':`${label} ${blocked?'retains a rejected send':'clears only an accepted send'}`}`,async()=>{
  const clock=held?vi.spyOn(performance,'now').mockReturnValue(1000):null;
  const run=vi.fn(),transcribe=vi.fn(async()=>({text:'실제 입력 엔진 검수'}));
  const renderer:ExperimentalComposerRendererApi={
   key:'voice-test',inputLocked:false,focusComposerShortcut:null,decorationSources:[],
   view:{scope:{kind:'thread',threadId:'thr_voice_test'},layout:'expanded',draft:{text:'',isEmpty:true,attachmentCount:0},run:{isRunning:false,isSubmitting:false}},
   input:{surface:'thread',autoFocus:false,mentionTriggers:[],commandTriggers:[],resolveMentionLink:()=>null,mentionMenuPlacement:'top',
    submission:{enter:{kind:'send',requiresInput:true,shortcut:{ariaKeyshortcuts:'Enter',label:'Enter'},run},modifier:null,showModifierInMenu:false},
    voice:{state:'idle',delivery:'insert',microphoneWarning:null,isSupported:true,unsupportedMessage:'unavailable',stream:null,failedRecordings:[],start:vi.fn(),stop:vi.fn(),send:vi.fn(),retry:vi.fn(),discard:vi.fn(),download:vi.fn(),cancel:vi.fn()}},
   threadLinks:{parse:()=>null,cached:()=>null,resolve:async()=>{}},clipboard:{readMessage:()=>null,readMessageImage:async()=>new File([],'unused')},
   dispatchAppCommandKey:()=>false,showError:vi.fn(),attachmentSrc:()=>'',
  };
  const v=renderSlot({component:()=> <div data-promptbox-shell=""><PromptBoxInternal {...renderer.input} fluid/></div>},{},{composer:{scope:renderer.view.scope,...(blocked?{submittingBlockedReason:'offline'}:{})},composerRenderer:renderer,sdk:{system:{transcribeVoice:transcribe}}});
  await waitFor(()=>expect(v.container.querySelector('.ProseMirror')).toBeTruthy());
  const originalEditor=v.container.querySelector('.ProseMirror');
  const details=screen.getByRole('button',{name:'정보와 설정'});
  fireEvent.click(details);
  const shell=v.container.querySelector('[data-promptbox-shell]')!;
  expect(shell.hasAttribute('data-bb-chat-ui-fluid-details-open')).toBe(true);
  const mic=screen.getByRole('button',{name:'음성모드 시작'});
  if(held)fireEvent.pointerDown(mic,{button:0});else fireEvent.click(mic,{detail:1});
  await waitFor(()=>expect(mic.getAttribute('aria-pressed')).toBe('true'));
  expect(v.container.querySelector('[data-bb-chat-ui-fluid-row]')!.hasAttribute('data-voice-mode')).toBe(false);
  expect(v.container.querySelector('[data-bb-chat-ui-fluid-composer]')!.hasAttribute('data-bb-chat-ui-fluid-voice-only')).toBe(false);
  expect(v.container.querySelector('[data-bb-chat-ui-voice-glow]')).toBeTruthy();
  if(held){expect(v.container.querySelector('[data-bb-chat-ui-voice-orbit]')).toBeTruthy();expect(mic.querySelector('[data-bb-chat-ui-voice-stop-symbol]')).toBeNull();}
  else expect(v.container.querySelectorAll('[data-bb-chat-ui-voice-bar]').length).toBeGreaterThan(7);
  expect(shell.hasAttribute('data-bb-chat-ui-fluid-details-open')).toBe(false);
  expect(screen.queryByRole('button',{name:'모델과 Effort 설정'})).toBeNull();
  expect(screen.queryByRole('button',{name:'정보와 설정'})).toBeNull();
  expect((screen.getByRole('button',{name:'Prompt actions'}) as HTMLButtonElement).disabled).toBe(true);
  expect(v.container.querySelector('[data-bb-chat-ui-fluid-editor]')!.hasAttribute('hidden')).toBe(false);
  act(()=>Speech.instances[0].onresult!({results:[{0:{transcript:'말하면서 보는 내용'}}]}));
  await screen.findByText('말하면서 보는 내용');
  const previewScroll=v.container.querySelector<HTMLElement>('[data-bb-chat-ui-voice-transcript]')!.parentElement!;
  if(!held){const header=v.container.querySelector('[data-bb-chat-ui-voice-bars-space]')!;expect(previewScroll.contains(header)).toBe(false);expect(header.parentElement).toBe(previewScroll.parentElement);}
  Object.defineProperty(previewScroll,'scrollHeight',{configurable:true,value:200});
  act(()=>Speech.instances[0].onresult!({results:[{0:{transcript:'말하면서 보는 내용이 더 길어졌습니다'}}]}));
  expect(previewScroll.scrollTop).toBe(200);
  expect(v.inspection.composer.text).toBe('');
  expect(v.container.querySelector('.ProseMirror')).toBe(originalEditor);
  if(held){
   clock!.mockReturnValue(1800);fireEvent.pointerUp(mic,{button:0});fireEvent.click(mic,{detail:1});
  }else{
   fireEvent.click(mic,{detail:1});
   const action=await screen.findByRole('button',{name:label});
   await waitFor(()=>expect((action as HTMLButtonElement).disabled).toBe(false));
   expect(transcribe).not.toHaveBeenCalled();expect(run).not.toHaveBeenCalled();
   fireEvent.click(action);
  }
  await waitFor(()=>expect(transcribe).toHaveBeenCalledTimes(1));
  await waitFor(()=>expect(v.inspection.composer.text).toBe(send&&!blocked?'':'실제 입력 엔진 검수'));
  expect(screen.queryByText('말하면서 보는 내용')).toBeNull();
  expect(v.container.querySelector('.ProseMirror')).toBe(originalEditor);
  expect(v.container.querySelector('[data-bb-chat-ui-fluid-composer]')!.hasAttribute('data-bb-chat-ui-fluid-voice-only')).toBe(false);
  expect(screen.getByRole('button',{name:'정보와 설정'})).toBe(details);
  expect(shell.hasAttribute('data-bb-chat-ui-fluid-details-open')).toBe(true);
  if(send&&!blocked){
   await waitFor(()=>expect(screen.getByRole('button',{name:'음성모드 시작'})).toBeTruthy());
   expect(originalEditor!.textContent).toBe('');
   expect(v.inspection.composer.submits).toHaveLength(1);
  }else{
   await waitFor(()=>expect(v.container.querySelector('button[data-promptbox-submit-action][type="submit"]')).toBeTruthy());
   expect(screen.queryByRole('button',{name:'음성모드 시작'})).toBeNull();
   expect(v.inspection.composer.submits).toHaveLength(0);
  }
  expect(transcribe).toHaveBeenCalledTimes(1);
  expect(run).not.toHaveBeenCalled();
  v.unmount();
 });
}
