import { dropletIn, EASE } from './motion.ts';

const BARS='[data-bb-chat-ui-info-bar], [data-bb-chat-ui-slot-toolbar]';
const SCROLL_TRACK='[data-bb-chat-ui-info-scroll-track]';
export const FLUID_COMPOSER='[data-bb-chat-ui-fluid-composer]';
const STEP=45, EXIT=200, ENTER=460;

type PillFrame = {opacity:number;transform:string};

// 두 목록의 퇴장과 등장이 중간 프레임에서 이어지도록 현재 모양을 기록한다.
export function readFluidPillFrames(items:readonly HTMLElement[]) {
  return new Map(items.map(item => {
    const style=getComputedStyle(item), opacity=Number.parseFloat(style.opacity);
    return [item,{opacity:Number.isFinite(opacity)?opacity:1,transform:style.transform || 'none'}];
  }));
}

// 옵션과 메타정보에 같은 순차 페이드와 물방울 효과를 적용한다.
export function animateFluidPillSwap(leaving:readonly HTMLElement[], arriving:readonly HTMLElement[], resting:ReadonlyMap<Element,number>, previous:ReadonlyMap<Element,PillFrame>, restore:boolean) {
  const exits=leaving.flatMap((item,index) => {
    const opacity=previous.get(item)?.opacity ?? resting.get(item) ?? 1;
    const transform=previous.get(item)?.transform ?? 'none';
    const animation=item.animate?.([{opacity,transform},{opacity:0,transform}],{duration:EXIT,delay:index*STEP,easing:EASE.exit,fill:'both'});
    return animation ? [animation] : [];
  });
  const delay=fluidOptionStaggerDuration(leaving.length,EXIT);
  const arrivals=arriving.flatMap((item,index) => {
    const animation=dropletIn(item,{delay:delay+index*STEP});
    const effect=animation?.effect;
    const snapshot=previous.get(item), opacity=resting.get(item) ?? 1;
    if (effect && 'getKeyframes' in effect && typeof effect.getKeyframes==='function'
      && 'setKeyframes' in effect && typeof effect.setKeyframes==='function') {
      const frames:ComputedKeyframe[]=effect.getKeyframes();
      effect.setKeyframes(frames.map((frame,index)=>({
        ...frame,opacity:index===0 ? snapshot?.opacity ?? 0:opacity,
        ...(index===0 && snapshot && snapshot.opacity>0 ? {transform:snapshot.transform}:{}),
      })));
    }
    if (restore) effect?.updateTiming?.({fill:'both'});
    return animation ? [animation] : [];
  });
  return {exits,arrivals};
}

// 컴포저 위에 정보 행이 있으면 옵션 목록을 같은 높이에 맞춘다.
export function bindFluidPillRow(row:HTMLElement, composer:HTMLElement) {
  const shell=composer.closest('[data-promptbox-shell]') ?? composer;
  const view=row.ownerDocument.defaultView;
  let anchor:HTMLElement|null=null;
  const observer=view?.ResizeObserver ? new view.ResizeObserver(() => align()) : undefined;
  // 표시 중인 정보 행의 가운데를 옵션 목록 배치에 사용한다.
  function align() {
    const next=Array.from(shell.querySelectorAll<HTMLElement>(BARS))
      .find(bar=>bar.getBoundingClientRect().height>0) ?? null;
    if (next!==anchor) {
      if (anchor) observer?.unobserve(anchor);
      anchor=next;
      if (anchor) observer?.observe(anchor);
    }
    if (!anchor) {
      row.style.removeProperty('--bb-chat-ui-pill-row-center');
      row.removeAttribute('data-bb-chat-ui-pill-row-positioned');
      return;
    }
    const level=anchor.getBoundingClientRect();
    const parent=row.offsetParent ?? composer;
    const frame=parent.getBoundingClientRect();
    row.style.setProperty('--bb-chat-ui-pill-row-center',(level.top+level.height/2-frame.top-parent.clientTop+parent.scrollTop)+'px');
    row.setAttribute('data-bb-chat-ui-pill-row-positioned','');
  }
  observer?.observe(composer);
  observer?.observe(shell);
  shell.addEventListener('bb-chat-ui:composer-data',align);
  view?.addEventListener('resize',align);
  align();
  return () => {
    observer?.disconnect();
    shell.removeEventListener('bb-chat-ui:composer-data',align);
    view?.removeEventListener('resize',align);
    row.style.removeProperty('--bb-chat-ui-pill-row-center');
    row.removeAttribute('data-bb-chat-ui-pill-row-positioned');
  };
}

// 같은 컴포저의 표시 중인 필을 한 번씩, 화면의 DOM 순서로 고른다.
export function fluidOptionPills(root:Element) {
  const shell=root.closest('[data-promptbox-shell]') ?? root.closest('form');
  const bars=Array.from(shell?.querySelectorAll<HTMLElement>(BARS) ?? []);
  const rowItems=bars.flatMap(bar=>Array.from(bar.children).flatMap(child=>child.matches('[data-bb-chat-ui-info-scroll-rail]')
    ? Array.from(child.querySelector(SCROLL_TRACK)?.children ?? []) : [child]));
  const pills=rowItems.flatMap(child=>{
    if (child.matches('[data-bb-chat-ui-slot-toolbar], [data-bb-chat-ui-info-leading]')) return [];
    return child instanceof HTMLElement && child.style.display==='contents' ? Array.from(child.children) : [child];
  })
    .filter((pill):pill is HTMLElement=>pill instanceof HTMLElement && !pill.closest('[hidden]') && getComputedStyle(pill).display!=='none');
  return {shell,bars,pills};
}

// 퇴장과 다음 필 등장을 같은 간격으로 연결한다. 빈 행은 기다리지 않는다.
export function fluidOptionStaggerDuration(count:number,duration:number) {
  return count ? duration+(count-1)*STEP : 0;
}

// 원래 필의 마지막 복귀 프레임까지 옵션 패널의 스타일·비활성 소유권을 보관한다.
export function fluidOptionCloseDuration(root:Element) {
  const count=root.querySelectorAll('[role="menuitem"]').length;
  return fluidPillReturnDuration(count,fluidOptionPills(root).pills.length);
}

// 마지막 복귀 필까지 현재 행의 표시 상태를 유지한다.
export function fluidPillReturnDuration(leaving:number, arriving:number) {
  return fluidOptionStaggerDuration(leaving,EXIT)+fluidOptionStaggerDuration(arriving,ENTER);
}

// 원래 컨트롤은 마지막 퇴장이 끝나면 클릭을 받을 수 있다.
export function fluidPillExitDuration(count:number) {
  return fluidOptionStaggerDuration(count,EXIT);
}
