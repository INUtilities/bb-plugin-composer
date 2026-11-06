import { EASE } from './motion.ts';

export const FLUID_COMPOSER_MORPH_MS = 320;
export const FLUID_COMPOSER_INPUT_MS = 320;
const FLUID_COMPOSER_LINE_MS = 120;

// 줄 높이는 짧게 잇고 큰 배치 전환과 빈 초안의 접힘은 기존 곡선을 유지한다.
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
  let inputView = viewport.getAttribute('data-bb-chat-ui-fluid-view') !== 'options' && !viewport.hasAttribute('data-voice-mode');
  let multiline = viewport.getAttribute('data-multiline') === 'true';
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
    if (!Number.isFinite(next) || next < 0) return;
    const nextInputView = viewport.getAttribute('data-bb-chat-ui-fluid-view') !== 'options' && !viewport.hasAttribute('data-voice-mode');
    const nextMultiline = viewport.getAttribute('data-multiline') === 'true';
    const reset = nextInputView && viewport.getAttribute('data-bb-chat-ui-fluid-reset') === 'true';
    if (next === height && !reset) { inputView = nextInputView; multiline = nextMultiline; return; }
    duration = reset ? FLUID_COMPOSER_INPUT_MS : inputView && nextInputView && (next > height || multiline && nextMultiline) ? FLUID_COMPOSER_LINE_MS
      : nextInputView ? FLUID_COMPOSER_INPUT_MS : FLUID_COMPOSER_MORPH_MS;
    inputView = nextInputView; multiline = nextMultiline;
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
