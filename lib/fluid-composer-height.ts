import { EASE } from './motion.ts';

export const FLUID_COMPOSER_MORPH_MS = 320;
export const FLUID_COMPOSER_INPUT_MS = 120;

// 자연 높이와 모서리를 같은 속도로 전환하고 입력 중에는 빠른 감속 곡선을 쓴다.
export function bindFluidComposerHeight(viewport: HTMLElement, content: HTMLElement): () => void {
  const win = viewport.ownerDocument.defaultView;
  if (!win?.ResizeObserver) return () => {};
  const previousHeight = viewport.style.height;
  const previousTransition = viewport.style.transition;
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false;
  let ready = false;
  let height = content.offsetHeight;
  let duration = FLUID_COMPOSER_INPUT_MS;
  // 높이·반지름·곡선의 전환 시간을 한 번에 설정한다.
  const updateMotion = () => {
    viewport.style.transition = ready && !motion.matches
      ? ['height', 'border-radius', 'corner-shape'].map(property => `${property} ${duration}ms ${EASE.out}`).join(', ')
      : 'none';
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
    duration = viewport.getAttribute('data-bb-chat-ui-fluid-view') === 'options' ? FLUID_COMPOSER_MORPH_MS : FLUID_COMPOSER_INPUT_MS;
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
