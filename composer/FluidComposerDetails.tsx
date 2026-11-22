import { useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Button } from './components/ui/button';
import { postHaptic, readHapticBridge } from '../lib/send-haptic';
import { bindComposerScrollBoundary } from '../lib/composer-scroll-boundary';
import { animateFluidPillSwap, bindFluidPillRow, FIXED_JUMP, FLUID_DETAILS_TOGGLE, FLUID_FOOTER, fluidDetailPills,
  fluidOptionPills, fluidPillExitDuration, fluidPillReturnDuration, readFluidPillFrames } from '../lib/fluid-options-motion';

const DETAILS='data-bb-chat-ui-fluid-details';
const RESTING='data-bb-chat-ui-fluid-details-resting';
const NATIVE_POPUP='[data-radix-popper-content-wrapper], [role="dialog"], [role="menu"], [role="listbox"]';
const EXPANDED_TRIGGER='[aria-haspopup][aria-expanded="true"], [aria-haspopup][data-state="open"]';

type DetailsRow = { transition(open:boolean):void; dispose():void };

// 같은 컴포저의 기존 footer를 표시하고 각 메타정보에 옵션 전환을 적용한다.
function bindDetailsRow(composer:HTMLElement, id:string, onDispose:()=>void) {
  const shell=composer.closest('[data-promptbox-shell]') ?? composer;
  const document=shell.ownerDocument, view=document.defaultView;
  const motion=view?.matchMedia('(prefers-reduced-motion: reduce)');
  const owner=composer.closest('[data-follow-up-composer]') ?? shell.querySelector('[data-follow-up-composer]');
  const resting=new Map<Element,number>();
  const priorInert=new Map<HTMLElement,string|null>();
  let footer:HTMLElement|null=null;
  let releaseFooter=()=>{};
  let returning:ReturnType<typeof setTimeout>|undefined, closing:ReturnType<typeof setTimeout>|undefined;
  let arrivals:Animation[]=[], exits:Animation[]=[];
  let open=false;

  // 원래 필의 상호작용을 복구하며 돌아오는 애니메이션은 계속 재생한다.
  function restoreInteraction() {
    for (const [pill,inert] of priorInert) {
      if (inert===null) pill.removeAttribute('inert');
      else pill.setAttribute('inert',inert);
    }
  }

  // 현재 메타정보의 등장 동작만 끝내고 클릭과 가로 스크롤을 받는다.
  function stopArriving() {
    for (const animation of arrivals) animation.cancel();
    arrivals=[];
  }

  // 예약과 재생 중인 애니메이션을 종료한다.
  function stopMotion() {
    clearTimeout(returning);
    clearTimeout(closing);
    stopArriving();
    for (const animation of exits) animation.cancel();
    exits=[];
  }

  // 원래 DOM과 접근성 속성을 그대로 돌려 준다.
  function dispose() {
    stopMotion();
    restoreInteraction();
    for (const pill of priorInert.keys()) pill.removeAttribute(RESTING);
    priorInert.clear();
    releaseFooter();
    shell.removeAttribute('data-bb-chat-ui-fluid-details-open');
    observer.disconnect();
    motion?.removeEventListener('change',reduce);
    if (requestFooter!==undefined) view?.clearTimeout(requestFooter);
    onDispose();
  }

  // 두 행의 현재 프레임에서 출발하고 닫힌 메타정보는 즉시 키보드 대상에서 뺀다.
  function play(active:boolean) {
    if (!footer) { if (!active) dispose(); return; }
    const base=fluidOptionPills(composer).pills.filter(pill=>
      !pill.matches(`${FLUID_DETAILS_TOGGLE}, ${FIXED_JUMP}`) && !pill.querySelector(FLUID_DETAILS_TOGGLE));
    const items=fluidDetailPills(footer);
    const leaving=active ? base : items, arriving=active ? items : base;
    const frames=readFluidPillFrames([...leaving,...arriving]);
    const previous=new Map(frames);
    // 처음 나타나는 필은 0에서 시작하며 중간 전환은 현재 모양을 이어 쓴다.
    if (active) for (const item of arriving) {
      if (!(arrivals.length || exits.length) || !resting.has(item)) previous.delete(item);
    }
    stopMotion();
    for (const [pill,frame] of frames) if (!resting.has(pill)) resting.set(pill,frame.opacity);
    footer.toggleAttribute('inert',!active);
    if (active) {
      for (const pill of base) {
        if (!priorInert.has(pill)) priorInert.set(pill,pill.getAttribute('inert'));
        pill.setAttribute('inert','');
        pill.setAttribute(RESTING,'');
      }
      footer.scrollLeft=footer.hasAttribute('data-bb-chat-ui-fluid-details-before') ? footer.scrollWidth : 0;
    }
    if (motion?.matches || typeof footer.animate!=='function') {
      if (!active) dispose();
      return;
    }
    ({exits,arrivals}=animateFluidPillSwap(leaving,arriving,resting,previous,!active));
    if (!active) {
      returning=setTimeout(restoreInteraction,fluidPillExitDuration(items.length));
      closing=setTimeout(dispose,fluidPillReturnDuration(items.length,base.length));
    }
  }

  // 늦게 나타나거나 교체된 BB footer를 연결하고 네이티브 부모와 이벤트를 보존한다.
  function syncFooter() {
    const next=(owner ?? shell).querySelector<HTMLElement>(FLUID_FOOTER);
    if (next===footer) return;
    releaseFooter();
    releaseFooter=()=>{};
    footer=next;
    if (!next) return;
    const attributes=new Map(['id','role','aria-label','inert'].map(name=>[name,next.getAttribute(name)]));
    next.setAttribute(DETAILS,'');
    next.id=id;
    next.setAttribute('role','region');
    next.setAttribute('aria-label','컴포저 정보와 설정');
    const stopLayout=bindFluidPillRow(next,composer,'details');
    const stopScroll=bindComposerScrollBoundary(next,stopArriving);
    next.addEventListener('pointerdown',stopArriving);
    releaseFooter=()=>{
      stopLayout();
      stopScroll();
      next.removeEventListener('pointerdown',stopArriving);
      next.removeAttribute(DETAILS);
      for (const [name,value] of attributes) {
        if (value===null) next.removeAttribute(name);
        else next.setAttribute(name,value);
      }
    };
    play(open);
  }

  // 동작 줄이기 설정을 켜면 현재 행을 즉시 표시한다.
  function reduce() {
    if (motion?.matches) play(open);
  }

  // 자신이 속한 컴포저에서 footer가 추가되거나 교체된 경우만 확인한다.
  const observer=new MutationObserver(records=>{
    if (records.some(record=>[...record.addedNodes,...record.removedNodes].some(node=>
      node instanceof Element && (node.matches(FLUID_FOOTER) || node.querySelector(FLUID_FOOTER))))) syncFooter();
  });
  observer.observe(owner ?? shell,{childList:true,subtree:true});
  motion?.addEventListener('change',reduce);
  shell.setAttribute('data-bb-chat-ui-fluid-details-open','');

  // 접힌 후속 입력은 기존 editor 진입 경로로 footer를 마운트한 뒤 포커스를 돌린다.
  const requestFooter=owner && !owner.hasAttribute('data-follow-up-composer-expanded') ? view?.setTimeout(()=>{
    const editor=owner.querySelector<HTMLElement>('[contenteditable="true"]');
    if (!open || !editor || editor.closest('[hidden], [inert]')) return;
    editor.focus({preventScroll:true});
    editor.blur();
    shell.querySelector<HTMLElement>(FLUID_DETAILS_TOGGLE)?.focus({preventScroll:true});
  },0) : undefined;

  return {
    // 현재 행을 유지한 채 열림과 닫힘을 이어 준다.
    transition(active:boolean) {
      open=active;
      if (active && !footer) syncFooter();
      else play(active);
    },
    dispose,
  };
}

// i 버튼 옆에 BB가 제공한 메타정보 컨트롤을 펼친다.
export function FluidComposerDetails({ formRef, open, onOpen, onClose, scopeKey, suspended=false, discard=false, children }: {
  formRef:RefObject<HTMLFormElement|null>;
  open:boolean;
  onOpen():void;
  onClose():void;
  scopeKey:string;
  suspended?:boolean;
  discard?:boolean;
  children(toggle:ReactNode):ReactNode;
}) {
  const button=useRef<HTMLButtonElement>(null);
  const binding=useRef<DetailsRow|null>(null);
  const id=useId();
  const interrupted=suspended || discard;
  const isInterrupted=useRef(interrupted);
  isInterrupted.current=interrupted;
  const active=open && !interrupted;

  // 화면이 바뀌거나 해제되면 이전 컴포저의 메타정보와 스타일을 돌려 준다.
  useLayoutEffect(()=>()=>binding.current?.dispose(),[scopeKey]);

  // 새 패널이 원래 필의 모양을 읽기 전에 이전 패널을 해제한다.
  useLayoutEffect(()=>()=>{
    if (isInterrupted.current) binding.current?.dispose();
  },[interrupted]);

  // 옵션과 슬롯으로 넘어갈 때 메타정보가 원래 행을 계속 가리지 않도록 정리한다.
  useLayoutEffect(()=>{
    if (interrupted) return;
    if (active && !binding.current && formRef.current && button.current) {
      binding.current=bindDetailsRow(formRef.current,id,()=>{binding.current=null;});
    }
    binding.current?.transition(active);
  },[active,interrupted,scopeKey,formRef,id]);

  // BB의 기존 선택 팝업과 메타정보에는 클릭을 전달하고 바깥에서 행을 닫는다.
  useLayoutEffect(()=>{
    const composer=formRef.current;
    if (!active || !composer) return;
    const document=composer.ownerDocument;
    // 네이티브 선택 팝업은 footer 외부에 렌더링될 수 있다.
    function isNativePopup(target:Element) {
      const footer=document.getElementById(id);
      const trigger=target.closest(EXPANDED_TRIGGER);
      return !!footer && ((!!trigger && footer.contains(trigger))
        || (!!footer.querySelector(EXPANDED_TRIGGER) && !!target.closest(NATIVE_POPUP)));
    }
    // 행 바깥에서 눌렀을 때 기존 클릭을 계속 전달한다.
    function dismissPointer(event:PointerEvent) {
      const target=event.target;
      if (!(target instanceof Element) || button.current?.contains(target)
        || document.getElementById(id)?.contains(target) || target.closest('[data-bb-chat-ui-voice-record]')
        || isNativePopup(target)) return;
      onClose();
    }
    // 메타정보를 키보드로 닫고 i 버튼으로 포커스를 돌린다.
    function dismissKey(event:KeyboardEvent) {
      if (event.key!=='Escape' || event.defaultPrevented || (event.target instanceof Element && isNativePopup(event.target))) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
      button.current?.focus({preventScroll:true});
    }
    document.addEventListener('pointerdown',dismissPointer);
    document.addEventListener('keydown',dismissKey,true);
    return ()=>{
      document.removeEventListener('pointerdown',dismissPointer);
      document.removeEventListener('keydown',dismissKey,true);
    };
  },[active,formRef,id,onClose]);

  return children(
    <Button ref={button} hidden={suspended} type="button" size="icon" variant="ghost" data-bb-chat-ui-fluid-details-toggle=""
      aria-label="정보와 설정" aria-expanded={active} aria-controls={id}
      onClick={event => {
        if (event.nativeEvent.isTrusted && document.documentElement.getAttribute('data-bb-chat-ui-root-device') === 'phone') {
          postHaptic(readHapticBridge(window), 'impact-light');
        }
        if (active) onClose();
        else onOpen();
      }}>
      <svg data-icon-root="" data-bb-chat-ui-fluid-settings-icon="" className="relative" style={{ width: 16, height: 16 }}
        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" pointerEvents="none">
        <circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>
      </svg>
    </Button>,
  );
}
