// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { FluidComposerBody } from './FluidComposerBody';
import { EASE } from '../lib/motion';

let reduced=false;
const listeners=new Set<()=>void>();
beforeEach(()=>{
 vi.useFakeTimers();reduced=false;listeners.clear();
 vi.stubGlobal('matchMedia',()=>({get matches(){return reduced;},addEventListener:(_type:string,fn:()=>void)=>listeners.add(fn),removeEventListener:(_type:string,fn:()=>void)=>listeners.delete(fn)}));
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
it('keeps the height curve but releases the moving caret immediately when typing continues',()=>{
 let lines=1;
 const animations:{options:KeyframeAnimationOptions;cancel:ReturnType<typeof vi.fn>}[]=[];
 const bounds=vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){
  const full=this.closest('[data-bb-chat-ui-fluid-row]')?.getAttribute('data-multiline')==='true';
  const editor=this.classList.contains('ProseMirror');
  const x=editor?(full?20:52):0,y=editor?(full?16:60):0,width=editor?280:400,height=editor?lines*24:this.hasAttribute('data-bb-chat-ui-fluid-content')&&lines>1?lines*24+68:52;
  return {x,y,top:y,left:x,width,height,right:x+width,bottom:y+height,toJSON:()=>({})};
 });
 const animate=vi.fn((_frames:Keyframe[],options:KeyframeAnimationOptions)=>{const cancel=vi.fn();animations.push({options,cancel});return {cancel,playState:'running'} as unknown as Animation;});
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
 Object.defineProperty(HTMLElement.prototype,'animate',{configurable:true,value:animate});
 const draw=(text:string)=><FluidComposerBody draftText={text} editor={<div className="ProseMirror" style={{lineHeight:'24px'}}>{text}</div>} options={<button>+</button>} actions={<button>전송</button>} attachments={null}/>;
 const v=render(draw('한 줄')),editor=v.container.querySelector('.ProseMirror');
 try{
  act(()=>vi.advanceTimersByTime(20));
  lines=3;v.rerender(draw('세 줄'));act(()=>vi.advanceTimersByTime(20));
  expect(v.container.querySelector('[data-bb-chat-ui-fluid-row]')!.getAttribute('data-multiline')).toBe('true');
  expect(v.container.querySelector('[data-bb-chat-ui-fluid-height]')!.getAttribute('data-multiline')).toBe('true');
  expect(animations.at(-1)!.options).toEqual({duration:320,easing:EASE.out});
  expect(v.container.querySelector('.ProseMirror')).toBe(editor);
  const bubbled=vi.fn();v.container.addEventListener('beforeinput',bubbled);
  const input=new InputEvent('beforeinput',{inputType:'insertText',data:'ㅇ',bubbles:true,cancelable:true});
  editor!.dispatchEvent(input);
  expect(animations.at(-1)!.cancel).toHaveBeenCalled();
  expect(v.container.querySelector<HTMLElement>('[data-bb-chat-ui-fluid-height]')!.style.height).toBe('140px');
  expect(input.defaultPrevented).toBe(false);expect(bubbled).toHaveBeenCalledOnce();
  expect(v.container.querySelector<HTMLElement>('[data-bb-chat-ui-fluid-height]')!.style.transition).toContain('height 320ms');
  lines=1;v.rerender(draw('한 줄'));act(()=>vi.advanceTimersByTime(20));
  expect(v.container.querySelector('[data-bb-chat-ui-fluid-height]')!.getAttribute('data-multiline')).toBe('false');
  expect(animations[0].cancel).toHaveBeenCalled();
  expect(animations.at(-1)!.options).toEqual({duration:320,easing:EASE.out});
  Object.defineProperty(animate.mock.results.at(-1)!.value,'playState',{value:'finished'});
  editor!.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertText',bubbles:true}));
  expect(v.container.querySelector<HTMLElement>('[data-bb-chat-ui-fluid-height]')!.style.height).toBe('140px');
  lines=3;v.rerender(draw('다시 세 줄'));act(()=>vi.advanceTimersByTime(20));
  const enter=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});editor!.dispatchEvent(enter);
  expect(animations.at(-1)!.cancel).toHaveBeenCalled();expect(enter.defaultPrevented).toBe(false);
  lines=1;v.rerender(draw('한 줄'));act(()=>vi.advanceTimersByTime(20));
  v.unmount();expect(animations.at(-1)!.cancel).toHaveBeenCalled();
  const cancels=animations.at(-1)!.cancel.mock.calls.length;editor!.dispatchEvent(new InputEvent('beforeinput',{bubbles:true}));
  expect(animations.at(-1)!.cancel).toHaveBeenCalledTimes(cancels);
 }finally{bounds.mockRestore();delete (HTMLElement.prototype as Partial<HTMLElement>).animate;}
});
const view=(open=false)=><FluidComposerBody panelOpen={open} panel={<div role="region" aria-label="옵션"><button>선택</button></div>} editor={<textarea defaultValue="보존할 초안"/>} options={<button>＋</button>} actions={<button>전송</button>} attachments={null}/>;
it('sizes the voice backdrop to its pane and updates it without widening the composer',()=>{
 let paneWidth=800,paneHeight=800,composerLeft=316;
 const observers:{callback:ResizeObserverCallback;targets:Element[];disconnect:ReturnType<typeof vi.fn>}[]=[];
 vi.stubGlobal('ResizeObserver',class{state:{callback:ResizeObserverCallback;targets:Element[];disconnect:ReturnType<typeof vi.fn>};constructor(callback:ResizeObserverCallback){this.state={callback,targets:[],disconnect:vi.fn()};observers.push(this.state);}observe(target:Element){this.state.targets.push(target);}disconnect(){this.state.disconnect();}});
 const bounds=vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){const pane=this.hasAttribute('data-pane-content');return{x:pane?200:composerLeft,y:100,left:pane?200:composerLeft,top:100,width:pane?paneWidth:568,height:pane?paneHeight:136,right:(pane?200:composerLeft)+(pane?paneWidth:568),bottom:pane?100+paneHeight:236,toJSON:()=>({})};});
 const draw=(voiceMode:boolean)=><div data-pane-content=""><form data-bb-chat-ui-fluid-composer=""><FluidComposerBody voiceMode={voiceMode} editor={<textarea/>} options={null} actions={<button>음성</button>} attachments={null}/></form></div>;
 const v=render(draw(true));
 try{
  act(()=>vi.advanceTimersByTime(20));const viewport=v.container.querySelector<HTMLElement>('[data-bb-chat-ui-fluid-height]')!,pane=v.container.querySelector('[data-pane-content]')!;
  expect(viewport.style.getPropertyValue('--bb-chat-ui-voice-backdrop-width')).toBe('800px');expect(viewport.style.getPropertyValue('--bb-chat-ui-voice-backdrop-left')).toBe('-116px');
  expect(viewport.style.getPropertyValue('--bb-chat-ui-voice-backdrop-bottom')).toBe('-664px');
  const observer=observers.find(observer=>observer.targets.includes(pane))!;expect(observer).toBeTruthy();
  paneWidth=500;paneHeight=400;composerLeft=220;act(()=>{observer.callback([],{}as ResizeObserver);vi.advanceTimersByTime(20);});
  expect(viewport.style.getPropertyValue('--bb-chat-ui-voice-backdrop-width')).toBe('500px');expect(viewport.style.getPropertyValue('--bb-chat-ui-voice-backdrop-left')).toBe('-20px');expect(viewport.style.getPropertyValue('--bb-chat-ui-voice-backdrop-bottom')).toBe('-264px');
  v.rerender(draw(false));expect(observer.disconnect).toHaveBeenCalled();expect(viewport.style.getPropertyValue('--bb-chat-ui-voice-backdrop-width')).toBe('');expect(viewport.style.getPropertyValue('--bb-chat-ui-voice-backdrop-left')).toBe('');expect(viewport.style.getPropertyValue('--bb-chat-ui-voice-backdrop-bottom')).toBe('');
 }finally{v.unmount();bounds.mockRestore();}
});
it('moves the real action column into voice mode and cancels its motion for reduced motion and unmount',()=>{
 const oldAnimate=HTMLElement.prototype.animate;
 const animations:{cancel:ReturnType<typeof vi.fn>;frames:Keyframe[];options:KeyframeAnimationOptions}[]=[];
 const bounds=vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){
  const active=this.closest('[data-bb-chat-ui-fluid-row]')?.getAttribute('data-voice-mode')==='true';
  const x=this.hasAttribute('data-bb-chat-ui-fluid-actions')?(active?160:300):0;
  return {x,y:100,top:100,left:x,width:80,height:32,right:x+80,bottom:132,toJSON:()=>({})};
 });
 HTMLElement.prototype.animate=function(frames,options){const a={frames:frames as Keyframe[],options:options as KeyframeAnimationOptions,cancel:vi.fn()};animations.push(a);return {cancel:a.cancel}as unknown as Animation;};
 const draw=(active:boolean)=><FluidComposerBody voiceMode={active} editor={<textarea/>} options={null} actions={<button>음성</button>} attachments={null}/>;
 const v=render(draw(false));
 try{
  const action=v.container.querySelector('[data-bb-chat-ui-fluid-actions]');v.rerender(draw(true));
  expect(v.container.querySelector('[data-voice-mode="true"]')).toBeTruthy();expect(v.container.querySelector('[data-bb-chat-ui-fluid-actions]')).toBe(action);
  expect(animations[0].frames[0]).toEqual({transform:'translate(140px, 0px)'});
  expect(animations[0].options).toEqual({duration:320,easing:EASE.out});
  reduced=true;act(()=>{for(const listener of listeners)listener();});expect(animations[0].cancel).toHaveBeenCalled();
  v.unmount();expect(listeners.size).toBe(0);
 }finally{bounds.mockRestore();HTMLElement.prototype.animate=oldAnimate;v.unmount();}
});
it('mounts the options lazily and retains both real views only during the closing morph',()=>{
 const v=render(view());const editor=v.container.querySelector('textarea')!;
 expect(v.queryByRole('region',{name:'옵션'})).toBeNull();
 v.rerender(view(true));const panel=v.container.querySelector('[data-bb-chat-ui-fluid-panel-layer]')!;
 expect(v.container.querySelector('textarea')).toBe(editor);
 expect(v.container.querySelector('[data-bb-chat-ui-fluid-input]')!.hasAttribute('hidden')).toBe(false);
 expect(v.container.querySelector('[data-bb-chat-ui-fluid-input]')!.hasAttribute('inert')).toBe(true);
 v.rerender(view());expect(panel.isConnected).toBe(true);expect(panel.hasAttribute('inert')).toBe(true);expect(panel.getAttribute('aria-hidden')).toBe('true');
 expect(v.queryByRole('region',{name:'옵션'})).toBeNull();
 act(()=>vi.advanceTimersByTime(319));expect(panel.isConnected).toBe(true);
 act(()=>vi.advanceTimersByTime(1));expect(panel.isConnected).toBe(false);expect(v.container.querySelector('textarea')).toBe(editor);expect(editor.value).toBe('보존할 초안');
});
it('reverses a closing morph without letting its old timer remove the reopened menu',()=>{
 const v=render(view());v.rerender(view(true));const panel=v.container.querySelector('[data-bb-chat-ui-fluid-panel-layer]')!;
 v.rerender(view());act(()=>vi.advanceTimersByTime(120));v.rerender(view(true));
 act(()=>vi.advanceTimersByTime(500));expect(panel.isConnected).toBe(true);expect(panel.hasAttribute('inert')).toBe(false);expect(panel.getAttribute('data-entered')).toBe('true');
});
it('removes the outgoing menu immediately with reduced motion enabled',()=>{
 const v=render(view(true));reduced=true;v.rerender(view());expect(v.container.querySelector('[data-bb-chat-ui-fluid-panel-layer]')).toBeNull();
});
it('finishes a closing morph when reduced motion changes and releases all local resources on unmount',()=>{
 const v=render(view(true));act(()=>vi.advanceTimersByTime(20));v.rerender(view());
 reduced=true;act(()=>{for(const listener of [...listeners])listener();});
 expect(v.container.querySelector('[data-bb-chat-ui-fluid-panel-layer]')).toBeNull();
 v.unmount();expect(listeners.size).toBe(0);expect(vi.getTimerCount()).toBe(0);
});
it('cleans up a pending closing timer when the composer unmounts',()=>{
 const v=render(view(true));v.rerender(view());v.unmount();expect(listeners.size).toBe(0);expect(vi.getTimerCount()).toBe(0);
});
it('keeps native wheel scrolling inside the composer without blocking zoom and removes its listener on unmount',()=>{
 const v=render(view()),host=v.container,viewport=host.querySelector('[data-bb-chat-ui-fluid-height]')!,editor=host.querySelector('textarea')!;
 const parentWheel=vi.fn();host.addEventListener('wheel',parentWheel);
 editor.style.overflowY='auto';Object.defineProperties(editor,{clientHeight:{value:100},scrollHeight:{value:500}});editor.scrollTop=100;
 const scroll=new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:120});editor.dispatchEvent(scroll);
 expect(parentWheel).not.toHaveBeenCalled();expect(scroll.defaultPrevented).toBe(false);
 editor.dispatchEvent(new WheelEvent('wheel',{bubbles:true,ctrlKey:true}));expect(parentWheel).toHaveBeenCalledTimes(1);
 v.unmount();host.append(viewport);viewport.dispatchEvent(new WheelEvent('wheel',{bubbles:true}));
 expect(parentWheel).toHaveBeenCalledTimes(2);host.removeEventListener('wheel',parentWheel);
});
it('blocks wheel chaining from short input, editor edges, and composer padding',()=>{
 const v=render(view()),viewport=v.container.querySelector('[data-bb-chat-ui-fluid-height]')!,editor=v.container.querySelector('textarea')!,parent=vi.fn();v.container.addEventListener('wheel',parent);
 const wheel=(target:Element,deltaY:number)=>{const e=new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY});target.dispatchEvent(e);return e;};
 expect(wheel(editor,80).defaultPrevented).toBe(true);expect(wheel(viewport,-80).defaultPrevented).toBe(true);
 editor.style.overflowY='auto';Object.defineProperties(editor,{clientHeight:{value:100},scrollHeight:{value:500}});
 editor.scrollTop=0;expect(wheel(editor,-80).defaultPrevented).toBe(true);
 editor.scrollTop=400;expect(wheel(editor,80).defaultPrevented).toBe(true);
 editor.scrollTop=100;expect(wheel(editor,80).defaultPrevented).toBe(false);expect(parent).not.toHaveBeenCalled();
});
it('contains input touch gestures while preserving inner scrolling, pinch and cleanup',()=>{
 const v=render(view()),viewport=v.container.querySelector('[data-bb-chat-ui-fluid-height]')!,editor=v.container.querySelector('textarea')!,parent=vi.fn();v.container.addEventListener('touchmove',parent);
 const touch=(type:string,y:number,count=1)=>{const e=new TouchEvent(type,{bubbles:true,cancelable:true,touches:Array.from({length:count},(_,i)=>({clientX:30+i*20,clientY:y}) as Touch)});editor.dispatchEvent(e);return e;};
 touch('touchstart',200);expect(touch('touchmove',180).defaultPrevented).toBe(true);
 editor.style.overflowY='auto';Object.defineProperties(editor,{clientHeight:{value:100},scrollHeight:{value:500}});editor.scrollTop=100;
 expect(touch('touchmove',160).defaultPrevented).toBe(false);editor.scrollTop=400;expect(touch('touchmove',140).defaultPrevented).toBe(true);expect(parent).not.toHaveBeenCalled();
 touch('touchstart',180,2);expect(touch('touchmove',160,2).defaultPrevented).toBe(false);expect(parent).toHaveBeenCalledTimes(1);
 v.unmount();v.container.append(viewport);touch('touchstart',160);expect(touch('touchmove',140).defaultPrevented).toBe(false);expect(parent).toHaveBeenCalledTimes(2);
});
