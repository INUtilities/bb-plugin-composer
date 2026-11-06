import { useCallback, useLayoutEffect, useRef } from 'react';
import type { ExperimentalComposerContributions, ExperimentalComposerMenuSelection, ExperimentalComposerPromptAction } from '@get-bb/plugin-sdk/app';
import { Button } from './components/ui/button';
import { Icon } from './components/ui/icon';
import { InlineDropdownMenuItems } from './components/ui/dropdown-menu';
import { orderedPromptActions, PROMPT_ACTION_PRESENTATION } from './src/PromptBoxActionsMenu';
import { postHaptic, readHapticBridge } from '../lib/send-haptic';
import { EASE } from '../lib/motion';
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
function pulse(): void {
  if (document.documentElement.getAttribute('data-bb-chat-ui-root-device') === 'phone') postHaptic(readHapticBridge(window), 'selection');
}

/** 입력과 다른 모드로 같은 면에 배치하고 플러그인 항목의 공개 host renderer 소유권을 유지한다. */
export function FluidOptionsPanel({ active = true, actions = [], plugins, onAttach, onAction, onClose, onPluginSelected }: FluidOptionsPanelProps) {
  const root = useRef<HTMLDivElement>(null);
  const entering = useRef<Animation[]>([]);
  const stopEntering = useCallback(() => { for (const animation of entering.current) animation.cancel(); entering.current = []; }, []);
  const visible = orderedPromptActions(actions).filter(action => action.text.length > 0);
  useLayoutEffect(() => {
    if (!active) return;
    const list = root.current?.querySelector<HTMLElement>('[data-bb-chat-ui-fluid-panel-list]');
    if (list) list.scrollTop = 0;
    (root.current?.querySelector<HTMLElement>(ENABLED_OPTIONS)
      ?? root.current?.closest('[data-bb-chat-ui-fluid-composer]')?.querySelector<HTMLElement>('[data-bb-chat-ui-fluid-toggle] button')
      ?? root.current)?.focus({ preventScroll: true });
    const motion = root.current?.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!motion?.matches) {
      const animation = list?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: EASE.out });
      if (animation) entering.current.push(animation);
    }
    const reduce = () => { if (motion?.matches) stopEntering(); };
    motion?.addEventListener('change', reduce);
    return () => { stopEntering(); motion?.removeEventListener('change', reduce); };
  }, [active, stopEntering]);

  useLayoutEffect(() => {
    if (active && root.current) return bindComposerScrollBoundary(root.current, stopEntering);
  }, [active, stopEntering]);

  const selectedPlugin = (selection: ExperimentalComposerMenuSelection) => {
    pulse(); onPluginSelected(selection);
  };

  return <div ref={root} data-bb-chat-ui-fluid-panel="" role="region" aria-label="컴포저 옵션" tabIndex={-1}
    onPointerDown={stopEntering}
    onKeyDown={event => {
      stopEntering();
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return; }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const buttons = Array.from(root.current?.querySelectorAll<HTMLElement>(ENABLED_OPTIONS) ?? []);
      if (!buttons.length) return;
      const index = buttons.indexOf(document.activeElement as HTMLElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : index < 0 ? (event.key === 'ArrowDown' ? 0 : buttons.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      event.preventDefault(); event.stopPropagation(); buttons[next].focus();
    }}>
    <InlineDropdownMenuItems>
      <div data-bb-chat-ui-fluid-panel-list="" role="menu" aria-label="추가 옵션">
        {onAttach ? <Button type="button" variant="ghost" role="menuitem" data-bb-chat-ui-fluid-option="" onClick={() => { pulse(); onAttach(); }}><Icon name="Paperclip" className="size-4"/>Attach files</Button> : null}
        {visible.map(action => <Button key={action.kind} type="button" variant="ghost" role="menuitem" data-bb-chat-ui-fluid-option="" onClick={() => { pulse(); onAction(action); }}><Icon name={PROMPT_ACTION_PRESENTATION[action.kind].icon} className="size-4"/>{PROMPT_ACTION_PRESENTATION[action.kind].label}</Button>)}
        {plugins.plusMenuItems.map(contribution => <plugins.MenuEntry key={contribution.key} kind="plus" contribution={contribution} onSelected={selectedPlugin}/>)}
        {!onAttach && !visible.length && !plugins.plusMenuItems.length ? <p role="status">사용할 수 있는 옵션이 없습니다.</p> : null}
      </div>
    </InlineDropdownMenuItems>
  </div>;
}
