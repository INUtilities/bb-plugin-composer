import { useCallback, useLayoutEffect, useRef } from 'react';
import type { ExperimentalComposerContributions, ExperimentalComposerMenuSelection, ExperimentalComposerPromptAction } from '@get-bb/plugin-sdk/app';
import { Button } from './components/ui/button';
import { Icon } from './components/ui/icon';
import { InlineDropdownMenuItems } from './components/ui/dropdown-menu';
import { orderedPromptActions, PROMPT_ACTION_PRESENTATION } from './src/PromptBoxActionsMenu';
import { postHaptic, readHapticBridge } from '../lib/send-haptic';
import { dropletIn, EASE } from '../lib/motion';
import { fluidOptionPills, fluidOptionStaggerDuration } from '../lib/fluid-options-motion';
import { bindComposerScrollBoundary } from '../lib/composer-scroll-boundary';

export interface FluidOptionsPanelProps {
  active?: boolean;
  actions?: readonly ExperimentalComposerPromptAction[];
  plugins: Pick<ExperimentalComposerContributions, 'plusMenuItems' | 'MenuEntry'>;
  onAttach?: () => void;
  onAction(action: ExperimentalComposerPromptAction): void;
  onClose(): void;
  onPluginSelected(selection: ExperimentalComposerMenuSelection): void;
}

const ENABLED_OPTIONS = '[role="menuitem"]:not(:disabled):not([data-disabled])';
// phone 옵션의 실제 선택에 기존 selection 햅틱을 전달한다.
function pulse(): void {
  if (document.documentElement.getAttribute('data-bb-chat-ui-root-device') === 'phone') postHaptic(readHapticBridge(window), 'selection');
}

// 입력창 위의 옵션 필을 그리고 플러그인 항목은 공개 host renderer에 맡긴다.
export function FluidOptionsPanel({ active = true, actions = [], plugins, onAttach, onAction, onClose, onPluginSelected }: FluidOptionsPanelProps) {
  const root = useRef<HTMLDivElement>(null);
  const entering = useRef<Animation[]>([]);
  const fading = useRef<Animation[]>([]);
  const restingOpacity = useRef(new Map<Element, number>());
  const outgoing = useRef(new Map<Element, {opacity:number;transform:string}>());
  const restoreInteraction = useRef<() => void>(() => {});
  // 직접 조작과 해제 때 필 전체의 순차 등장을 즉시 끝낸다.
  const stopEntering = useCallback(() => { for (const animation of entering.current) animation.cancel(); entering.current = []; }, []);
  const visible = orderedPromptActions(actions).filter(action => action.text.length > 0);
  // 시각 상태의 수명과 클릭 차단의 수명을 분리해 빌리기 전 상호작용을 복구한다.
  useLayoutEffect(() => {
    if (!root.current) return;
    const {shell,bars,pills}=fluidOptionPills(root.current);
    for (const pill of pills) {
      const opacity=Number.parseFloat(getComputedStyle(pill).opacity);
      restingOpacity.current.set(pill,Number.isFinite(opacity)?opacity:1);
    }
    const priorInert = bars.map(bar => bar.inert);
    restoreInteraction.current = () => { bars.forEach((bar,index) => { bar.inert = priorInert[index]; }); };
    shell?.setAttribute('data-bb-chat-ui-fluid-options-open', '');
    bars.forEach(bar => { bar.inert = true; });
    return () => {
      shell?.removeAttribute('data-bb-chat-ui-fluid-options-open');
      shell?.removeAttribute('data-bb-chat-ui-fluid-options-returning');
      restoreInteraction.current(); restoreInteraction.current = () => {};
    };
  }, []);
  // 양쪽 필을 퇴장 → 순차 등장으로 연결하고 재전환은 현재 보이는 상태에서 시작한다.
  useLayoutEffect(() => {
    const panel = root.current;
    if (!panel) return;
    const list=panel.querySelector<HTMLElement>('[data-bb-chat-ui-fluid-panel-list]');
    const items=Array.from(list?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const {shell,bars,pills}=fluidOptionPills(panel);
    for (const item of items) if (!restingOpacity.current.has(item)) {
      const opacity=Number.parseFloat(getComputedStyle(item).opacity);
      restingOpacity.current.set(item,Number.isFinite(opacity)?opacity:1);
    }
    const motion=panel.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
    // 옵션 퇴장 뒤 원래 필이 보이기 시작하면 마지막 탄성 모션을 기다리지 않고 누를 수 있다.
    const restore=()=>{
      restoreInteraction.current();
      shell?.setAttribute('data-bb-chat-ui-fluid-options-returning','');
    };
    let returnTimer: ReturnType<typeof setTimeout> | undefined;
    if (active) {
      shell?.removeAttribute('data-bb-chat-ui-fluid-options-returning');
      bars.forEach(bar=>{bar.inert=true;});
      if (list) { list.scrollTop=0; list.scrollLeft=0; }
      (panel.querySelector<HTMLElement>(ENABLED_OPTIONS)
        ?? panel.closest('[data-bb-chat-ui-fluid-composer]')?.querySelector<HTMLElement>('[data-bb-chat-ui-fluid-toggle] button')
        ?? panel).focus({preventScroll:true});
    } else if (motion?.matches) restore();
    else returnTimer=setTimeout(restore,fluidOptionStaggerDuration(items.length,200));
    if (!motion?.matches) {
      const leaving=active?pills:items, arriving=active?items:pills;
      fading.current=leaving.map((item,index)=>{
        const snapshot=outgoing.current.get(item);
        const opacity=snapshot?.opacity ?? restingOpacity.current.get(item) ?? 1;
        const transform=snapshot?.transform ?? 'none';
        return item.animate?.([{opacity,transform},{opacity:0,transform}],{duration:200,delay:index*45,easing:EASE.exit,fill:'both'});
      }).filter((animation):animation is Animation=>!!animation);
      const delay=fluidOptionStaggerDuration(leaving.length,200);
      const arrivals=arriving.map((item,index)=>{
        const animation=dropletIn(item,{delay:delay+index*45});
        const effect=animation?.effect as KeyframeEffect | null;
        const snapshot=outgoing.current.get(item), opacity=restingOpacity.current.get(item) ?? 1;
        if (effect?.getKeyframes && effect.setKeyframes) effect.setKeyframes(effect.getKeyframes().map((frame,index)=>({
          ...frame,opacity:index===0 ? snapshot?.opacity ?? 0:opacity,
          ...(index===0 && snapshot && snapshot.opacity>0 ? {transform:snapshot.transform}:{}),
        })));
        // 원래 행의 CSS 숨김을 유지하므로 마지막 필의 복귀까지 최종 프레임을 보관한다.
        if (!active) effect?.updateTiming?.({fill:'both'});
        return animation;
      }).filter((animation):animation is Animation=>!!animation);
      if (active) entering.current=arrivals;
      else fading.current.push(...arrivals);
    }
    // 동작 줄이기는 모든 모션을 끝내며 닫힘의 수명 정리는 Body가 함께 처리한다.
    const reduce=()=>{if (motion?.matches) {clearTimeout(returnTimer);if(!active)restore();stopEntering();for (const animation of fading.current) animation.cancel();fading.current=[];}};
    motion?.addEventListener('change',reduce);
    return ()=>{
      clearTimeout(returnTimer);
      outgoing.current=new Map([...items,...pills].map(item=>{
        const style=getComputedStyle(item),opacity=Number.parseFloat(style.opacity);
        return [item,{opacity:Number.isFinite(opacity)?opacity:1,transform:style.transform || 'none'}];
      }));
      stopEntering();for (const animation of fading.current) animation.cancel();fading.current=[];
      motion?.removeEventListener('change',reduce);
    };
  }, [active, stopEntering]);

  useLayoutEffect(() => {
    if (active && root.current) return bindComposerScrollBoundary(root.current, stopEntering);
  }, [active, stopEntering]);

  // 플러그인 선택의 포커스 소유권을 호스트에 전달한다.
  const selectedPlugin = (selection: ExperimentalComposerMenuSelection) => {
    pulse(); onPluginSelected(selection);
  };

  return <div ref={root} data-bb-chat-ui-fluid-panel="" role="region" aria-label="컴포저 옵션" tabIndex={-1}
    onPointerDown={stopEntering}
    onKeyDown={event => {
      stopEntering();
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return; }
      if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const buttons = Array.from(root.current?.querySelectorAll<HTMLElement>(ENABLED_OPTIONS) ?? []);
      if (!buttons.length) return;
      const index = buttons.indexOf(document.activeElement as HTMLElement);
      const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight';
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : index < 0 ? (forward ? 0 : buttons.length - 1) : (index + (forward ? 1 : -1) + buttons.length) % buttons.length;
      event.preventDefault(); event.stopPropagation(); buttons[next].focus();
    }}>
    <InlineDropdownMenuItems>
      <div data-bb-chat-ui-fluid-panel-list="" role="menu" aria-label="추가 옵션" aria-orientation="horizontal">
        {onAttach ? <Button type="button" variant="ghost" role="menuitem" data-bb-chat-ui-fluid-option="" onClick={() => { pulse(); onAttach(); }}><Icon name="Paperclip" className="size-4"/>Attach files</Button> : null}
        {visible.map(action => <Button key={action.kind} type="button" variant="ghost" role="menuitem" data-bb-chat-ui-fluid-option="" onClick={() => { pulse(); onAction(action); }}><Icon name={PROMPT_ACTION_PRESENTATION[action.kind].icon} className="size-4"/>{PROMPT_ACTION_PRESENTATION[action.kind].label}</Button>)}
        {plugins.plusMenuItems.map(contribution => <plugins.MenuEntry key={contribution.key} kind="plus" contribution={contribution} onSelected={selectedPlugin}/>)}
        {!onAttach && !visible.length && !plugins.plusMenuItems.length ? <p role="status">사용할 수 있는 옵션이 없습니다.</p> : null}
      </div>
    </InlineDropdownMenuItems>
  </div>;
}
