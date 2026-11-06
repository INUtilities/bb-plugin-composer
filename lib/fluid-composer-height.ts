import { EASE } from './motion.ts';

export const FLUID_COMPOSER_MORPH_MS = 320;
export const FLUID_COMPOSER_INPUT_MS = 320;
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

// 자연 높이와 모서리를 같은 속도로 전환하고 입력 중에는 감속 곡선을 쓴다.
export function bindFluidComposerHeight(viewport: HTMLElement, content: HTMLElement, getEditor?: () => HTMLElement | null): () => void {
  const win = viewport.ownerDocument.defaultView;
  if (!win?.ResizeObserver) return () => {};
  const previousHeight = viewport.style.height;
  const previousTransition = viewport.style.transition;
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false;
  let ready = false;
  let height = content.offsetHeight;
  let duration = FLUID_COMPOSER_INPUT_MS;
  let moving = getEditor?.() ?? null;
  let position = moving ? readFluidEditorPosition(moving, content) : null;
  let inputView = viewport.getAttribute('data-bb-chat-ui-fluid-view') !== 'options';
  let editorMotion: Animation | null = null;
  // 높이·반지름·곡선의 전환 시간을 한 번에 설정한다.
  const updateMotion = () => {
    if (motion.matches) { editorMotion?.cancel(); editorMotion = null; }
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
    const nextMoving = getEditor?.() ?? null;
    const nextPosition = nextMoving ? readFluidEditorPosition(nextMoving, content) : null;
    const nextInputView = viewport.getAttribute('data-bb-chat-ui-fluid-view') !== 'options';
    if (next === height) { moving = nextMoving; position = nextPosition; inputView = nextInputView; return; }
    const follow = ready && !motion.matches && inputView && nextInputView && nextMoving === moving && nextPosition;
    const delta = follow && nextPosition ? next - height + (position?.y ?? nextPosition.y) - nextPosition.y + nextPosition.offsetY : 0;
    editorMotion?.cancel(); editorMotion = null;
    moving = nextMoving; position = nextPosition; inputView = nextInputView;
    duration = viewport.getAttribute('data-bb-chat-ui-fluid-view') === 'options' ? FLUID_COMPOSER_MORPH_MS : FLUID_COMPOSER_INPUT_MS;
    height = next;
    updateMotion();
    viewport.style.height = `${height}px`;
    if (moving?.animate && Number.isFinite(delta) && Math.abs(delta) > .5) {
      editorMotion = moving.animate([{ translate: `0px ${delta}px` }, { translate: '0px 0px' }], { duration, easing: EASE.out });
      editorMotion.id = FLUID_EDITOR_FOLLOW_ANIMATION;
    }
  });
  observer.observe(content, { box: 'border-box' });
  motion.addEventListener('change', updateMotion);
  return () => {
    disposed = true;
    observer.disconnect();
    editorMotion?.cancel(); editorMotion = null;
    win.cancelAnimationFrame(frame);
    motion.removeEventListener('change', updateMotion);
    viewport.style.height = previousHeight;
    viewport.style.transition = previousTransition;
  };
}
