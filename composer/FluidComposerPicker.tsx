import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { experimental_ProviderIcon as ProviderIcon } from '@get-bb/plugin-sdk/app';
import { createPortal } from 'react-dom';
import { Button } from './components/ui/button';
import { EffortIcon } from './EffortIcon';
import { FluidPickerWheel } from './FluidPickerWheel';
import { useFluidPicker } from './useFluidPicker';
import { useDeviceChrome } from '../lib/use-device';
import { postHaptic, readHapticBridge } from '../lib/send-haptic';
import { bindComposerScrollBoundary } from '../lib/composer-scroll-boundary';
import { FLUID_COMPOSER_INPUT_MS } from '../lib/fluid-composer-height';
import { EASE } from '../lib/motion';

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
  const currentKey=useRef(state.key); currentKey.current=state.key;
  const trigger=useRef<HTMLButtonElement>(null), done=useRef<HTMLButtonElement>(null), layer=useRef<HTMLDivElement>(null);
  const shellState=useRef<{element:Element;previous:string | null} | null>(null);
  const [backdropHost,setBackdropHost]=useState<HTMLElement | null>(null);
  const visible=enabled && state.open && !disabled;
  const rowSize=device==='phone'?44:40;
  const locked=disabled || state.applying, wheelDisabled=locked || !visible;
  // 채팅 하단에 블러 한 겹을 연결해 컴포저 축소와 창 너비 변경을 그대로 따른다.
  useEffect(()=>{setBackdropHost(formRef.current?.closest<HTMLElement>('[data-scroll-footer]') ?? null);},[formRef,state.key]);
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
    const sizes=['--bb-chat-ui-slot-compact-width','--bb-chat-ui-slot-model-fr','--bb-chat-ui-slot-effort-fr','--bb-slot-fast-peek-width'];
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
  // 확장된 전송 메뉴에서 원형 확인 버튼으로 폭만 줄이고 취소 때 모션을 정리한다.
  useLayoutEffect(()=>{
    const button=done.current, form=formRef.current, win=form?.ownerDocument.defaultView;
    if(!visible || !button || !form || !win) return;
    const media=win.matchMedia('(prefers-reduced-motion: reduce)');
    if(media.matches) return;
    const width=Number.parseFloat(win.getComputedStyle(form).getPropertyValue('--bb-chat-ui-fluid-control-size'));
    const from=form.querySelector('[data-promptbox-submit-group]')?.getBoundingClientRect().width ?? width;
    if(!Number.isFinite(width) || from<=width) return;
    const animation=button.animate?.([{width:from+'px'},{width:width+'px'}],{duration:FLUID_COMPOSER_INPUT_MS,easing:EASE.out});
    // 모션 줄이기를 켜면 진행 중 폭 전환을 즉시 끝낸다.
    const reduce=()=>{if(media.matches) animation?.cancel();};
    media.addEventListener('change',reduce);
    return ()=>{animation?.cancel();media.removeEventListener('change',reduce);};
  },[visible,formRef]);
  // 같은 작성창의 채팅 여백과 정보 필을 전환하며 최초 상태는 한 번만 보관한다.
  const syncShell=()=>{
    const shell=formRef.current?.closest('[data-promptbox-shell]');
    if(!shell) return;
    if(!shellState.current) shellState.current={element:shell,previous:shell.getAttribute('data-bb-chat-ui-slot-picker-open')};
    shell.setAttribute('data-bb-chat-ui-slot-picker-open',String(visible));
  };
  // 열고 닫는 상태 변경은 그리기 전에 반영하되 전환 도중 표식을 제거하지 않는다.
  useLayoutEffect(syncShell,[visible,formRef]);
  // 부모 form의 ref 연결 뒤 최초 닫힘을 반영하고 StrictMode 재연결에도 원래 값을 복구한다.
  useEffect(()=>{
    syncShell();
    return ()=>{
      const saved=shellState.current;
      if(!saved) return;
      if(saved.previous===null) saved.element.removeAttribute('data-bb-chat-ui-slot-picker-open');
      else saved.element.setAttribute('data-bb-chat-ui-slot-picker-open',saved.previous);
    };
  },[formRef]);
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
  const providerIndex=Math.max(0,picker.providers.findIndex(item=>item.id===state.draft.providerId));
  const modelIndex=Math.max(0,state.models.findIndex(item=>item.model===state.draft.model));
  const efforts=picker.model?.supportedReasoningEfforts ?? [];
  const effortIndex=Math.max(0,efforts.findIndex(item=>item.reasoningEffort===state.draft.reasoningLevel));
  const normalTier=picker.tiers.find(item=>item.id!=='fast'), hasFast=picker.tiers.some(item=>item.id==='fast') && !!normalTier;
  const fastTooltipId=useId();
  const [fastPeek,setFastPeek]=useState(false);
  const fastTimer=useRef<ReturnType<typeof setTimeout> | null>(null);
  // 클릭·키보드 활성화·터치로 바꾼 Fast 상태를 잠시 표시하고 연속 입력은 시간을 갱신한다.
  const previewFast=()=>{
    if(!visible || locked) return;
    if(fastTimer.current!==null) clearTimeout(fastTimer.current);
    setFastPeek(true);
    fastTimer.current=setTimeout(()=>{setFastPeek(false);fastTimer.current=null;},1500);
  };
  // 슬롯·대상·잠금이 바뀌거나 해제되면 이전 상태 문구와 예약을 정리한다.
  useEffect(()=>{
    setFastPeek(false);
    return ()=>{if(fastTimer.current!==null) clearTimeout(fastTimer.current);fastTimer.current=null;};
  },[visible,state.key,state.draft.providerId,state.draft.model,state.loading,locked]);
  // 잠깐 펼치는 Fast 글자만 측정해 휠 폭을 다시 읽지 않고 오른쪽 공간을 확보한다.
  useLayoutEffect(()=>{
    const form=formRef.current;
    const label=visible && fastPeek && hasFast ? layer.current?.querySelector<HTMLElement>('[data-bb-chat-ui-slot-fast-label]') : null;
    const width=label ? label.scrollWidth+6 : 0;
    form?.style.setProperty('--bb-slot-fast-peek-width',width+'px');
  },[visible,fastPeek,hasFast,state.draft.serviceTier,device,formRef]);
  const targetName=picker.providers.find(item=>item.id===state.draft.providerId)?.displayName ?? state.draft.providerId ?? '';
  // 현재 선택한 세 슬롯과 확인 버튼에 필요한 폭만 계산해 열린 컴포저를 줄인다.
  useLayoutEffect(()=>{
    const form=formRef.current, overlay=layer.current, win=form?.ownerDocument.defaultView;
    if(!visible || !form || !overlay || !win) return;
    const wheels=Array.from(overlay.querySelectorAll<HTMLElement>('[data-bb-chat-ui-slot-wheel]'));
    // 계산된 CSS 길이를 픽셀 수로 읽는다.
    const pixels=(value:string)=>Number.parseFloat(value)||0;
    // 각 슬롯에서 현재 선택한 항목의 글자·아이콘·여백을 합한다.
    const selectedWidth=(name:string)=>{
      const wheel=wheels.find(item=>item.getAttribute('aria-label')===name);
      return Math.max(0,...Array.from(wheel?.querySelectorAll<HTMLElement>('[data-bb-chat-ui-slot-item]') ?? []).map(selected=>{
      const face=selected?.querySelector<HTMLElement>('[data-bb-chat-ui-slot-item-face]');
      const label=face?.querySelector<HTMLElement>('span');
      const icon=face?.querySelector<HTMLElement>('svg,img');
      if(!face) return 0;
      const style=win.getComputedStyle(selected);
      return (label ? label.scrollWidth+2 : 0)+(icon?.getBoundingClientRect().width ?? 0)
        +(label && icon ? pixels(win.getComputedStyle(face).columnGap) : 0)+pixels(style.paddingLeft)+pixels(style.paddingRight)+12;
      }));
    };
    const formStyle=win.getComputedStyle(form);
    const icon=pixels(formStyle.getPropertyValue('--bb-slot-icon'));
    const confirm=pixels(formStyle.getPropertyValue('--bb-chat-ui-fluid-control-size'));
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
    const modelWidth=Math.max(1,selectedWidth('모델'),statusWidth-effortWidth);
    const compactMinimum=device==='phone'?288:320;
    const width=Math.max(compactMinimum,8+icon+modelWidth+effortWidth+(hasFast?confirm:0)+16+confirm);
    form.style.setProperty('--bb-chat-ui-slot-model-fr',`${modelWidth}fr`);
    form.style.setProperty('--bb-chat-ui-slot-effort-fr',`${effortWidth}fr`);
    form.style.setProperty('--bb-chat-ui-slot-compact-width',`${Math.ceil(width)}px`);
  },[visible,providerIndex,modelIndex,effortIndex,state.models,efforts,hasFast,formRef]);
  const backdrop=<span data-bb-chat-ui-slot-backdrop="" data-full-width={backdropHost ? '' : undefined} data-open={visible || undefined} aria-hidden="true"/>;
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
      onClick={()=>{const key=state.key;void picker.confirm().then(applied=>{if(applied && currentKey.current===key)trigger.current?.focus({preventScroll:true});});}}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={picker.handoff?'M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4':'M20 6 9 17l-5-5'}/></svg>
    </button>:null,
    overlay:<div data-bb-chat-ui-slot-overlay="">
      {backdropHost ? createPortal(backdrop,backdropHost) : backdrop}
      <div ref={layer} role="group" aria-label="모델 슬롯" data-bb-chat-ui-slot-layer="" data-open={visible || undefined} inert={!visible || undefined} aria-hidden={!visible || undefined}>
        <div data-bb-chat-ui-slot-reels="" data-fast={hasFast || undefined}>
          <FluidPickerWheel label="Provider" rowSize={rowSize} index={providerIndex} disabled={wheelDisabled} items={picker.providers.map(provider=>({key:provider.id,label:provider.displayName,iconOnly:true,
            icon:<ProviderIcon providerKind="agent" provider={provider} className="size-4"/>}))}
            onPick={(index,trusted)=>{pulse(trusted);picker.pickProvider(picker.providers[index]!.id);}}/>
          {state.loading?<div role="status" data-bb-chat-ui-slot-status="">모델 불러오는 중…</div>:state.error?<div role="alert" data-bb-chat-ui-slot-status="">{state.error}
            <button type="button" onClick={()=>{if(state.draft.providerId) void picker.load(state.draft.providerId,state.draft);}}>다시 불러오기</button></div>:<>
            <div data-bb-chat-ui-slot-model="">
              <FluidPickerWheel label="모델" rowSize={rowSize} disabled={wheelDisabled} index={modelIndex} items={state.models.map(model=>({key:model.id,label:model.displayName || model.model}))}
                onPick={(index,trusted)=>{pulse(trusted);picker.pickModel(index);}}/>
            </div>
            <FluidPickerWheel label="Effort" rowSize={rowSize} disabled={wheelDisabled || !efforts.length} index={effortIndex}
              items={efforts.length?efforts.map((effort,index)=>({key:effort.reasoningEffort,label:effort.label || labels[effort.reasoningEffort] || effort.reasoningEffort,
                icon:<EffortIcon level={effort.reasoningEffort} index={index} count={efforts.length}/>})):[{key:'none',label:'설정 없음'}]}
              onPick={(index,trusted)=>{pulse(trusted);picker.pickEffort(efforts[index]!.reasoningEffort);}}/>
            {hasFast?<button type="button" aria-label="Fast mode" aria-describedby={fastTooltipId} aria-pressed={state.draft.serviceTier==='fast'} disabled={wheelDisabled} data-bb-chat-ui-slot-fast="" data-peek={fastPeek || undefined}
              onClick={event=>{pulse(event.nativeEvent.isTrusted);picker.pickTier(state.draft.serviceTier==='fast'?normalTier!.id:'fast');previewFast();}}>
              <FastGlyph/><span data-bb-chat-ui-slot-fast-label="" aria-hidden="true">Fast {state.draft.serviceTier==='fast'?'On':'Off'}</span>
              <span id={fastTooltipId} role="tooltip" data-bb-chat-ui-slot-fast-tooltip="">Fast {state.draft.serviceTier==='fast'?'On':'Off'}</span>
            </button>:null}
          </>}
        </div>
      </div>
    </div>,
  });
}
