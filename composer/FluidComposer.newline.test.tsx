// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, waitFor } from '@testing-library/react';
import { renderSlot } from '@get-bb/plugin-sdk/testing/app';
import type { ExperimentalComposerRendererApi } from '@get-bb/plugin-sdk/app';
import type { Editor } from '@tiptap/core';
import { PromptBoxInternal } from './src/PromptBoxInternal';

const touchDescriptor = Object.getOwnPropertyDescriptor(navigator, 'maxTouchPoints');

function device(kind: 'iphone' | 'ipad' | 'android' | 'desktop') {
  const touch = kind !== 'desktop';
  const apple = kind === 'iphone' || kind === 'ipad';
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
    apple ? `Mozilla/5.0 (${kind === 'iphone' ? 'iPhone' : 'iPad'}) AppleWebKit/605.1.15 Safari/604.1`
      : kind === 'android' ? 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0' : 'Chrome/140.0',
  );
  vi.spyOn(navigator, 'vendor', 'get').mockReturnValue(apple ? 'Apple Computer, Inc.' : 'Google Inc.');
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue(kind === 'ipad' ? 'iPad' : kind === 'iphone' ? 'iPhone' : 'Linux');
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: touch ? 5 : 0 });
  vi.spyOn(window.screen, 'width', 'get').mockReturnValue(kind === 'ipad' ? 820 : 390);
  vi.spyOn(window.screen, 'height', 'get').mockReturnValue(844);
  vi.stubGlobal('matchMedia', (media: string) => ({
    media,
    matches: media === '(pointer: fine)' ? !touch :
      ['(pointer: coarse)', '(any-pointer: coarse)', '(hover: none)', '(orientation: portrait)'].includes(media) && touch,
    onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return true; },
  }));
}

beforeEach(() => device('iphone'));
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  if (touchDescriptor) Object.defineProperty(navigator, 'maxTouchPoints', touchDescriptor);
  else Reflect.deleteProperty(navigator, 'maxTouchPoints');
});

async function mount() {
  const run = vi.fn();
  const renderer: ExperimentalComposerRendererApi = {
    key: 'newline-test', inputLocked: false, focusComposerShortcut: null, decorationSources: [],
    view: { scope: { kind: 'thread', threadId: 'thr_newline_test' }, layout: 'expanded', draft: { text: '', isEmpty: true, attachmentCount: 0 }, run: { isRunning: false, isSubmitting: false } },
    input: {
      surface: 'thread', autoFocus: false, mentionTriggers: [], commandTriggers: [], resolveMentionLink: () => null, mentionMenuPlacement: 'top',
      submission: { enter: { kind: 'send', requiresInput: true, shortcut: { ariaKeyshortcuts: 'Enter', label: 'Enter' }, run }, modifier: null, showModifierInMenu: false },
    },
    threadLinks: { parse: () => null, cached: () => null, resolve: async () => {} }, clipboard: { readMessage: () => null, readMessageImage: async () => new File([], 'unused') },
    dispatchAppCommandKey: () => false, showError: vi.fn(), attachmentSrc: () => '',
  };
  const v = renderSlot({ component: () => <PromptBoxInternal {...renderer.input} fluid /> }, {}, { composer: { scope: renderer.view.scope, text: '' }, composerRenderer: renderer });
  await waitFor(() => expect(v.container.querySelector('.ProseMirror[contenteditable=true]')).toBeTruthy());
  const element = v.container.querySelector<HTMLElement & { editor: Editor }>('.ProseMirror')!;
  return { v, editor: element.editor, run };
}

function earlyEnter(editor: Editor, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...init });
  // iOS may not emit insertParagraph. Test the DOM handler before ProseMirror's 200ms fallback.
  let handled: boolean | void;
  act(() => { handled = editor.view.props.handleDOMEvents!.keydown!(editor.view, event); });
  return { event, handled: handled! };
}

it('inserts each iPhone Enter synchronously before the next Korean character without submitting', async () => {
  const { editor, run } = await mount();
  for (let index = 0; index < 8; index++) {
    act(() => { editor.commands.insertContent('ㅇ'); });
    if (index < 7) {
      const { event, handled } = earlyEnter(editor);
      expect(handled).toBe(true);
      expect(event.defaultPrevented).toBe(true);
      expect(editor.state.doc.childCount).toBe(index + 2);
    }
  }
  expect(Array.from({ length: editor.state.doc.childCount }, (_, i) => editor.state.doc.child(i).textContent)).toEqual(Array(8).fill('ㅇ'));
  expect(run).not.toHaveBeenCalled();
});

it.each([{ isComposing: true }, { keyCode: 229 }, { ctrlKey: true }, { metaKey: true }, { altKey: true }])('leaves composition and modified Enter to their existing handlers: %j', async (init) => {
  const { editor, run } = await mount();
  act(() => { editor.commands.insertContent('한'); });
  const { event, handled } = earlyEnter(editor, init);
  expect(handled).toBe(false);
  expect(event.defaultPrevented).toBe(false);
  expect(editor.state.doc.childCount).toBe(1);
  expect(run).not.toHaveBeenCalled();
});

it('leaves active view composition and the first post-composition Enter to WebKit', async () => {
  const { editor, run } = await mount();
  const view = editor.view;
  act(() => { view.dom.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })); });
  expect(view.composing).toBe(true);
  expect(earlyEnter(editor).handled).toBe(false);
  act(() => { view.dom.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })); });
  expect(view.composing).toBe(false);
  const { event, handled } = earlyEnter(editor);
  expect(handled).toBe(false);
  expect(event.defaultPrevented).toBe(false);
  expect(editor.state.doc.childCount).toBe(1);
  expect(run).not.toHaveBeenCalled();
  expect(earlyEnter(editor).handled).toBe(true);
  expect(editor.state.doc.childCount).toBe(2);
});

it('keeps Shift+Enter as a newline on iPhone', async () => {
  const { editor, run } = await mount();
  act(() => { editor.commands.insertContent('한글'); });
  const { event, handled } = earlyEnter(editor, { shiftKey: true });
  expect(handled).toBe(true);
  expect(event.defaultPrevented).toBe(true);
  expect(editor.state.doc.childCount).toBe(2);
  expect(run).not.toHaveBeenCalled();
});

it('does not change a locked editor', async () => {
  const { editor, run } = await mount();
  act(() => { editor.setEditable(false); });
  expect(earlyEnter(editor).handled).toBe(false);
  expect(editor.state.doc.childCount).toBe(1);
  expect(run).not.toHaveBeenCalled();
});

it.each(['android', 'desktop'] as const)('preserves the existing %s keydown route', async (kind) => {
  vi.restoreAllMocks(); device(kind);
  const { editor, run } = await mount();
  expect(earlyEnter(editor).handled).toBe(false);
  expect(editor.state.doc.childCount).toBe(1);
  expect(run).not.toHaveBeenCalled();
});

it('preserves iPad hardware Enter submission', async () => {
  vi.restoreAllMocks(); device('ipad');
  const { editor, run } = await mount();
  act(() => { editor.commands.insertContent('전송할 초안'); });
  const { event, handled } = earlyEnter(editor, { code: 'Enter' });
  expect(handled).toBe(true);
  expect(event.defaultPrevented).toBe(true);
  await waitFor(() => expect(run).toHaveBeenCalledOnce());
});
