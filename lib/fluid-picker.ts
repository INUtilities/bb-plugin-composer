import { LIGHT_GLASS_FACE, DARK_GLASS_FACE } from './glass-surface.ts';
import { EASE } from './motion.ts';
import { pillStyle } from './pill.ts';
import { FLUID_COMPOSER_SLOT_MS, FLUID_COMPOSER_INPUT_MS } from './fluid-composer-height.ts';

export const fluidPickerCss=`
[data-bb-chat-ui-slot-toolbar] { display:flex; align-items:center; gap:8px; margin-bottom:8px; min-width:0; }
[data-bb-chat-ui-slot-toolbar][data-shared-row] { flex:none; margin:0; }
[data-bb-chat-ui-slot-toolbar][hidden] { display:none !important; }
/* 채팅 여백의 높이만 이어서 바꾸고 입력창의 하단 위치는 유지한다. */
[data-promptbox-shell][data-bb-chat-ui-slot-picker-open]::before { content:""; display:block; height:0; pointer-events:none; transition:height ${FLUID_COMPOSER_SLOT_MS}ms ${EASE.out}; }
[data-promptbox-shell][data-bb-chat-ui-slot-picker-open="true"]::before { height:120px; }
[data-promptbox-shell][data-bb-chat-ui-slot-picker-open="true"] :is([data-bb-chat-ui-info-bar],[data-bb-chat-ui-slot-toolbar]) { opacity:0; pointer-events:none; transition:opacity 160ms ${EASE.exit}; }
[data-bb-chat-ui-slot-mode], [data-bb-chat-ui-slot-toolbar] > [data-bb-chat-ui-fluid-details-toggle] { ${pillStyle.navigation} min-height:32px; color:var(--foreground); background:${LIGHT_GLASS_FACE}; backdrop-filter:blur(14px) saturate(1.25); box-shadow:0 6px 18px -12px color-mix(in oklab,var(--foreground) 22%,transparent),inset 0 1px 3px color-mix(in oklab,var(--popover) 35%,transparent); }
.dark [data-bb-chat-ui-slot-mode], .dark [data-bb-chat-ui-slot-toolbar] > [data-bb-chat-ui-fluid-details-toggle] { background:${DARK_GLASS_FACE}; }
[data-bb-chat-ui-slot-mode][aria-pressed="true"] { color:var(--foreground); }
[data-bb-chat-ui-slot-mode] > span { font-size:inherit; opacity:.72; }
html[data-bb-chat-ui-root-device="phone"] [data-bb-chat-ui-slot-mode] { min-height:32px; font-size:13px; }
[data-bb-chat-ui-fluid-composer] { --bb-slot-row:40px; --bb-slot-font:13px; --bb-slot-icon:40px; }
html[data-bb-chat-ui-root-device="phone"] [data-bb-chat-ui-fluid-composer] { --bb-slot-row:44px; --bb-slot-font:14px; --bb-slot-icon:44px; }
[data-bb-chat-ui-slot-enabled] { isolation:isolate; }
[data-bb-chat-ui-slot-current-models] { display:contents; }
[data-bb-chat-ui-slot-current-models][hidden] { display:none !important; }
[data-bb-chat-ui-slot-submit] { position:relative; display:flex; flex:none; }
/* 휠은 바깥에 그리되 숨은 목록과 휠의 아래쪽이 부모 스크롤 범위를 늘리지 않게 한다. */
[data-bb-chat-ui-slot-overlay] { position:absolute; inset:0; contain:layout; overflow:clip; overflow-clip-margin:120px; pointer-events:none; }
[data-bb-chat-ui-fluid-composer] [data-bb-chat-ui-slot-trigger] { position:relative; display:flex; align-items:center; justify-content:center; width:var(--bb-chat-ui-fluid-control-size); height:var(--bb-chat-ui-fluid-control-size); min-width:var(--bb-chat-ui-fluid-control-size); padding:0; border-radius:999px; background:transparent; }
[data-bb-chat-ui-slot-fast-badge] { position:absolute; right:-2px; top:0; color:var(--brand,var(--ring)); pointer-events:none; }
[data-bb-chat-ui-slot-fast-badge] > svg { width:10px; height:10px; }
[data-bb-chat-ui-slot-open] :is([data-bb-chat-ui-fluid-editor],[data-bb-chat-ui-fluid-toggle],[data-bb-chat-ui-fluid-extra-actions],[data-bb-chat-ui-slot-submit] > [data-promptbox-submit-group],[data-bb-chat-ui-slot-trigger]) { visibility:hidden; pointer-events:none; }
[data-bb-chat-ui-fluid-composer] [data-bb-chat-ui-slot-confirm] { position:absolute; z-index:4; right:0; top:0; display:flex; align-items:center; justify-content:center; width:var(--bb-chat-ui-fluid-control-size); height:var(--bb-chat-ui-fluid-control-size); min-width:var(--bb-chat-ui-fluid-control-size); min-height:var(--bb-chat-ui-fluid-control-size); border:0; padding:0; border-radius:999px; background:var(--primary); color:var(--primary-foreground); cursor:pointer; }
[data-bb-chat-ui-slot-confirm]:disabled { opacity:.5; cursor:default; }
:is([data-bb-chat-ui-slot-layer],[data-bb-chat-ui-slot-backdrop]) { position:absolute; bottom:calc(8px + var(--bb-chat-ui-fluid-control-size)/2 - var(--bb-slot-row,40px)*2.5); height:calc(var(--bb-slot-row,40px)*5); }
[data-bb-chat-ui-slot-backdrop] { z-index:-1; left:-80px; right:-80px; height:calc(var(--bb-slot-row,40px)*5 + 80px); bottom:calc(8px + var(--bb-chat-ui-fluid-control-size)/2 - var(--bb-slot-row,40px)*2.5 - 40px); border-radius:48px; pointer-events:none; opacity:0; transform:scaleY(.3); background:radial-gradient(ellipse at center,color-mix(in oklab,var(--bb-chat-ui-glass-base,var(--background)) 82%,transparent) 35%,transparent 90%); backdrop-filter:blur(14px) saturate(1.25); -webkit-backdrop-filter:blur(14px) saturate(1.25); mask-image:radial-gradient(ellipse at center,black 45%,transparent 90%); -webkit-mask-image:radial-gradient(ellipse at center,black 45%,transparent 90%); transition:opacity 200ms ${EASE.exit},transform 240ms ${EASE.exit}; }
/* 하단에 한 장을 유지하고 슬롯을 열면 위쪽 경계를 부드럽게 올린다. */
[data-bb-chat-ui-slot-backdrop][data-full-width] { left:0; right:0; bottom:0; height:120px; border-radius:0; opacity:1; transform:none; transition:height ${FLUID_COMPOSER_SLOT_MS}ms ${EASE.out}; background:color-mix(in oklab,var(--bb-chat-ui-glass-base,var(--background)) 82%,transparent); mask-image:linear-gradient(to bottom,transparent,black 50%); -webkit-mask-image:linear-gradient(to bottom,transparent,black 50%); }
[data-bb-chat-ui-slot-backdrop][data-open] { opacity:1; transform:none; transition:opacity ${FLUID_COMPOSER_SLOT_MS}ms ${EASE.out},transform ${FLUID_COMPOSER_SLOT_MS}ms ${EASE.out}; }
[data-bb-chat-ui-slot-backdrop][data-full-width][data-open] { height:240px; transition:height ${FLUID_COMPOSER_SLOT_MS}ms ${EASE.out}; }
[data-bb-chat-ui-slot-layer] { z-index:3; left:8px; right:calc(16px + var(--bb-chat-ui-fluid-control-size)); pointer-events:none; visibility:hidden; --bb-slot-open:0; transition:visibility 0s linear ${FLUID_COMPOSER_SLOT_MS}ms; }
[data-bb-chat-ui-slot-layer][data-open] { --bb-slot-open:1; visibility:visible; pointer-events:auto; transition:visibility 0s; }
[data-bb-chat-ui-slot-reels] { display:grid; grid-template-columns:var(--bb-slot-icon,40px) minmax(0,var(--bb-chat-ui-slot-model-fr,1.25fr)) minmax(0,var(--bb-chat-ui-slot-effort-fr,1fr)) var(--bb-slot-fast-width,0px); grid-template-rows:minmax(0,1fr); height:100%; transition:grid-template-columns ${FLUID_COMPOSER_INPUT_MS}ms ${EASE.out}; }
[data-bb-chat-ui-slot-reels][data-fast] { --bb-slot-fast-width:calc(var(--bb-chat-ui-fluid-control-size) + var(--bb-slot-fast-peek-width,0px)); }
[data-bb-chat-ui-slot-wheel] { position:relative; min-width:0; height:100%; border-radius:14px; outline:none; }
[data-bb-chat-ui-slot-wheel]:focus-visible { box-shadow:inset 0 0 0 2px var(--ring); }
[data-bb-chat-ui-slot-scroll] { width:100%; height:100%; overflow-y:auto; overflow-anchor:none; overscroll-behavior:contain; scrollbar-width:none; scroll-snap-type:y mandatory; padding-block:calc(var(--bb-slot-row)*2); perspective:420px; touch-action:pan-y; cursor:grab; }
[data-bb-chat-ui-slot-scroll]::-webkit-scrollbar { display:none; }
[data-bb-chat-ui-slot-scroll][data-dragging] { scroll-snap-type:none; cursor:grabbing; }
[data-bb-chat-ui-slot-wheel][aria-disabled="true"] [data-bb-chat-ui-slot-scroll] { overflow:hidden; pointer-events:none; }
[data-bb-chat-ui-slot-item] { height:var(--bb-slot-row); padding:0 6px; scroll-snap-align:center; font-size:var(--bb-slot-font); line-height:20px; white-space:nowrap; color:var(--foreground); user-select:none; -webkit-user-select:none; cursor:pointer; }
[data-bb-chat-ui-slot-item-face] { display:flex; align-items:center; justify-content:center; gap:5px; height:100%; transform-origin:center; animation:bb-chat-ui-slot-exit ${FLUID_COMPOSER_SLOT_MS}ms ${EASE.exit}; opacity:calc(var(--bb-slot-opacity,1)*var(--bb-slot-open)); transform:translateY(calc(var(--bb-slot-distance,0)*var(--bb-slot-row)*(var(--bb-slot-open) - 1))) rotateX(calc(var(--bb-slot-distance,0)* -20deg)) scale(var(--bb-slot-scale,1)); }
/* 열기·닫기만 직접 보간하고 열린 휠의 실제 스크롤 위치는 즉시 따른다. */
@keyframes bb-chat-ui-slot-enter {
 from { opacity:0; transform:translateY(calc(var(--bb-slot-distance,0)*var(--bb-slot-row)* -1)) rotateX(calc(var(--bb-slot-distance,0)* -20deg)) scale(var(--bb-slot-scale,1)); }
 to { opacity:var(--bb-slot-opacity,1); transform:translateY(0) rotateX(calc(var(--bb-slot-distance,0)* -20deg)) scale(var(--bb-slot-scale,1)); }
}
@keyframes bb-chat-ui-slot-exit {
 from { opacity:var(--bb-slot-opacity,1); transform:translateY(0) rotateX(calc(var(--bb-slot-distance,0)* -20deg)) scale(var(--bb-slot-scale,1)); }
 to { opacity:0; transform:translateY(calc(var(--bb-slot-distance,0)*var(--bb-slot-row)* -1)) rotateX(calc(var(--bb-slot-distance,0)* -20deg)) scale(var(--bb-slot-scale,1)); }
}
[data-bb-chat-ui-slot-layer][data-open] [data-bb-chat-ui-slot-item-face] { animation:bb-chat-ui-slot-enter ${FLUID_COMPOSER_SLOT_MS}ms ${EASE.out}; }
[data-bb-chat-ui-slot-item][aria-selected="true"] { font-weight:600; }
[data-bb-chat-ui-slot-item-face] > :is(svg,img) { flex:none; }
[data-bb-chat-ui-slot-item-face] > span:last-child { min-width:0; overflow:hidden; text-overflow:ellipsis; }
[data-bb-chat-ui-slot-model] { position:relative; display:flex; align-items:center; min-width:0; min-height:0; height:100%; }
[data-bb-chat-ui-slot-model] > [data-bb-chat-ui-slot-wheel] { width:100%; }
[data-bb-chat-ui-slot-fast] { position:relative; align-self:center; display:flex; align-items:center; justify-content:flex-start; gap:0; width:100%; height:var(--bb-chat-ui-fluid-control-size); border:0; padding:0 calc((var(--bb-chat-ui-fluid-control-size) - 14px)/2); box-sizing:border-box; border-radius:8px; color:var(--muted-foreground); background:transparent; cursor:pointer; opacity:var(--bb-slot-open); transform:translateY(calc((1 - var(--bb-slot-open))*8px)); }
[data-bb-chat-ui-slot-fast][aria-pressed="true"] { color:var(--brand,var(--ring)); }
[data-bb-chat-ui-slot-fast] { transition:gap ${FLUID_COMPOSER_INPUT_MS}ms ${EASE.out},opacity ${FLUID_COMPOSER_SLOT_MS}ms ${EASE.exit},transform ${FLUID_COMPOSER_SLOT_MS}ms ${EASE.exit}; }
[data-bb-chat-ui-slot-layer][data-open] [data-bb-chat-ui-slot-fast] { transition-timing-function:${EASE.out}; }
[data-bb-chat-ui-slot-fast] > svg { flex:none; }
[data-bb-chat-ui-slot-fast-label] { display:inline-flex; flex:none; max-width:0; overflow:clip; font-size:calc(var(--bb-slot-font) - 1px); line-height:16px; white-space:nowrap; color:color-mix(in oklab,var(--muted-foreground) 72%,transparent); pointer-events:none; opacity:0; transform:scale(.92); transform-origin:left center; transition:max-width ${FLUID_COMPOSER_INPUT_MS}ms ${EASE.out},opacity ${FLUID_COMPOSER_INPUT_MS}ms ease,transform ${FLUID_COMPOSER_INPUT_MS}ms ease; }
[data-bb-chat-ui-slot-fast][data-peek] { gap:6px; }
[data-bb-chat-ui-slot-fast][data-peek] [data-bb-chat-ui-slot-fast-label] { max-width:70px; opacity:1; transform:scale(1); }
[data-bb-chat-ui-slot-fast-tooltip] { position:absolute; bottom:calc(100% + 6px); left:50%; width:max-content; padding:4px 8px; border-radius:999px; font-size:12px; line-height:16px; color:var(--foreground); background:${LIGHT_GLASS_FACE}; backdrop-filter:blur(14px) saturate(1.25); pointer-events:none; opacity:0; visibility:hidden; transform:translate(-50%,4px); transition:opacity 160ms ${EASE.out},transform 160ms ${EASE.out}; }
.dark [data-bb-chat-ui-slot-fast-tooltip] { background:${DARK_GLASS_FACE}; }
@media (hover:hover) { [data-bb-chat-ui-slot-fast]:hover:not([data-peek]):not(:disabled) [data-bb-chat-ui-slot-fast-tooltip] { opacity:1; visibility:visible; transform:translate(-50%,0); } }
[data-bb-chat-ui-slot-fast]:focus-visible:not([data-peek]) [data-bb-chat-ui-slot-fast-tooltip] { opacity:1; visibility:visible; transform:translate(-50%,0); }
:is([data-bb-chat-ui-slot-fast],[data-bb-chat-ui-slot-confirm]):focus-visible { outline:2px solid var(--ring); outline-offset:2px; }
[data-bb-chat-ui-slot-status] { grid-column:2 / span 2; align-self:center; max-height:120px; overflow:auto; padding:8px; font-size:12px; line-height:18px; color:var(--muted-foreground); }
[data-bb-chat-ui-slot-status] > button { display:block; margin-top:8px; border:0; border-radius:8px; padding:4px 8px; background:var(--state-hover); color:var(--foreground); font:inherit; cursor:pointer; }
@media (prefers-reduced-motion:reduce) { [data-bb-chat-ui-slot-layer],[data-bb-chat-ui-slot-reels],[data-bb-chat-ui-slot-backdrop],[data-bb-chat-ui-slot-fast],[data-bb-chat-ui-slot-fast-label],[data-bb-chat-ui-slot-fast-tooltip],[data-promptbox-shell][data-bb-chat-ui-slot-picker-open]::before { transition:none !important; } [data-bb-chat-ui-slot-item-face] { animation:none !important; } }
`;
