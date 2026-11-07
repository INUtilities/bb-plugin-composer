// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, waitFor } from '@testing-library/react';
import { renderSlot } from '@get-bb/plugin-sdk/testing/app';
import type { ExperimentalComposerRendererApi } from '@get-bb/plugin-sdk/app';
import type { Editor } from '@tiptap/core';
import { PromptBoxInternal } from './src/PromptBoxInternal';

// ProseMirror reads the browser once at module import, before beforeEach runs.
vi.hoisted(() => {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' });
  Object.defineProperty(navigator, 'vendor', { configurable: true, value: 'Apple Computer, Inc.' });
  Object.defineProperty(navigator, 'platform', { configurable: true, value: 'iPhone' });
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
});

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
  cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
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

function nativeEnter(editor: Editor, init: KeyboardEventInit = {}) {
  const dom = editor.view.dom;
  const event = new KeyboardEvent('keydown', {
    key: 'Enter', keyCode: 13, bubbles: true, cancelable: true, ...init,
  });
  dom.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  nativeParagraph(editor);
  dom.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
}

function nativeParagraph(editor: Editor) {
  const dom = editor.view.dom;
  const before = new InputEvent('beforeinput', {
    inputType: 'insertParagraph', bubbles: true, cancelable: true,
  });
  dom.dispatchEvent(before);
  if (before.defaultPrevented) return;
  // jsdom has no contenteditable default action. Model the browser splitting
  // the paragraph, then let the real ProseMirror DOM observer read the change.
  const selection = window.getSelection()!;
  const range = selection.getRangeAt(0);
  const paragraph = (range.startContainer.nodeType === Node.TEXT_NODE
    ? range.startContainer.parentElement : range.startContainer as Element).closest('p')!;
  range.setEnd(paragraph, paragraph.childNodes.length);
  const next = document.createElement('p');
  next.append(range.extractContents());
  if (!next.hasChildNodes()) next.append(document.createElement('br'));
  paragraph.after(next);
  selection.collapse(next, 0);
  dom.dispatchEvent(new InputEvent('input', { inputType: 'insertParagraph', bubbles: true }));
}

function commitKoreanText(editor: Editor, text: string) {
  const dom = editor.view.dom;
  editor.view.focus();
  dom.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
  dom.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertCompositionText', data: text, isComposing: true, bubbles: true }));
  const paragraph = dom.lastElementChild!;
  const node = document.createTextNode(text);
  paragraph.replaceChildren(node);
  window.getSelection()!.collapse(node, text.length);
  dom.dispatchEvent(new CompositionEvent('compositionupdate', { data: text, bubbles: true }));
  dom.dispatchEvent(new InputEvent('input', { inputType: 'insertCompositionText', data: text, isComposing: true, bubbles: true }));
  dom.dispatchEvent(new CompositionEvent('compositionend', { data: text, bubbles: true }));
}

it('lets the iPhone keyboard finish its native Enter instead of cancelling it before beforeinput', async () => {
  const { editor, run } = await mount();
  act(() => { editor.commands.insertContent('마지막 한글'); });
  const before = editor.state.doc;
  const event = new KeyboardEvent('keydown', {
    key: 'Enter', keyCode: 13, bubbles: true, cancelable: true,
  });
  act(() => { editor.view.dom.dispatchEvent(event); });
  expect(event.defaultPrevented).toBe(false);
  expect(editor.state.doc).toBe(before);
  expect(run).not.toHaveBeenCalled();
});

it('keeps one newline when native iPhone paragraph input arrives after a frame following key release', async () => {
  const { editor, run } = await mount();
  vi.useFakeTimers();
  await act(async () => {
    editor.commands.insertContent('한글');
    editor.view.focus();
    editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true }));
    editor.view.dom.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(32);
    nativeParagraph(editor);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(250);
  });
  expect(editor.state.doc.childCount).toBe(2);
  expect(editor.state.doc.firstChild!.textContent).toBe('한글');
  expect(editor.state.doc.lastChild!.textContent).toBe('');
  expect(run).not.toHaveBeenCalled();
});

it('keeps eight rapid native Korean commits and Enter presses in separate paragraphs without a fallback wait', async () => {
  const { editor, run } = await mount();
  for (let index = 0; index < 8; index++) {
    await act(async () => {
      commitKoreanText(editor, '한글');
      if (index < 7) nativeEnter(editor);
      await Promise.resolve();
    });
    expect(editor.state.doc.childCount).toBe(index < 7 ? index + 2 : 8);
  }
  expect(Array.from({ length: editor.state.doc.childCount }, (_, i) => editor.state.doc.child(i).textContent)).toEqual(Array(8).fill('한글'));
  expect(run).not.toHaveBeenCalled();
});

it('keeps a native paragraph split at the caret with the final Korean character present once', async () => {
  const { editor, run } = await mount();
  await act(async () => {
    editor.commands.insertContent('한글 문장');
    editor.commands.setTextSelection(3);
    editor.view.focus();
    nativeEnter(editor);
    await Promise.resolve();
  });
  expect(editor.state.doc.childCount).toBe(2);
  expect(editor.state.doc.child(0).textContent).toBe('한글');
  expect(editor.state.doc.child(1).textContent).toBe(' 문장');
  expect(editor.state.selection.$from.parentOffset).toBe(0);
  act(() => { editor.commands.insertContent('다음'); });
  expect(editor.state.doc.child(1).textContent).toBe('다음 문장');
  expect(run).not.toHaveBeenCalled();
});

it('does not insert a second newline when the iOS fallback deadline passes after native input', async () => {
  const { editor, run } = await mount();
  vi.useFakeTimers();
  await act(async () => {
    editor.commands.insertContent('끝');
    editor.view.focus();
    nativeEnter(editor);
    await Promise.resolve();
  });
  expect(editor.state.doc.childCount).toBe(2);
  act(() => { editor.commands.insertContent('다음'); });
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  expect(editor.state.doc.childCount).toBe(2);
  expect(editor.state.doc.child(0).textContent).toBe('끝');
  expect(editor.state.doc.child(1).textContent).toBe('다음');
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

it('leaves both active composition and post-composition Enter to the native keyboard', async () => {
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
  expect(earlyEnter(editor).handled).toBe(false);
  expect(editor.state.doc.childCount).toBe(1);
});

it('keeps Shift+Enter as a newline on iPhone', async () => {
  const { editor, run } = await mount();
  await act(async () => {
    editor.commands.insertContent('한글');
    editor.view.focus();
    nativeEnter(editor, { shiftKey: true });
    await Promise.resolve();
  });
  expect(editor.state.doc.childCount).toBe(2);
  expect(editor.state.doc.firstChild!.textContent).toBe('한글');
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


it('applies an explicit iPhone paragraph before the next text event without waiting for native DOM input', async () => {
  const { editor, run } = await mount();
  vi.useFakeTimers();
  act(() => { editor.commands.insertContent('ㅇ');editor.view.focus(); });
  const key=new KeyboardEvent('keydown',{key:'Enter',keyCode:13,bubbles:true,cancelable:true});
  const before=new InputEvent('beforeinput',{inputType:'insertParagraph',bubbles:true,cancelable:true});
  act(() => {editor.view.dom.dispatchEvent(key);editor.view.dom.dispatchEvent(before);});
  expect(key.defaultPrevented).toBe(false);
  expect(before.defaultPrevented).toBe(true);
  expect(editor.state.doc.childCount).toBe(2);
  act(() => {editor.commands.insertContent('ㅇ');});
  await act(async () => {await vi.advanceTimersByTimeAsync(250);});
  expect(Array.from({length:editor.state.doc.childCount},(_,i)=>editor.state.doc.child(i).textContent)).toEqual(['ㅇ','ㅇ']);
  expect(run).not.toHaveBeenCalled();
});

it('keeps eight immediate Korean composition commits and beforeinput paragraphs ordered with no duplicated fallback', async () => {
  const { editor, run } = await mount();
  vi.useFakeTimers();
  for(let index=0;index<8;index++){
    act(() => {
      commitKoreanText(editor,'ㅇ');
      if(index<7){
        editor.view.dom.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,bubbles:true,cancelable:true}));
        const before=new InputEvent('beforeinput',{inputType:'insertParagraph',bubbles:true,cancelable:true});
        editor.view.dom.dispatchEvent(before);
        expect(before.defaultPrevented).toBe(true);
        expect(editor.state.doc.childCount).toBe(index+2);
        editor.view.dom.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',keyCode:13,bubbles:true}));
      }
    });
    await act(async () => {await Promise.resolve();await vi.advanceTimersByTimeAsync(25);});
  }
  await act(async () => {await vi.advanceTimersByTimeAsync(300);});
  expect(Array.from({length:editor.state.doc.childCount},(_,i)=>editor.state.doc.child(i).textContent)).toEqual(Array(8).fill('ㅇ'));
  expect(run).not.toHaveBeenCalled();
});

it.each([{isComposing:true,cancelable:true},{isComposing:false,cancelable:false}])('keeps native paragraph input when it is composing or cannot be cancelled: %j', async init => {
 const {editor,run}=await mount();act(()=>{editor.commands.insertContent('한');editor.view.focus();});
 const before=new InputEvent('beforeinput',{inputType:'insertParagraph',bubbles:true,...init});
 act(()=>{editor.view.dom.dispatchEvent(before);});
 expect(before.defaultPrevented).toBe(false);expect(editor.state.doc.childCount).toBe(1);expect(run).not.toHaveBeenCalled();
});

it.each(['android', 'desktop', 'ipad'] as const)('leaves the %s beforeinput paragraph route native', async kind => {
 vi.restoreAllMocks();device(kind);
 const {editor,run}=await mount();act(()=>{editor.commands.insertContent('native');editor.view.focus();});
 const before=new InputEvent('beforeinput',{inputType:'insertParagraph',bubbles:true,cancelable:true});
 act(()=>{editor.view.dom.dispatchEvent(before);});
 expect(before.defaultPrevented).toBe(false);expect(editor.state.doc.childCount).toBe(1);expect(run).not.toHaveBeenCalled();
});

it('does not edit from a locked or blurred beforeinput event', async () => {
 const {editor,run}=await mount();act(()=>{editor.commands.insertContent('한');editor.view.focus();editor.setEditable(false);});
 const locked=new InputEvent('beforeinput',{inputType:'insertParagraph',bubbles:true,cancelable:true});
 act(()=>{editor.view.dom.dispatchEvent(locked);});expect(locked.defaultPrevented).toBe(false);
 act(()=>{editor.setEditable(true);editor.view.dom.blur();});
 const blurred=new InputEvent('beforeinput',{inputType:'insertParagraph',bubbles:true,cancelable:true});
 act(()=>{editor.view.dom.dispatchEvent(blurred);});expect(blurred.defaultPrevented).toBe(false);
 expect(editor.state.doc.childCount).toBe(1);expect(run).not.toHaveBeenCalled();
});

it('handles a confirmed line-break intent once while leaving the keydown and later timer intact', async () => {
 const {editor,run}=await mount();vi.useFakeTimers();
 act(()=>{editor.commands.insertContent('앞');editor.view.focus();});
 const key=new KeyboardEvent('keydown',{key:'Enter',keyCode:13,shiftKey:true,bubbles:true,cancelable:true});
 const before=new InputEvent('beforeinput',{inputType:'insertLineBreak',bubbles:true,cancelable:true});
 act(()=>{editor.view.dom.dispatchEvent(key);editor.view.dom.dispatchEvent(before);});
 expect(key.defaultPrevented).toBe(false);expect(before.defaultPrevented).toBe(true);
 await act(async()=>{await vi.advanceTimersByTimeAsync(250);});
 expect(editor.state.doc.childCount).toBe(2);expect(editor.state.doc.firstChild!.textContent).toBe('앞');expect(run).not.toHaveBeenCalled();
});
