import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { staggerIn } from '../lib/motion';

const BAR = '[data-bb-chat-ui-info-bar]';
const SCROLL_ROW = 'data-bb-chat-ui-info-scroll-row';
const WIDTH = '--bb-chat-ui-fluid-toolbar-width';
type SharedRow = {kind:'legacy'; bar:HTMLElement} | {kind:'scroll'; bar:HTMLElement; leading:HTMLElement; track:HTMLElement};

// 정보 버튼은 왼쪽에 고정하고 나머지 필은 스크롤 줄에 연결한다.
export function FluidComposerToolbar({hidden=false,inactive=false,leading,children}:{hidden?:boolean;inactive?:boolean;leading?:ReactNode;children:ReactNode}) {
  const anchor=useRef<HTMLSpanElement>(null), toolbar=useRef<HTMLDivElement>(null), leadingToolbar=useRef<HTMLDivElement>(null);
  const binding=useRef<{shell:Element;stop():void}|null>(null);
  const [target,setTarget]=useState<SharedRow|null>(null);
  // 이 컴포저에서 정보 행의 생성·교체·숨김만 확인하며 입력 내용은 탐색하지 않는다.
  useLayoutEffect(()=>{
    const shell=anchor.current?.closest('[data-promptbox-shell]') ?? anchor.current?.closest('form');
    if(binding.current?.shell===shell) return;
    binding.current?.stop();binding.current=null;
    if(!shell) return;
    // 현재 보이는 같은 컴포저의 정보 행만 연결 대상으로 고른다.
    const sync=()=>{
      const bar=shell.querySelector<HTMLElement>(BAR);
      if(!bar || bar.hidden) {setTarget(null);return;}
      const start=bar.querySelector<HTMLElement>('[data-bb-chat-ui-info-leading]');
      const track=bar.querySelector<HTMLElement>('[data-bb-chat-ui-info-scroll-track]');
      const next:SharedRow=bar.hasAttribute(SCROLL_ROW) && start && track
        ? {kind:'scroll',bar,leading:start,track} : {kind:'legacy',bar};
      setTarget(current=>current?.bar===bar && current.kind===next.kind ? current : next);
    };
    sync();
    const observer=new MutationObserver(records=>{
      if(records.some(record=>record.type==='attributes' ? (record.target as Element).matches(BAR)
        : [...record.addedNodes,...record.removedNodes].some(node=>node instanceof Element && (node.matches(BAR)||node.querySelector(BAR))))) sync();
    });
    observer.observe(shell,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden',SCROLL_ROW]});
    binding.current={shell,stop:()=>observer.disconnect()};
  });
  // 시각적으로 숨긴 정보 행도 키보드 대상에서 제외하며 빌리기 전 상태를 복구한다.
  useLayoutEffect(()=>{
    const bar=target?.bar;
    if(!bar || !inactive) return;
    const previous=bar.getAttribute('inert');bar.setAttribute('inert','');
    return ()=>{if(previous===null)bar.removeAttribute('inert');else bar.setAttribute('inert',previous);};
  },[target,inactive]);
  // 해제와 StrictMode 재연결에서 로컬 관찰을 정리한다.
  useLayoutEffect(()=>()=>{binding.current?.stop();binding.current=null;},[]);
  // 구형 정보 행만 폭을 예약한다. 새 행은 고정 버튼과 스크롤 줄의 폭을 CSS로 나눈다.
  useLayoutEffect(()=>{
    const node=toolbar.current;
    if(!node || hidden) return;
    const legacyBar=target?.kind==='legacy' ? target.bar : null;
    const previous=legacyBar?.style.getPropertyValue(WIDTH);
    let observer:ResizeObserver|undefined;
    if(legacyBar){
      const reserveWidth=()=>{
        const width=String(node.offsetWidth+8);
        if(legacyBar.style.getPropertyValue(WIDTH)===width) return;
        legacyBar.style.setProperty(WIDTH,width);
        legacyBar.dispatchEvent(new Event('bb-chat-ui:composer-data',{bubbles:true}));
      };
      reserveWidth();
      const ResizeObserver=node.ownerDocument.defaultView?.ResizeObserver;
      if(ResizeObserver){
        observer=new ResizeObserver(reserveWidth);
        observer.observe(node);
      }
    }
    const controls=[...Array.from(leadingToolbar.current?.children ?? []),...Array.from(node.children)];
    const animations=staggerIn(controls).filter((animation):animation is Animation=>!!animation);
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    // 동작 줄이기는 현재 필의 등장도 즉시 마친다.
    const reduce=()=>{if(motion.matches)for(const animation of animations)animation.cancel();};
    motion.addEventListener('change',reduce);
    return ()=>{
      observer?.disconnect();
      for(const animation of animations)animation.cancel();motion.removeEventListener('change',reduce);
      if(legacyBar){if(previous)legacyBar.style.setProperty(WIDTH,previous);else legacyBar.style.removeProperty(WIDTH);legacyBar.dispatchEvent(new Event('bb-chat-ui:composer-data',{bubbles:true}));}
    };
  },[target,hidden]);
  const toolbarProps={'data-bb-chat-ui-slot-toolbar':'','data-shared-row':!!target || undefined,hidden,inert:inactive || undefined};
  const content=<div ref={toolbar} {...toolbarProps}>{target?.kind!=='scroll' && leading}{children}</div>;
  return <><span ref={anchor} hidden/>{target?.kind==='scroll'
    ? <>{createPortal(<div ref={leadingToolbar} {...toolbarProps}>{leading}</div>,target.leading)}{createPortal(content,target.track)}</>
    : target ? createPortal(content,target.bar) : content}</>;
}
