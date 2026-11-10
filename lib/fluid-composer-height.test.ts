import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { bindFluidComposerHeight, FLUID_COMPOSER_INPUT_EASING } from './fluid-composer-height.ts';
import { EASE } from './motion.ts';

// 자연 높이와 실제 표시 높이를 분리해 진행 중인 전환도 재현한다.
function fixture(withEditor = false) {
  const dom = new JSDOM('<div id="viewport"><div id="content"><div id="moving"><div class="ProseMirror"></div></div></div></div>', { pretendToBeVisual: true });
  const win = dom.window;
  const viewport = win.document.getElementById('viewport')!;
  const content = win.document.getElementById('content')!;
  content.style.maxHeight = 'none';
  const moving = win.document.getElementById('moving')!;
  let naturalHeight = 52;
  let visibleHeight = 52, editorInset = 12, editorOffset = 0;
  const animations: { frames: Keyframe[]; options: KeyframeAnimationOptions; cancelled: boolean; id: string }[] = [];
  viewport.getBoundingClientRect = () => ({ height: visibleHeight } as DOMRect);
  content.getBoundingClientRect = () => ({ top: 0, left: 0 } as DOMRect);
  moving.querySelector<HTMLElement>('.ProseMirror')!.getBoundingClientRect = () => ({ top: editorInset + editorOffset, left: 0 } as DOMRect);
  moving.animate = (frames, options) => {
    const record = { frames: frames as Keyframe[], options: options as KeyframeAnimationOptions, cancelled: false, id: '' };
    animations.push(record);
    return { get id() { return record.id; }, set id(value) { record.id = value; }, cancel() { record.cancelled = true; } } as Animation;
  };
  Object.defineProperty(content, 'offsetHeight', { get: () => naturalHeight });
  let deliver: ResizeObserverCallback;
  let disconnected = false;
  let reduced = false;
  const listeners = new Set<() => void>();
  Object.assign(win, {
    ResizeObserver: class {
      constructor(callback: ResizeObserverCallback) { deliver = callback; }
      observe(target: Element) { assert.equal(target, content); }
      disconnect() { disconnected = true; }
    },
    matchMedia: () => ({
      get matches() { return reduced; },
      addEventListener(_type: string, listener: () => void) { listeners.add(listener); },
      removeEventListener(_type: string, listener: () => void) { listeners.delete(listener); },
    }),
  });
  const stop = bindFluidComposerHeight(viewport, content, withEditor ? () => moving : undefined);
  return {
    viewport, content, dom, stop, animations,
    visible(height: number) { visibleHeight = height; },
    inset(value: number) { editorInset = value; },
    offset(value: number) { editorOffset = value; moving.style.translate = `0px ${value}px`; },
    get disconnected() { return disconnected; },
    get listeners() { return listeners.size; },
    resize(height: number) {
      naturalHeight = height;
      deliver!([{ target: content, borderBoxSize: [{ blockSize: height }] } as unknown as ResizeObserverEntry], {} as ResizeObserver);
    },
    reduce(value: boolean) { reduced = value; for (const listener of listeners) listener(); },
  };
}

test('fluid composer starts at its natural single-line height without an entrance resize', () => {
  const f = fixture();
  try {
    assert.equal(f.viewport.style.height, '52px');
    assert.equal(f.viewport.style.transition, 'none');
  } finally { f.stop(); f.dom.window.close(); }
});

test('every height change carries the editor with the visible box, including retargeting and padding changes', async () => {
  const f = fixture(true);
  try {
    await new Promise(resolve => f.dom.window.requestAnimationFrame(resolve));
    f.resize(100);
    assert.deepEqual(f.animations.at(-1)?.frames, [{ translate: '0px 48px' }, { translate: '0px 0px' }]);
    assert.equal(f.animations.at(-1)?.options.duration, 400);
    assert.equal(f.animations.at(-1)?.options.easing, FLUID_COMPOSER_INPUT_EASING);
    f.visible(80); f.offset(20); f.resize(124);
    assert.equal(f.animations[0].cancelled, true);
    assert.deepEqual(f.animations.at(-1)?.frames[0], { translate: '0px 44px' });
    f.visible(110); f.offset(14); f.inset(20); f.resize(148);
    assert.deepEqual(f.animations.at(-1)?.frames[0], { translate: '0px 30px' });
    f.visible(148); f.offset(0); f.inset(12); f.resize(100);
    assert.deepEqual(f.animations.at(-1)?.frames[0], { translate: '0px -40px' });
    const count = f.animations.length;
    f.reduce(true); f.resize(172);
    assert.equal(f.animations.at(-1)?.cancelled, true);
    assert.equal(f.animations.length, count);
    assert.equal(f.viewport.style.transition, 'none');
    f.reduce(false); f.visible(160); f.resize(196); f.stop();
    assert.equal(f.animations.at(-1)?.cancelled, true);
  } finally { f.stop(); f.dom.window.close(); }
});

test('fluid composer follows wrapping, newlines, deletion and rapid retargeting', async () => {
  const f = fixture();
  try {
    await new Promise(resolve => f.dom.window.requestAnimationFrame(resolve));
    for (const [height, duration] of [[76, 400], [100, 400], [124, 400], [76, 150], [52, 150]]) {
      f.resize(height);
      assert.equal(f.viewport.style.height, `${height}px`);
      assert.match(f.viewport.style.transition, new RegExp(`height ${duration}ms`));
    }
    f.resize(52);
    assert.equal(f.viewport.style.height, '52px');
  } finally { f.stop(); f.dom.window.close(); }
});

// 여러 줄 입력은 짧게 이어 주고 배치·옵션·음성의 기존 전환을 유지하는지 확인한다.
test('expanded input briefly follows subsequent line heights while layout and option changes retain motion', async () => {
  const f = fixture(true);
  try {
    await new Promise(resolve => f.dom.window.requestAnimationFrame(resolve));
    f.viewport.setAttribute('data-multiline', 'true'); f.resize(100);
    assert.match(f.viewport.style.transition, /height 400ms/);
    const count = f.animations.length;
    for (const [index,height] of [124, 148, 100].entries()) {
      f.resize(height);
      assert.equal(f.viewport.style.height, `${height}px`);
      assert.equal(f.viewport.style.transition, ['height', 'border-radius', 'corner-shape'].map(property => `${property} 150ms ease-out`).join(', '));
      assert.equal(f.animations.length, count+index+1);
      assert.equal(f.animations.at(-1)?.options.duration,150);
      assert.equal(f.animations.at(-1)?.options.easing,'ease-out');
    }
    assert.equal(f.animations[0].cancelled, true);
    f.viewport.setAttribute('data-bb-chat-ui-fluid-view', 'options'); f.resize(212);
    assert.match(f.viewport.style.transition, /height 320ms/);
    f.viewport.setAttribute('data-bb-chat-ui-fluid-view', 'input'); f.resize(100);
    assert.match(f.viewport.style.transition, /height 320ms/);
    f.viewport.setAttribute('data-voice-mode', 'true'); f.resize(140);
    assert.match(f.viewport.style.transition, /height 320ms/);
    f.resize(172);
    assert.match(f.viewport.style.transition, /height 320ms/);
    f.viewport.removeAttribute('data-voice-mode'); f.resize(100);
    assert.match(f.viewport.style.transition, /height 320ms/);
    f.viewport.setAttribute('data-multiline', 'false'); f.resize(52);
    assert.match(f.viewport.style.transition, /height 150ms ease-out/);
  } finally { f.stop(); f.dom.window.close(); }
});

// 여러 줄 입력에서 슬롯을 여닫을 때 입력 전환보다 설정 전환의 속도를 적용한다.
test('slot opening and closing use the settings morph for a multiline draft', async () => {
  const f = fixture();
  try {
    await new Promise(resolve => f.dom.window.requestAnimationFrame(resolve));
    f.viewport.setAttribute('data-multiline', 'true'); f.resize(140);
    f.dom.window.document.body.setAttribute('data-bb-chat-ui-slot-open', '');
    f.resize(52);
    assert.match(f.viewport.style.transition, /height 320ms/);
    assert.equal(f.viewport.style.height, '52px');
    f.dom.window.document.body.removeAttribute('data-bb-chat-ui-slot-open');
    f.resize(140);
    assert.match(f.viewport.style.transition, /height 320ms/);
    assert.equal(f.viewport.style.height, '140px');
  } finally { f.stop(); f.dom.window.close(); }
});

// 상한에 가까운 큰 펼침과 읽을 수 없는 상한에서는 반동을 빼고 목표 높이를 유지한다.
test('input expansion near the height cap uses the same bounded curve for the box and editor', async () => {
  for (const cap of ['280px', 'calc(100% - 1px)']) {
    const f = fixture(true);
    try {
      await new Promise(resolve => f.dom.window.requestAnimationFrame(resolve));
      f.content.style.maxHeight = cap;
      f.resize(270);
      assert.match(f.viewport.style.transition, /height 400ms cubic-bezier\(\.22,1,\.36,1\)/);
      assert.equal(f.animations.at(-1)?.options.easing, EASE.out);
      assert.equal(f.viewport.style.height, '270px');
    } finally { f.stop(); f.dom.window.close(); }
  }
});

// 도중에 목표가 바뀌어도 이전 목표 대신 실제 표시 높이로 상한 여유를 확인한다.
test('retargeted expansion checks the cap from the current visible height', async () => {
  const f = fixture(true);
  try {
    await new Promise(resolve => f.dom.window.requestAnimationFrame(resolve));
    f.content.style.maxHeight = '310px';
    f.resize(280); f.visible(52); f.resize(300);
    assert.match(f.viewport.style.transition, /height 400ms cubic-bezier\(\.22,1,\.36,1\)/);
    assert.equal(f.animations.at(-1)?.options.easing, EASE.out);
  } finally { f.stop(); f.dom.window.close(); }
});

// 긴 초안을 짧은 한 줄로 줄일 때 실제 clip과 글자가 목표 아래로 튀지 않게 한다.
test('large nonempty deletion uses a monotonic shrink for both the clip and the editor', async () => {
  const f = fixture(true);
  try {
    await new Promise(resolve => f.dom.window.requestAnimationFrame(resolve));
    f.viewport.setAttribute('data-multiline', 'true'); f.resize(300);
    assert.equal(f.animations.at(-1)?.options.easing, FLUID_COMPOSER_INPUT_EASING);
    f.visible(300); f.viewport.setAttribute('data-multiline', 'false'); f.resize(52);
    assert.equal(f.viewport.style.height, '52px');
    assert.match(f.viewport.style.transition, /height 150ms ease-out/);
    assert.equal(f.animations.at(-1)?.options.duration, 150);
    assert.equal(f.animations.at(-1)?.options.easing, 'ease-out');
  } finally { f.stop(); f.dom.window.close(); }
});

// 초기화할 때 실제 남은 내용 높이와 옵션 전환의 수명을 확인한다.
test('host-cleared input cancels shrink and corner motion and uses the actual remaining content height', async () => {
  const f=fixture(true);
  try{
    await new Promise(resolve=>f.dom.window.requestAnimationFrame(resolve));
    f.viewport.setAttribute('data-multiline','true');f.resize(148);
    const count=f.animations.length;
    f.viewport.setAttribute('data-bb-chat-ui-fluid-reset','true');
    f.resize(76);
    assert.equal(f.viewport.style.height,'76px');
    assert.equal(f.viewport.style.transition,'none');
    assert.equal(f.animations.length,count);assert.equal(f.animations[0].cancelled,true);
    f.viewport.setAttribute('data-multiline','false');f.resize(52);
    assert.equal(f.viewport.style.transition,'none');assert.equal(f.animations.length,count);
    f.viewport.setAttribute('data-bb-chat-ui-fluid-view','options');f.resize(212);
    assert.match(f.viewport.style.transition,/height 320ms/);
  }finally{f.stop();f.dom.window.close();}
});

test('reduced motion changes immediately and resumes for later height changes', async () => {
  const f = fixture();
  try {
    await new Promise(resolve => f.dom.window.requestAnimationFrame(resolve));
    f.reduce(true);
    f.resize(124);
    assert.equal(f.viewport.style.height, '124px');
    assert.equal(f.viewport.style.transition, 'none');
    f.reduce(false);
    f.resize(52);
    assert.match(f.viewport.style.transition, /height 150ms ease-out/);
  } finally { f.stop(); f.dom.window.close(); }
});

test('typing synchronizes height and corners while option morphs retain their existing duration', async () => {
  const f = fixture();
  try {
    await new Promise(resolve => f.dom.window.requestAnimationFrame(resolve));
    f.viewport.setAttribute('data-bb-chat-ui-fluid-view', 'input');
    for (const height of [76, 100, 148]) {
      f.resize(height);
      assert.equal(f.viewport.style.transition, ['height', 'border-radius', 'corner-shape'].map(property => `${property} 400ms ${FLUID_COMPOSER_INPUT_EASING}`).join(', '));
    }
    f.resize(52);
    assert.equal(f.viewport.style.transition, ['height', 'border-radius', 'corner-shape'].map(property => `${property} 150ms ease-out`).join(', '));
    f.viewport.setAttribute('data-bb-chat-ui-fluid-view', 'options');
    f.resize(212);
    assert.equal(f.viewport.style.transition, ['height', 'border-radius', 'corner-shape'].map(property => `${property} 320ms ${EASE.out}`).join(', '));
  } finally { f.stop(); f.dom.window.close(); }
});

test('unmount disconnects the local observer and cannot revive pending motion', async () => {
  const f = fixture();
  f.stop();
  assert.equal(f.disconnected, true);
  assert.equal(f.listeners, 0);
  assert.equal(f.viewport.style.height, '');
  f.resize(500);
  await new Promise(resolve => f.dom.window.requestAnimationFrame(resolve));
  assert.equal(f.viewport.style.height, '');
  assert.equal(f.viewport.style.transition, '');
  f.dom.window.close();
});
