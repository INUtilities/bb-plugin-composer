import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { staggerIn } from '../lib/motion';

const BAR = '[data-bb-chat-ui-info-bar]';
const WIDTH = '--bb-chat-ui-fluid-toolbar-width';

// 기존 정보 행에 임시 필을 연결하고 정보 행이 없을 때만 원래 자리를 쓴다.
export function FluidComposerToolbar({hidden=false,children}:{hidden?:boolean;children:ReactNode}) {
  const anchor=useRef<HTMLSpanElement>(null), toolbar=useRef<HTMLDivElement>(null);
  const binding=useRef<{shell:Element;stop():void}|null>(null);
  const [target,setTarget]=useState<HTMLElement|null>(null);
  // 이 컴포저에서 정보 행의 생성·교체·숨김만 확인하며 입력 내용은 탐색하지 않는다.
  useLayoutEffect(()=>{
    const shell=anchor.current?.closest('[data-promptbox-shell]') ?? anchor.current?.closest('form');
    if(binding.current?.shell===shell) return;
    binding.current?.stop();binding.current=null;
    if(!shell) return;
    // 현재 보이는 같은 컴포저의 정보 행만 연결 대상으로 고른다.
    const sync=()=>{const bar=shell.querySelector<HTMLElement>(BAR);setTarget(bar && !bar.hidden ? bar:null);};
    sync();
    const observer=new MutationObserver(records=>{
      if(records.some(record=>record.type==='attributes' ? (record.target as Element).matches(BAR)
        : [...record.addedNodes,...record.removedNodes].some(node=>node instanceof Element && (node.matches(BAR)||node.querySelector(BAR))))) sync();
    });
    observer.observe(shell,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
    binding.current={shell,stop:()=>observer.disconnect()};
  });
  // 해제와 StrictMode 재연결에서 로컬 관찰을 정리한다.
  useLayoutEffect(()=>()=>{binding.current?.stop();binding.current=null;},[]);
  // 기존 행의 가용 폭을 예약하고 같은 460ms·45ms 물방울 효과를 연결한다.
  useLayoutEffect(()=>{
    const node=toolbar.current;
    if(!node || hidden) return;
    const previous=target?.style.getPropertyValue(WIDTH);
    if(target){target.style.setProperty(WIDTH,String(node.offsetWidth+8));target.dispatchEvent(new Event('bb-chat-ui:composer-data',{bubbles:true}));}
    const animations=staggerIn(node.children).filter((animation):animation is Animation=>!!animation);
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    // 동작 줄이기는 현재 필의 등장도 즉시 마친다.
    const reduce=()=>{if(motion.matches)for(const animation of animations)animation.cancel();};
    motion.addEventListener('change',reduce);
    return ()=>{
      for(const animation of animations)animation.cancel();motion.removeEventListener('change',reduce);
      if(target){if(previous)target.style.setProperty(WIDTH,previous);else target.style.removeProperty(WIDTH);target.dispatchEvent(new Event('bb-chat-ui:composer-data',{bubbles:true}));}
    };
  },[target,hidden]);
  const content=<div ref={toolbar} data-bb-chat-ui-slot-toolbar="" data-shared-row={!!target || undefined} hidden={hidden}>{children}</div>;
  return <><span ref={anchor} hidden/>{target ? createPortal(content,target):content}</>;
}
