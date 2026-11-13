const BARS='[data-bb-chat-ui-info-bar], [data-bb-chat-ui-slot-toolbar]';

// 같은 컴포저의 표시 중인 필을 한 번씩, 화면의 DOM 순서로 고른다.
export function fluidOptionPills(root:Element) {
  const shell=root.closest('[data-promptbox-shell]') ?? root.closest('form');
  const bars=Array.from(shell?.querySelectorAll<HTMLElement>(BARS) ?? []);
  const pills=bars.flatMap(bar=>Array.from(bar.children).flatMap(child=>child.hasAttribute('data-bb-chat-ui-slot-toolbar') ? []
    : (child as HTMLElement).style.display==='contents' ? Array.from(child.children):[child]))
    .filter((pill):pill is HTMLElement=>pill instanceof HTMLElement && !pill.closest('[hidden]') && getComputedStyle(pill).display!=='none');
  return {shell,bars,pills};
}

// 퇴장과 다음 필 등장을 같은 간격으로 연결한다. 빈 행은 기다리지 않는다.
export function fluidOptionStaggerDuration(count:number,duration:number) {
  return count ? duration+(count-1)*45 : 0;
}

// 원래 필의 마지막 복귀 프레임까지 옵션 패널의 스타일·비활성 소유권을 보관한다.
export function fluidOptionCloseDuration(root:Element) {
  const count=root.querySelectorAll('[role="menuitem"]').length;
  return fluidOptionStaggerDuration(count,200)+fluidOptionStaggerDuration(fluidOptionPills(root).pills.length,460);
}
