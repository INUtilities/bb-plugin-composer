// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderSlot } from '@get-bb/plugin-sdk/testing/app';
import { AttachmentPreview } from './src/AttachmentPreview';
import { injectFluidComposer } from '../lib/fluid-composer';
afterEach(cleanup);

// 제품 첨부를 실제 Fluid 표면에 붙여 여백·클립과 원래 확대·삭제를 함께 확인한다.
it('insets and clips image previews without replacing their open and remove actions',()=>{
 const open=vi.fn(),remove=vi.fn(),stop=injectFluidComposer(document);
 const view=renderSlot({component:()=> <form data-bb-chat-ui-fluid-composer=""><div data-bb-chat-ui-fluid-attachments=""><AttachmentPreview attachments={[{path:'/fixture.png',name:'Preview.png',mimeType:'image/png'}]} expandedImageIndex={null} onExpandedImageIndexChange={open} onRemoveAttachment={remove}/></div></form>},{},{composerRenderer:{attachmentSrc:()=> 'data:image/png;base64,'} as any});
 try{
  const preview=screen.getByRole('button',{name:'Preview.png'});
  expect(getComputedStyle(preview).borderRadius).toBe('18px');
  expect(getComputedStyle(preview).overflow).toBe('hidden');
  const list=view.container.querySelector<HTMLElement>('[data-composer-attachment-list]')!;
  expect(getComputedStyle(list).padding).toBe('16px 16px 8px');
  fireEvent.click(preview);expect(open).toHaveBeenCalledWith(0);
  fireEvent.click(screen.getByRole('button',{name:'Remove Preview.png'}));expect(remove).toHaveBeenCalledWith('/fixture.png');
 }finally{view.unmount();stop();}
});
