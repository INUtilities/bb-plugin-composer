// @vitest-environment jsdom
import {useRef} from 'react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {act,cleanup,fireEvent,screen,waitFor} from '@testing-library/react';
import {renderSlot} from '@get-bb/plugin-sdk/testing/app';
import {useComposer} from '@get-bb/plugin-sdk/app';
import {FluidComposerPicker} from './FluidComposerPicker';
import {FluidModelControls} from './FluidModelControls';

beforeEach(()=>{sessionStorage.clear();vi.stubGlobal('matchMedia',(media:string)=>({media,matches:false,addEventListener(){},removeEventListener(){}}));});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
const model={id:'m',model:'m',displayName:'Model',isDefault:true,defaultReasoningEffort:'medium',supportedReasoningEfforts:[{reasoningEffort:'medium',description:'medium'},{reasoningEffort:'high',description:'high'}],supportedServiceTiers:[]};

it('review: normal effort lookup keeps the new-thread project when the selection has no project override',async()=>{
 const models=vi.fn(async(_args:any)=>({models:[model],selectedOnlyModels:[]}));
 const view=renderSlot({component:()=> <FluidModelControls controls={<button type="button">native</button>} onError={()=>{}}/>},{},{composer:{scope:{kind:'new-thread',projectId:'project-current'},selection:{providerId:'codex',model:'m',reasoningLevel:'medium'}},sdk:{providers:{models}}});
 fireEvent.click(screen.getByRole('button',{name:'Effort: Medium'}));await waitFor(()=>expect(models).toHaveBeenCalledTimes(1));
 expect(models.mock.calls[0][0]).toMatchObject({projectId:'project-current',providerId:'codex'});
 expect(view.inspection.composer.submits).toHaveLength(0);
});

it('review: a confirmation from the previous scope must not move keyboard focus in the new scope',async()=>{
 let api!:ReturnType<typeof useComposer>;let finish!:()=>void;const gate=new Promise<void>(resolve=>{finish=resolve;});
 function Harness(){api=useComposer();const ref=useRef<HTMLFormElement>(null);return <div data-scroll-footer=""><div data-promptbox-shell=""><form ref={ref}><FluidComposerPicker formRef={ref} onOpen={()=>{}} onError={()=>{}}>{p=><>{p.modeToggle}{p.trigger}<div data-bb-chat-ui-slot-submit="">{p.confirm}</div>{p.overlay}</>}</FluidComposerPicker></form></div></div>;}
 const view=renderSlot({component:Harness},{},{composer:{scope:{kind:'thread',threadId:'old'},selection:{providerId:'codex',model:'m',reasoningLevel:'medium'}},providers:{status:'ready',providers:[{id:'codex',displayName:'Codex',logoUrl:null}] as any},sdk:{providers:{models:async()=>({models:[model],selectedOnlyModels:[]})},threads:{get:async()=>({environmentId:'env'}) as any}}});
 const selection=vi.spyOn(api,'setSelection').mockImplementation(async()=>{await gate;return{providerId:'codex',model:'m',reasoningLevel:'medium'};});
 fireEvent.click(screen.getByRole('button',{name:'모델과 Effort 설정'}));await screen.findByRole('option',{name:'Model'});fireEvent.click(screen.getByRole('button',{name:'설정 완료'}));await waitFor(()=>expect(selection).toHaveBeenCalledTimes(1));
 await act(async()=>{await view.setComposerScope({kind:'thread',threadId:'new'});});
 const outside=document.createElement('input');outside.setAttribute('aria-label','current typing target');document.body.append(outside);outside.focus();expect(document.activeElement).toBe(outside);
 try{await act(async()=>{finish();await gate;});expect(document.activeElement).toBe(outside);}finally{outside.remove();}
});
