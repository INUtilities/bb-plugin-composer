import { useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FluidComposerBody } from '../../../composer/FluidComposerBody';
import { FluidComposerPicker } from '../../../composer/FluidComposerPicker';
import { AttachmentPreview } from '../../../composer/src/AttachmentPreview';
import { injectFluidComposer } from '../../../lib/fluid-composer';
import { useDeviceChrome } from '../../../lib/use-device';
import { DemoProvider, useDemo } from './sdk-demo';

const picture='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="192" height="128"><rect width="192" height="128" fill="slategray"/><circle cx="138" cy="36" r="18" fill="lightgray"/><path d="M0 128 60 40 120 128M70 128 135 65 192 128" fill="darkslategray"/></svg>');
function Demo(){
 const form=useRef<HTMLFormElement>(null),{device}=useDeviceChrome();
 const state=useDemo();
 const [text,setText]=useState(''),[attachment,setAttachment]=useState(false),[expanded,setExpanded]=useState<number|null>(null),[notice,setNotice]=useState('');
 useLayoutEffect(()=>injectFluidComposer(document),[]);
 useLayoutEffect(()=>{document.documentElement.setAttribute('data-bb-chat-ui-root-device',device);},[device]);
 return <main><header><span className="eyebrow">COMPOSER / EXPERIMENT 06</span><h1>모델을 돌려 고르기</h1><p>설정 버튼을 눌러 Provider · 모델 · Effort를 선택하세요.<br/>체크하면 데모에만 적용됩니다.</p></header>
 <div className="stage" data-bb-plugin="composer"><div data-promptbox-shell="" className="shell">
 <form ref={form} data-bb-chat-ui-fluid-composer="" onSubmit={event=>event.preventDefault()}>
 <FluidComposerPicker formRef={form} onOpen={()=>setNotice('')} onError={setNotice}>{picker=><>
  <div data-bb-chat-ui-slot-toolbar="">{picker.modeToggle}</div>
  <FluidComposerBody draftText={text} editor={<div data-promptbox-editor-scroll=""><div className="ProseMirror" contentEditable suppressContentEditableWarning aria-label="데모 초안" role="textbox" aria-multiline="true" onInput={event=>setText(event.currentTarget.innerText)} data-placeholder="초안을 입력해 보세요"/></div>}
   options={picker.enabled?picker.trigger:<button type="button" aria-label="Provider, model and reasoning" onClick={()=>setNotice('기본 모드에서는 기존 모델 메뉴를 사용합니다.')}>{state.selection.model}</button>}
   actions={<div data-bb-chat-ui-slot-submit=""><div data-promptbox-submit-group=""><button data-promptbox-submit-action="" type="button" aria-label="데모 전송" onClick={()=>setNotice('전송하지 않았습니다. 초안은 그대로 유지됩니다.')}><svg width="18" height="18" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8"/></svg></button></div>{picker.confirm}</div>}
   attachments={attachment?<AttachmentPreview attachments={[{path:picture,name:'Landscape.svg',mimeType:'image/svg+xml'}]} expandedImageIndex={expanded} onExpandedImageIndexChange={setExpanded} onRemoveAttachment={()=>setAttachment(false)}/>:null}
   toggle={<button type="button" aria-label="데모 이미지 첨부" onClick={()=>setAttachment(value=>!value)}><span data-bb-chat-ui-fluid-toggle-glyph=""/></button>}/>
  {picker.overlay}
 </>}</FluidComposerPicker>
 </form></div></div>
 <footer><output>{state.selection.providerId} · {state.selection.model} · {state.selection.reasoningLevel} · {state.selection.serviceTier}</output><p role="status">{notice || '초안·첨부는 슬롯을 열고 닫아도 유지됩니다.'}</p><label><input type="checkbox" checked={state.experiment} onChange={event=>state.setExperiment(event.target.checked)}/> 06 슬롯 실험 사용</label><small>제품 컴포넌트 사용 · 합성 목록/전송 · 실제 API·음성 녹음 없음</small></footer>
 </main>;
}
createRoot(document.getElementById('app')!).render(<DemoProvider><Demo/></DemoProvider>);
