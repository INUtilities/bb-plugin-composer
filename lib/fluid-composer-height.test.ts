import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { bindFluidComposerHeight } from './fluid-composer-height.ts';
import { EASE } from './motion.ts';

function fixture() {
  const dom = new JSDOM('<div id="viewport"><div id="content"></div></div>', { pretendToBeVisual: true });
  const win = dom.window;
  const viewport = win.document.getElementById('viewport')!;
  const content = win.document.getElementById('content')!;
  let naturalHeight = 52;
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
    viewport, content, dom, stop,
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

test('fluid composer follows wrapping, newlines, deletion and rapid retargeting', async () => {
  const f = fixture();
  try {
    await new Promise(resolve => f.dom.window.requestAnimationFrame(resolve));
    for (const height of [76, 100, 124, 76, 52]) {
      f.resize(height);
      assert.equal(f.viewport.style.height, `${height}px`);
      assert.match(f.viewport.style.transition, /height 120ms/);
    }
    f.resize(52);
    assert.equal(f.viewport.style.height, '52px');
  } finally { f.stop(); f.dom.window.close(); }
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
    assert.match(f.viewport.style.transition, /height 120ms/);
  } finally { f.stop(); f.dom.window.close(); }
});

test('typing synchronizes fast height and corners while option morphs retain their existing duration', async () => {
  const f = fixture();
  try {
    await new Promise(resolve => f.dom.window.requestAnimationFrame(resolve));
    f.viewport.setAttribute('data-bb-chat-ui-fluid-view', 'input');
    for (const height of [76, 100, 148]) {
      f.resize(height);
      assert.equal(f.viewport.style.transition, ['height', 'border-radius', 'corner-shape'].map(property => `${property} 120ms ${EASE.out}`).join(', '));
    }
    f.resize(52);
    assert.equal(f.viewport.style.transition, ['height', 'border-radius', 'corner-shape'].map(property => `${property} 120ms ${EASE.out}`).join(', '));
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
