import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './components/ui/button';
import { Icon } from './components/ui/icon';
import { postHaptic, readHapticBridge } from '../lib/send-haptic';

/** 기존 정보 줄과 설정을 같은 컴포저 안에서 열며 host DOM은 옮기지 않는다. */
export function FluidComposerDetails({ controls, onOpen, suspended = false }: { controls: ReactNode; onOpen(): void; suspended?: boolean }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    if (!open || suspended) return;
    const shell = button.current?.closest('[data-promptbox-shell]');
    if (!shell) return;
    const mark = 'data-bb-chat-ui-fluid-details-open', previous = shell.getAttribute(mark);
    shell.setAttribute(mark, '');
    const owner = button.current?.closest('[data-follow-up-composer]');
    const view = shell.ownerDocument.defaultView;
    // 접힌 host는 footer를 unmount한다. control-gesture guard가 끝난 뒤 기존
    // focus 경로로 한 번 펼치고 즉시 버튼에 돌려 phone 키보드를 열지 않는다.
    const timer = owner && !owner.hasAttribute('data-follow-up-composer-expanded') ? view?.setTimeout(() => {
      const editor = owner.querySelector<HTMLElement>('[contenteditable="true"]');
      if (!editor || editor.closest('[hidden], [inert]')) return;
      editor.focus({ preventScroll: true });
      editor.blur();
      button.current?.focus({ preventScroll: true });
    }, 0) : undefined;
    return () => {
      if (timer !== undefined) view?.clearTimeout(timer);
      if (previous === null) shell.removeAttribute(mark);
      else shell.setAttribute(mark, previous);
    };
  }, [open, suspended]);
  const close = () => { setOpen(false); button.current?.focus({ preventScroll: true }); };
  return <>
    <Button ref={button} hidden={suspended} type="button" size="icon" variant="ghost" data-bb-chat-ui-fluid-details-toggle=""
      aria-label="정보와 설정" aria-expanded={open && !suspended} aria-controls={id}
      onClick={event => {
        if (event.nativeEvent.isTrusted && document.documentElement.getAttribute('data-bb-chat-ui-root-device') === 'phone') {
          postHaptic(readHapticBridge(window), 'impact-light');
        }
        if (!open) onOpen();
        setOpen(value => !value);
      }}
      onKeyDown={event => { if (open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }}>
      <span data-bb-chat-ui-fluid-details-face="" aria-hidden="true"/>
      <Icon name="SlidersHorizontal" className="relative size-4" />
    </Button>
    <div id={id} role="region" aria-label="컴포저 정보와 설정" data-bb-chat-ui-fluid-details=""
      hidden={!open || suspended} inert={!open || suspended || undefined} aria-hidden={!open || suspended || undefined}
      onKeyDown={event => {
        if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); close(); }
      }}>
      <div data-bb-chat-ui-fluid-native-controls="">{controls}</div>
    </div>
  </>;
}
