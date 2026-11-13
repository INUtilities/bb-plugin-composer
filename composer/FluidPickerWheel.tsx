import { useCallback, useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';

export type FluidWheelItem = {key:string; label:string; icon?:ReactNode; iconOnly?:boolean};

// 기본 터치 스크롤과 마우스·키보드 선택으로 가운데 칸을 고른다.
export function FluidPickerWheel({label,items,index,onPick,rowSize,disabled=false}:{
  label:string; items:FluidWheelItem[]; index:number; onPick(index:number,trusted:boolean):void; rowSize:number; disabled?:boolean;
}) {
  const scroller=useRef<HTMLDivElement>(null), id=useId();
  const latest=useRef({index,items,onPick,disabled}); latest.current={index,items,onPick,disabled};
  const frame=useRef(0), timer=useRef(0), clickTimer=useRef(0), suppress=useRef(false);
  const scrollTrusted=useRef(false), userScroll=useRef(false);
  const previous=useRef<{keys:string;index:number;disabled:boolean} | null>(null);
  const drag=useRef<{id:number; y:number; top:number; moving:boolean} | null>(null);
  const keys=items.map(item=>item.key).join('|')+':'+rowSize;
  // 가운데와 떨어진 거리를 CSS에 전달하며 새 프레임 반복은 만들지 않는다.
  const paint=useCallback(()=>{
    frame.current=0;
    const element=scroller.current;
    if(!element) return;
    const position=element.scrollTop/rowSize;
    for(const [index,option] of element.querySelectorAll<HTMLElement>('[role="option"]').entries()) {
      const distance=Math.max(-3,Math.min(3,index-position));
      option.style.setProperty('--bb-slot-distance',distance.toFixed(3));
      option.style.setProperty('--bb-slot-opacity',String(Math.max(.08,1-Math.abs(distance)*.55)));
      option.style.setProperty('--bb-slot-scale',String(1-Math.abs(distance)*.05));
    }
  },[rowSize]);
  // 지원 범위 안의 새 항목만 선택한다.
  const pick=useCallback((value:number,trusted=false)=>{
    const current=latest.current, next=Math.max(0,Math.min(current.items.length-1,value));
    if(!current.disabled && current.items[next] && next!==current.index) current.onPick(next,trusted);
  },[]);
  // 스크롤이 멈춘 칸을 선택하고 이미 선택한 칸의 잔여 오차를 맞춘다.
  const settle=useCallback(()=>{
    clearTimeout(timer.current);
    const element=scroller.current;
    if(!element || drag.current || latest.current.disabled || !userScroll.current) return;
    userScroll.current=false;
    const next=Math.max(0,Math.min(latest.current.items.length-1,Math.round(element.scrollTop/rowSize)));
    if(next!==latest.current.index) pick(next,scrollTrusted.current);
    else if(Math.abs(element.scrollTop-next*rowSize)>1) {
      if(element.scrollTo) element.scrollTo({top:next*rowSize,behavior:'auto'});
      else element.scrollTop=next*rowSize;
    }
  },[pick,rowSize]);
  // 열린 같은 목록의 선택은 부드럽게 옮기고 목록·열림 변경은 즉시 맞춘다.
  useLayoutEffect(()=>{
    const element=scroller.current;
    if(!element) return;
    const before=previous.current;
    previous.current={keys,index,disabled};
    const animate=before && before.keys===keys && !before.disabled && !disabled && before.index!==index
      && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    userScroll.current=false;
    const top=index*rowSize;
    if(element.scrollTo) element.scrollTo({top,behavior:animate ? 'smooth':'instant'});
    else element.scrollTop=top;
    paint();
  },[index,keys,paint,rowSize,disabled]);
  // 스크롤 종료와 동작 줄이기 변경을 처리하고 예약 작업을 정리한다.
  useEffect(()=>{
    const element=scroller.current, motion=matchMedia('(prefers-reduced-motion: reduce)');
    // 동작 줄이기를 켜면 진행 중 스크롤을 선택 위치에서 마친다.
    const reduce=()=>{
      if(motion.matches && element){
        const top=latest.current.index*rowSize;
        if(element.scrollTo) element.scrollTo({top,behavior:'instant'});
        else element.scrollTop=top;
        paint();
      }
    };
    // 브라우저가 보정한 마지막 위치도 다시 그리되 자동 스크롤은 선택하지 않는다.
    const end=()=>{paint();settle();};
    element?.addEventListener('scrollend',end); motion.addEventListener('change',reduce);
    return ()=>{
      element?.removeEventListener('scrollend',end); motion.removeEventListener('change',reduce);
      cancelAnimationFrame(frame.current);clearTimeout(timer.current);clearTimeout(clickTimer.current);drag.current=null;
    };
  },[settle,paint,rowSize]);
  // 끌기를 마치고 바로 이어지는 클릭 한 번만 막는다.
  const release=(event:React.PointerEvent<HTMLDivElement>,click:boolean)=>{
    const state=drag.current;
    if(state?.id!==event.pointerId) return;
    drag.current=null; event.currentTarget.removeAttribute('data-dragging');
    if(state.moving && click) {suppress.current=true;clearTimeout(clickTimer.current);clickTimer.current=window.setTimeout(()=>{suppress.current=false;},0);}
    settle();
  };
  return <div role="listbox" aria-label={label} tabIndex={disabled ? -1:0} aria-disabled={disabled || undefined}
    aria-activedescendant={items[index] ? `${id}-${index}`:undefined} data-bb-chat-ui-slot-wheel=""
    onKeyDown={event=>{
      if(['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();return;}
      const delta=({ArrowUp:-1,ArrowDown:1,PageUp:-3,PageDown:3} as Record<string,number>)[event.key];
      if(delta){event.preventDefault();pick(latest.current.index+delta,event.nativeEvent.isTrusted);}
      else if(event.key==='Home'){event.preventDefault();pick(0,event.nativeEvent.isTrusted);}
      else if(event.key==='End'){event.preventDefault();pick(latest.current.items.length-1,event.nativeEvent.isTrusted);}
    }}>
    <div ref={scroller} data-bb-chat-ui-slot-scroll="" onScroll={event=>{
      scrollTrusted.current=event.nativeEvent.isTrusted;
      if(!frame.current) frame.current=requestAnimationFrame(paint);
      if(userScroll.current) {clearTimeout(timer.current);timer.current=window.setTimeout(settle,140);}
    }} onWheelCapture={()=>{if(!disabled) userScroll.current=true;}} onPointerDown={event=>{
      if(disabled) return;
      userScroll.current=true;
      if(event.pointerType!=='mouse' || event.button!==0) return;
      drag.current={id:event.pointerId,y:event.clientY,top:event.currentTarget.scrollTop,moving:false};
    }} onPointerMove={event=>{
      const state=drag.current;
      if(state?.id!==event.pointerId || disabled) return;
      if(!state.moving){
        if(Math.abs(event.clientY-state.y)<=4) return;
        state.moving=true;event.currentTarget.setPointerCapture?.(event.pointerId);event.currentTarget.setAttribute('data-dragging','');
      }
      event.currentTarget.scrollTop=state.top-(event.clientY-state.y);
    }} onPointerUp={event=>release(event,true)} onPointerCancel={event=>release(event,false)}
      onLostPointerCapture={event=>release(event,false)} onPointerLeave={event=>{if(drag.current && !drag.current.moving) release(event,false);}}>
      {items.map((item,i)=><div key={item.key} id={`${id}-${i}`} role="option" aria-selected={i===index}
        aria-label={item.iconOnly ? item.label:undefined} title={item.label} data-bb-chat-ui-slot-item=""
        onClick={event=>{if(suppress.current){suppress.current=false;return;}pick(i,event.nativeEvent.isTrusted);}}>
        <span data-bb-chat-ui-slot-item-face="">{item.icon}{item.iconOnly ? null:<span>{item.label}</span>}</span>
      </div>)}
    </div>
  </div>;
}
