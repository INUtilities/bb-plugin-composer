// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { FluidComposerToolbar } from './FluidComposerToolbar';

beforeEach(()=>vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}})));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

// 같은 컴포저의 늦은 정보 행과 교체를 연결하고 편집 영역은 유지한다.
it('joins the local information row, follows replacement and falls back when hidden',async()=>{
 const shell=document.createElement('div'),mount=document.createElement('div'),other=document.createElement('div');
 shell.setAttribute('data-promptbox-shell','');other.setAttribute('data-bb-chat-ui-info-bar','');shell.append(mount);document.body.append(shell,other);
 const v=render(<><textarea defaultValue="보관할 초안"/><FluidComposerToolbar><button>06 슬롯</button><button>정보</button></FluidComposerToolbar></>,{container:mount});
 try{
  const editor=screen.getByRole('textbox');
  const bar=document.createElement('div');bar.setAttribute('data-bb-chat-ui-info-bar','');bar.innerHTML='<button>Code Diff</button>';shell.prepend(bar);
  await waitFor(()=>expect(bar.contains(screen.getByRole('button',{name:'06 슬롯'}))).toBe(true));
  expect(other.children.length).toBe(0);expect(bar.querySelector('button')?.textContent).toBe('Code Diff');
  const replacement=document.createElement('div');replacement.setAttribute('data-bb-chat-ui-info-bar','');bar.replaceWith(replacement);
  await waitFor(()=>expect(replacement.contains(screen.getByRole('button',{name:'정보'}))).toBe(true));
  replacement.hidden=true;
  await waitFor(()=>expect(mount.contains(screen.getByRole('button',{name:'06 슬롯'}))).toBe(true));
  replacement.hidden=false;
  await waitFor(()=>expect(replacement.contains(screen.getByRole('button',{name:'06 슬롯'}))).toBe(true));
  expect(screen.getByRole('textbox')).toBe(editor);expect((editor as HTMLTextAreaElement).value).toBe('보관할 초안');
  v.unmount();expect(replacement.children.length).toBe(0);expect(replacement.style.getPropertyValue('--bb-chat-ui-fluid-toolbar-width')).toBe('');
 }finally{v.unmount();shell.remove();other.remove();}
});
