import { createContext, useContext, useState } from 'react';
const Context=createContext<any>(null);
const providers=['Codex','Claude','Hermes'].map(id=>({id,displayName:id,logoUrl:null,serviceTiers:[{id:'default',label:'Standard'},{id:'fast',label:'Fast'}]}));
const catalog=async({providerId}:any)=>({models:['Small','Balanced','Large'].map((name,index)=>({
 id:name,model:name,displayName:name,description:'검수용 모델',isDefault:index===1,defaultReasoningEffort:'medium',
 supportedReasoningEfforts:(providerId==='Hermes'?['default','none','minimal','low','medium','high','xhigh','max','ultra']:['low','medium','high']).map(reasoningEffort=>({reasoningEffort,description:reasoningEffort})),
})),selectedOnlyModels:[]});
const sdk={system:{executionOptions:catalog},providers:{models:catalog}};
// 모든 선택은 이 데모의 메모리에만 보관한다. 네트워크나 실제 전송 API는 없다.
export function DemoProvider({children}:any){
 const [selection,setSelection]=useState({providerId:'Hermes',model:'Balanced',reasoningLevel:'medium',serviceTier:'default'});
 const [experiment,setExperiment]=useState(true);
 return <Context.Provider value={{selection,setSelection,experiment,setExperiment}}>{children}</Context.Provider>;
}
export const useDemo=()=>useContext(Context);
export const useSettings=()=>({values:{experimentalSlotPicker:useDemo().experiment},isLoading:false});
export function useComposer(){const state=useDemo();return {key:'demo',scope:{kind:'new-thread',projectId:'demo'},selection:state.selection,isSubmitting:false,setSelection:async(values:any)=>{state.setSelection(values);return values;}};}
export const useSdk=()=>sdk;
export const experimental_useProviders=()=>({status:'ready',providers});
export const experimental_ProviderIcon=({provider}:any)=><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor"/><text x="12" y="16" textAnchor="middle" fill="currentColor" fontSize="11">{provider.id.slice(0,1)}</text></svg>;
export const experimental_Icon=({name,...props}:any)=><svg {...props} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d={name==='X'?'M6 6l12 12M6 18 18 6':'M4 12h16M12 4v16'} fill="none" stroke="currentColor" strokeWidth="1.6"/></svg>;
export const experimental_useComposerRenderer=()=>({attachmentSrc:(path:string)=>path,input:{resolveMentionLink:()=>null}});
export const experimental_ImageLightbox=({onClose}:any)=><div role="dialog" aria-label="첨부 확대" className="preview-dialog"><button type="button" onClick={onClose}>닫기</button><p>이 데모의 합성 첨부 미리보기입니다.</p></div>;
