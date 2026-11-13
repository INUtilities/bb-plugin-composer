import { traceComposerInput, traceComposerAnimation } from './composer-input-trace.ts';
import { EASE } from './motion.ts';

export const FLUID_COMPOSER_MORPH_MS = 320;
export const FLUID_COMPOSER_SLOT_MS = 260;
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

// 큰 펼침은 탄성으로, 접힘은 빠르게 잇고 호스트 초기화는 즉시 반영한다.
export function bindFluidComposerHeight(viewport: HTMLElement, content: HTMLElement, getEditor?: () => HTMLElement | null): (() => void) & { sync(): void } {
  const win = viewport.ownerDocument.defaultView;
  if (!win?.ResizeObserver) return Object.assign(() => {}, { sync() {} });
  const previousHeight = viewport.style.height;
  const previousTransition = viewport.style.transition;
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false;
  let ready = false;
  let height = content.offsetHeight;
  let moving = getEditor?.() ?? null;
  let position = moving ? readFluidEditorPosition(moving, content) : null;
  let slotOpen = !!viewport.closest('[data-bb-chat-ui-slot-open]');
  let slotClosing = false;
  const form = viewport.closest<HTMLElement>('[data-bb-chat-ui-fluid-composer]');
  let inputView = viewport.getAttribute('data-bb-chat-ui-fluid-view') !== 'options' && !viewport.hasAttribute('data-voice-mode') && !slotOpen;
  let multiline = viewport.getAttribute('data-multiline') === 'true';
  let duration = slotOpen ? FLUID_COMPOSER_SLOT_MS : inputView ? FLUID_COMPOSER_INPUT_MS : FLUID_COMPOSER_MORPH_MS;
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
  traceComposerInput(viewport,'raf.schedule');
  const frame = win.requestAnimationFrame(() => {
    traceComposerInput(viewport,'raf.run');
    if (disposed) return;
    ready = true;
    updateMotion();
  });
  // 같은 commit의 배치 변경과 ResizeObserver가 하나의 높이 상태를 공유한다.
  const measure = (next: number) => {
    traceComposerInput(viewport,'height.measure');
    if (disposed || !Number.isFinite(next) || next < 0) return;
    const nextMoving = getEditor?.() ?? null;
    const nextPosition = nextMoving ? readFluidEditorPosition(nextMoving, content) : null;
    const nextSlotOpen = !!viewport.closest('[data-bb-chat-ui-slot-open]');
    const nextInputView = viewport.getAttribute('data-bb-chat-ui-fluid-view') !== 'options' && !viewport.hasAttribute('data-voice-mode') && !nextSlotOpen;
    const nextMultiline = viewport.getAttribute('data-multiline') === 'true';
    const reset = nextInputView && viewport.getAttribute('data-bb-chat-ui-fluid-reset') === 'true';
    if (slotOpen && !nextSlotOpen) slotClosing = true;
    // 닫힐 때 폭이 복원되는 중의 임시 줄바꿈도 슬롯 진입 전 높이를 바꾸지 않는다.
    if (slotClosing && (reset || !form?.getAnimations?.().some(animation =>
      'transitionProperty' in animation && animation.transitionProperty === 'width' && animation.playState === 'running'))) slotClosing = false;
    if (nextSlotOpen || slotClosing) next = height;
    if (next === height && !reset) { moving = nextMoving; position = nextPosition; inputView = nextInputView; multiline = nextMultiline; slotOpen = nextSlotOpen; return; }
    const inputChange = inputView && nextInputView;
    const quickInput = inputChange && (next < height || (multiline && nextMultiline));
    duration = reset ? 0 : slotOpen || nextSlotOpen ? FLUID_COMPOSER_SLOT_MS : quickInput ? FLUID_COMPOSER_LINE_MS
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
    moving = nextMoving; position = nextPosition; inputView = nextInputView; multiline = nextMultiline; slotOpen = nextSlotOpen;
    height = next;
    updateMotion();
    viewport.style.height = `${height}px`;
    if (moving?.animate && Number.isFinite(delta) && Math.abs(delta) > .5) {
      editorMotion = moving.animate([{ translate: `0px ${delta}px` }, { translate: '0px 0px' }], { duration, easing });
      editorMotion.id = FLUID_EDITOR_FOLLOW_ANIMATION;
      traceComposerAnimation(viewport,editorMotion,'height-follow');
    }
  };
  const observer = new win.ResizeObserver(entries => {
    traceComposerInput(viewport,'ResizeObserver.height');
    const entry = entries.find(entry => entry.target === content);
    if (entry) measure(entry.borderBoxSize?.[0]?.blockSize ?? content.offsetHeight);
  });
  observer.observe(content, { box: 'border-box' });
  const finishSlotWidth = (event: TransitionEvent) => {
    if (event.target === form && event.propertyName === 'width' && slotClosing) measure(content.offsetHeight);
  };
  // 닫히는 중 새 입력이 오면 입력에 따른 높이 반영을 기다리지 않게 한다.
  const resumeInputHeight = () => { slotClosing = false; slotOpen = !!viewport.closest('[data-bb-chat-ui-slot-open]'); };
  form?.addEventListener('transitionend', finishSlotWidth);
  form?.addEventListener('transitioncancel', finishSlotWidth);
  content.addEventListener('beforeinput', resumeInputHeight, true);
  motion.addEventListener('change', updateMotion);
  return Object.assign(() => {
    disposed = true;
    editorMotion?.cancel(); editorMotion = null;
    observer.disconnect();
    form?.removeEventListener('transitionend', finishSlotWidth);
    form?.removeEventListener('transitioncancel', finishSlotWidth);
    content.removeEventListener('beforeinput', resumeInputHeight, true);
    win.cancelAnimationFrame(frame);
    motion.removeEventListener('change', updateMotion);
    viewport.style.height = previousHeight;
    viewport.style.transition = previousTransition;
  }, { sync: () => measure(content.offsetHeight) });
}
