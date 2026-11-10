import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { experimental_ProviderIcon as ProviderIcon } from '@get-bb/plugin-sdk/app';
import { Button } from './components/ui/button';
import { EffortIcon } from './EffortIcon';
import { FluidPickerWheel } from './FluidPickerWheel';
import { useFluidPicker } from './useFluidPicker';
import { useDeviceChrome } from '../lib/use-device';
import { postHaptic, readHapticBridge } from '../lib/send-haptic';
import { eventHop } from '../lib/motion';
import { bindComposerScrollBoundary } from '../lib/composer-scroll-boundary';

const MODE_KEY='bb-chat-ui:fluid-slot-picker';
const listeners=new Set<()=>void>();
let memoryMode=true;
const labels:Record<string,string>={none:'None',minimal:'Minimal',low:'Low',medium:'Medium',high:'High',xhigh:'Extra high',max:'Max',ultra:'Ultra'};

// 같은 앱 실행 안에서 선택한 방식을 읽고 저장소가 막히면 메모리를 쓴다.
function readMode() {try{return sessionStorage.getItem(MODE_KEY)!=='off';}catch{return memoryMode;}}
// 다른 컴포저도 같은 토글 선택을 즉시 읽도록 구독한다.
function subscribe(listener:()=>void) {listeners.add(listener);return ()=>{listeners.delete(listener);};}
// 현재 앱 실행의 표시 방식만 보관하고 실제 모델 설정은 바꾸지 않는다.
function writeMode(enabled:boolean) {
  memoryMode=enabled;
  try{sessionStorage.setItem(MODE_KEY,enabled?'on':'off');}catch{}
  for(const listener of listeners) listener();
}

// 원래 정보 버튼과 같은 Settings2 도형을 표시한다.
function SettingsGlyph() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 17H19M5 7h9"/><circle cx="7" cy="17" r="3"/><circle cx="17" cy="7" r="3"/></svg>;
}

// Fast 상태를 나타내는 비대화형 번개를 그린다.
function FastGlyph() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m13 2-8 11h6l-1 9 9-12h-6l1-8Z"/></svg>;
}

type PickerUi={enabled:boolean;open:boolean;modeToggle:ReactNode;trigger:ReactNode;confirm:ReactNode;overlay:ReactNode;close():void};

// 같은 작성창을 유지하며 기존 컨트롤과 06번 슬롯을 선택적으로 연결한다.
export function FluidComposerPicker({formRef,disabled=false,onOpen,onError,children}:{
  formRef:RefObject<HTMLFormElement | null>;disabled?:boolean;onOpen():void;onError(message:string):void;children(ui:PickerUi):ReactNode;
}) {
  const enabled=useSyncExternalStore(subscribe,readMode,readMode);
  const picker=useFluidPicker(disabled,onError), {state}=picker;
  const {device}=useDeviceChrome();
  const trigger=useRef<HTMLButtonElement>(null), done=useRef<HTMLButtonElement>(null), layer=useRef<HTMLDivElement>(null);
  const visible=enabled && state.open && !disabled;
  const rowSize=device==='phone'?44:40;
  const locked=disabled || state.applying, wheelDisabled=locked || !visible;
  // 실제 phone 활성화마다 선택 햅틱을 한 번 전달한다.
  const pulse=(trusted:boolean)=>{if(trusted && device==='phone') postHaptic(readHapticBridge(window),'selection');};
  // 취소할 때만 선택 화면을 닫고 필요한 경로에서 설정 버튼에 포커스를 돌린다.
  const dismiss=(restore=false)=>{picker.close();if(restore) trigger.current?.focus({preventScroll:true});};
  // 다른 컴포저에서 기존 방식으로 바꾸어도 숨은 목록 요청을 즉시 취소한다.
  useEffect(()=>{if(!enabled) picker.close();},[enabled]);
  // 원래 표식은 해제 때만 복구해 자식의 배치 측정 중 CSS 변수가 사라지지 않게 한다.
  useLayoutEffect(()=>{
    const form=formRef.current;
    if(!form) return;
    const marks=['data-bb-chat-ui-slot-enabled','data-bb-chat-ui-slot-open'];
    const previous=marks.map(mark=>form.getAttribute(mark));
    const sizes=['--bb-chat-ui-slot-compact-width','--bb-chat-ui-slot-model-fr','--bb-chat-ui-slot-effort-fr'];
    const previousSizes=sizes.map(size=>form.style.getPropertyValue(size));
    return ()=>{
      marks.forEach((mark,index)=>{if(previous[index]===null) form.removeAttribute(mark);else form.setAttribute(mark,previous[index]!);});
      sizes.forEach((size,index)=>{if(previousSizes[index]) form.style.setProperty(size,previousSizes[index]!);else form.style.removeProperty(size);});
    };
  },[formRef]);
  // 표시 상태만 갱신하며 이전 렌더의 정리에서 표식을 지우지 않는다.
  useLayoutEffect(()=>{
    formRef.current?.toggleAttribute('data-bb-chat-ui-slot-enabled',enabled);
    formRef.current?.toggleAttribute('data-bb-chat-ui-slot-open',visible);
  },[enabled,visible,formRef]);
  // 설정을 여는 동안 바깥 누르기·Escape·전송 차단과 로컬 스크롤 경계를 관리한다.
  useEffect(()=>{
    const form=formRef.current, overlay=layer.current;
    if(!visible || !form || !overlay) return;
    const doc=form.ownerDocument;
    // 바깥 또는 가려진 본문을 누르면 확인 전 설정만 취소한다.
    const outside=(event:PointerEvent)=>{
      const target=event.target as Element;
      if(!form.contains(target) || (target.closest('[data-bb-chat-ui-fluid-height]') && !target.closest('[data-bb-chat-ui-slot-trigger],[data-bb-chat-ui-slot-submit]'))) dismiss();
    };
    // 슬롯의 Escape만 소비하며 현재 입력의 다른 키 동작은 유지한다.
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape' && (form.contains(doc.activeElement) || doc.activeElement===doc.body)) {event.preventDefault();event.stopPropagation();dismiss(true);}
    };
    // 설정을 확인하는 Enter나 합성 submit이 메시지를 보내지 못하게 한다.
    const submit=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();};
    const stopScroll=bindComposerScrollBoundary(overlay);
    doc.addEventListener('pointerdown',outside,true);doc.addEventListener('keydown',key,true);form.addEventListener('submit',submit,true);
    return ()=>{stopScroll();doc.removeEventListener('pointerdown',outside,true);doc.removeEventListener('keydown',key,true);form.removeEventListener('submit',submit,true);};
  },[visible,locked,formRef]);
  // 01과 같은 확인 버튼 모션을 쓰며 동작 줄이기와 해제 때 정리한다.
  useLayoutEffect(()=>{
    if(!visible || !done.current) return;
    const animation=eventHop(done.current), media=matchMedia('(prefers-reduced-motion: reduce)');
    // 동작 줄이기를 켜면 현재 표시 중 모션도 취소한다.
    const reduce=()=>{if(media.matches) animation?.cancel();};
    media.addEventListener('change',reduce);
    return ()=>{animation?.cancel();media.removeEventListener('change',reduce);};
  },[visible,picker.handoff]);
  const providerIndex=Math.max(0,picker.providers.findIndex(item=>item.id===state.draft.providerId));
  const modelIndex=Math.max(0,state.models.findIndex(item=>item.model===state.draft.model));
  const efforts=picker.model?.supportedReasoningEfforts ?? [];
  const effortIndex=Math.max(0,efforts.findIndex(item=>item.reasoningEffort===state.draft.reasoningLevel));
  const normalTier=picker.tiers.find(item=>item.id!=='fast'), hasFast=picker.tiers.some(item=>item.id==='fast') && !!normalTier;
  const targetName=picker.providers.find(item=>item.id===state.draft.providerId)?.displayName ?? state.draft.providerId ?? '';
  // 현재 선택한 세 슬롯과 확인 버튼에 필요한 폭만 계산해 열린 컴포저를 줄인다.
  useLayoutEffect(()=>{
    const form=formRef.current, overlay=layer.current, win=form?.ownerDocument.defaultView;
    if(!visible || !form || !overlay || !win) return;
    // 계산된 CSS 길이를 픽셀 수로 읽는다.
    const pixels=(value:string)=>Number.parseFloat(value)||0;
    // 각 슬롯에서 현재 선택한 항목의 글자·아이콘·여백을 합한다.
    const selectedWidth=(name:string)=>{
      const wheel=Array.from(overlay.querySelectorAll<HTMLElement>('[data-bb-chat-ui-slot-wheel]'))
        .find(item=>item.getAttribute('aria-label')===name);
      const selected=wheel?.querySelector<HTMLElement>('[data-bb-chat-ui-slot-item][aria-selected="true"]');
      const face=selected?.querySelector<HTMLElement>('[data-bb-chat-ui-slot-item-face]');
      const label=face?.querySelector<HTMLElement>('span');
      const icon=face?.querySelector<HTMLElement>('svg,img');
      if(!selected || !face) return 0;
      const style=win.getComputedStyle(selected), faceStyle=win.getComputedStyle(face);
      return (label ? label.scrollWidth+2 : 0)+(icon?.getBoundingClientRect().width ?? 0)
        +(label && icon ? pixels(faceStyle.columnGap) : 0)+pixels(style.paddingLeft)+pixels(style.paddingRight);
    };
    const icon=pixels(win.getComputedStyle(form).getPropertyValue('--bb-slot-icon'));
    const confirm=pixels(win.getComputedStyle(form).getPropertyValue('--bb-chat-ui-fluid-control-size'));
    const effortWidth=Math.max(1,selectedWidth('Effort'));
    const status=overlay.querySelector<HTMLElement>('[data-bb-chat-ui-slot-status][role="status"]');
    let statusWidth=0;
    if(status){
      const previous=status.style.whiteSpace;
      status.style.whiteSpace='nowrap';
      const range=form.ownerDocument.createRange();
      range.selectNodeContents(status);
      const style=win.getComputedStyle(status);
      statusWidth=(range.getBoundingClientRect?.().width ?? 0)+pixels(style.paddingLeft)+pixels(style.paddingRight);
      status.style.whiteSpace=previous;
    }
    const modelWidth=Math.max(1,selectedWidth('모델')+(hasFast?24:0),statusWidth-effortWidth);
    const width=8+icon+modelWidth+effortWidth+16+confirm;
    form.style.setProperty('--bb-chat-ui-slot-model-fr',`${modelWidth}fr`);
    form.style.setProperty('--bb-chat-ui-slot-effort-fr',`${effortWidth}fr`);
    form.style.setProperty('--bb-chat-ui-slot-compact-width',`${Math.ceil(width)}px`);
  },[visible,providerIndex,modelIndex,effortIndex,state.models,efforts,hasFast,formRef]);
  return children({enabled,open:visible,close:()=>dismiss(),
    modeToggle:<Button type="button" size="sm" variant="ghost" data-bb-chat-ui-slot-mode="" aria-label="06 슬롯" aria-pressed={enabled} disabled={locked}
      aria-description={enabled?'누르면 기존 모델·Effort 방식으로 전환':'누르면 06 슬롯 방식으로 전환'} onClick={event=>{pulse(event.nativeEvent.isTrusted);dismiss();writeMode(!enabled);}}>06 슬롯<span aria-hidden="true">{enabled?'켜짐':'꺼짐'}</span></Button>,
    trigger:<Button ref={trigger} type="button" size="icon" variant="ghost" data-bb-chat-ui-slot-trigger="" aria-label="모델과 Effort 설정" aria-expanded={visible}
      disabled={locked || !picker.canOpen} onClick={event=>{
        pulse(event.nativeEvent.isTrusted);onOpen();(document.activeElement as HTMLElement | null)?.blur?.();picker.start();
        if(event.detail===0) requestAnimationFrame(()=>layer.current?.querySelector<HTMLElement>('[aria-label="모델"]')?.focus({preventScroll:true}));
      }}><SettingsGlyph/>{picker.selection?.serviceTier==='fast'?<span data-bb-chat-ui-slot-fast-badge=""><FastGlyph/></span>:null}</Button>,
    confirm:visible?<button ref={done} type="button" data-bb-chat-ui-slot-confirm="" data-handoff={picker.handoff || undefined}
      aria-label={picker.handoff?`${targetName}로 핸드오프`:'설정 완료'} aria-busy={state.applying || undefined} disabled={locked || state.loading || !state.draft.model || !!state.error}
      onClick={()=>{void picker.confirm().then(()=>trigger.current?.focus({preventScroll:true}));}}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={picker.handoff?'M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4':'M20 6 9 17l-5-5'}/></svg>
    </button>:null,
    overlay:<>
      <span data-bb-chat-ui-slot-backdrop="" data-open={visible || undefined} aria-hidden="true"/>
      <div ref={layer} role="group" aria-label="모델 슬롯" data-bb-chat-ui-slot-layer="" data-open={visible || undefined} inert={!visible || undefined} aria-hidden={!visible || undefined}>
        <div data-bb-chat-ui-slot-reels="">
          <FluidPickerWheel label="Provider" rowSize={rowSize} index={providerIndex} disabled={wheelDisabled} items={picker.providers.map(provider=>({key:provider.id,label:provider.displayName,iconOnly:true,
            icon:<ProviderIcon providerKind="agent" provider={provider} className="size-4"/>}))}
            onPick={(index,trusted)=>{pulse(trusted);picker.pickProvider(picker.providers[index]!.id);}}/>
          {state.loading?<div role="status" data-bb-chat-ui-slot-status="">모델 불러오는 중…</div>:state.error?<div role="alert" data-bb-chat-ui-slot-status="">{state.error}
            <button type="button" onClick={()=>{if(state.draft.providerId) void picker.load(state.draft.providerId,state.draft);}}>다시 불러오기</button></div>:<>
            <div data-bb-chat-ui-slot-model="" data-fast={hasFast || undefined}>
              <FluidPickerWheel label="모델" rowSize={rowSize} disabled={wheelDisabled} index={modelIndex} items={state.models.map(model=>({key:model.id,label:model.displayName || model.model}))}
                onPick={(index,trusted)=>{pulse(trusted);picker.pickModel(index);}}/>
              {hasFast?<button type="button" aria-label="Fast mode" aria-pressed={state.draft.serviceTier==='fast'} disabled={locked} data-bb-chat-ui-slot-fast="" title={state.draft.serviceTier==='fast'?'Fast mode 켜짐':'Fast mode 꺼짐'}
                onClick={event=>{pulse(event.nativeEvent.isTrusted);picker.pickTier(state.draft.serviceTier==='fast'?normalTier!.id:'fast');}}><FastGlyph/></button>:null}
            </div>
            <FluidPickerWheel label="Effort" rowSize={rowSize} disabled={wheelDisabled || !efforts.length} index={effortIndex}
              items={efforts.length?efforts.map((effort,index)=>({key:effort.reasoningEffort,label:effort.label || labels[effort.reasoningEffort] || effort.reasoningEffort,
                icon:<EffortIcon level={effort.reasoningEffort} index={index} count={efforts.length}/>})):[{key:'none',label:'설정 없음'}]}
              onPick={(index,trusted)=>{pulse(trusted);picker.pickEffort(efforts[index]!.reasoningEffort);}}/>
          </>}
        </div>
      </div>
    </>,
  });
}
