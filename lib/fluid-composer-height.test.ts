import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { bindFluidComposerHeight } from './fluid-composer-height.ts';
import { EASE } from './motion.ts';

// 자연 높이와 실제 표시 높이를 분리해 진행 중인 전환도 재현한다.
function fixture() {
  const dom = new JSDOM('<div id="viewport"><div id="content"><div id="moving"><div class="ProseMirror"></div></div></div></div>', { pretendToBeVisual: true });
  const win = dom.window;
  const viewport = win.document.getElementById('viewport')!;
  const content = win.document.getElementById('content')!;
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
  const stop = bindFluidComposerHeight(viewport, content);
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

test('newline resizing leaves the native editor in place while the surface height transitions', async () => {
  const f = fixture();
  try {
    await new Promise(resolve => f.dom.window.requestAnimationFrame(resolve));
    f.viewport.setAttribute('data-multiline', 'true');
    for (const height of [100, 124, 148, 100]) {
      f.resize(height);
      assert.equal(f.viewport.style.height, `${height}px`);
      assert.match(f.viewport.style.transition, /height (120|320)ms/);
      assert.equal(f.animations.length, 0, 'resizing must not move the editor and its native caret after a newline');
    }
  } finally { f.stop(); f.dom.window.close(); }
});

test('a focused newline retains the initial growth transition while later line changes and clearing keep motion', async () => {
  const f = fixture();
  try {
    await new Promise(resolve => f.dom.window.requestAnimationFrame(resolve));
    const editor = f.dom.window.document.querySelector<HTMLElement>('.ProseMirror')!;
    editor.parentElement!.setAttribute('data-bb-chat-ui-fluid-editor', '');editor.tabIndex=0;editor.focus();
    f.viewport.setAttribute('data-multiline', 'true');f.resize(116);
    assert.match(f.viewport.style.transition, /height 320ms/);
    assert.equal(f.viewport.style.height, '116px');
    f.resize(140);assert.match(f.viewport.style.transition, /height 120ms/);
    f.viewport.setAttribute('data-bb-chat-ui-fluid-reset','true');f.viewport.setAttribute('data-multiline','false');f.resize(52);
    assert.match(f.viewport.style.transition, /height 320ms/);assert.equal(f.animations.length,0);
  } finally { f.stop(); f.dom.window.close(); }
});

test('height retargeting and padding changes preserve native editor positioning and reduced motion', async () => {
  const f = fixture();
  try {
    await new Promise(resolve => f.dom.window.requestAnimationFrame(resolve));
    f.resize(100);
    assert.equal(f.animations.length, 0);
    assert.match(f.viewport.style.transition, /height 320ms/);
    f.visible(80); f.offset(20); f.resize(124);
    assert.equal(f.animations.length, 0);
    assert.equal(f.viewport.style.height, '124px');
    f.visible(110); f.offset(14); f.inset(20); f.resize(148);
    assert.equal(f.animations.length, 0);
    assert.equal(f.viewport.style.height, '148px');
    f.visible(148); f.offset(0); f.inset(12); f.resize(100);
    assert.equal(f.animations.length, 0);
    assert.equal(f.viewport.style.height, '100px');
    const count = f.animations.length;
    f.reduce(true); f.resize(172);
    assert.equal(f.animations.length, count);
    assert.equal(f.viewport.style.transition, 'none');
    f.reduce(false); f.visible(160); f.resize(196); f.stop();
    assert.equal(f.animations.length, 0);
  } finally { f.stop(); f.dom.window.close(); }
});

test('fluid composer follows wrapping, newlines, deletion and rapid retargeting', async () => {
  const f = fixture();
  try {
    await new Promise(resolve => f.dom.window.requestAnimationFrame(resolve));
    for (const height of [76, 100, 124, 76, 52]) {
      f.resize(height);
      assert.equal(f.viewport.style.height, `${height}px`);
      assert.match(f.viewport.style.transition, /height 320ms/);
    }
    f.resize(52);
    assert.equal(f.viewport.style.height, '52px');
  } finally { f.stop(); f.dom.window.close(); }
});

// 여러 줄 입력은 짧게 이어 주고 배치·옵션·음성의 기존 전환을 유지하는지 확인한다.
test('expanded input briefly follows subsequent line heights while layout and option changes retain motion', async () => {
  const f = fixture();
  try {
    await new Promise(resolve => f.dom.window.requestAnimationFrame(resolve));
    f.viewport.setAttribute('data-multiline', 'true'); f.resize(100);
    assert.match(f.viewport.style.transition, /height 320ms/);
    const count = f.animations.length;
    for (const height of [124, 148, 100]) {
      f.resize(height);
      assert.equal(f.viewport.style.height, `${height}px`);
      assert.equal(f.viewport.style.transition, ['height', 'border-radius', 'corner-shape'].map(property => `${property} 120ms ${EASE.out}`).join(', '));
      assert.equal(f.animations.length, count);
    }
    assert.equal(f.animations.length, 0);
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
    assert.match(f.viewport.style.transition, /height 320ms/);
  } finally { f.stop(); f.dom.window.close(); }
});

// 초기화할 때 실제 남은 내용 높이와 옵션 전환의 수명을 확인한다.
test('cleared input smoothly shrinks the box without moving the editor or dropping remaining content', async () => {
  const f=fixture();
  try{
    await new Promise(resolve=>f.dom.window.requestAnimationFrame(resolve));
    f.viewport.setAttribute('data-multiline','true');f.resize(148);
    const count=f.animations.length;
    f.viewport.setAttribute('data-bb-chat-ui-fluid-reset','true');
    f.resize(76);
    assert.equal(f.viewport.style.height,'76px');
    assert.match(f.viewport.style.transition,/height 320ms/);
    assert.match(f.viewport.style.transition,/border-radius 320ms/);
    assert.equal(f.animations.length,count);
    f.viewport.setAttribute('data-multiline','false');f.resize(52);
    assert.match(f.viewport.style.transition,/height 320ms/);assert.equal(f.animations.length,count);
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
    assert.match(f.viewport.style.transition, /height 320ms/);
  } finally { f.stop(); f.dom.window.close(); }
});

test('typing synchronizes height and corners while option morphs retain their existing duration', async () => {
  const f = fixture();
  try {
    await new Promise(resolve => f.dom.window.requestAnimationFrame(resolve));
    f.viewport.setAttribute('data-bb-chat-ui-fluid-view', 'input');
    for (const height of [76, 100, 148]) {
      f.resize(height);
      assert.equal(f.viewport.style.transition, ['height', 'border-radius', 'corner-shape'].map(property => `${property} 320ms ${EASE.out}`).join(', '));
    }
    f.resize(52);
    assert.equal(f.viewport.style.transition, ['height', 'border-radius', 'corner-shape'].map(property => `${property} 320ms ${EASE.out}`).join(', '));
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
