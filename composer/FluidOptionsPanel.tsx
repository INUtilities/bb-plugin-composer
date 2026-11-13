import { useCallback, useLayoutEffect, useRef } from 'react';
import type { ExperimentalComposerContributions, ExperimentalComposerMenuSelection, ExperimentalComposerPromptAction } from '@get-bb/plugin-sdk/app';
import { Button } from './components/ui/button';
import { Icon } from './components/ui/icon';
import { InlineDropdownMenuItems } from './components/ui/dropdown-menu';
import { orderedPromptActions, PROMPT_ACTION_PRESENTATION } from './src/PromptBoxActionsMenu';
import { postHaptic, readHapticBridge } from '../lib/send-haptic';
import { dropletIn, EASE } from '../lib/motion';
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
  const outgoingOpacity = useRef(new Map<Element, string>());
  // 직접 조작과 해제 때 필 전체의 순차 등장을 즉시 끝낸다.
  const stopEntering = useCallback(() => { for (const animation of entering.current) animation.cancel(); entering.current = []; }, []);
  const visible = orderedPromptActions(actions).filter(action => action.text.length > 0);
  // 옵션 퇴장까지 기존 정보 필의 위치와 비활성 상태를 유지한다.
  useLayoutEffect(() => {
    const shell = root.current?.closest('[data-promptbox-shell]') ?? root.current?.closest('form');
    const bars = Array.from(shell?.querySelectorAll<HTMLElement>('[data-bb-chat-ui-info-bar], [data-bb-chat-ui-slot-toolbar]') ?? []);
    const priorInert = bars.map(bar => bar.inert);
    shell?.setAttribute('data-bb-chat-ui-fluid-options-open', '');
    bars.forEach(bar => { bar.inert = true; });
    return () => { shell?.removeAttribute('data-bb-chat-ui-fluid-options-open'); bars.forEach((bar,index) => { bar.inert = priorInert[index]; }); };
  }, []);
  // 기존 상단 pill과 같은 등장 모션을 실제 옵션 항목에 연결한다.
  useLayoutEffect(() => {
    const panel = root.current;
    const list = panel?.querySelector<HTMLElement>('[data-bb-chat-ui-fluid-panel-list]');
    const items = Array.from(list?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (!active) {
      const motion = panel?.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
      if (!motion?.matches) fading.current = items.map((item,index) => item.animate?.(
        [{opacity:outgoingOpacity.current.get(item) || getComputedStyle(item).opacity || 1},{opacity:0}],
        {duration:200,delay:index*45,easing:EASE.exit,fill:'both'})).filter((animation):animation is Animation => !!animation);
      // 동작 줄이기는 진행 중인 퇴장도 즉시 끝낸다.
      const reduce = () => { if (motion?.matches) { for (const animation of fading.current) animation.cancel(); fading.current = []; } };
      motion?.addEventListener('change', reduce);
      return () => { for (const animation of fading.current) animation.cancel(); fading.current = []; motion?.removeEventListener('change', reduce); };
    }
    if (list) list.scrollTop = 0;
    (root.current?.querySelector<HTMLElement>(ENABLED_OPTIONS)
      ?? root.current?.closest('[data-bb-chat-ui-fluid-composer]')?.querySelector<HTMLElement>('[data-bb-chat-ui-fluid-toggle] button')
      ?? root.current)?.focus({ preventScroll: true });
    const motion = root.current?.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
    const shell = panel?.closest('[data-promptbox-shell]') ?? panel?.closest('form');
    const bars = Array.from(shell?.querySelectorAll<HTMLElement>('[data-bb-chat-ui-info-bar], [data-bb-chat-ui-slot-toolbar]') ?? []);
    const pills = bars.flatMap(bar => Array.from(bar.children).flatMap(child => child.hasAttribute('data-bb-chat-ui-slot-toolbar') ? []
      : (child as HTMLElement).style.display==='contents' ? Array.from(child.children):[child]));
    if (!motion?.matches) {
      fading.current = pills.map((pill,index) => pill.animate?.([{opacity:1},{opacity:0}], {duration:200,delay:index*45,easing:EASE.exit,fill:'both'})).filter((animation): animation is Animation => !!animation);
      const delay = pills.length ? 200 + (pills.length - 1) * 45 : 0;
      entering.current = items.map((item,index) => {
        const animation = dropletIn(item, {delay:delay+index*45});
        const effect = animation?.effect as KeyframeEffect | null;
        const opacity = Number.parseFloat(getComputedStyle(item).opacity);
        if (effect?.getKeyframes && effect.setKeyframes) effect.setKeyframes(effect.getKeyframes().map((frame,index) => ({...frame,opacity:index===0 ? 0:Number.isFinite(opacity) ? opacity:1})));
        return animation;
      }).filter((animation): animation is Animation => animation !== null);
    }
    // 동작 줄이기는 등장과 퇴장을 모두 즉시 끝낸다.
    const reduce = () => { if (motion?.matches) { stopEntering(); for (const animation of fading.current) animation.cancel(); fading.current = []; } };
    motion?.addEventListener('change', reduce);
    return () => {
      outgoingOpacity.current = new Map(items.map(item => [item,getComputedStyle(item).opacity]));
      stopEntering();
      for (const animation of fading.current) animation.cancel();
      fading.current = [];
      motion?.removeEventListener('change', reduce);
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
