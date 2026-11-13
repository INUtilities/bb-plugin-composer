// @vitest-environment jsdom
import { StrictMode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FluidVoiceControl, type FluidVoiceControlProps } from './FluidVoiceControl';
import { injectSendHaptic } from '../lib/send-haptic';

class Pointer extends MouseEvent {
 pointerId:number;isPrimary:boolean;
 constructor(type:string,options:PointerEventInit={}){super(type,options);this.pointerId=options.pointerId??7;this.isPrimary=options.isPrimary??true;}
}
class Recorder extends EventTarget {
 static instances:Recorder[]=[];static autoFinish=true;static isTypeSupported(){return true;}
 mimeType='audio/webm';state='inactive';
 constructor(){super();Recorder.instances.push(this);}
 start(){this.state='recording';}
 stop(){this.state='inactive';if(Recorder.autoFinish)queueMicrotask(()=>this.finish());}
 finish(){const event=new Event('dataavailable');Object.assign(event,{data:new Blob(['audio'],{type:this.mimeType})});this.dispatchEvent(event);this.dispatchEvent(new Event('stop'));}
}
class Speech {
 static instances:Speech[]=[];continuous=false;interimResults=false;lang='';
 onresult:((event:{results:{0:{transcript:string}}[]})=>void)|null=null;
 onerror:(()=>void)|null=null;onend:(()=>void)|null=null;
 start=vi.fn();abort=vi.fn();constructor(){Speech.instances.push(this);}
}
let originalMedia:PropertyDescriptor|undefined,tracks:{stop:ReturnType<typeof vi.fn>}[],capture:ReturnType<typeof vi.fn>;
beforeEach(()=>{
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
 originalMedia=Object.getOwnPropertyDescriptor(navigator,'mediaDevices');tracks=[{stop:vi.fn()}];
 capture=vi.fn(async()=>({getTracks:()=>tracks})as unknown as MediaStream);
 Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:capture}});
 vi.stubGlobal('MediaRecorder',Recorder);vi.stubGlobal('PointerEvent',Pointer);Recorder.instances=[];Recorder.autoFinish=true;Speech.instances=[];
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.useRealTimers();vi.unstubAllGlobals();if(originalMedia)Object.defineProperty(navigator,'mediaDevices',originalMedia);else Reflect.deleteProperty(navigator,'mediaDevices');document.documentElement.removeAttribute('data-bb-chat-ui-root-device');Reflect.deleteProperty(window,'bb');});
function props(extra:Partial<FluidVoiceControlProps>={}):FluidVoiceControlProps{return{disabled:false,sendDisabled:false,showFallback:false,warning:null,fallback:<button>초안 전송</button>,transcribe:vi.fn(async()=>'변환된 초안'),deliver:vi.fn(),onStateChange:vi.fn(),...extra};}
const down=(button:HTMLElement,extra:PointerEventInit={})=>fireEvent.pointerDown(button,{button:0,pointerId:7,isPrimary:true,...extra});
const up=(button:HTMLElement)=>fireEvent.pointerUp(button,{button:0,pointerId:7,isPrimary:true});
async function start(){const button=screen.getByRole('button',{name:/음성모드 시작|누르고 있는 동안 녹음/});fireEvent.click(button,{detail:1});await waitFor(()=>expect(Recorder.instances).toHaveLength(1));return button;}
async function split(button:HTMLElement){select(button);await waitFor(()=>expect((screen.getByRole('button',{name:'음성 입력 중지'}) as HTMLButtonElement).disabled).toBe(false));}
function select(button:HTMLElement){down(button);up(button);fireEvent.click(button,{detail:1});}

it('starts voice mode on click and stops recording on the next tap before any conversion',async()=>{
 const p=props();render(<FluidVoiceControl {...p}/>);const button=screen.getByRole('button',{name:/음성모드 시작|누르고 있는 동안 녹음/});
 down(button);expect(capture).not.toHaveBeenCalled();up(button);fireEvent.click(button,{detail:1});
 await waitFor(()=>expect(Recorder.instances).toHaveLength(1));
 expect(button.getAttribute('aria-pressed')).toBe('true');expect(button.querySelector('[data-bb-chat-ui-voice-waveform]')).toBeTruthy();
 down(button);up(button);fireEvent.click(button,{detail:1});
 expect(tracks[0].stop).toHaveBeenCalledOnce();expect(screen.getByRole('button',{name:'음성 입력 중지'})).toBe(button);await waitFor(()=>expect(Recorder.instances[0].state).toBe('inactive'));
 expect(p.transcribe).not.toHaveBeenCalled();expect(capture).toHaveBeenCalledOnce();
});
it('keeps the normal microphone and the draft send fallback',()=>{const p=props(),v=render(<FluidVoiceControl {...p}/>);expect(screen.queryByText('초안 전송')).toBeNull();v.rerender(<FluidVoiceControl {...p} showFallback/>);expect(screen.getByText('초안 전송')).toBeTruthy();});
it('replaces the held Stop symbol with the ring indicator and switches a released short tap to bars',async()=>{
 const clock=vi.spyOn(performance,'now').mockReturnValue(1000),gesture=vi.fn();render(<FluidVoiceControl {...props()} appearance="composer" onGestureChange={gesture}/>);
 const button=screen.getByRole('button',{name:'음성모드 시작'});down(button);await waitFor(()=>expect(Recorder.instances).toHaveLength(1));
 expect(gesture).toHaveBeenLastCalledWith('hold');expect(button.closest('[data-bb-chat-ui-voice-actions]')?.getAttribute('data-gesture')).toBe('hold');
 expect(button.querySelector('[data-bb-chat-ui-voice-stop-symbol]')).toBeNull();
 clock.mockReturnValue(1080);up(button);fireEvent.click(button,{detail:1});
 expect(gesture).toHaveBeenLastCalledWith('toggle');expect(button.closest('[data-bb-chat-ui-voice-actions]')?.getAttribute('data-gesture')).toBe('toggle');
 expect(button.querySelector('[data-bb-chat-ui-voice-stop-symbol]')).toBeTruthy();expect(tracks[0].stop).not.toHaveBeenCalled();
});
for(const held of [true,false])it(`pulses once on the real ${held?'hold':'tap'} activation without a following click duplicate`,async()=>{
 document.documentElement.setAttribute('data-bb-chat-ui-root-device','phone');const post=vi.fn();Object.assign(window,{bb:{native:{capabilities:['haptic'],post}}});const dispose=injectSendHaptic(document);
 try{
  const clock=vi.spyOn(performance,'now').mockReturnValue(1000),p=props();render(<form data-bb-chat-ui-fluid-composer=""><FluidVoiceControl {...p} appearance="composer"/></form>);
  const button=screen.getByRole('button',{name:'음성모드 시작'});down(button);expect(post).toHaveBeenCalledExactlyOnceWith({type:'haptic',kind:'selection'});
  await waitFor(()=>expect(Recorder.instances).toHaveLength(1));clock.mockReturnValue(held?1800:1080);up(button);fireEvent.click(button,{detail:1});
  if(held){await waitFor(()=>expect(p.deliver).toHaveBeenCalledWith('변환된 초안','insert'));expect(post).toHaveBeenCalledTimes(2);}
  else{expect(post).toHaveBeenCalledOnce();select(button);await screen.findByRole('button',{name:'음성 입력 중지'});expect(post).toHaveBeenCalledTimes(2);expect(p.transcribe).not.toHaveBeenCalled();}
 }finally{dispose();}
});
it('captures immediately, latches a short tap, and stops on the next deliberate tap',async()=>{
 const clock=vi.spyOn(performance,'now').mockReturnValue(1000),p=props();render(<FluidVoiceControl {...p} appearance="composer"/>);
 const button=screen.getByRole('button',{name:'음성모드 시작'});down(button);
 expect(capture).toHaveBeenCalledOnce();await waitFor(()=>expect(Recorder.instances).toHaveLength(1));
 clock.mockReturnValue(1080);up(button);fireEvent.click(button,{detail:1});
 expect(button.getAttribute('aria-pressed')).toBe('true');expect(tracks[0].stop).not.toHaveBeenCalled();expect(p.transcribe).not.toHaveBeenCalled();
 clock.mockReturnValue(1200);down(button);clock.mockReturnValue(1280);up(button);fireEvent.click(button,{detail:1});
 await screen.findByRole('button',{name:'음성 입력 중지'});
 expect(tracks[0].stop).toHaveBeenCalledOnce();expect(capture).toHaveBeenCalledOnce();expect(p.transcribe).not.toHaveBeenCalled();
});
it('stops a held recording on release and transcribes exactly once after the final audio data',async()=>{
 Recorder.autoFinish=false;const clock=vi.spyOn(performance,'now').mockReturnValue(1000),p=props();render(<FluidVoiceControl {...p} appearance="composer"/>);
 const button=screen.getByRole('button',{name:'음성모드 시작'});down(button);await waitFor(()=>expect(Recorder.instances).toHaveLength(1));
 clock.mockReturnValue(1800);up(button);fireEvent.click(button,{detail:1});
 expect(tracks[0].stop).toHaveBeenCalledOnce();expect(p.transcribe).not.toHaveBeenCalled();
 await act(async()=>Recorder.instances[0].finish());
 await waitFor(()=>expect(p.deliver).toHaveBeenCalledWith('변환된 초안','insert'));
 expect(p.transcribe).toHaveBeenCalledOnce();expect(p.deliver).toHaveBeenCalledOnce();
});
it('cancels a released hold while permission is pending and discards the late stream',async()=>{
 let resolve!:(stream:MediaStream)=>void;capture.mockImplementation(()=>new Promise<MediaStream>(r=>{resolve=r;}));
 const clock=vi.spyOn(performance,'now').mockReturnValue(1000),p=props();render(<FluidVoiceControl {...p} appearance="composer"/>);
 const button=screen.getByRole('button',{name:'음성모드 시작'});down(button);expect(capture).toHaveBeenCalledOnce();
 clock.mockReturnValue(1800);up(button);fireEvent.click(button,{detail:1});
 await act(async()=>resolve({getTracks:()=>tracks} as unknown as MediaStream));
 expect(tracks[0].stop).toHaveBeenCalledOnce();expect(Recorder.instances).toHaveLength(0);expect(p.transcribe).not.toHaveBeenCalled();
 expect(button.getAttribute('aria-pressed')).toBe('false');
});
it('offers the existing Stop and Send recovery when automatic hold transcription fails',async()=>{
 const clock=vi.spyOn(performance,'now').mockReturnValue(1000),transcribe=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('재시도한 초안'),p=props({transcribe});
 render(<FluidVoiceControl {...p} appearance="composer"/>);const button=screen.getByRole('button',{name:'음성모드 시작'});
 down(button);await waitFor(()=>expect(Recorder.instances).toHaveLength(1));clock.mockReturnValue(1800);up(button);fireEvent.click(button,{detail:1});
 await screen.findByRole('alert');expect(screen.getByRole('button',{name:'음성 입력 중지'})).toBeTruthy();expect(p.deliver).not.toHaveBeenCalled();
 select(screen.getByRole('button',{name:'음성 내용 전송'}));
 await waitFor(()=>expect(p.deliver).toHaveBeenCalledWith('재시도한 초안','send'));expect(transcribe).toHaveBeenCalledTimes(2);
});
for(const event of ['pointerCancel','lostPointerCapture'] as const)it(`cancels a hold on ${event} without transcription or a following click restart`,async()=>{
 const p=props();render(<FluidVoiceControl {...p} appearance="composer"/>);const button=screen.getByRole('button',{name:'음성모드 시작'});
 down(button);await waitFor(()=>expect(Recorder.instances).toHaveLength(1));fireEvent[event](button,{pointerId:7});fireEvent.click(button,{detail:1});
 expect(tracks[0].stop).toHaveBeenCalledOnce();expect(p.transcribe).not.toHaveBeenCalled();expect(capture).toHaveBeenCalledOnce();
 expect(button.getAttribute('aria-pressed')).toBe('false');
});
it('keeps composer voice controls inline and releases capture before showing choices',async()=>{
 const streamChanged=vi.fn(),p=props();render(<FluidVoiceControl {...p} appearance="composer" onStreamChange={streamChanged}/>);
 const button=await start();expect(streamChanged.mock.calls.at(-1)?.[0]?.getTracks()).toEqual(tracks);
 expect(button.querySelector('[data-bb-chat-ui-voice-orbit]')).toBeNull();
 expect(button.closest('[data-bb-chat-ui-voice-actions]')?.getAttribute('data-appearance')).toBe('composer');
 select(button);await waitFor(()=>expect((screen.getByRole('button',{name:'음성 입력 중지'}) as HTMLButtonElement).disabled).toBe(false));
 expect(tracks[0].stop).toHaveBeenCalledOnce();expect(streamChanged).toHaveBeenLastCalledWith(null);
 expect(p.transcribe).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'음성 내용 전송'})).toBeTruthy();
});
it('stops capture immediately but reveals the choices only after the last exit ring',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(SVGElement.prototype,'animate');
 const animations:{frames:Keyframe[];playState:string;onfinish:(()=>void)|null;cancel:ReturnType<typeof vi.fn>}[]=[];
 Object.defineProperty(SVGElement.prototype,'animate',{configurable:true,value:(frames:Keyframe[])=>{const animation={frames,playState:'running',onfinish:null,cancel:vi.fn()};animations.push(animation);return animation as unknown as Animation;}});
 try{
  const p=props();render(<FluidVoiceControl {...p}/>);select(await start());
  expect(tracks[0].stop).toHaveBeenCalledOnce();expect(p.transcribe).not.toHaveBeenCalled();
  expect(screen.queryByRole('button',{name:'음성 입력 중지'})).toBeNull();
  const exit=animations.filter(a=>a.frames[0].opacity===1&&a.frames[1].opacity===0);
  expect(exit).toHaveLength(21);
  await act(async()=>{for(const animation of exit.slice(0,-1)){animation.playState='finished';animation.onfinish?.();}});
  expect(screen.queryByRole('button',{name:'음성 입력 중지'})).toBeNull();
  await act(async()=>{const last=exit.at(-1)!;last.playState='finished';last.onfinish?.();});
  await waitFor(()=>expect((screen.getByRole('button',{name:'음성 입력 중지'})as HTMLButtonElement).disabled).toBe(false));
  expect(tracks[0].stop).toHaveBeenCalledOnce();expect(p.transcribe).not.toHaveBeenCalled();
 }finally{cleanup();if(descriptor)Object.defineProperty(SVGElement.prototype,'animate',descriptor);else Reflect.deleteProperty(SVGElement.prototype,'animate');}
});
it('does not capture when disabled',()=>{render(<FluidVoiceControl {...props({disabled:true})}/>);const button=screen.getByRole('button');fireEvent.click(button);down(button);expect(capture).not.toHaveBeenCalled();});
it('morphs the same bars control into Stop and a separate Send after stopping capture',async()=>{
 const p=props();render(<FluidVoiceControl {...p}/>);const button=await start();await split(button);
 expect(screen.getAllByRole('button')).toHaveLength(2);expect(screen.getByRole('button',{name:'음성 입력 중지'})).toBe(button);expect(screen.getByRole('button',{name:'음성 내용 전송'})).not.toBe(button);
 expect(screen.queryByText('변환')).toBeNull();expect(tracks[0].stop).toHaveBeenCalledOnce();expect(p.transcribe).not.toHaveBeenCalled();
 expect(p.deliver).not.toHaveBeenCalled();
});
for(const[label,mode]of[['음성 입력 중지','insert'],['음성 내용 전송','send']]as const){it(`${label} stops and delivers once with its existing role`,async()=>{
 const p=props();render(<FluidVoiceControl {...p}/>);await split(await start());select(screen.getByRole('button',{name:label}));
 expect(tracks[0].stop).toHaveBeenCalledOnce();await waitFor(()=>expect(p.deliver).toHaveBeenCalledWith('변환된 초안',mode));expect(p.transcribe).toHaveBeenCalledOnce();expect(p.deliver).toHaveBeenCalledOnce();
});}
for(const type of ['pointercancel','lostpointercapture','pointermove']as const){it(`${type} without a click leaves the latched recording unchanged`,async()=>{
 render(<FluidVoiceControl {...props()}/>);const button=await start();down(button);
 if(type==='pointermove')fireEvent.pointerMove(button,{pointerId:7,clientX:30,clientY:30});else if(type==='pointercancel')fireEvent.pointerCancel(button,{pointerId:7});else fireEvent.lostPointerCapture(button,{pointerId:7});
 expect(screen.queryByRole('button',{name:'음성 입력 중지'})).toBeNull();expect(screen.getAllByRole('button')).toHaveLength(1);expect(tracks[0].stop).not.toHaveBeenCalled();
});}
it('cancels pending permission with Escape and closes a late stream',async()=>{
 let resolve!:(stream:MediaStream)=>void;capture.mockImplementation(()=>new Promise<MediaStream>(yes=>{resolve=yes;}));
 render(<FluidVoiceControl {...props()}/>);fireEvent.click(screen.getByRole('button'));
 fireEvent.keyDown(window,{key:'Escape'});resolve({getTracks:()=>tracks}as unknown as MediaStream);
 await waitFor(()=>expect(tracks[0].stop).toHaveBeenCalledOnce());expect(Recorder.instances).toHaveLength(0);
});
it('supports assistive activation and cancels on Escape',async()=>{
 render(<FluidVoiceControl {...props()}/>);fireEvent.click(screen.getByRole('button'),{detail:0});await waitFor(()=>expect(Recorder.instances).toHaveLength(1));
 fireEvent.click(screen.getByRole('button'),{detail:0});expect(screen.getAllByRole('button')).toHaveLength(2);await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('button',{name:'음성 입력 중지'})));
 fireEvent.keyDown(window,{key:'Escape'});expect(tracks[0].stop).toHaveBeenCalledOnce();expect(screen.getAllByRole('button')).toHaveLength(1);
});
it('releases capture and preview on unmount',async()=>{
 vi.stubGlobal('SpeechRecognition',Speech);const p=props(),v=render(<FluidVoiceControl {...p}/>);const button=await start(),speech=Speech.instances[0];
 down(button);v.unmount();
 expect(tracks[0].stop).toHaveBeenCalledOnce();expect(speech.abort).toHaveBeenCalledOnce();expect(p.transcribe).not.toHaveBeenCalled();
});
it('cancels recording when the window loses focus or host input locks',async()=>{
 const p=props(),v=render(<FluidVoiceControl {...p}/>);await start();fireEvent(window,new Event('blur'));expect(tracks[0].stop).toHaveBeenCalledOnce();
 Recorder.instances=[];await start();v.rerender(<FluidVoiceControl {...p} disabled/>);expect(tracks[0].stop).toHaveBeenCalledTimes(2);
});
it('disables Send when the host cannot submit while keeping Stop available',async()=>{render(<FluidVoiceControl {...props({sendDisabled:true})}/>);await split(await start());expect((screen.getByRole('button',{name:'음성 내용 전송'})as HTMLButtonElement).disabled).toBe(true);expect((screen.getByRole('button',{name:'음성 입력 중지'})as HTMLButtonElement).disabled).toBe(false);});
it('shows live preview but does not convert before an explicit split action',async()=>{
 vi.stubGlobal('SpeechRecognition',Speech);const preview=vi.fn(),p=props({onPreviewChange:preview});render(<FluidVoiceControl {...p}/>);const button=await start(),speech=Speech.instances[0];
 speech.onresult!({results:[{0:{transcript:'안녕'}}]});speech.onresult!({results:[{0:{transcript:'안녕하세요'}}]});expect(preview).toHaveBeenLastCalledWith({text:'안녕하세요',available:true});
 speech.onend!();expect(speech.start).toHaveBeenCalledTimes(2);speech.onresult!({results:[{0:{transcript:'다음 문장'}}]});expect(preview).toHaveBeenLastCalledWith({text:'안녕하세요 다음 문장',available:true});
 await split(button);expect(speech.abort).toHaveBeenCalledOnce();expect(p.transcribe).not.toHaveBeenCalled();select(screen.getByRole('button',{name:'음성 입력 중지'}));
 await waitFor(()=>expect(p.deliver).toHaveBeenCalledOnce());expect(speech.abort).toHaveBeenCalledOnce();
});
it('does not loop when recognition ends without any result',async()=>{vi.stubGlobal('SpeechRecognition',Speech);render(<FluidVoiceControl {...props()}/>);await start();const speech=Speech.instances[0];speech.onend!();expect(speech.start).toHaveBeenCalledOnce();expect(speech.abort).toHaveBeenCalledOnce();expect(tracks[0].stop).not.toHaveBeenCalled();});
it('preserves recording when browser recognition fails',async()=>{vi.stubGlobal('webkitSpeechRecognition',Speech);const p=props();render(<FluidVoiceControl {...p}/>);const button=await start();Speech.instances[0].onerror!();expect(tracks[0].stop).not.toHaveBeenCalled();await split(button);select(screen.getByRole('button',{name:'음성 입력 중지'}));await waitFor(()=>expect(p.deliver).toHaveBeenCalledOnce());});
it('keeps a failed conversion available for an explicit Send retry',async()=>{
 const transcribe=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('재시도한 초안'),p=props({transcribe});render(<FluidVoiceControl {...p}/>);await split(await start());select(screen.getByRole('button',{name:'음성 입력 중지'}));
 await screen.findByRole('alert');select(screen.getByRole('button',{name:'음성 내용 전송'}));await waitFor(()=>expect(p.deliver).toHaveBeenCalledWith('재시도한 초안','send'));expect(p.deliver).toHaveBeenCalledOnce();
});
it('can leave a failed voice conversion using Stop without adding a third button',async()=>{const p=props({transcribe:vi.fn(async()=>{throw Error('offline');})});render(<FluidVoiceControl {...p}/>);await split(await start());select(screen.getByRole('button',{name:'음성 입력 중지'}));await screen.findByRole('alert');select(screen.getByRole('button',{name:'음성 입력 중지'}));expect(screen.getByRole('button',{name:'음성모드 시작'})).toBeTruthy();expect(p.transcribe).toHaveBeenCalledOnce();});
it('pulses once for each mode, split and explicit action without duplicate document haptics',async()=>{
 document.documentElement.setAttribute('data-bb-chat-ui-root-device','phone');const post=vi.fn();Object.assign(window,{bb:{native:{capabilities:['haptic'],post}}});const stop=injectSendHaptic(document);
 try{render(<form data-bb-chat-ui-fluid-composer=""><FluidVoiceControl {...props()}/></form>);const button=await start();expect(post).toHaveBeenCalledTimes(1);await split(button);expect(post).toHaveBeenCalledTimes(2);select(screen.getByRole('button',{name:'음성 입력 중지'}));await waitFor(()=>expect(post).toHaveBeenCalledTimes(3));}finally{stop();}
});
it('remains usable after StrictMode setup and cleanup',async()=>{render(<StrictMode><FluidVoiceControl {...props()}/></StrictMode>);await split(await start());select(screen.getByRole('button',{name:'음성 입력 중지'}));await waitFor(()=>expect(tracks[0].stop).toHaveBeenCalledOnce());});

it('stops the microphone immediately and waits for final audio before enabling either delivery',async()=>{
 Recorder.autoFinish=false;const p=props();render(<FluidVoiceControl {...p}/>);select(await start());
 expect(tracks[0].stop).toHaveBeenCalledOnce();
 for(const name of ['음성 입력 중지','음성 내용 전송'])expect((screen.getByRole('button',{name})as HTMLButtonElement).disabled).toBe(true);
 expect(p.transcribe).not.toHaveBeenCalled();expect(p.deliver).not.toHaveBeenCalled();
 await act(async()=>Recorder.instances[0].finish());
 expect((screen.getByRole('button',{name:'음성 내용 전송'})as HTMLButtonElement).disabled).toBe(false);
 expect(p.transcribe).not.toHaveBeenCalled();select(screen.getByRole('button',{name:'음성 내용 전송'}));
 await waitFor(()=>expect(p.deliver).toHaveBeenCalledWith('변환된 초안','send'));expect(tracks[0].stop).toHaveBeenCalledOnce();
});

it('cancels pending capture with a second tap and closes the late microphone stream',async()=>{
 let resolve!:(stream:MediaStream)=>void;capture.mockImplementation(()=>new Promise<MediaStream>(yes=>{resolve=yes;}));
 render(<FluidVoiceControl {...props()}/>);fireEvent.click(screen.getByRole('button'));
 fireEvent.click(screen.getByRole('button',{name:'음성 녹음 중지'}));resolve({getTracks:()=>tracks}as unknown as MediaStream);
 await waitFor(()=>expect(tracks[0].stop).toHaveBeenCalledOnce());expect(Recorder.instances).toHaveLength(0);expect(screen.getByRole('button',{name:'음성모드 시작'})).toBeTruthy();
});
it('returns to a usable microphone if stopping fails instead of leaving a broken choice group',async()=>{
 const p=props();render(<FluidVoiceControl {...p}/>);const button=await start();
 vi.spyOn(Recorder.instances[0],'stop').mockImplementationOnce(()=>{throw Error('recorder unavailable');});select(button);
 await screen.findByRole('alert');expect(screen.getByRole('button',{name:'음성모드 시작'})).toBeTruthy();expect(screen.queryByRole('group',{name:'음성 입력 동작'})).toBeNull();expect(tracks[0].stop).toHaveBeenCalledOnce();expect(p.transcribe).not.toHaveBeenCalled();
});

// 전사가 즉시 끝나 마이크가 전송 버튼으로 바뀌어도 같은 손뗌의 호환 click은 전송하지 않는다.
for(const nextPress of [false,true])it(`guards a retargeted hold-release click and ${nextPress?'allows the next intentional pointer press':'allows a later keyboard activation'}`,async()=>{
 const clock=vi.spyOn(performance,'now').mockReturnValue(1000),send=vi.fn(),p=props();
 const v=render(<form><FluidVoiceControl {...p} appearance="composer" fallback={<button type="button" onClick={send}>초안 전송</button>}/></form>);
 const mic=screen.getByRole('button',{name:'음성모드 시작'});down(mic);await waitFor(()=>expect(Recorder.instances).toHaveLength(1));
 clock.mockReturnValue(1800);up(mic);await waitFor(()=>expect(p.deliver).toHaveBeenCalledWith('변환된 초안','insert'));
 v.rerender(<form><FluidVoiceControl {...p} appearance="composer" showFallback fallback={<button type="button" onClick={send}>초안 전송</button>}/></form>);
 const button=screen.getByRole('button',{name:'초안 전송'});
 if(!nextPress){fireEvent.click(button,{detail:1});expect(send).not.toHaveBeenCalled();fireEvent.keyDown(button,{key:'Enter'});fireEvent.click(button,{detail:0});}
 else{down(button);fireEvent.click(button,{detail:1});}
 expect(send).toHaveBeenCalledTimes(1);
});
