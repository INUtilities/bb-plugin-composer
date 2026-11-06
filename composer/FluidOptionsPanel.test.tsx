// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderSlot } from '@get-bb/plugin-sdk/testing/app';
import { useComposer, type ExperimentalComposerPlusMenuContribution, type ExperimentalComposerMenuEntryProps } from '@get-bb/plugin-sdk/app';
import { FluidOptionsPanel, type FluidOptionsPanelProps } from './FluidOptionsPanel';
import { DropdownMenuItem } from './components/ui/dropdown-menu';

afterEach(()=>{cleanup();vi.restoreAllMocks();});
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
it('fades the complete menu once regardless of item count and cancels when closed',()=>{
 const media={matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()};
 const old=window.matchMedia;window.matchMedia=()=>media as unknown as MediaQueryList;
 const motions:{target:Element;frames:Keyframe[];options:KeyframeAnimationOptions;cancel:ReturnType<typeof vi.fn>}[]=[];
 const oldAnimate=Element.prototype.animate;
 Element.prototype.animate=function(frames,options){const record={target:this,frames:frames as Keyframe[],options:options as KeyframeAnimationOptions,cancel:vi.fn()};motions.push(record);return record as unknown as Animation;};
 try{
  const items=Array.from({length:12},(_,i)=>({...plugin(),key:`p/${i}`}));const {v}=mount({},items);
  expect(motions).toHaveLength(1);expect(motions[0].target.getAttribute('role')).toBe('menu');
  expect(motions[0].options.delay??0).toBe(0);expect(motions[0].options.duration).toBe(260);
  expect(motions[0].frames).toEqual([{opacity:0},{opacity:1}]);
  v.unmount();for(const m of motions)expect(m.cancel).toHaveBeenCalled();expect(media.removeEventListener).toHaveBeenCalled();
 }finally{window.matchMedia=old;Element.prototype.animate=oldAnimate;}
});
it('cancels entering choices immediately when reduced motion is enabled',()=>{
 let change:(()=>void)|undefined;const media={matches:false,addEventListener:(_event:string,fn:()=>void)=>{change=fn;},removeEventListener:vi.fn()};
 const old=window.matchMedia;window.matchMedia=()=>media as unknown as MediaQueryList;
 const cancel=vi.fn(),oldAnimate=Element.prototype.animate;Element.prototype.animate=()=>({cancel}) as unknown as Animation;
 try{const {v}=mount({onAttach:vi.fn()});expect(change).toBeTypeOf('function');media.matches=true;change!();expect(cancel).toHaveBeenCalled();v.unmount();}finally{window.matchMedia=old;Element.prototype.animate=oldAnimate;}
});
it('keeps menu text stationary while its opacity fades in',()=>{
 const oldAnimate=Element.prototype.animate,motions:{frames:Keyframe[];options:KeyframeAnimationOptions}[]=[];
 Element.prototype.animate=function(frames,options){motions.push({frames:frames as Keyframe[],options:options as KeyframeAnimationOptions});return {cancel:vi.fn()} as unknown as Animation;};
 try{
  mount({onAttach:vi.fn()});expect(motions).toHaveLength(1);
  const {frames,options}=motions[0];
  expect(frames.every(frame=>frame.transform===undefined)).toBe(true);
  expect(frames.at(-1)!.opacity).toBe(1);expect(options.duration).toBe(260);
 }finally{Element.prototype.animate=oldAnimate;}
});
it('preserves a disabled choice opacity during its entrance',()=>{
 const style=document.createElement('style');style.textContent='button:disabled { opacity:.4; }';document.head.append(style);
 const oldAnimate=Element.prototype.animate,frames:Keyframe[][]=[];
 Element.prototype.animate=function(value){frames.push(value as Keyframe[]);return {cancel:vi.fn()} as unknown as Animation;};
 try{mount({},[plugin(true)]);expect(frames).toHaveLength(1);expect(Number(frames[0].at(-1)!.opacity)).toBe(1);expect(getComputedStyle(screen.getByRole('menuitem')).opacity).toBe('0.4');}finally{style.remove();Element.prototype.animate=oldAnimate;}
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
