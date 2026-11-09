// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderSlot } from '@get-bb/plugin-sdk/testing/app';
import { FluidModelControls } from './FluidModelControls';
// kit 기기 판정에 필요한 브라우저 신호를 jsdom에 제공한다.
beforeEach(()=>vi.stubGlobal('matchMedia',(media:string)=>({media,matches:false,addEventListener(){},removeEventListener(){}})));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
// 실제 host 목록과 선택 API를 가진 컴포저를 준비한다.
function mount(options: { levels?: string[]; load?: () => Promise<any>; scope?: any; selection?: any } = {}) {
 const models=vi.fn(options.load ?? (async()=>({models:[{id:'model',model:'model',supportedReasoningEfforts:(options.levels ?? ['low','medium','high','max']).map(reasoningEffort=>({reasoningEffort,description:reasoningEffort}))}]})));
 const get=vi.fn(async()=>({environmentId:'env-owned'}));
 const error=vi.fn();
 const selection=options.selection ?? {providerId:'provider',model:'model',reasoningLevel:'medium'};
 const scope=options.scope ?? {kind:'new-thread',projectId:'project'};
 const view=renderSlot({component:()=> <FluidModelControls controls={<button type="button">모델 선택</button>} onError={error}/>},{},{composer:{scope,selection,text:'남길 초안'},sdk:{providers:{models},threads:{get:get as any}}});
 return {view,models,get,error};
}
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
