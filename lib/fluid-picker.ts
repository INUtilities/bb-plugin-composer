import { LIGHT_GLASS_FACE, DARK_GLASS_FACE } from './glass-surface.ts';
import { EASE } from './motion.ts';
import { pillStyle } from './pill.ts';

export const fluidPickerCss=`
@property --bb-slot-open { syntax:"<number>"; inherits:true; initial-value:0; }
[data-bb-chat-ui-slot-toolbar] { display:flex; align-items:center; gap:8px; margin-bottom:8px; min-width:0; }
[data-bb-chat-ui-slot-toolbar][data-shared-row] { flex:none; margin:0; }
[data-bb-chat-ui-slot-toolbar][hidden] { display:none !important; }
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
[data-bb-chat-ui-fluid-composer] [data-bb-chat-ui-slot-trigger] { position:relative; display:flex; align-items:center; justify-content:center; width:var(--bb-chat-ui-fluid-control-size); height:var(--bb-chat-ui-fluid-control-size); min-width:var(--bb-chat-ui-fluid-control-size); padding:0; border-radius:999px; background:transparent; }
[data-bb-chat-ui-slot-fast-badge] { position:absolute; right:-2px; top:0; color:var(--brand,var(--ring)); pointer-events:none; }
[data-bb-chat-ui-slot-fast-badge] > svg { width:10px; height:10px; }
[data-bb-chat-ui-slot-open] :is([data-bb-chat-ui-fluid-editor],[data-bb-chat-ui-fluid-toggle],[data-bb-chat-ui-fluid-extra-actions],[data-bb-chat-ui-slot-submit] > [data-promptbox-submit-group],[data-bb-chat-ui-slot-trigger]) { visibility:hidden; pointer-events:none; }
[data-bb-chat-ui-fluid-composer] [data-bb-chat-ui-slot-confirm] { position:absolute; z-index:4; inset:0; display:flex; align-items:center; justify-content:center; width:100%; height:100%; min-width:var(--bb-chat-ui-fluid-control-size); min-height:var(--bb-chat-ui-fluid-control-size); border:0; padding:0; border-radius:999px; background:var(--primary); color:var(--primary-foreground); cursor:pointer; }
[data-bb-chat-ui-slot-confirm]:disabled { opacity:.5; cursor:default; }
:is([data-bb-chat-ui-slot-layer],[data-bb-chat-ui-slot-backdrop]) { position:absolute; bottom:calc(8px + var(--bb-chat-ui-fluid-control-size)/2 - var(--bb-slot-row,40px)*2.5); height:calc(var(--bb-slot-row,40px)*5); }
[data-bb-chat-ui-slot-backdrop] { z-index:-1; left:-12px; right:-12px; pointer-events:none; opacity:0; transform:scaleY(.3); background:linear-gradient(to bottom,transparent 0%,color-mix(in oklab,var(--background) 96%,transparent) 20%,color-mix(in oklab,var(--background) 96%,transparent) 80%,transparent 100%); backdrop-filter:blur(14px) saturate(1.25); -webkit-backdrop-filter:blur(14px) saturate(1.25); mask-image:linear-gradient(to bottom,transparent,black 18%,black 82%,transparent); -webkit-mask-image:linear-gradient(to bottom,transparent,black 18%,black 82%,transparent); transition:opacity 200ms ${EASE.exit},transform 240ms ${EASE.exit}; }
[data-bb-chat-ui-slot-backdrop][data-open] { opacity:1; transform:none; transition:opacity 240ms ${EASE.out},transform 360ms ${EASE.out}; }
[data-bb-chat-ui-slot-layer] { z-index:3; left:8px; right:calc(16px + var(--bb-chat-ui-fluid-control-size)); pointer-events:none; visibility:hidden; --bb-slot-open:0; transition:--bb-slot-open 240ms ${EASE.exit},visibility 0s linear 240ms; }
[data-bb-chat-ui-slot-layer][data-open] { --bb-slot-open:1; visibility:visible; pointer-events:auto; transition:--bb-slot-open 360ms ${EASE.out},visibility 0s; }
[data-bb-chat-ui-slot-reels] { display:grid; grid-template-columns:var(--bb-slot-icon,40px) minmax(0,1.25fr) minmax(0,1fr); grid-template-rows:minmax(0,1fr); height:100%; }
[data-bb-chat-ui-slot-wheel] { position:relative; align-self:center; min-width:0; height:var(--bb-slot-row); border-radius:14px; outline:none; }
[data-bb-chat-ui-slot-wheel]:focus-visible { box-shadow:inset 0 0 0 2px var(--ring); }
[data-bb-chat-ui-slot-scroll] { position:absolute; top:calc(var(--bb-slot-row)* -2); width:100%; height:calc(var(--bb-slot-row)*5); overflow-y:auto; overflow-anchor:none; overscroll-behavior:contain; scrollbar-width:none; scroll-snap-type:y mandatory; padding-block:calc(var(--bb-slot-row)*2); perspective:420px; touch-action:pan-y; cursor:grab; }
[data-bb-chat-ui-slot-scroll]::-webkit-scrollbar { display:none; }
[data-bb-chat-ui-slot-scroll][data-dragging] { scroll-snap-type:none; cursor:grabbing; }
[data-bb-chat-ui-slot-wheel][aria-disabled="true"] [data-bb-chat-ui-slot-scroll] { overflow:hidden; pointer-events:none; }
[data-bb-chat-ui-slot-item] { height:var(--bb-slot-row); padding:0 6px; scroll-snap-align:center; font-size:var(--bb-slot-font); line-height:20px; white-space:nowrap; color:var(--foreground); user-select:none; -webkit-user-select:none; cursor:pointer; }
[data-bb-chat-ui-slot-item-face] { display:flex; align-items:center; justify-content:center; gap:5px; height:100%; transform-origin:center; opacity:calc(var(--bb-slot-opacity,1)*var(--bb-slot-open)); transform:translateY(calc(var(--bb-slot-distance,0)*var(--bb-slot-row)*(var(--bb-slot-open) - 1))) rotateX(calc(var(--bb-slot-distance,0)* -20deg)) scale(var(--bb-slot-scale,1)); }
[data-bb-chat-ui-slot-item][aria-selected="true"] { font-weight:600; }
[data-bb-chat-ui-slot-item-face] > :is(svg,img) { flex:none; }
[data-bb-chat-ui-slot-item-face] > span:last-child { min-width:0; overflow:hidden; text-overflow:ellipsis; }
[data-bb-chat-ui-slot-model] { position:relative; display:flex; align-items:center; min-width:0; min-height:0; }
[data-bb-chat-ui-slot-model] > [data-bb-chat-ui-slot-wheel] { width:100%; }
[data-bb-chat-ui-slot-model][data-fast] { padding-right:24px; }
[data-bb-chat-ui-slot-fast] { position:absolute; right:0; top:calc(50% - 16px); display:flex; align-items:center; justify-content:center; width:24px; height:32px; border:0; padding:0; border-radius:8px; color:var(--muted-foreground); background:transparent; cursor:pointer; }
[data-bb-chat-ui-slot-fast][aria-pressed="true"] { color:var(--brand,var(--ring)); background:var(--state-active); }
[data-bb-chat-ui-slot-fast]:hover { background:var(--state-hover); }
:is([data-bb-chat-ui-slot-fast],[data-bb-chat-ui-slot-confirm]):focus-visible { outline:2px solid var(--ring); outline-offset:2px; }
[data-bb-chat-ui-slot-status] { grid-column:2 / span 2; align-self:center; max-height:120px; overflow:auto; padding:8px; font-size:12px; line-height:18px; color:var(--muted-foreground); }
[data-bb-chat-ui-slot-status] > button { display:block; margin-top:8px; border:0; border-radius:8px; padding:4px 8px; background:var(--state-hover); color:var(--foreground); font:inherit; cursor:pointer; }
@media (prefers-reduced-motion:reduce) { [data-bb-chat-ui-slot-layer],[data-bb-chat-ui-slot-backdrop] { transition:none !important; } }
`;
