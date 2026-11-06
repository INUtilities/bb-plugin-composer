import { EASE } from './motion.ts';

export const FLUID_COMPOSER_MORPH_MS = 320;

/** 자연 높이가 바뀔 때만 관찰한다. 입력·포커스마다 DOM을 다시 검색하지 않는다. */
export function bindFluidComposerHeight(viewport: HTMLElement, content: HTMLElement): () => void {
  const win = viewport.ownerDocument.defaultView;
  if (!win?.ResizeObserver) return () => {};
  const previousHeight = viewport.style.height;
  const previousTransition = viewport.style.transition;
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false;
  let ready = false;
  let height = content.offsetHeight;
  let easing: string = EASE.out;
  const updateMotion = () => {
    viewport.style.transition = ready && !motion.matches ? `height ${FLUID_COMPOSER_MORPH_MS}ms ${easing}` : 'none';
  };
  viewport.style.height = `${height}px`;
  updateMotion();
  const frame = win.requestAnimationFrame(() => {
    if (disposed) return;
    ready = true;
    updateMotion();
  });
  const observer = new win.ResizeObserver(entries => {
    if (disposed) return;
    const entry = entries.find(entry => entry.target === content);
    if (!entry) return;
    const next = entry.borderBoxSize?.[0]?.blockSize ?? content.offsetHeight;
    if (!Number.isFinite(next) || next < 0 || next === height) return;
    easing = next > height && viewport.getAttribute('data-bb-chat-ui-fluid-view') !== 'options' ? EASE.droplet : EASE.out;
    height = next;
    updateMotion();
    viewport.style.height = `${height}px`;
  });
  observer.observe(content, { box: 'border-box' });
  motion.addEventListener('change', updateMotion);
  return () => {
    disposed = true;
    observer.disconnect();
    win.cancelAnimationFrame(frame);
    motion.removeEventListener('change', updateMotion);
    viewport.style.height = previousHeight;
    viewport.style.transition = previousTransition;
  };
}
