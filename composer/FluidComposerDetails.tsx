import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './components/ui/button';
import { postHaptic, readHapticBridge } from '../lib/send-haptic';

// 상단 i 필로 기존 메타데이터 카드를 열고 입력과 기본 정보 필을 유지한다.
export function FluidComposerDetails({ onOpen, scopeKey, suspended = false, children }: { onOpen(): void; scopeKey: string; suspended?: boolean; children(toggle: ReactNode, details: ReactNode): ReactNode }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  // 대화 변경은 정보만 닫고 같은 입력 배치와 editor를 유지한다.
  useLayoutEffect(() => { setOpen(false); }, [scopeKey]);
  useLayoutEffect(() => {
    if (!open || suspended) return;
    const shell = button.current?.closest('[data-promptbox-shell]');
    if (!shell) return;
    const mark = 'data-bb-chat-ui-fluid-details-open', previous = shell.getAttribute(mark);
    shell.setAttribute(mark, '');
    const owner = button.current?.closest('[data-follow-up-composer]') ?? shell.querySelector('[data-follow-up-composer]');
    const view = shell.ownerDocument.defaultView;
    // 카드 밖 누르기와 Escape는 메타데이터만 닫는다.
    const dismiss = (event: Event) => {
      const target = event.target as Element;
      if (event instanceof KeyboardEvent) {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        setOpen(false); button.current?.focus({preventScroll:true});
      } else if (!button.current?.contains(target) && !target.closest('[data-follow-up-composer-footer], [data-new-thread-footer], [data-bb-chat-ui-voice-record]')) setOpen(false);
    };
    shell.ownerDocument.addEventListener('pointerdown', dismiss);
    shell.ownerDocument.addEventListener('keydown', dismiss);
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
      shell.ownerDocument.removeEventListener('pointerdown', dismiss);
      shell.ownerDocument.removeEventListener('keydown', dismiss);
      if (timer !== undefined) view?.clearTimeout(timer);
      if (previous === null) shell.removeAttribute(mark);
      else shell.setAttribute(mark, previous);
    };
  }, [open, suspended]);
  // 정보를 닫고 같은 버튼으로 키보드 포커스를 돌린다.
  const close = () => { setOpen(false); button.current?.focus({ preventScroll: true }); };
  return children(
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
      <svg data-icon-root="" data-bb-chat-ui-fluid-settings-icon="" className="relative" style={{ width: 16, height: 16 }}
        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" pointerEvents="none">
        <circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>
      </svg>
    </Button>,
    <div id={id} role="region" aria-label="컴포저 정보와 설정" data-bb-chat-ui-fluid-details=""
      hidden={!open || suspended} inert={!open || suspended || undefined} aria-hidden={!open || suspended || undefined}
      onKeyDown={event => {
        if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); close(); }
      }}>
    </div>
  );
}
