// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderSlot } from '@get-bb/plugin-sdk/testing/app';
import { FluidModelControls } from './FluidModelControls';
import { useComposer } from '@get-bb/plugin-sdk/app';
import type { ReactNode } from 'react';
import { injectFluidComposer } from '../lib/fluid-composer';
// kit 기기 판정에 필요한 브라우저 신호를 jsdom에 제공한다.
beforeEach(()=>vi.stubGlobal('matchMedia',(media:string)=>({media,matches:false,addEventListener(){},removeEventListener(){}})));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
// 실제 host 목록과 선택 API를 가진 컴포저를 준비한다.
function mount(options: { levels?: string[]; load?: () => Promise<any>; scope?: any; selection?: any; controls?: ReactNode; singleLine?: boolean } = {}) {
 const models=vi.fn(options.load ?? (async()=>({models:[{id:'model',model:'model',supportedReasoningEfforts:(options.levels ?? ['low','medium','high','max']).map(reasoningEffort=>({reasoningEffort,description:reasoningEffort}))}]})));
 const get=vi.fn(async()=>({environmentId:'env-owned'}));
 const error=vi.fn();
 const selection=options.selection ?? {providerId:'provider',model:'model',reasoningLevel:'medium'};
 const scope=options.scope ?? {kind:'new-thread',projectId:'project'};
 const view=renderSlot({component:()=> <div data-bb-chat-ui-fluid-row={options.singleLine ? '':undefined} data-multiline={options.singleLine ? 'false':undefined}><FluidModelControls controls={options.controls ?? <button type="button">모델 선택</button>} onError={error}/></div>},{},{composer:{scope,selection,text:'남길 초안'},sdk:{providers:{models},threads:{get:get as any}}});
 return {view,models,get,error};
}

// 클릭한 확정 이름만 잠시 보여 주며 연속 선택과 화면 전환은 이전 접힘 예약을 정리한다.
it('briefly reveals the selected effort, restarts its timeout and clears it on scope changes',async()=>{
 const stop=injectFluidComposer(document);vi.useFakeTimers();const {view,models}=mount({singleLine:true});
 try{
  const button=screen.getByRole('button',{name:'Effort: Medium'}),label=button.querySelector<HTMLElement>('[data-bb-chat-ui-fluid-effort-label]')!;
  expect(getComputedStyle(label).maxWidth).toBe('0px');
  await act(async()=>{fireEvent.click(button);});
  expect(button.getAttribute('aria-label')).toBe('Effort: High');expect(button.hasAttribute('data-bb-chat-ui-fluid-effort-peek')).toBe(true);
  act(()=>vi.advanceTimersByTime(1400));
  await act(async()=>{fireEvent.click(button);});
  expect(button.getAttribute('aria-label')).toBe('Effort: Max');
  act(()=>vi.advanceTimersByTime(1400));expect(button.hasAttribute('data-bb-chat-ui-fluid-effort-peek')).toBe(true);
  act(()=>vi.advanceTimersByTime(100));expect(getComputedStyle(label).maxWidth).toBe('0px');
  await act(async()=>{fireEvent.click(button);});
  await act(async()=>{await view.setComposerScope({kind:'thread',threadId:'other'});});
  expect(button.hasAttribute('data-bb-chat-ui-fluid-effort-peek')).toBe(false);expect(models).toHaveBeenCalledTimes(1);expect(view.inspection.composer.text).toBe('남길 초안');
  await act(async()=>{await view.setComposerScope({kind:'new-thread',projectId:'project'});});
  expect(button.hasAttribute('data-bb-chat-ui-fluid-effort-peek')).toBe(false);
 }finally{view.unmount();vi.useRealTimers();stop();}
});
// 모델 설정은 정보 열림과 무관하게 입력 안에 유지한다.
it('keeps native controls and cycles only the current model levels without touching the draft',async()=>{
 const {view,models}=mount(); const native=screen.getByRole('button',{name:'모델 선택'});
 const effort=await screen.findByRole('button',{name:'Effort: Medium'});
 await waitFor(()=>expect(effort.hasAttribute('disabled')).toBe(false));
 fireEvent.click(effort);
 await screen.findByRole('button',{name:'Effort: High'});
 expect(view.inspection.composer.selection?.reasoningLevel).toBe('high');
 expect(view.inspection.composer.text).toBe('남길 초안');expect(screen.getByRole('button',{name:'모델 선택'})).toBe(native);
 fireEvent.click(effort);await screen.findByRole('button',{name:'Effort: Max'});
 expect(effort.querySelector('[data-effort-icon="max"]')).toBeTruthy();
 fireEvent.click(effort);await screen.findByRole('button',{name:'Effort: Low'});expect(models).toHaveBeenCalledTimes(1);
});
// 모델별 목록이 준비되기 전에는 지원 값을 추측하지 않는다.
it('disables cycling during discovery and leaves native picker usable on failure',async()=>{
 const {models}=mount({load:async()=>{throw Error('catalog unavailable');}});
 fireEvent.click(screen.getByRole('button',{name:'Effort: Medium'}));
 await waitFor(()=>expect(models).toHaveBeenCalledTimes(1));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Effort: Medium'}).getAttribute('aria-busy')).toBeNull());
 expect(screen.getByRole('button',{name:'모델 선택'}).hasAttribute('disabled')).toBe(false);
});
// 기존 스레드는 자신이 실행되는 환경의 모델 목록만 읽는다.
it('routes existing thread discovery through its environment',async()=>{
 const {models,get}=mount({scope:{kind:'thread',threadId:'thread'}});
 expect(models).not.toHaveBeenCalled();expect(get).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Effort: Medium'}));
 await waitFor(()=>expect(models).toHaveBeenCalled());
 expect(get).toHaveBeenCalledWith(expect.objectContaining({threadId:'thread'}));
 expect(models.mock.calls[0][0]).toEqual(expect.objectContaining({environmentId:'env-owned',providerId:'provider'}));
});
// provider의 별도 effort 이름도 실제 목록에 있을 때만 순환한다.
it('uses provider labels and distinguishes ultra from max',async()=>{
 const {view}=mount({levels:['medium','ultra']});
 const effort=await screen.findByRole('button',{name:'Effort: Medium'});
 await waitFor(()=>expect(effort.hasAttribute('disabled')).toBe(false));
 fireEvent.click(effort);await screen.findByRole('button',{name:'Effort: Ultra'});
 expect(view.inspection.composer.selection?.reasoningLevel).toBe('ultra');expect(effort.querySelector('[data-effort-icon="ultra"]')).toBeTruthy();
});
// 편집기 전용 범위에는 모델 변경 UI나 조회를 추가하지 않는다.
it('does not query or render effort for an editor without a selection',async()=>{
 const {models}=mount({selection:{},scope:{kind:'queued-message',threadId:'thread',queuedMessageId:'queued'}});
 expect(screen.queryByRole('button',{name:/Effort:/})).toBeNull();expect(models).not.toHaveBeenCalled();
});

// 대화를 바꾼 뒤 도착한 이전 목록은 선택과 새 화면을 바꾸지 않는다.
it('aborts late discovery on a scope change without applying a stale selection',async()=>{
 let resolve!: (result:any)=>void;
 const {view,models}=mount({load:()=>new Promise(done=>{resolve=done;})});
 expect(models).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Effort: Medium'}));
 expect(models).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:'Effort: Medium'}));expect(models).toHaveBeenCalledTimes(1);
 await act(async()=>{await view.setComposerScope({kind:'thread',threadId:'other-thread'});});
 await act(async()=>{resolve({models:[{model:'model',supportedReasoningEfforts:[{reasoningEffort:'medium'},{reasoningEffort:'max'}]}]});});
 expect(view.inspection.composer.selection?.reasoningLevel).toBe('medium');
 expect(view.inspection.composer.selections).toHaveLength(0);expect(models.mock.calls[0][0].signal.aborted).toBe(true);
});

// 모델 버튼의 캐럿과 중복 effort 요약만 숨기고 공급자·모델·메뉴 동작을 유지한다.
it('hides the model caret and duplicate reasoning summary while retaining model, tier and menu',()=>{
 const stop=injectFluidComposer(document),clicked=vi.fn();
 const controls=<><button type="button" aria-label="Provider, model and reasoning" onClick={clicked}><span className="contents" title="Model v2 · Medium reasoning"><svg data-tier-icon=""/><span data-model-base="">Model</span><span data-model-tag="">v2</span><span data-promptbox-hide-compact="" data-native-effort="">Medium</span></span><svg data-caret="" data-icon="ChevronDown"/><span data-shortcut="">shortcut</span></button><button type="button" aria-label="Provider, model and reasoning loading" disabled><span className="contents"><svg/><span className="sr-only">Loading models</span><div data-model-loading-placeholder="trigger-reasoning"/><div data-model-loading-placeholder="trigger-model"/></span></button><div role="dialog" aria-label="모델 설정"><span data-promptbox-hide-compact="" data-menu-effort="">Medium</span></div></>;
 const view=renderSlot({component:()=> <FluidModelControls controls={controls} onError={()=>{}}/>},{},{composer:{selection:{providerId:'provider',model:'model',reasoningLevel:'medium'}}});
 try{expect(getComputedStyle(view.container.querySelector('[data-native-effort]')!).display).toBe('none');expect(getComputedStyle(view.container.querySelector('[data-model-loading-placeholder="trigger-reasoning"]')!).display).toBe('none');
 for(const mark of ['[data-model-base]','[data-model-tag]','[data-tier-icon]','[data-shortcut]','[data-menu-effort]','[data-model-loading-placeholder="trigger-model"]'])expect(getComputedStyle(view.container.querySelector(mark)!).display).not.toBe('none');
 expect(getComputedStyle(view.container.querySelector('[data-caret]')!).display).toBe('none');
 fireEvent.click(screen.getByRole('button',{name:'Provider, model and reasoning'}));expect(clicked).toHaveBeenCalledTimes(1);
 }finally{view.unmount();stop();}
});
// 클릭한 단계의 글자는 fade·zoom과 폭 전환을 한 번 재생하고 이전 모션을 정리한다.
it('animates the confirmed label and cancels its previous motion on repeated changes',async()=>{
 const original=Element.prototype.animate,animations:{target:Element;frames:any;options:any;cancel:ReturnType<typeof vi.fn>}[]=[];
 Element.prototype.animate=function(frames:any,options:any){const item={target:this,frames,options,cancel:vi.fn()};animations.push(item);return{cancel:item.cancel,playState:'running'} as unknown as Animation;};
 const measure=vi.spyOn(HTMLElement.prototype,'offsetWidth','get').mockImplementation(function(this:HTMLElement){return this.hasAttribute('data-bb-chat-ui-fluid-effort-value')?(this.textContent?.length??0)*7:40;});
 const {view}=mount();
 try{expect(animations).toHaveLength(0);const button=screen.getByRole('button',{name:'Effort: Medium'});fireEvent.click(button);await screen.findByRole('button',{name:'Effort: High'});
 expect(animations.some(item=>item.target.hasAttribute('data-bb-chat-ui-fluid-effort-value')&&item.frames[0].opacity===0&&item.frames[0].transform==='scale(.92)')).toBe(true);
 expect(animations.some(item=>item.target.hasAttribute('data-bb-chat-ui-fluid-effort-label')&&item.frames[0].width!==item.frames[1].width)).toBe(true);
 await waitFor(()=>expect(button.hasAttribute('disabled')).toBe(false));
 const old=[...animations];fireEvent.click(button);await screen.findByRole('button',{name:'Effort: Max'});for(const item of old)expect(item.cancel).toHaveBeenCalled();view.unmount();for(const item of animations)expect(item.cancel).toHaveBeenCalled();
 }finally{view.unmount();measure.mockRestore();Element.prototype.animate=original;}
});

// 별도 effort가 없는 컴포저와 다른 picker의 요약은 그대로 표시한다.
it('retains native reasoning when a separate effort control is unavailable',()=>{
 const stop=injectFluidComposer(document);
 const controls=<button type="button" aria-label="Provider, model and reasoning"><span><span>Model</span><span data-promptbox-hide-compact="" data-native-effort="">Medium</span></span></button>;
 const view=renderSlot({component:()=> <FluidModelControls controls={controls} onError={()=>{}}/>},{},{composer:{selection:{}}});
 try{expect(getComputedStyle(view.container.querySelector('[data-native-effort]')!).display).not.toBe('none');expect(view.container.querySelector('[data-bb-chat-ui-fluid-effort]')).toBeNull();}finally{view.unmount();stop();}
});
// 모션 줄이기를 켜면 진행 중인 전환을 끝내고 다음 값도 즉시 표시한다.
it('finishes the label animation when reduced motion is enabled',async()=>{
 let reduced=false;const listeners=new Set<()=>void>();
 vi.stubGlobal('matchMedia',(media:string)=>({media,get matches(){return media.includes('prefers-reduced-motion')&&reduced;},addEventListener(_name:string,listener:()=>void){if(media.includes('prefers-reduced-motion'))listeners.add(listener);},removeEventListener(_name:string,listener:()=>void){listeners.delete(listener);}}));
 const old=Element.prototype.animate,cancel=vi.fn();const animate=vi.fn(()=>({cancel,playState:'running'} as unknown as Animation));Element.prototype.animate=animate;
 const {view}=mount();try{fireEvent.click(screen.getByRole('button',{name:'Effort: Medium'}));await screen.findByRole('button',{name:'Effort: High'});expect(animate).toHaveBeenCalled();
 await act(async()=>{reduced=true;for(const listener of listeners)listener();});expect(cancel).toHaveBeenCalled();animate.mockClear();
 await waitFor(()=>expect(screen.getByRole('button',{name:'Effort: High'}).hasAttribute('disabled')).toBe(false));fireEvent.click(screen.getByRole('button',{name:'Effort: High'}));await screen.findByRole('button',{name:'Effort: Max'});expect(animate).not.toHaveBeenCalled();
 }finally{view.unmount();Element.prototype.animate=old;}expect(listeners.size).toBe(0);
});

// native 메뉴의 연속 변경도 진행 중인 표시 폭에서 이어진다.
it('continues native effort changes from the currently displayed width',async()=>{
 const old=Element.prototype.animate,records:{node:Element;frames:any}[]=[];
 Element.prototype.animate=function(frames:any){records.push({node:this,frames});return{cancel:vi.fn(),playState:'running'} as unknown as Animation;};
 const widths=vi.spyOn(HTMLElement.prototype,'offsetWidth','get').mockImplementation(function(this:HTMLElement){return this.hasAttribute('data-bb-chat-ui-fluid-effort-value')?(this.textContent?.length??0)*7:40;});
 const bounds=vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){return {width:31,height:16,x:0,y:0,left:0,top:0,right:31,bottom:16,toJSON(){return{};}} as DOMRect;});
 // 검수용 native 메뉴에서 같은 공개 선택 API로 다른 단계를 고른다.
 function NativeEffort(){const composer=useComposer();return <button type="button" onClick={()=>{void composer.setSelection({reasoningLevel:'max'});}}>native effort</button>;}
 const {view}=mount({controls:<NativeEffort/>});
 try{fireEvent.click(screen.getByRole('button',{name:'Effort: Medium'}));await screen.findByRole('button',{name:'Effort: High'});records.length=0;fireEvent.click(screen.getByRole('button',{name:'native effort'}));await screen.findByRole('button',{name:'Effort: Max'});expect(records.find(item=>item.node.hasAttribute('data-bb-chat-ui-fluid-effort-label'))?.frames[0].width).toBe('31px');}
 finally{view.unmount();widths.mockRestore();bounds.mockRestore();Element.prototype.animate=old;}
});

// phone에서는 실제 native summary의 아이콘만 남기고 모델 글자가 옆으로 새지 않게 한다.
it('keeps the native contents summary compact on phone and restores desktop model text',()=>{
 const root=document.documentElement,previous=root.getAttribute('data-bb-chat-ui-root-device');root.setAttribute('data-bb-chat-ui-root-device','phone');const stop=injectFluidComposer(document);
 const controls=<button type="button" aria-label="Provider, model and reasoning"><span className="contents"><svg data-tier-icon=""/><span data-model-base="">Model</span><span data-model-tag="">v2</span><span data-promptbox-hide-compact="" data-native-effort="">Medium</span></span><svg/></button>;
 const view=renderSlot({component:()=> <form data-bb-chat-ui-fluid-composer="" data-bb-composer-device="phone"><FluidModelControls controls={controls} onError={()=>{}}/></form>},{},{composer:{selection:{providerId:'provider',model:'model',reasoningLevel:'medium'}}});
 try{expect(getComputedStyle(view.container.querySelector('[data-model-base]')!).display).toBe('none');expect(getComputedStyle(view.container.querySelector('[data-model-tag]')!).display).toBe('none');expect(getComputedStyle(view.container.querySelector('[data-tier-icon]')!).display).not.toBe('none');view.container.querySelector('form')!.setAttribute('data-bb-composer-device','desktop');expect(getComputedStyle(view.container.querySelector('[data-model-base]')!).display).not.toBe('none');expect(getComputedStyle(view.container.querySelector('[data-native-effort]')!).display).toBe('none');}
 finally{view.unmount();stop();if(previous===null)root.removeAttribute('data-bb-chat-ui-root-device');else root.setAttribute('data-bb-chat-ui-root-device',previous);}
});
