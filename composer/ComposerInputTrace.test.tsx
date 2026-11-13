// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {attachComposerInputTrace,traceComposerInput,traceComposerAnimation} from '../lib/composer-input-trace';
let release:()=>void=()=>{};
beforeEach(()=>vi.useFakeTimers());
afterEach(()=>{release();document.body.replaceChildren();vi.restoreAllMocks();vi.useRealTimers();});
function mount(){
 const viewport=document.createElement('div');viewport.dataset.bbChatUiFluidHeight='';viewport.dataset.multiline='true';
 viewport.innerHTML='<div data-bb-chat-ui-fluid-row data-multiline="true"><div class="ProseMirror" contenteditable="true">PRIVATE_INPUT_DO_NOT_CAPTURE</div></div>';
 document.body.append(viewport);release=attachComposerInputTrace(viewport);
 return {viewport,api:window.__bbComposerInputTrace!,editor:viewport.querySelector<HTMLElement>('.ProseMirror')!};
}
it('does no geometry work until explicitly started and exports only the allowed metadata',()=>{
 const {viewport,api,editor}=mount();const reads=vi.spyOn(Element.prototype,'getBoundingClientRect');
 traceComposerInput(viewport,'layoutProbe.enter');expect(reads).not.toHaveBeenCalled();
 api.start(viewport);
 traceComposerInput(viewport,'compositionstart',{composing:true});
 traceComposerInput(viewport,'beforeinput',{composing:true,inputType:'insertCompositionText'});
 traceComposerInput(viewport,'beforeinput',{inputType:'PRIVATE_INPUT_DO_NOT_CAPTURE'});
 traceComposerInput(viewport,'layoutProbe.result',{needsFullWidth:false});
 traceComposerInput(viewport,'compositionend',{composing:false});
 const result=api.stop();expect(reads).toHaveBeenCalled();expect(result.map(e=>e.event)).toEqual(['compositionstart','beforeinput','beforeinput','layoutProbe.result','compositionend']);
 expect(result[1].inputType).toBe('insertCompositionText');expect(result[2].inputType).toBe('other');
 expect(result[0].composing).toBe(true);expect(result.at(-1)!.composing).toBe(false);expect(result[3].needsFullWidth).toBe(false);
 expect(JSON.stringify(result)).not.toContain(editor.textContent);expect(Object.keys(result[0]).sort()).toEqual(['animation','composing','editorClientHeight','editorRectHeight','editorScrollHeight','event','inputType','multiline','needsFullWidth','rowRectHeight','timestamp','viewportRectHeight'].sort());
 expect(window.__bbComposerInputTrace).toBeUndefined();
});
it('expires and clears the capture after 60 seconds without any repeating frame or observer',()=>{
 const {viewport,api}=mount();const raf=vi.spyOn(window,'requestAnimationFrame'),observer=vi.spyOn(window,'ResizeObserver');
 api.start(viewport);traceComposerInput(viewport,'raf.run');vi.advanceTimersByTime(60_000);
 expect(window.__bbComposerInputTrace).toBeUndefined();expect(api.stop()).toEqual([]);expect(raf).not.toHaveBeenCalled();expect(observer).not.toHaveBeenCalled();
});
it('bounds the buffer and removes animation and transition listeners on explicit removal',()=>{
 const {viewport,api}=mount();api.start(viewport);
 const animation=new EventTarget() as Animation;const remove=vi.spyOn(animation,'removeEventListener');
 traceComposerAnimation(viewport,animation);for(let i=0;i<1100;i++)traceComposerInput(viewport,'raf.run');
 const entries=api.stop();expect(entries).toHaveLength(1024);expect(remove).toHaveBeenCalledTimes(2);
 const before=entries.length;animation.dispatchEvent(new Event('finish'));viewport.dispatchEvent(new Event('transitionrun'));expect(entries).toHaveLength(before);
});
it('clears on unmount, allows idempotent removal, and does not replace another owner global',()=>{
 const {viewport,api}=mount();api.start(viewport);traceComposerInput(viewport,'raf.run');release();release();api.remove();expect(api.stop()).toEqual([]);expect(window.__bbComposerInputTrace).toBeUndefined();
 const occupied={owner:'external'};Object.defineProperty(window,'__bbComposerInputTrace',{configurable:true,value:occupied});
 const detach=attachComposerInputTrace(viewport);detach();expect(window.__bbComposerInputTrace).toBe(occupied);delete window.__bbComposerInputTrace;
});
it('requires a focused or explicit owned viewport when several composers share a document',()=>{
 const {viewport,api,editor}=mount();const other=document.createElement('div');document.body.append(other);const detach=attachComposerInputTrace(other);
 try{expect(()=>api.start()).toThrow();editor.focus();api.start();traceComposerInput(other,'raf.run');traceComposerInput(viewport,'raf.run');expect(api.stop()).toHaveLength(1);}finally{detach();}
});

it('records animation roles and releases completed listeners without changing the animation',()=>{
 const {viewport,api}=mount();api.start(viewport);
 const animation=new EventTarget() as Animation;
 traceComposerAnimation(viewport,animation,'height-follow');animation.dispatchEvent(new Event('finish'));
 const transition=new Event('transitionrun');Object.defineProperty(transition,'propertyName',{value:'height'});viewport.dispatchEvent(transition);
 const entries=api.stop();expect(entries.map(e=>[e.event,e.animation])).toEqual([['animation.start','height-follow'],['animation.finish','height-follow'],['animation.start','height']]);
});
it('drops the diagnostic if a geometry read fails without throwing into the product input path',()=>{
 const {viewport,api}=mount();api.start(viewport);
 vi.spyOn(viewport,'getBoundingClientRect').mockImplementation(()=>{throw Error('geometry unavailable');});
 expect(()=>traceComposerInput(viewport,'beforeinput',{inputType:'insertText'})).not.toThrow();
 expect(window.__bbComposerInputTrace).toBeUndefined();expect(api.stop()).toEqual([]);
});
