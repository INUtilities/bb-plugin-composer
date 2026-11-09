import { useEffect, useRef, useState } from 'react';
import { experimental_useProviders as useProviders, useComposer, useSdk } from '@get-bb/plugin-sdk/app';

type Selection = NonNullable<ReturnType<typeof useComposer>['selection']>;
type Catalog = Awaited<ReturnType<ReturnType<typeof useSdk>['providers']['models']>>;
export type FluidPickerModel = Catalog['models'][number];
export type FluidPickerDraft = Pick<Selection, 'providerId' | 'model' | 'reasoningLevel' | 'serviceTier'>;
type Routing = {environmentId:string} | {hostId:string; projectId?:string} | {projectId?:string};
type State = {key:string; open:boolean; draft:FluidPickerDraft; models:FluidPickerModel[]; loading:boolean; applying:boolean; error:string};
const order = ['none','minimal','low','medium','high','xhigh','max','ultra'];

// 실제 모델과 공급자가 허용하는 서비스 등급만 돌려준다.
export function fluidServiceTiers(model:FluidPickerModel | undefined, provider:{serviceTiers?:readonly {id:string;label?:string}[]} | undefined) {
  return model?.supportedServiceTiers ?? provider?.serviceTiers ?? [];
}

// 새 모델의 지원 목록에 맞춰 노력 단계와 서비스 등급을 보존하거나 보정한다.
function reconcile(model:FluidPickerModel, preferred:FluidPickerDraft, tiers:readonly {id:string}[]):FluidPickerDraft {
  const efforts = model.supportedReasoningEfforts;
  const rank = order.indexOf(preferred.reasoningLevel ?? '');
  const nearest = rank < 0 ? undefined : efforts.filter(item=>order.includes(item.reasoningEffort)).reduce<typeof efforts[number] | undefined>((best,item)=>
    !best || Math.abs(order.indexOf(item.reasoningEffort)-rank) < Math.abs(order.indexOf(best.reasoningEffort)-rank) ? item : best, undefined);
  const reasoningLevel = efforts.find(item=>item.reasoningEffort===preferred.reasoningLevel)?.reasoningEffort
    ?? nearest?.reasoningEffort ?? efforts.find(item=>item.reasoningEffort===model.defaultReasoningEffort)?.reasoningEffort ?? efforts[0]?.reasoningEffort;
  const serviceTier = tiers.find(item=>item.id===preferred.serviceTier)?.id ?? tiers.find(item=>item.id==='default')?.id ?? tiers[0]?.id;
  return {providerId:preferred.providerId,model:model.model,reasoningLevel,serviceTier};
}

// 현재 환경에서 필요할 때만 목록을 읽고 확인한 선택만 호스트에 전달한다.
export function useFluidPicker(disabled:boolean, onError:(message:string)=>void) {
  const composer=useComposer(), sdk=useSdk(), directory=useProviders();
  const {scope,selection}=composer;
  const key=JSON.stringify([composer.key,scope,selection?.projectId,selection?.environment]);
  const current=useRef(key); current.current=key;
  const latest=useRef({disabled,selection}); latest.current={disabled:disabled || composer.isSubmitting,selection};
  const [stored,setStored]=useState<State>({key,open:false,draft:{},models:[],loading:false,applying:false,error:''});
  const state=stored.key===key ? stored : {key,open:false,draft:{},models:[],loading:false,applying:false,error:''};
  const stateRef=useRef(state); stateRef.current=state;
  const request=useRef<AbortController | null>(null), applying=useRef<string | null>(null);
  const cache=useRef(new Map<string,Catalog>()), route=useRef<Routing | null>(null);
  const choices=useRef(new Map<string,FluidPickerDraft>());
  const provider=directory.providers.find(item=>item.id===state.draft.providerId);
  const model=state.models.find(item=>item.model===state.draft.model);
  const tiers=fluidServiceTiers(model,provider);
  // 대화나 환경이 바뀌면 이전 목록과 요청을 무효화하며 닫힌 상태에서는 조회하지 않는다.
  useEffect(()=>{
    cache.current.clear(); choices.current.clear(); route.current=null;
    return ()=>{request.current?.abort(); if(current.current===key) current.current='';};
  },[key]);
  // 확인하지 않은 설정 화면을 닫고 진행 중인 목록 요청을 취소한다.
  const close=()=>{
    if(applying.current===key) return;
    request.current?.abort();
    setStored(previous=>({...previous,open:false,loading:false,error:''}));
  };
  // 입력 잠금과 음성 모드에서는 설정 화면을 닫는다.
  useEffect(()=>{if(disabled) close();},[disabled,key]);
  // 현재 대화 또는 새 입력에서 사용하는 실행 환경을 읽는다.
  const routing=async(signal:AbortSignal):Promise<Routing>=>{
    if(route.current) return route.current;
    let result:Routing;
    const projectId=selection?.projectId ?? (scope.kind==='new-thread' ? scope.projectId ?? undefined:undefined);
    if(scope.kind==='thread') {
      const thread=await sdk.threads.get({threadId:scope.threadId,signal});
      if(!thread.environmentId) throw Error('실행 환경이 없습니다.');
      result={environmentId:thread.environmentId};
    } else if(selection?.environment?.type==='reuse') result={environmentId:selection.environment.environmentId};
    else if(selection?.environment?.type==='host') result=selection.environment.hostId ? {hostId:selection.environment.hostId,projectId} : {projectId};
    else if(!selection?.environment || selection.environment.type==='project-default') result={projectId};
    else throw Error('이 실행 환경은 기존 모델 메뉴를 사용해 주세요.');
    if(!signal.aborted && current.current===key) route.current=result;
    return result;
  };
  // 공급자별 목록을 필요할 때 읽고 이전 응답과 중복 요청을 버린다.
  const load=async(providerId:string, preferred:FluidPickerDraft)=>{
    if(latest.current.disabled || applying.current===key) return;
    request.current?.abort();
    const controller=new AbortController(); request.current=controller;
    setStored({key,open:true,draft:{...preferred,providerId},models:[],loading:true,applying:false,error:''});
    try {
      let catalog=cache.current.get(providerId);
      if(!catalog) {
        const target=await routing(controller.signal);
        if(controller.signal.aborted || current.current!==key) return;
        catalog=await sdk.providers.models({...target,providerId,signal:controller.signal});
      }
      if(controller.signal.aborted || current.current!==key || latest.current.disabled) return;
      cache.current.set(providerId,catalog);
      const models=[...catalog.models];
      const selected=catalog.selectedOnlyModels?.find(item=>providerId===latest.current.selection?.providerId && item.model===latest.current.selection?.model);
      if(selected && !models.some(item=>item.model===selected.model)) models.push(selected);
      const chosen=models.find(item=>item.model===preferred.model || item.id===preferred.model) ?? models.find(item=>item.isDefault) ?? models[0];
      if(!chosen) throw Error('선택할 수 있는 모델이 없습니다.');
      const selectedProvider=directory.providers.find(item=>item.id===providerId);
      const draft=reconcile(chosen,{...preferred,providerId},fluidServiceTiers(chosen,selectedProvider));
      setStored({key,open:true,draft,models,loading:false,applying:false,error:''});
    } catch {
      if(!controller.signal.aborted && current.current===key) setStored(previous=>({...previous,loading:false,error:'모델 목록을 불러오지 못했습니다. 다시 시도하거나 기존 방식을 사용해 주세요.'}));
    }
  };
  // 열 때의 실제 선택을 읽고 작성 중인 본문은 바꾸지 않는다.
  const start=()=>{
    if(!latest.current.selection?.providerId || latest.current.disabled || scope.kind==='queued-message') return;
    void load(latest.current.selection.providerId,latest.current.selection);
  };
  // 공급자를 떠날 때 선택을 기억하고 다시 돌아오면 복구한다.
  const pickProvider=(providerId:string)=>{
    if(!stateRef.current.open) return;
    const {draft}=stateRef.current;
    if(draft.providerId) choices.current.set(draft.providerId,draft);
    void load(providerId,choices.current.get(providerId) ?? {...draft,providerId,model:undefined});
  };
  // 같은 목록의 모델을 고르고 노력 단계와 서비스 등급을 보정한다.
  const pickModel=(index:number)=>{
    if(!stateRef.current.open || latest.current.disabled || applying.current===key || !stateRef.current.models[index]) return;
    const chosen=stateRef.current.models[index]!;
    setStored(previous=>({...previous,draft:reconcile(chosen,previous.draft,fluidServiceTiers(chosen,provider))}));
  };
  // 지원하는 노력 단계만 확인 전 선택에 저장한다.
  const pickEffort=(reasoningLevel:string)=>{
    if(!stateRef.current.open || latest.current.disabled || applying.current===key || !model?.supportedReasoningEfforts.some(item=>item.reasoningEffort===reasoningLevel)) return;
    setStored(previous=>({...previous,draft:{...previous.draft,reasoningLevel}}));
  };
  // 실제 목록에 있는 서비스 등급만 확인 전 선택에 저장한다.
  const pickTier=(serviceTier:string)=>{
    if(!stateRef.current.open || latest.current.disabled || applying.current===key || !tiers.some(item=>item.id===serviceTier)) return;
    setStored(previous=>({...previous,draft:{...previous.draft,serviceTier}}));
  };
  // 확인한 값을 한 번만 보내고 공급자 변경은 기존 핸드오프 경로에 맡긴다.
  const confirm=async()=>{
    const snapshot=stateRef.current;
    if(latest.current.disabled || applying.current===key || snapshot.loading || !snapshot.open || !snapshot.draft.providerId || !snapshot.draft.model || snapshot.error) return;
    applying.current=key; setStored(previous=>({...previous,applying:true}));
    try {
      const chosen=snapshot.models.find(item=>item.model===snapshot.draft.model);
      const values={...snapshot.draft,providerId:chosen?.routeProviderId ?? snapshot.draft.providerId};
      const result=await composer.setSelection(values);
      if(current.current!==key) return;
      if(result.providerId!==values.providerId || result.model!==values.model) onError('호스트가 선택을 조정했습니다. 현재 모델은 기존 메뉴에서 확인해 주세요.');
      setStored(previous=>({...previous,open:false,applying:false,error:''}));
    } catch {
      if(current.current===key) { setStored(previous=>({...previous,applying:false})); onError('설정을 바꾸지 못했습니다. 다시 시도해 주세요.'); }
    } finally {if(applying.current===key) applying.current=null;}
  };
  return {state,selection,providers:directory.providers,model,tiers,start,close,load,pickProvider,pickModel,pickEffort,pickTier,confirm,
    canOpen:!!selection?.providerId && scope.kind!=='queued-message' && !disabled && !composer.isSubmitting,
    handoff:scope.kind==='thread' && state.draft.providerId!==selection?.providerId};
}
