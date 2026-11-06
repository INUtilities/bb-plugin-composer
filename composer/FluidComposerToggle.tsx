import { useLayoutEffect, useRef, type PointerEvent } from 'react';
import { pressPop } from '../lib/motion';
import { Button } from './components/ui/button';

/** pill의 눌림은 frost 면에만 적용하고 기호와 터치 영역은 고정한다. */
export function FluidComposerToggle({ open, disabled = false, onClick }: { open: boolean; disabled?: boolean; onClick(): void }) {
  const face = useRef<HTMLSpanElement>(null);
  const press = useRef<ReturnType<typeof pressPop> | null>(null);
  const held = useRef<number | null>(null);
  const cancel = useRef(() => {});
  useLayoutEffect(() => {
    const element = face.current;
    if (!element) return;
    press.current = pressPop(element);
    cancel.current = () => { held.current = null; for (const animation of element.getAnimations?.() ?? []) animation.cancel(); };
    const motion = element.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
    const reduce = () => { if (motion?.matches) cancel.current(); };
    motion?.addEventListener('change', reduce);
    return () => { cancel.current(); press.current = null; motion?.removeEventListener('change', reduce); };
  }, []);
  useLayoutEffect(() => { if (disabled) cancel.current(); }, [disabled]);
  const cancelPointer = (event: PointerEvent) => { if (held.current === event.pointerId) cancel.current(); };
  return <Button type="button" size="icon" variant="ghost" aria-label="Prompt actions" aria-expanded={open}
    aria-description={open ? '옵션 닫기' : '옵션 열기'} disabled={disabled} onClick={onClick}
    onPointerDown={event => {
      if (disabled || event.isPrimary === false || event.button > 0 || held.current !== null) return;
      held.current = event.pointerId; press.current?.down();
    }}
    onPointerUp={event => { if (held.current === event.pointerId) { held.current = null; press.current?.up(); } }}
    onPointerCancel={cancelPointer} onPointerLeave={cancelPointer} onLostPointerCapture={cancelPointer}
    onBlur={() => { if (held.current !== null) cancel.current(); }}>
    <span ref={face} data-bb-chat-ui-fluid-toggle-face="" aria-hidden="true"/>
    <span data-bb-chat-ui-fluid-toggle-glyph="" aria-hidden="true"/>
  </Button>;
}
