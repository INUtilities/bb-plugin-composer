/** 내부 스크롤은 유지하고 입력·메뉴의 경계에서 채팅으로 이어지는 스크롤을 막는다. */
export function bindComposerScrollBoundary(element: HTMLElement, onScroll?: () => void): () => void {
  const win = element.ownerDocument.defaultView;
  if (!win) return () => {};
  // 실제 이동이 있는 축에서만 내부 스크롤 여유를 읽는다.
  const canScroll = (event: Event, dx: number, dy: number) => {
    for (let node = event.target instanceof win.Element ? event.target : null; node; node = node.parentElement) {
      const css = win.getComputedStyle(node);
      const available = (overflow: string, delta: number, position: number, size: number, total: number) =>
        /auto|scroll|overlay/.test(overflow) && (delta < 0 ? position > 0 : delta > 0 && position + size < total - 1);
      if ((dy !== 0 && available(css.overflowY || css.overflow, dy, node.scrollTop, node.clientHeight, node.scrollHeight))
        || (dx !== 0 && available(css.overflowX || css.overflow, dx, node.scrollLeft, node.clientWidth, node.scrollWidth))) return true;
      if (node === element) break;
    }
    return false;
  };
  const wheel = (event: WheelEvent) => {
    if (event.ctrlKey) return;
    onScroll?.(); event.stopPropagation();
    if (!event.defaultPrevented && !canScroll(event, event.deltaX, event.deltaY)) event.preventDefault();
  };
  let touch: { x: number; y: number } | null = null;
  const start = (event: TouchEvent) => {
    touch = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
    if (touch) event.stopPropagation();
  };
  const move = (event: TouchEvent) => {
    if (!touch || event.touches.length !== 1) { touch = null; return; }
    const next = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    onScroll?.(); event.stopPropagation();
    if (!event.defaultPrevented && !canScroll(event, touch.x - next.x, touch.y - next.y)) event.preventDefault();
    touch = next;
  };
  const end = () => { touch = null; };
  element.addEventListener('wheel', wheel, { passive: false });
  element.addEventListener('touchstart', start, { passive: true });
  element.addEventListener('touchmove', move, { passive: false });
  element.addEventListener('touchend', end); element.addEventListener('touchcancel', end);
  return () => {
    element.removeEventListener('wheel', wheel); element.removeEventListener('touchstart', start);
    element.removeEventListener('touchmove', move); element.removeEventListener('touchend', end); element.removeEventListener('touchcancel', end);
  };
}
