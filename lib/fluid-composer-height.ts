import { EASE } from './motion.ts';

export const FLUID_COMPOSER_MORPH_MS = 320;
export const FLUID_COMPOSER_INPUT_MS = 400;
export const FLUID_COMPOSER_INPUT_EASING = 'cubic-bezier(.175,.885,.32,1.275)';
// 베지어 제어점의 최댓값으로 실제 반동보다 넉넉한 여유를 계산한다.
export const FLUID_COMPOSER_INPUT_OVERSHOOT_BOUND = .275;
export const FLUID_COMPOSER_LINE_MS = 150;
export const FLUID_EDITOR_FOLLOW_ANIMATION = 'bb-chat-ui-fluid-height-follow';

// 높이 보정을 제외한 본문의 로컬 위치를 읽고 글 스크롤의 영향을 피한다.
export function readFluidEditorPosition(editor: HTMLElement, content: HTMLElement): { x: number; y: number; offsetY: number } | null {
  const win = editor.ownerDocument.defaultView;
  if (!win) return null;
  const anchor = editor.querySelector<HTMLElement>('[data-promptbox-editor-scroll], [data-bb-chat-ui-voice-transcript], .ProseMirror') ?? editor;
  const box = anchor.getBoundingClientRect(), parent = content.getBoundingClientRect();
  const style = win.getComputedStyle(anchor), translate = win.getComputedStyle(editor).translate?.split(/\s+/);
  const offset = Number.parseFloat(translate?.[1] ?? '') || 0;
  return { x: box.left + (Number.parseFloat(style.paddingLeft) || 0) - parent.left,
    y: box.top + (Number.parseFloat(style.paddingTop) || 0) - parent.top - offset, offsetY: offset };
}

// 큰 펼침은 탄성으로, 줄 변화와 접힘은 빠르게 잇고 빈 초안은 즉시 복귀한다.
export function bindFluidComposerHeight(viewport: HTMLElement, content: HTMLElement, getEditor?: () => HTMLElement | null): () => void {
  const win = viewport.ownerDocument.defaultView;
  if (!win?.ResizeObserver) return () => {};
  const previousHeight = viewport.style.height;
  const previousTransition = viewport.style.transition;
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false;
  let ready = false;
  let height = content.offsetHeight;
  let moving = getEditor?.() ?? null;
  let position = moving ? readFluidEditorPosition(moving, content) : null;
  let inputView = viewport.getAttribute('data-bb-chat-ui-fluid-view') !== 'options' && !viewport.hasAttribute('data-voice-mode');
  let multiline = viewport.getAttribute('data-multiline') === 'true';
  let duration = inputView ? FLUID_COMPOSER_INPUT_MS : FLUID_COMPOSER_MORPH_MS;
  let easing = inputView ? FLUID_COMPOSER_INPUT_EASING : EASE.out;
  let editorMotion: Animation | null = null;
  // 높이·반지름·곡선의 전환 시간을 한 번에 설정한다.
  const updateMotion = () => {
    if (motion.matches) { editorMotion?.cancel(); editorMotion = null; }
    viewport.style.transition = ready && !motion.matches && !(inputView && viewport.getAttribute('data-bb-chat-ui-fluid-reset') === 'true')
      ? ['height', 'border-radius', 'corner-shape'].map(property => `${property} ${duration}ms ${easing}`).join(', ')
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
    const nextMoving = getEditor?.() ?? null;
    const nextPosition = nextMoving ? readFluidEditorPosition(nextMoving, content) : null;
    const nextInputView = viewport.getAttribute('data-bb-chat-ui-fluid-view') !== 'options' && !viewport.hasAttribute('data-voice-mode');
    const nextMultiline = viewport.getAttribute('data-multiline') === 'true';
    const reset = nextInputView && viewport.getAttribute('data-bb-chat-ui-fluid-reset') === 'true';
    if (next === height && !reset) { moving = nextMoving; position = nextPosition; inputView = nextInputView; multiline = nextMultiline; return; }
    const inputChange = inputView && nextInputView;
    const quickInput = inputChange && (next < height || (multiline && nextMultiline));
    duration = reset ? 0 : quickInput ? FLUID_COMPOSER_LINE_MS
      : inputChange ? FLUID_COMPOSER_INPUT_MS : FLUID_COMPOSER_MORPH_MS;
    easing = quickInput ? 'ease-out' : inputChange ? FLUID_COMPOSER_INPUT_EASING : EASE.out;
    if (inputChange && !quickInput && !reset) {
      const cap = win.getComputedStyle(content).maxHeight;
      const limit = Number.parseFloat(cap);
      const visible = viewport.getBoundingClientRect().height;
      const from = Number.isFinite(visible) ? visible : height;
      if (cap !== 'none' && (!Number.isFinite(limit) || next + Math.max(0, next - from) * FLUID_COMPOSER_INPUT_OVERSHOOT_BOUND > limit)) easing = EASE.out;
    }
    const follow = ready && !motion.matches && duration > 0 && inputView && nextInputView && nextMoving === moving && nextPosition;
    const delta = follow && nextPosition ? next - height + (position?.y ?? nextPosition.y) - nextPosition.y + nextPosition.offsetY : 0;
    editorMotion?.cancel(); editorMotion = null;
    moving = nextMoving; position = nextPosition; inputView = nextInputView; multiline = nextMultiline;
    height = next;
    updateMotion();
    viewport.style.height = `${height}px`;
    if (moving?.animate && Number.isFinite(delta) && Math.abs(delta) > .5) {
      editorMotion = moving.animate([{ translate: `0px ${delta}px` }, { translate: '0px 0px' }], { duration, easing });
      editorMotion.id = FLUID_EDITOR_FOLLOW_ANIMATION;
    }
  });
  observer.observe(content, { box: 'border-box' });
  motion.addEventListener('change', updateMotion);
  return () => {
    disposed = true;
    editorMotion?.cancel(); editorMotion = null;
    observer.disconnect();
    win.cancelAnimationFrame(frame);
    motion.removeEventListener('change', updateMotion);
    viewport.style.height = previousHeight;
    viewport.style.transition = previousTransition;
  };
}
