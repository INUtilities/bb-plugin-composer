// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { FluidComposerBody } from './FluidComposerBody';

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({matches:false, addEventListener(){}, removeEventListener(){}}));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

// Chat UI가 소유한 DOM과 클릭 동작은 복사·이동 없이 그대로 사용한다.
function setup() {
  const shell=document.createElement('div'), stack=document.createElement('div'), mount=document.createElement('div');
  shell.setAttribute('data-promptbox-shell',''); stack.setAttribute('data-bb-chat-ui-info-stack','');
  const bar=document.createElement('div'); bar.setAttribute('data-bb-chat-ui-info-bar','');
  const trigger=document.createElement('button'); trigger.setAttribute('data-bb-chat-ui-info-trigger','goal'); trigger.textContent='Goal';
  const card=document.createElement('section'); card.setAttribute('data-bb-chat-ui-info-unit','');
  const action=document.createElement('button'); action.textContent='기존 정보 동작'; const run=vi.fn(); action.onclick=run;
  const dismiss=document.createElement('button'); dismiss.setAttribute('data-bb-chat-ui-info-dismiss',''); dismiss.textContent='닫기';
  card.append(action,dismiss); bar.append(trigger); stack.append(bar,card); shell.append(stack,mount); document.body.append(shell);
  const close=()=>{card.removeAttribute('data-bb-chat-ui-info-open');trigger.setAttribute('aria-expanded','false');};
  trigger.onclick=()=>{if(card.hasAttribute('data-bb-chat-ui-info-open'))close();else{card.setAttribute('data-bb-chat-ui-info-open','goal');trigger.setAttribute('aria-expanded','true');}};
  dismiss.onclick=close;
  Object.defineProperty(card,'scrollHeight',{configurable:true,value:180});
  const view=render(<form data-bb-chat-ui-fluid-composer=""><FluidComposerBody
    editor={<textarea defaultValue="보존할 초안"/>} options={<button type="button">모델</button>}
    actions={<button type="button">전송</button>} attachments={<span data-attachment="">파일</span>}/></form>,{container:mount});
  const viewport=mount.querySelector<HTMLElement>('[data-bb-chat-ui-fluid-height]')!;
  return {shell,stack,mount,bar,trigger,card,action,dismiss,run,view,viewport};
}

it('keeps the input and attachments usable while the original information card opens above',async()=>{
  const f=setup(), editor=f.mount.querySelector('textarea')!, attachment=f.mount.querySelector('[data-attachment]')!;
  f.card.style.setProperty('background','var(--popover)','important');
  fireEvent.click(f.trigger);
  await act(async()=>{});
  expect(f.card.getAttribute('data-bb-chat-ui-info-open')).toBe('goal');
  expect(f.viewport.getAttribute('data-bb-chat-ui-fluid-view')).toBe('input');
  expect(f.card.parentElement).toBe(f.stack);
  expect(f.card.hasAttribute('data-bb-composer-info-surface')).toBe(false);
  expect(f.card.style.background).toBe('var(--popover)');
  expect(f.card.style.getPropertyPriority('background')).toBe('important');
  expect(editor.closest('[inert]')).toBeNull();
  expect(f.mount.querySelector('textarea')).toBe(editor);
  expect(editor.value).toBe('보존할 초안');
  expect(f.mount.querySelector('[data-attachment]')).toBe(attachment);
  fireEvent.click(f.action);expect(f.run).toHaveBeenCalledOnce();
  fireEvent.click(f.dismiss);
  expect(f.card.hasAttribute('data-bb-chat-ui-info-open')).toBe(false);
  expect(f.mount.querySelector('textarea')).toBe(editor);
});

it('leaves the original native metadata card above the composer',async()=>{
  const f=setup(), toggle=document.createElement('button'), footer=document.createElement('div');
  toggle.setAttribute('data-bb-chat-ui-fluid-details-toggle','');footer.setAttribute('data-follow-up-composer-footer','');
  footer.textContent='Project · Branch · Permission · Context';f.bar.append(toggle);f.shell.append(footer);
  toggle.onclick=()=>{f.shell.toggleAttribute('data-bb-chat-ui-fluid-details-open');};
  fireEvent.click(toggle);
  await act(async()=>{});
  expect(f.shell.hasAttribute('data-bb-chat-ui-fluid-details-open')).toBe(true);
  expect(f.viewport.getAttribute('data-bb-chat-ui-fluid-view')).toBe('input');
  expect(footer.parentElement).toBe(f.shell);
  expect(footer.hasAttribute('data-bb-composer-info-surface')).toBe(false);
  expect(f.mount.querySelector('textarea')!.closest('[inert]')).toBeNull();
});
