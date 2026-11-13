// @vitest-environment jsdom
import { useRef } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderSlot } from '@get-bb/plugin-sdk/testing/app';
import { FluidComposerPicker } from './FluidComposerPicker';

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal('matchMedia', (media:string) => ({media,matches:false,addEventListener(){},removeEventListener(){}}));
});
afterEach(() => {
  cleanup();
  delete (window as Window & {bb?:unknown}).bb;
  vi.unstubAllGlobals();
});

// 닫힌 목록의 배치 보정 스크롤은 새 설정 조회나 선택을 시작하지 않는다.
it('ignores a hidden wheel scroll instead of reopening the picker',async()=>{
  const {view,models}=mount();
  const scroller=view.container.querySelector('[aria-label="Provider"] [data-bb-chat-ui-slot-scroll]')!;
  Object.defineProperty(scroller,'scrollTop',{configurable:true,writable:true,value:40});
  fireEvent.scroll(scroller);
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,180));});
  expect(models).not.toHaveBeenCalled();
  expect(screen.queryByRole('group',{name:'모델 슬롯'})).toBeNull();
  expect(view.inspection.composer.selections).toHaveLength(0);
});

// 배치 보정은 선택을 바꾸지 않고 실제 wheel 조작 뒤의 스크롤만 선택한다.
it('changes provider only after a user scroll gesture, not a layout scroll',async()=>{
  const {view,models}=mount();
  fireEvent.click(screen.getByRole('button',{name:'모델과 Effort 설정'}));
  await screen.findByRole('option',{name:'Opus'});
  const scroller=view.container.querySelector('[aria-label="Provider"] [data-bb-chat-ui-slot-scroll]')!;
  Object.defineProperty(scroller,'scrollTop',{configurable:true,writable:true,value:40});
  fireEvent.scroll(scroller);
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,180));});
  expect(models).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('option',{name:'Opus'}).getAttribute('aria-selected')).toBe('true');
  fireEvent.wheel(scroller,{deltaY:40});scroller.scrollTop=40;fireEvent.scroll(scroller);
  await screen.findByRole('option',{name:'GPT'});
  expect(models).toHaveBeenCalledTimes(2);
});

// 실제 호스트 모양의 공급자와 모델 목록을 검수용으로 만든다.
function fixtures() {
  const providers = [
    {id:'claude',displayName:'Claude Code',logoUrl:null,serviceTiers:[{id:'default',label:'Default'},{id:'fast',label:'Fast'}]},
    {id:'codex',displayName:'Codex',logoUrl:null,serviceTiers:[{id:'default',label:'Standard'},{id:'fast',label:'Fast'}]},
  ];
  const model = (id:string, levels:string[]) => ({id,model:id,displayName:id,description:'',isDefault:true,defaultReasoningEffort:'medium',supportedReasoningEfforts:levels.map(reasoningEffort=>({reasoningEffort,description:reasoningEffort}))});
  return {providers,opus:model('Opus',['low','medium','high','max']),gpt:{...model('GPT',['low','medium','high']),supportedServiceTiers:[{id:'fast'}]}};
}

// 제품과 같은 슬롯을 같은 입력 노드 옆에 연결한다.
function mount(load?: (args:any) => Promise<any>, thread=false) {
  const {providers,opus,gpt} = fixtures();
  const models = vi.fn(load ?? (async({providerId})=>({models:[providerId==='codex'?gpt:opus],selectedOnlyModels:[]})));
  const error=vi.fn();
  // 렌더링 도중 모드를 바꾸어도 입력을 다시 만들지 않는다.
  function Harness() {
    const form = useRef<HTMLFormElement>(null);
    return <div data-scroll-footer=""><div data-promptbox-shell=""><form ref={form}><FluidComposerPicker formRef={form} onOpen={()=>{}} onError={error}>
      {picker=><>
        {picker.modeToggle}
        <div hidden={picker.enabled}><button type="button">기존 모델 선택</button></div>
        <input aria-label="초안 검수" defaultValue="보관할 초안"/>
        {picker.enabled ? picker.trigger : null}
        <div data-bb-chat-ui-slot-submit=""><button type="button">검수 전송</button>{picker.confirm}</div>
        {picker.overlay}
      </>}
    </FluidComposerPicker></form></div></div>;
  }
  const view=renderSlot({component:Harness},{},{providers:{status:'ready',providers:providers as any},
    composer:{scope:thread ? {kind:'thread',threadId:'thread'}:{kind:'new-thread',projectId:'project'},selection:{providerId:'claude',model:'Opus',reasoningLevel:'medium'},text:'보관할 초안'},
    sdk:{providers:{models},threads:{get:vi.fn(async()=>({environmentId:'env-owned'})) as any}}});
  return {view,models,error};
}

// 06과 기존 방식을 전환해도 초안과 입력 노드를 유지하고 목록은 미리 읽지 않는다.
it('toggles the actual mode without replacing the input, clearing the draft or eagerly fetching models',()=>{
  const {view,models}=mount();
  const input=screen.getByRole('textbox',{name:'초안 검수'});
  const toggle=screen.getByRole('button',{name:'06 슬롯'});
  expect(toggle.getAttribute('aria-pressed')).toBe('true');
  fireEvent.change(input,{target:{value:'직접 쓴 초안'}});
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByRole('button',{name:'기존 모델 선택'})).toBeTruthy();
  expect(screen.getByRole('textbox',{name:'초안 검수'})).toBe(input);
  expect((input as HTMLInputElement).value).toBe('직접 쓴 초안');
  expect(view.inspection.composer.text).toBe('보관할 초안');
  expect(models).not.toHaveBeenCalled();
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-pressed')).toBe('true');
  expect(models).not.toHaveBeenCalled();
});

it('pulses the phone haptic when the slot confirmation button is pressed',async()=>{
 vi.stubGlobal('matchMedia',(query:string)=>({
  media:query,
  matches:query==='(hover: none)'||query==='(pointer: coarse)'||query==='(any-pointer: coarse)'||query==='(orientation: portrait)',
  addEventListener(){},removeEventListener(){},
 }));
 const width=vi.spyOn(window.screen,'width','get').mockReturnValue(390);
 const height=vi.spyOn(window.screen,'height','get').mockReturnValue(844);
 const post=vi.fn();Object.assign(window,{bb:{native:{capabilities:['haptic'],post}}});
 try {
  mount();
  fireEvent.click(screen.getByRole('button',{name:'모델과 Effort 설정'}));
  await screen.findByRole('option',{name:'Opus'});
  post.mockClear();
  fireEvent.click(screen.getByRole('button',{name:'설정 완료'}));
  expect(post).toHaveBeenCalledExactlyOnceWith({type:'haptic',kind:'impact-light'});
 } finally { width.mockRestore(); height.mockRestore(); }
});

// 여백 표식은 닫힐 때도 남겨 전환을 잇고 입력기가 해제될 때 원래 상태로 복구한다.
it('retains the closed shell state for chat motion and restores it on unmount',async()=>{
  const {view}=mount();
  const shell=view.container.querySelector('[data-promptbox-shell]')!;
  expect(shell.getAttribute('data-bb-chat-ui-slot-picker-open')).toBe('false');
  fireEvent.click(screen.getByRole('button',{name:'모델과 Effort 설정'}));
  await screen.findByRole('option',{name:'Opus'});
  expect(shell.getAttribute('data-bb-chat-ui-slot-picker-open')).toBe('true');
  fireEvent.keyDown(screen.getByRole('listbox',{name:'Effort'}),{key:'Escape'});
  expect(shell.getAttribute('data-bb-chat-ui-slot-picker-open')).toBe('false');
  fireEvent.click(screen.getByRole('button',{name:'06 슬롯'}));
  expect(shell.getAttribute('data-bb-chat-ui-slot-picker-open')).toBe('false');
  view.unmount();
  expect(shell.hasAttribute('data-bb-chat-ui-slot-picker-open')).toBe(false);
});

// 블러 한 장은 닫혀도 하단에 남고 입력기 해제 때 제거된다.
it('portals one full-width backdrop into the chat footer and cleans it up',async()=>{
  const {view}=mount();
  const footer=view.container.querySelector('[data-scroll-footer]')!;
  const backdrop=footer.querySelector('[data-bb-chat-ui-slot-backdrop]')!;
  expect(backdrop.parentElement).toBe(footer);
  expect(backdrop.hasAttribute('data-open')).toBe(false);
  expect(backdrop.hasAttribute('data-full-width')).toBe(true);
  expect(view.container.querySelector('form')!.contains(backdrop)).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'모델과 Effort 설정'}));
  await screen.findByRole('option',{name:'Opus'});
  expect(backdrop.hasAttribute('data-open')).toBe(true);
  expect(footer.querySelectorAll('[data-bb-chat-ui-slot-backdrop]')).toHaveLength(1);
  fireEvent.keyDown(screen.getByRole('listbox',{name:'Effort'}),{key:'Escape'});
  expect(backdrop.hasAttribute('data-open')).toBe(false);
  expect(backdrop.parentElement).toBe(footer);
  view.unmount();
  expect(footer.contains(backdrop)).toBe(false);
});

// 공급자를 굴리는 동안 초안을 건드리지 않고 확인 때만 실제 호스트 선택을 적용한다.
it('stages a provider handoff and supported Fast choice until confirmation without submitting',async()=>{
  const {view,models}=mount(undefined,true);
  fireEvent.click(screen.getByRole('button',{name:'모델과 Effort 설정'}));
  await screen.findByRole('option',{name:'Opus'});
  expect(models).toHaveBeenCalledWith(expect.objectContaining({providerId:'claude',environmentId:'env-owned'}));
  fireEvent.click(screen.getByRole('option',{name:'Codex'}));
  await screen.findByRole('option',{name:'GPT'});
  fireEvent.click(screen.getByRole('button',{name:'Fast mode'}));
  expect(view.inspection.composer.selections).toHaveLength(0);
  expect(view.inspection.composer.text).toBe('보관할 초안');
  const confirm=screen.getByRole('button',{name:'Codex로 핸드오프'});
  fireEvent.click(confirm);fireEvent.click(confirm);
  await waitFor(()=>expect(view.inspection.composer.selection?.providerId).toBe('codex'));
  expect(view.inspection.composer.selection).toMatchObject({model:'GPT',reasoningLevel:'medium',serviceTier:'fast'});
  expect(view.inspection.composer.text).toBe('보관할 초안');
  expect(view.inspection.composer.submits).toHaveLength(0);
  expect(view.inspection.composer.selections).toHaveLength(1);
});

// 모델 목록이 일반 모드를 생략해도 두 공급자의 Fast를 표시하고 기본값은 켜지 않는다.
it('keeps Fast available and off for provider tiers and a model declaring only fast',async()=>{
  const {view}=mount();
  fireEvent.click(screen.getByRole('button',{name:'모델과 Effort 설정'}));
  await screen.findByRole('option',{name:'Opus'});
  expect(screen.getByRole('button',{name:'Fast mode'}).getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(screen.getByRole('option',{name:'Codex'}));
  await screen.findByRole('option',{name:'GPT'});
  const fast=screen.getByRole('button',{name:'Fast mode'});
  expect(fast.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(fast);
  expect(fast.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(fast);
  expect(fast.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(screen.getByRole('button',{name:'설정 완료'}));
  await waitFor(()=>expect(view.inspection.composer.selection).toMatchObject({providerId:'codex',model:'GPT',serviceTier:'default'}));
  expect(view.inspection.composer.submits).toHaveLength(0);
});

// Fast는 마지막 열에 두고 마우스·터치 클릭으로 연 상태 문구를 잠시만 유지한다.
it('keeps hover and focus compact and briefly reveals Fast text only after clicking',async()=>{
  const {view}=mount();
  fireEvent.click(screen.getByRole('button',{name:'모델과 Effort 설정'}));
  await screen.findByRole('option',{name:'Opus'});
  const fast=screen.getByRole('button',{name:'Fast mode'});
  const label=fast.querySelector('[data-bb-chat-ui-slot-fast-label]')!;
  expect(fast.parentElement?.lastElementChild).toBe(fast);
  expect(fast.previousElementSibling?.getAttribute('aria-label')).toBe('Effort');
  vi.useFakeTimers();
  const scheduled=vi.spyOn(globalThis,'setTimeout'),cancelled=vi.spyOn(globalThis,'clearTimeout');
  try {
    fireEvent.mouseEnter(fast);
    expect(fast.hasAttribute('data-peek')).toBe(false);
    expect(label.textContent).toBe('Fast Off');
    act(()=>vi.advanceTimersByTime(1500));
    expect(fast.hasAttribute('data-peek')).toBe(false);
    fireEvent.click(fast);
    expect(label.textContent).toBe('Fast On');
    expect(fast.hasAttribute('data-peek')).toBe(true);
    act(()=>vi.advanceTimersByTime(1000));
    fireEvent.click(fast);
    expect(label.textContent).toBe('Fast Off');
    act(()=>vi.advanceTimersByTime(1000));
    expect(fast.hasAttribute('data-peek')).toBe(true);
    act(()=>vi.advanceTimersByTime(500));
    expect(fast.hasAttribute('data-peek')).toBe(false);
    fireEvent.focus(fast);
    expect(fast.hasAttribute('data-peek')).toBe(false);
    fireEvent.click(fast);
    expect(fast.hasAttribute('data-peek')).toBe(true);
    const peekTimer=scheduled.mock.results[scheduled.mock.calls.findLastIndex(call=>call[1]===1500)]!.value;
    fireEvent.keyDown(fast,{key:'Escape'});
    expect(cancelled).toHaveBeenCalledWith(peekTimer);
    expect(fast.hasAttribute('data-peek')).toBe(false);
    expect(fast.hasAttribute('disabled')).toBe(true);
    expect(view.inspection.composer.selections).toHaveLength(0);
    view.unmount();
  } finally {scheduled.mockRestore();cancelled.mockRestore();vi.useRealTimers();}
});

// 취소와 모드 전환은 아직 확인하지 않은 모델·Effort를 호스트에 쓰지 않는다.
it('discards unconfirmed selections on Escape and reuses a scoped catalog',async()=>{
  const {view,models}=mount();
  fireEvent.click(screen.getByRole('button',{name:'모델과 Effort 설정'}));
  await screen.findByRole('option',{name:'Opus'});
  fireEvent.keyDown(screen.getByRole('listbox',{name:'Effort'}),{key:'End'});
  fireEvent.keyDown(screen.getByRole('listbox',{name:'Effort'}),{key:'Escape'});
  expect(view.inspection.composer.selections).toHaveLength(0);
  fireEvent.click(screen.getByRole('button',{name:'모델과 Effort 설정'}));
  await screen.findByRole('option',{name:'Opus'});
  expect(screen.getByRole('option',{name:'Medium'}).getAttribute('aria-selected')).toBe('true');
  expect(models).toHaveBeenCalledTimes(1);
});

// 늦게 도착한 이전 대화의 목록은 새 대화를 바꾸지 않는다.
it('aborts late catalog results when the composer scope changes',async()=>{
  let resolve!:(value:any)=>void;
  const {view,models}=mount(()=>new Promise(done=>{resolve=done;}));
  fireEvent.click(screen.getByRole('button',{name:'모델과 Effort 설정'}));
  await waitFor(()=>expect(models).toHaveBeenCalledTimes(1));
  await act(async()=>{await view.setComposerScope({kind:'thread',threadId:'next'});});
  expect(models.mock.calls[0][0].signal.aborted).toBe(true);
  await act(async()=>{resolve({models:[fixtures().opus],selectedOnlyModels:[]});});
  expect(screen.queryByRole('group',{name:'모델 슬롯'})).toBeNull();
  expect(view.inspection.composer.selections).toHaveLength(0);
});

// 목록 조회 실패 뒤에도 기존 방식을 바로 선택할 수 있다.
it('leaves the original mode available after catalog failure',async()=>{
  const {view}=mount(async()=>{throw Error('모델 목록 오류');});
  fireEvent.click(screen.getByRole('button',{name:'모델과 Effort 설정'}));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button',{name:'06 슬롯'}));
  expect(screen.getByRole('button',{name:'기존 모델 선택'})).toBeTruthy();
  expect(view.inspection.composer.selections).toHaveLength(0);
});

// 명시적으로 지원하지 않는 Fast와 Effort는 공급자 기본값으로 추측하지 않는다.
it('hides unsupported Fast and handles a model without effort without a new-thread handoff',async()=>{
  const {view}=mount(async()=>({models:[{...fixtures().gpt,supportedReasoningEfforts:[],supportedServiceTiers:[]}],selectedOnlyModels:[]}));
  fireEvent.click(screen.getByRole('button',{name:'모델과 Effort 설정'}));
  await screen.findByRole('option',{name:'GPT'});
  fireEvent.click(screen.getByRole('option',{name:'Codex'}));
  await screen.findByRole('option',{name:'설정 없음'});
  expect(screen.queryByRole('button',{name:'Fast mode'})).toBeNull();
  expect(screen.getByRole('button',{name:'설정 완료'})).toBeTruthy();
  expect(screen.getByRole('listbox',{name:'Effort'}).getAttribute('aria-disabled')).toBe('true');
  expect(view.inspection.composer.selections).toHaveLength(0);
});

// 모드를 끄면 지연 중인 목록을 취소하고 다시 켜도 확인 전 선택을 열지 않는다.
it('cancels discovery when switching to the original mode and remembers the mode on remount',async()=>{
  let resolve!:(value:any)=>void;
  const {view,models}=mount(()=>new Promise(done=>{resolve=done;}));
  fireEvent.click(screen.getByRole('button',{name:'모델과 Effort 설정'}));
  await waitFor(()=>expect(models).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button',{name:'06 슬롯'}));
  expect(models.mock.calls[0][0].signal.aborted).toBe(true);
  await act(async()=>{resolve({models:[fixtures().opus],selectedOnlyModels:[]});});
  expect(screen.queryByRole('group',{name:'모델 슬롯'})).toBeNull();
  view.unmount();
  const next=mount();
  expect(screen.getByRole('button',{name:'06 슬롯'}).getAttribute('aria-pressed')).toBe('false');
  expect(next.models).not.toHaveBeenCalled();
});
