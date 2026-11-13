// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { renderSlot } from '@get-bb/plugin-sdk/testing/app';
import { useComposer, type ExperimentalComposerPlusMenuContribution, type ExperimentalComposerMenuEntryProps } from '@get-bb/plugin-sdk/app';
import { FluidOptionsPanel, type FluidOptionsPanelProps } from './FluidOptionsPanel';
import { DropdownMenuItem } from './components/ui/dropdown-menu';
import { injectFluidComposer } from '../lib/fluid-composer';

afterEach(()=>{cleanup();vi.restoreAllMocks();});

// 필이 이미 보이는 복귀 모션 동안에도 native pointer와 키보드 입력을 받아야 한다.
it('releases the information row when its return starts and relocks it on a quick reopen',()=>{
 vi.useFakeTimers();
 const descriptor=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'inert');
 Object.defineProperty(HTMLElement.prototype,'inert',{configurable:true,get(){return this.hasAttribute('inert');},set(value){this.toggleAttribute('inert',!!value);}});
 const stop=injectFluidComposer(document);
 const Harness=({active}:{active:boolean})=><div data-promptbox-shell=""><div data-bb-chat-ui-info-bar=""><button>Goal</button><button>Diff</button></div><FluidOptionsPanel active={active} plugins={{plusMenuItems:[],MenuEntry:()=>null}} onAttach={()=>{}} actions={[{kind:'plan',text:'/plan '}]} onClose={()=>{}} onAction={()=>{}} onPluginSelected={()=>{}}/></div>;
 const v=renderSlot({component:Harness},{active:true},{});
 try{
  const bar=v.container.querySelector<HTMLElement>('[data-bb-chat-ui-info-bar]')!;
  expect(bar.inert).toBe(true);
  v.rerender(<Harness active={false}/>);
  act(()=>vi.advanceTimersByTime(244));expect(bar.inert).toBe(true);
  act(()=>vi.advanceTimersByTime(1));
  expect(bar.inert).toBe(false);expect(getComputedStyle(bar).pointerEvents).not.toBe('none');
  expect(v.container.querySelector('[data-bb-chat-ui-fluid-panel]')).not.toBeNull();
  v.rerender(<Harness active/>);expect(bar.inert).toBe(true);
  v.rerender(<Harness active={false}/>);act(()=>vi.advanceTimersByTime(100));v.rerender(<Harness active/>);
  act(()=>vi.advanceTimersByTime(600));expect(bar.inert).toBe(true);
  v.unmount();expect(bar.inert).toBe(false);expect(vi.getTimerCount()).toBe(0);
 }finally{v.unmount();stop();vi.useRealTimers();if(descriptor)Object.defineProperty(HTMLElement.prototype,'inert',descriptor);else delete (HTMLElement.prototype as any).inert;}
});

// 기존 필의 퇴장이 끝난 뒤 옵션이 투명한 상태에서 시작하고 해제 때 원래 필을 복원한다.
it('fades existing pills before options appear and restores their interaction on close',()=>{
 const previous=Element.prototype.animate,entries:{target:Element;frames:Keyframe[];options:KeyframeAnimationOptions;cancel:ReturnType<typeof vi.fn>}[]=[];
 Element.prototype.animate=function(frames,options){
  const entry={target:this,frames:frames as Keyframe[],options:options as KeyframeAnimationOptions,cancel:vi.fn()};entries.push(entry);
  return {...entry,effect:{getKeyframes:()=>entry.frames,setKeyframes:(frames:Keyframe[])=>{entry.frames=frames;}}} as unknown as Animation;
 };
 try{
  const v=renderSlot({component:()=> <div data-promptbox-shell=""><div data-bb-chat-ui-info-bar=""><button>Goal</button><button>Diff</button></div><div data-bb-chat-ui-slot-toolbar=""><button>06 슬롯</button></div><FluidOptionsPanel plugins={{plusMenuItems:[],MenuEntry:()=>null}} onAttach={()=>{}} onClose={()=>{}} onAction={()=>{}} onPluginSelected={()=>{}}/></div>},{},{});
  const shell=v.container.querySelector('[data-promptbox-shell]')!,bar=v.container.querySelector<HTMLElement>('[data-bb-chat-ui-info-bar]')!;
  expect(shell.hasAttribute('data-bb-chat-ui-fluid-options-open')).toBe(true);expect(bar.inert).toBe(true);
  const fades=entries.filter(entry=>entry.options.duration===200),entrance=entries.find(entry=>entry.options.duration===460)!;
  expect(fades.map(entry=>entry.options.delay)).toEqual([0,45,90]);
  expect(entrance.options.delay).toBe(290);expect(entrance.frames[0].opacity).toBe(0);
  v.unmount();expect(shell.hasAttribute('data-bb-chat-ui-fluid-options-open')).toBe(false);expect(bar.inert).toBeFalsy();expect(entries.every(entry=>entry.cancel.mock.calls.length===1)).toBe(true);
 }finally{Element.prototype.animate=previous;}
});
const plugin=(disabled:ExperimentalComposerPlusMenuContribution['item']['disabled']=false):ExperimentalComposerPlusMenuContribution=>({key:'p/item',pluginId:'p',customizationId:'c',generation:1,item:{id:'item',label:'Plugin option',icon:'Zap',description:'플러그인 옵션 설명',disabled,run:vi.fn()}});
function mount(overrides:Partial<Omit<FluidOptionsPanelProps,'plugins'>>={},items:ExperimentalComposerPlusMenuContribution[]=[],afterSelected=()=>{}){
 const restore=vi.fn();
 // The native host MenuEntry owns the plugin boundary. Its registry item uses
 // this exact shared context; a missing inline context throws outside Radix Root.
 const NativeEntry=vi.fn(({contribution,onSelected}:ExperimentalComposerMenuEntryProps)=>{
  const composer=useComposer(),item=contribution.item;
  const disabled=typeof item.disabled==='function'?item.disabled(composer):item.disabled;
  return <DropdownMenuItem disabled={disabled} aria-description={item.description} onSelect={()=>{onSelected?.({selectedElement:document.activeElement,restoreComposerFocus:restore});afterSelected();}}>{item.label}</DropdownMenuItem>;
 });
 const props={plugins:{plusMenuItems:items,MenuEntry:NativeEntry},onClose:vi.fn(),onAction:vi.fn(),onPluginSelected:vi.fn(),...overrides};
 const v=renderSlot({component:()=> <FluidOptionsPanel {...props}/>},{},{composer:{scope:{kind:'thread',threadId:'t1'},text:'기존 초안'}});
 return{v,props,restore,NativeEntry};
}
it('keeps built-in order, hides missing commands, and delegates availability to the host renderer',()=>{
 const disabled=vi.fn(c=>c.draft.text==='기존 초안');
 const{props}=mount({onAttach:vi.fn(),actions:[{kind:'goal',text:''},{kind:'plan',text:'/plan '},{kind:'skills',text:'$'}]},[plugin(disabled)]);
 const options=screen.getAllByRole('menuitem');
 expect(options.map(x=>x.textContent)).toEqual(['Attach files','Skills','Plan','Plugin option']);
 expect((options.at(-1)as HTMLButtonElement).disabled).toBe(true);expect(disabled).toHaveBeenCalled();
 fireEvent.click(options[2]);expect(props.onAction).toHaveBeenCalledWith({kind:'plan',text:'/plan '});
});
it('focuses the first choice, navigates enabled buttons, and handles Escape locally',()=>{
 const{props}=mount({onAttach:vi.fn(),actions:[{kind:'plan',text:'/plan '}]},[plugin(true)]);
 const panel=screen.getByRole('region',{name:'컴포저 옵션'}),attach=screen.getByRole('menuitem',{name:'Attach files'}),plan=screen.getByRole('menuitem',{name:'Plan'});
 expect(document.activeElement).toBe(attach);
 fireEvent.keyDown(attach,{key:'ArrowDown'});expect(document.activeElement).toBe(plan);
 fireEvent.keyDown(plan,{key:'Home'});expect(document.activeElement).toBe(attach);
 fireEvent.keyDown(attach,{key:'End'});expect(document.activeElement).toBe(plan);
 fireEvent.keyDown(panel,{key:'Escape'});expect(props.onClose).toHaveBeenCalledTimes(1);
});
// 가로 필 목록에서도 비활성 항목을 건너뛰고 양방향으로 이동하는지 확인한다.
it('navigates the scrolling pill menu with left and right arrows',()=>{
 mount({onAttach:vi.fn(),actions:[{kind:'plan',text:'/plan '}]},[plugin(true)]);
 expect(screen.getByRole('menu',{name:'추가 옵션'}).getAttribute('aria-orientation')).toBe('horizontal');
 const attach=screen.getByRole('menuitem',{name:'Attach files'}),plan=screen.getByRole('menuitem',{name:'Plan'});
 fireEvent.keyDown(attach,{key:'ArrowRight'});expect(document.activeElement).toBe(plan);
 fireEvent.keyDown(plan,{key:'ArrowRight'});expect(document.activeElement).toBe(attach);
 fireEvent.keyDown(attach,{key:'ArrowLeft'});expect(document.activeElement).toBe(plan);
});
it('keeps host items inline as real buttons without a Radix root, portal or drawer',()=>{
 const{NativeEntry}=mount({},[plugin()]);
 expect(NativeEntry).toHaveBeenCalled();expect(screen.getByRole('menuitem',{name:'Plugin option'}).tagName).toBe('BUTTON');
 expect(document.querySelector('[data-persistent-drawer-content],[data-radix-popper-content-wrapper]')).toBeNull();
});
it('hands the host selection to the input owner before restoring focus, without directly running another plugin',()=>{
 const item=plugin(),{props,restore}=mount({},[item]);
 fireEvent.click(screen.getByRole('menuitem',{name:'Plugin option'}));
 expect(props.onPluginSelected).toHaveBeenCalledTimes(1);
 expect(props.onPluginSelected.mock.calls[0][0].restoreComposerFocus).toBe(restore);
 expect(restore).not.toHaveBeenCalled();expect(item.item.run).not.toHaveBeenCalled();
});
it('preserves focus a plugin deliberately moves into another UI',async()=>{
 const outside=document.createElement('input');document.body.append(outside);
 try{const{restore}=mount({},[plugin()],()=>outside.focus());fireEvent.click(screen.getByRole('menuitem',{name:'Plugin option'}));await Promise.resolve();expect(restore).not.toHaveBeenCalled();expect(document.activeElement).toBe(outside);}finally{outside.remove();}
});
it('keeps a headerless all-disabled panel focusable and dismissible with Escape',()=>{
 const{props}=mount({},[plugin(true)]);const panel=screen.getByRole('region',{name:'컴포저 옵션'});
 expect(document.activeElement).toBe(panel);expect(screen.queryByRole('button',{name:'입력으로 돌아가기'})).toBeNull();
 fireEvent.keyDown(panel,{key:'Escape'});expect(props.onClose).toHaveBeenCalledTimes(1);
});
it('has a usable headerless empty state with keyboard dismissal',()=>{
 const{props}=mount();expect(screen.getByRole('status').textContent).toContain('사용할 수 있는 옵션');
 const panel=screen.getByRole('region',{name:'컴포저 옵션'});expect(document.activeElement).toBe(panel);fireEvent.keyDown(panel,{key:'Escape'});expect(props.onClose).toHaveBeenCalledTimes(1);
});
it('does not take focus when retained only for the outgoing morph',()=>{
 const outside=document.createElement('input');document.body.append(outside);outside.focus();
 try{mount({active:false},[plugin()]);expect(document.activeElement).toBe(outside);}finally{outside.remove();}
});
// 기존 상단 pill과 같은 구간별 모션을 필 전체에 순서대로 적용한다.
it('matches the existing upper-pill droplet on each whole option with 45ms spacing',()=>{
 const oldAnimate=Element.prototype.animate,entries:{target:Element;frames:Keyframe[];options:KeyframeAnimationOptions;cancel:ReturnType<typeof vi.fn>}[]=[];
 Element.prototype.animate=function(frames,options){const entry={target:this,frames:frames as Keyframe[],options:options as KeyframeAnimationOptions,cancel:vi.fn()};entries.push(entry);return {...entry,effect:{getKeyframes:()=>entry.frames,setKeyframes:(frames:Keyframe[])=>{entry.frames=frames;}}} as unknown as Animation;};
 try{const {v}=mount({onAttach:vi.fn(),actions:[{kind:'plan',text:'/plan '}]},[plugin(true)]);const items=screen.getAllByRole('menuitem');
  expect(entries.map(entry=>entry.target)).toEqual(items);
  expect(entries.map(entry=>entry.options.delay)).toEqual([0,45,90]);
  expect(entries[0].frames.map(frame=>frame.transform)).toEqual(['translateY(8px) scale(.82,.72)','translateY(-4px) scale(.94,1.16)','translateY(0) scale(1.1,.94)','translateY(-1px) scale(.985,1.015)','none']);
  expect(entries[0].frames.map(frame=>frame.offset)).toEqual([0,.35,.65,.82,1]);
  expect(entries[0].frames.slice(0,-1).every(frame=>frame.easing==='cubic-bezier(.36,0,.18,1)')).toBe(true);
  expect(entries.every(entry=>entry.options.duration===460&&entry.options.fill==='backwards'&&entry.frames[0].opacity===0&&entry.frames.slice(1).every(frame=>frame.opacity===1))).toBe(true);
  v.unmount();expect(entries.every(entry=>entry.cancel.mock.calls.length===1)).toBe(true);
 }finally{Element.prototype.animate=oldAnimate;}
});
// 동작 줄이기를 켜면 필 전체의 진행 중인 등장도 즉시 끝낸다.
it('cancels whole-pill droplets immediately when reduced motion is enabled',()=>{
 let change:(()=>void)|undefined;const media={matches:false,addEventListener:(_event:string,fn:()=>void)=>{change=fn;},removeEventListener:vi.fn()};
 const old=window.matchMedia,oldAnimate=Element.prototype.animate,cancel=vi.fn();window.matchMedia=()=>media as unknown as MediaQueryList;Element.prototype.animate=()=>({cancel}) as unknown as Animation;
 try{const {v}=mount({onAttach:vi.fn()});media.matches=true;change!();expect(cancel).toHaveBeenCalledOnce();v.unmount();expect(cancel).toHaveBeenCalledOnce();expect(media.removeEventListener).toHaveBeenCalled();}finally{window.matchMedia=old;Element.prototype.animate=oldAnimate;}
});
// 처음부터 동작 줄이기이면 필을 지연 없이 표시한다.
it('does not start whole-pill droplets when reduced motion is already enabled',()=>{
 const old=window.matchMedia,oldAnimate=Element.prototype.animate,animate=vi.fn();window.matchMedia=()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}) as unknown as MediaQueryList;Element.prototype.animate=animate;
 try{mount({onAttach:vi.fn()});expect(animate).not.toHaveBeenCalled();}finally{window.matchMedia=old;Element.prototype.animate=oldAnimate;}
});
// 직접 조작은 순서를 기다리지 않고 필 전체의 모션을 끝낸다.
it.each(['pointer','keyboard','wheel'])('finishes whole-pill droplets on %s input',kind=>{
 const oldAnimate=Element.prototype.animate,cancel=vi.fn();Element.prototype.animate=()=>({cancel}) as unknown as Animation;
 try{mount({onAttach:vi.fn()});const panel=screen.getByRole('region',{name:'컴포저 옵션'});if(kind==='pointer')fireEvent.pointerDown(screen.getByRole('menuitem'));else if(kind==='keyboard')fireEvent.keyDown(panel,{key:'ArrowRight'});else fireEvent.wheel(panel,{deltaY:40});expect(cancel).toHaveBeenCalledOnce();}finally{Element.prototype.animate=oldAnimate;}
});
// 기존 상단 pill처럼 opacity를 건드리지 않고 비활성 흐림을 유지한다.
it('preserves disabled opacity during the whole-pill droplet',()=>{
 const style=document.createElement('style');style.textContent='button:disabled { opacity:.4; }';document.head.append(style);
 try{mount({},[plugin(true)]);expect(getComputedStyle(screen.getByRole('menuitem')).opacity).toBe('0.4');}finally{style.remove();}
});
it('keeps menu wheel scrolling native inside a list but blocks short lists, edges and card padding',()=>{
 mount({onAttach:vi.fn()});
 const panel=screen.getByRole('region',{name:'컴포저 옵션'}),list=screen.getByRole('menu'),item=screen.getByRole('menuitem'),parentWheel=vi.fn();
 panel.parentElement!.addEventListener('wheel',parentWheel);
 const wheel=(target:Element,deltaY:number,ctrlKey=false)=>{const event=new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY,ctrlKey});target.dispatchEvent(event);return event;};
 let height=100;list.style.overflowY='auto';Object.defineProperties(list,{clientHeight:{value:100},scrollHeight:{get:()=>height}});
 expect(wheel(item,80).defaultPrevented).toBe(true);
 height=500;list.scrollTop=100;expect(wheel(item,80).defaultPrevented).toBe(false);
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS('http://www.w3.org/2000/svg','path');svg.append(path);item.append(svg);
 expect(wheel(path,80).defaultPrevented).toBe(false);
 list.scrollTop=0;expect(wheel(item,-80).defaultPrevented).toBe(true);
 list.scrollTop=400;expect(wheel(item,80).defaultPrevented).toBe(true);
 list.scrollTop=100;expect(wheel(panel,80).defaultPrevented).toBe(true);
 const nested=document.createElement('textarea');nested.style.overflowY='auto';list.append(nested);
 Object.defineProperties(nested,{clientHeight:{value:50},scrollHeight:{value:300}});
 expect(wheel(nested,80).defaultPrevented).toBe(false);
 expect(parentWheel).not.toHaveBeenCalled();expect(wheel(item,80,true).defaultPrevented).toBe(false);expect(parentWheel).toHaveBeenCalledTimes(1);
});
it('contains single-finger menu gestures at its boundaries while preserving native list scroll and pinch',()=>{
 mount({onAttach:vi.fn()});
 const panel=screen.getByRole('region',{name:'컴포저 옵션'}),list=screen.getByRole('menu'),item=screen.getByRole('menuitem'),parentMove=vi.fn();
 panel.parentElement!.addEventListener('touchmove',parentMove);
 const touch=(type:string,y:number,count=1)=>{const event=new TouchEvent(type,{bubbles:true,cancelable:true,touches:Array.from({length:count},(_,i)=>({clientX:30+i*20,clientY:y}) as Touch)});item.dispatchEvent(event);return event;};
 touch('touchstart',200);expect(touch('touchmove',180).defaultPrevented).toBe(true);
 list.style.overflowY='auto';Object.defineProperties(list,{clientHeight:{value:100},scrollHeight:{value:500}});
 list.scrollTop=100;expect(touch('touchmove',160).defaultPrevented).toBe(false);
 list.scrollTop=400;expect(touch('touchmove',140).defaultPrevented).toBe(true);
 list.scrollTop=0;expect(touch('touchmove',180).defaultPrevented).toBe(true);
 expect(parentMove).not.toHaveBeenCalled();
 touch('touchstart',180,2);expect(touch('touchmove',160,2).defaultPrevented).toBe(false);expect(parentMove).toHaveBeenCalledTimes(1);
});
it('does not trap scroll in an inactive menu and releases native listeners on unmount',()=>{
 const {v}=mount({active:false,onAttach:vi.fn()});let panel=screen.getByRole('region',{name:'컴포저 옵션'});
 const wheel=()=>{const event=new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:80});panel.dispatchEvent(event);return event;};
 expect(wheel().defaultPrevented).toBe(false);v.unmount();
 const active=mount({onAttach:vi.fn()});panel=screen.getByRole('region',{name:'컴포저 옵션'});active.v.unmount();
 document.body.append(panel);try{expect(wheel().defaultPrevented).toBe(false);}finally{panel.remove();}
});

// 실제 가로 overflow 규칙에서 스와이프·wheel은 목록 안에서만 이동한다.
it('allows horizontal wheel and swipe inside the pill row and contains both edges',()=>{
 const stop=injectFluidComposer(document),{v}=mount({onAttach:vi.fn()});
 try{
  const panel=screen.getByRole('region',{name:'컴포저 옵션'}),list=screen.getByRole('menu'),item=screen.getByRole('menuitem'),parent=vi.fn();
  panel.parentElement!.addEventListener('wheel',parent);panel.parentElement!.addEventListener('touchmove',parent);
  Object.defineProperties(list,{clientWidth:{value:100},scrollWidth:{value:600}});
  const wheel=(dx:number,dy=0)=>{const event=new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaX:dx,deltaY:dy});item.dispatchEvent(event);return event;};
  const touch=(type:string,x:number)=>{const event=new TouchEvent(type,{bubbles:true,cancelable:true,touches:[{clientX:x,clientY:100} as Touch]});item.dispatchEvent(event);return event;};
  list.scrollLeft=100;expect(wheel(80).defaultPrevented).toBe(false);expect(wheel(-80).defaultPrevented).toBe(false);
  touch('touchstart',200);expect(touch('touchmove',150).defaultPrevented).toBe(false);
  list.scrollLeft=500;expect(wheel(80).defaultPrevented).toBe(true);expect(touch('touchmove',100).defaultPrevented).toBe(true);
  list.scrollLeft=0;expect(wheel(-80).defaultPrevented).toBe(true);expect(touch('touchmove',150).defaultPrevented).toBe(true);
  expect(wheel(0,80).defaultPrevented).toBe(true);expect(parent).not.toHaveBeenCalled();
 }finally{v.unmount();stop();}
});

// 닫힘은 메뉴 퇴장 뒤 원래 필을 개별 복구하며 반대 전환도 이전 애니메이션을 남기지 않는다.
it('stagger-exits the menu then stagger-enters the original pills, cancelling both phases on reopen',()=>{
 const previous=Element.prototype.animate,entries:{target:Element;frames:Keyframe[];options:KeyframeAnimationOptions;cancel:ReturnType<typeof vi.fn>}[]=[];
 Element.prototype.animate=function(frames,options){const entry={target:this,frames:frames as Keyframe[],options:options as KeyframeAnimationOptions,cancel:vi.fn()};entries.push(entry);return {...entry,effect:{getKeyframes:()=>entry.frames,setKeyframes:(frames:Keyframe[])=>{entry.frames=frames;},updateTiming:(timing:KeyframeAnimationOptions)=>Object.assign(entry.options,timing)}} as unknown as Animation;};
 const Harness=({active}:{active:boolean})=><div data-promptbox-shell=""><div data-bb-chat-ui-info-bar=""><button>Goal</button><button>Diff</button><div data-bb-chat-ui-slot-toolbar="" data-shared-row=""><button>정보</button></div></div><FluidOptionsPanel active={active} plugins={{plusMenuItems:[],MenuEntry:()=>null}} actions={[{kind:'plan',text:'/plan '}]} onAttach={()=>{}} onClose={()=>{}} onAction={()=>{}} onPluginSelected={()=>{}}/></div>;
 try{
  const v=renderSlot({component:Harness},{active:true},{});
  const first=[...entries];entries.length=0;v.rerender(<Harness active={false}/>);
  expect(first.every(entry=>entry.cancel.mock.calls.length===1)).toBe(true);
  const exits=entries.filter(entry=>entry.options.duration===200),returns=entries.filter(entry=>entry.options.duration===460);
  expect(exits.map(entry=>entry.options.delay)).toEqual([0,45]);
  expect(returns.map(entry=>entry.target.textContent)).toEqual(['Goal','Diff','정보']);
  expect(returns.map(entry=>entry.options.delay)).toEqual([245,290,335]);
  expect(returns.every(entry=>entry.options.fill==='both' && entry.frames.at(-1)?.opacity===1)).toBe(true);
  const closing=[...entries];entries.length=0;v.rerender(<Harness active/> );
  expect(closing.every(entry=>entry.cancel.mock.calls.length===1)).toBe(true);
  expect(entries.filter(entry=>entry.options.duration===200).map(entry=>entry.options.delay)).toEqual([0,45,90]);
  expect(entries.filter(entry=>entry.options.duration===460).map(entry=>entry.options.delay)).toEqual([290,335]);
  v.unmount();expect(entries.every(entry=>entry.cancel.mock.calls.length===1)).toBe(true);
 }finally{Element.prototype.animate=previous;}
});
