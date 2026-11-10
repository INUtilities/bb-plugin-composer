import { LIGHT_GLASS_FACE, DARK_GLASS_FACE } from './glass-surface.ts';
import { FLUID_COMPOSER_MORPH_MS } from './fluid-composer-height.ts';
import { EASE } from './motion.ts';
import { fluidPickerCss } from './fluid-picker.ts';

export const fluidComposerCss = `
${fluidPickerCss}
/* 정보 필은 유지하며 메타데이터는 i 필을 통해 위쪽 카드에서만 연다. */
html[data-bb-chat-ui-fluid-mode] [data-bb-chat-ui-info-bar]:not([hidden]) { display:flex !important; }
html[data-bb-chat-ui-fluid-mode] :is([data-follow-up-composer-footer], [data-new-thread-footer]) { display:none !important; }
[data-promptbox-shell][data-bb-chat-ui-fluid-details-open] { position:relative; }
html[data-bb-chat-ui-fluid-mode] [data-promptbox-shell][data-bb-chat-ui-fluid-details-open] :is([data-follow-up-composer-footer], [data-new-thread-footer]):not([hidden]) { display:flex !important; position:absolute; bottom:calc(100% + 8px); right:0; z-index:30; width:max-content; max-width:100%; padding:12px 16px; border-radius:18px; background:${LIGHT_GLASS_FACE}; backdrop-filter:blur(14px) saturate(1.25); box-shadow:0 8px 24px -12px color-mix(in oklab,var(--foreground) 22%,transparent); }
.dark [data-promptbox-shell][data-bb-chat-ui-fluid-details-open] :is([data-follow-up-composer-footer], [data-new-thread-footer]) { background:${DARK_GLASS_FACE}; }
[data-bb-chat-ui-fluid-options-open] :is([data-bb-chat-ui-info-bar], [data-bb-chat-ui-slot-toolbar]) { pointer-events:none; }
[data-bb-chat-ui-fluid-options-open] :is([data-bb-chat-ui-info-bar], [data-bb-chat-ui-slot-toolbar]) > * { opacity:0; }
[data-bb-chat-ui-fluid-details-open] :is([data-follow-up-composer-footer], [data-new-thread-footer]) { flex-wrap:wrap; max-height:none; overflow:visible; opacity:1; pointer-events:auto; }
[data-bb-chat-ui-fluid-details-open] :is([data-follow-up-composer-footer], [data-new-thread-footer]) > div { flex-wrap:wrap; overflow:visible; }
[data-bb-chat-ui-fluid-composer] {
  --bb-chat-ui-fluid-input-radius:24px;
  --bb-chat-ui-fluid-control-size:32px;
  --bb-chat-ui-fluid-device-max:40dvh;
  --bb-chat-ui-fluid-max-height:max(96px,min(var(--bb-chat-ui-fluid-device-max),var(--bb-chat-ui-fluid-host-max,100dvh)));
  position:relative; width:100%; min-width:0; margin:0; padding:0; box-sizing:border-box;
  border:0; border-radius:var(--bb-chat-ui-fluid-input-radius); color:var(--foreground);
  background:transparent;
}
[data-bb-chat-ui-fluid-surface], [data-bb-chat-ui-fluid-toggle-face], [data-bb-chat-ui-fluid-details] {
  position:absolute; inset:0; pointer-events:none; border-radius:inherit;
  background:${LIGHT_GLASS_FACE}; backdrop-filter:blur(14px) saturate(1.25); -webkit-backdrop-filter:blur(14px) saturate(1.25);
  box-shadow:0 8px 24px -12px color-mix(in oklab,var(--foreground) 22%,transparent),inset 0 1px 3px color-mix(in oklab,var(--popover) 35%,transparent);
}
[data-bb-chat-ui-fluid-composer] [data-bb-chat-ui-fluid-details-toggle] { position:relative; flex:none; background:${LIGHT_GLASS_FACE}; width:32px; height:32px; min-width:32px; min-height:32px; padding:0; border-radius:999px; }
.dark [data-bb-chat-ui-fluid-composer] [data-bb-chat-ui-fluid-details-toggle] { background:${DARK_GLASS_FACE}; }
[data-bb-chat-ui-fluid-details] { position:relative; inset:auto; pointer-events:auto; border-radius:18px; padding:8px; margin-bottom:8px; }
[data-bb-chat-ui-fluid-details][hidden] { display:none !important; }
[data-bb-chat-ui-fluid-composer] [hidden] { display:none !important; }
[data-bb-chat-ui-fluid-composer][data-bb-chat-ui-fluid-voice-only="true"] { padding-right:0; }
[data-bb-chat-ui-fluid-extra-actions] { display:contents; }
[data-bb-chat-ui-fluid-native-controls] { display:flex; flex-wrap:wrap; align-items:center; gap:8px; min-width:0; }
[data-bb-chat-ui-fluid-surface] { transform:translateX(0); opacity:1; transition:transform ${FLUID_COMPOSER_MORPH_MS}ms ${EASE.out}, opacity ${FLUID_COMPOSER_MORPH_MS}ms ${EASE.out}; }
[data-bb-chat-ui-fluid-height][data-voice-mode="true"] > [data-bb-chat-ui-fluid-surface] { opacity:1; inset:-120px auto calc(var(--bb-chat-ui-voice-backdrop-bottom,-24px) - var(--bb-safe-area-bottom,env(safe-area-inset-bottom,0px))) var(--bb-chat-ui-voice-backdrop-left,0px); width:var(--bb-chat-ui-voice-backdrop-width,100%); border-radius:0; transform:none; box-shadow:none; mask-image:linear-gradient(to bottom,transparent 0,black 120px); -webkit-mask-image:linear-gradient(to bottom,transparent 0,black 120px); }
[data-bb-chat-ui-fluid-height][data-voice-mode="true"] { overflow:visible; }
html[data-bb-chat-ui-root-device="phone"] [data-bb-chat-ui-fluid-composer] { --bb-chat-ui-fluid-input-radius:26px; --bb-chat-ui-fluid-control-size:36px; --bb-chat-ui-fluid-device-max:35dvh; }
.dark [data-bb-chat-ui-fluid-surface], .dark [data-bb-chat-ui-fluid-toggle-face], .dark [data-bb-chat-ui-fluid-details] { background:${DARK_GLASS_FACE}; box-shadow:0 8px 24px -12px color-mix(in oklab,var(--background) 60%,transparent),inset 0 1px 3px color-mix(in oklab,var(--foreground) 8%,transparent); }
[data-bb-chat-ui-fluid-height] { position:relative; display:flex; flex-direction:column; justify-content:flex-end; overflow:clip; border-radius:var(--bb-chat-ui-fluid-input-radius); }
[data-bb-chat-ui-fluid-toggle] { position:absolute; left:8px; bottom:8px; z-index:1; display:flex; border-radius:999px; }
[data-bb-chat-ui-fluid-toggle-face] { inset:4px; opacity:0; transition:opacity ${FLUID_COMPOSER_MORPH_MS}ms ${EASE.out}; }
[data-bb-chat-ui-fluid-composer] [data-bb-chat-ui-fluid-toggle] > button { position:relative; background:transparent; }
[data-bb-chat-ui-fluid-toggle-glyph] { position:relative; display:block; flex:none; width:24px; height:24px; pointer-events:none; }
[data-bb-chat-ui-fluid-toggle-glyph]::before, [data-bb-chat-ui-fluid-toggle-glyph]::after { content:""; position:absolute; left:50%; top:50%; width:1.5px; height:12px; border-radius:999px; background:currentColor; transform:translate(-50%,-50%) rotate(0deg); transition:transform ${FLUID_COMPOSER_MORPH_MS}ms ${EASE.out}; }
[data-bb-chat-ui-fluid-toggle-glyph]::after { transform:translate(-50%,-50%) rotate(90deg); }
[aria-expanded="true"] > [data-bb-chat-ui-fluid-toggle-glyph]::before { transform:translate(-50%,-50%) rotate(45deg); }
[aria-expanded="true"] > [data-bb-chat-ui-fluid-toggle-glyph]::after { transform:translate(-50%,-50%) rotate(135deg); }
[data-bb-chat-ui-fluid-content] { position:relative; min-width:0; flex:none; width:100%; display:flex; flex-direction:column; max-height:var(--bb-chat-ui-fluid-max-height); }
[data-bb-chat-ui-fluid-input] { position:relative; display:flex; flex-direction:column; min-width:0; min-height:0; }
[data-bb-chat-ui-fluid-panel-layer] { position:relative; width:100%; min-width:0; margin-bottom:8px; }
[data-bb-chat-ui-fluid-native-controls][hidden] { display:none !important; }
[data-bb-chat-ui-fluid-panel] { display:flex; flex-direction:column; width:100%; min-width:0; }
[data-bb-chat-ui-fluid-panel-list] { display:flex; flex-wrap:wrap; gap:8px; min-height:0; max-height:var(--bb-chat-ui-fluid-max-height); overflow-y:auto; overscroll-behavior:contain; scrollbar-width:thin; padding:8px; }
[data-bb-chat-ui-fluid-panel-list] [role="menuitem"] { position:relative; display:inline-flex; flex:none; align-items:center; justify-content:flex-start; gap:8px; width:auto; min-width:0; max-width:100%; min-height:32px; height:auto; padding:6px 12px; border-radius:999px; text-align:left; white-space:normal; overflow-wrap:anywhere; font-size:12px; line-height:16px; background:${LIGHT_GLASS_FACE}; backdrop-filter:blur(14px) saturate(1.25); -webkit-backdrop-filter:blur(14px) saturate(1.25); box-shadow:inset 0 1px 3px color-mix(in oklab,var(--popover) 35%,transparent); }
.dark [data-bb-chat-ui-fluid-panel-list] [role="menuitem"] { background:${DARK_GLASS_FACE}; box-shadow:inset 0 1px 3px color-mix(in oklab,var(--foreground) 8%,transparent); }
[data-bb-chat-ui-fluid-panel-list] [role="menuitem"]:is(:hover,:focus-visible):not(:disabled):not([data-disabled]) { background-color:color-mix(in oklab,var(--foreground) 8%,transparent); }
[data-bb-chat-ui-fluid-panel-list] [role="menuitem"] > [data-icon-root], [data-bb-chat-ui-fluid-panel-list] [role="menuitem"] > svg { flex:none; width:16px; height:16px; }
[data-bb-chat-ui-fluid-panel-list] [role="menuitem"] > span { min-width:0; }
[data-bb-chat-ui-fluid-panel-list] > p { margin:8px; color:var(--muted-foreground); font-size:12px; line-height:18px; }
html[data-bb-chat-ui-root-device="phone"] [data-bb-chat-ui-fluid-panel-list] [role="menuitem"] { min-height:36px; padding:8px 12px; font-size:13px; }
html[data-bb-chat-ui-root-device="phone"] [data-bb-chat-ui-fluid-editor][data-bb-chat-ui-fluid-moving] .ProseMirror { caret-color:transparent; }
[data-bb-chat-ui-fluid-row] { display:grid; flex:1 1 auto; grid-template-columns:auto minmax(0,1fr) auto; grid-template-rows:minmax(0,1fr); grid-template-areas:"options editor actions"; align-items:end; gap:4px; padding:8px; min-height:48px; box-sizing:border-box; }
[data-bb-chat-ui-fluid-row][data-multiline="true"] { grid-template-areas:"editor editor editor" "options . actions"; grid-template-rows:minmax(0,1fr) auto; row-gap:8px; }
[data-bb-chat-ui-fluid-row][data-voice-mode="true"] { grid-template-columns:minmax(0,1fr) auto minmax(0,1fr); grid-template-areas:". actions ."; grid-template-rows:auto; row-gap:0; padding:0 8px; }
[data-bb-chat-ui-fluid-row][data-voice-mode="true"] > [data-bb-chat-ui-fluid-options] { display:none; }
[data-bb-chat-ui-fluid-row][data-voice-mode="true"] > [data-bb-chat-ui-fluid-actions] { justify-self:center; }
[data-bb-chat-ui-fluid-options], [data-bb-chat-ui-fluid-actions] { display:flex; align-items:center; min-width:0; gap:4px; }
[data-bb-chat-ui-fluid-options] { grid-area:options; padding-left:calc(var(--bb-chat-ui-fluid-control-size) + 4px); height:var(--bb-chat-ui-fluid-control-size); }
/* 기본 한 줄은 입력 뒤에 모델·Effort를 두고 + 예약 폭은 같은 행의 왼쪽에 유지한다. */
[data-bb-chat-ui-fluid-composer]:not([data-bb-chat-ui-slot-enabled]) [data-bb-chat-ui-fluid-row][data-multiline="false"]:not([data-voice-mode="true"]) { grid-template-columns:minmax(0,1fr) auto auto; grid-template-areas:"editor options actions"; padding-left:calc(var(--bb-chat-ui-fluid-control-size) + 12px); }
[data-bb-chat-ui-fluid-composer]:not([data-bb-chat-ui-slot-enabled]) [data-bb-chat-ui-fluid-row][data-multiline="false"]:not([data-voice-mode="true"]) > [data-bb-chat-ui-fluid-options] { padding-left:0; }
[data-bb-chat-ui-fluid-model-controls] { display:flex; align-items:center; gap:2px; min-width:0; }
[data-bb-chat-ui-fluid-model-controls] [data-bb-chat-ui-fluid-native-controls] { flex-wrap:nowrap; gap:2px; }
[data-bb-chat-ui-fluid-model-controls][data-bb-chat-ui-fluid-separate-effort] [data-bb-chat-ui-fluid-native-controls] button[aria-label^="Provider, model and reasoning"] > span > span[data-promptbox-hide-compact],
[data-bb-chat-ui-fluid-model-controls][data-bb-chat-ui-fluid-separate-effort] [data-bb-chat-ui-fluid-native-controls] button[aria-label^="Provider, model and reasoning"] [data-model-loading-placeholder="trigger-reasoning"] { display:none; }
[data-bb-chat-ui-fluid-details]:not([hidden]) { display:contents; }
[data-bb-chat-ui-fluid-effort] { gap:6px; height:32px; padding:0 8px; border-radius:999px; font-size:12px; line-height:16px; font-weight:400; white-space:nowrap; color:var(--muted-foreground); background:transparent; }
[data-bb-chat-ui-fluid-effort]:hover { background:transparent; color:var(--muted-foreground); }
[data-bb-chat-ui-fluid-effort] > svg { flex:none; width:20px; height:16px; }
[data-bb-chat-ui-fluid-effort-label] { display:inline-flex; flex:none; align-items:center; justify-content:center; max-width:70px; overflow:clip; }
[data-bb-chat-ui-fluid-effort-value] { display:block; flex:none; width:max-content; max-width:70px; overflow:hidden; text-overflow:ellipsis; transform-origin:center; color:color-mix(in oklab,var(--muted-foreground) 72%,transparent); }
[data-bb-chat-ui-fluid-actions] { grid-area:actions; }
[data-bb-chat-ui-fluid-actions] > [data-promptbox-submit-group] { display:flex; align-items:center; flex:none; }
[data-bb-chat-ui-fluid-composer] [data-promptbox-send-menu] { margin-left:0; border-radius:999px; overflow:hidden; }
[data-bb-chat-ui-fluid-editor] { grid-area:editor; align-self:center; min-width:0; }
[data-bb-chat-ui-fluid-row]:is([data-multiline="true"], [data-voice-mode="true"]) > [data-bb-chat-ui-fluid-editor] { align-self:stretch; min-height:0; display:flex; flex-direction:column; padding:8px 8px 0; }
[data-bb-chat-ui-fluid-editor] > [data-bb-chat-ui-voice-editor], [data-bb-chat-ui-fluid-editor] > [data-bb-chat-ui-voice-editor] > div { display:flex; flex-direction:column; min-height:0; }
[data-bb-chat-ui-voice-editor] > [hidden] { display:none !important; }
[data-bb-chat-ui-fluid-composer] [data-promptbox-editor-scroll] { flex:1 1 auto; max-height:calc(var(--bb-chat-ui-fluid-max-height) - var(--bb-chat-ui-fluid-control-size) - 32px); padding:0 4px; font-size:14px; line-height:24px; overflow-y:auto; overscroll-behavior:contain; scrollbar-width:thin; }
[data-bb-chat-ui-fluid-composer] [data-promptbox-editor-content] { height:auto; min-height:24px; }
[data-bb-chat-ui-fluid-composer] .ProseMirror[contenteditable] { min-height:24px; line-height:24px; font-size:inherit; white-space:pre-wrap; overflow-wrap:anywhere; outline:none; }
[data-bb-chat-ui-fluid-composer] .ProseMirror p { margin:0; }
[data-bb-chat-ui-fluid-composer] .ProseMirror p.is-editor-empty:first-child { position:relative; }
[data-bb-chat-ui-fluid-composer] .ProseMirror p.is-editor-empty:first-child::before { content:attr(data-placeholder); position:absolute; inset:0; float:none; height:24px; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; pointer-events:none; }
[data-bb-chat-ui-fluid-composer] :is([data-promptbox-submit-action], button[aria-label="Prompt actions"], button[aria-label="Start voice input"], [data-bb-chat-ui-voice-record]) { width:32px; height:32px; min-width:32px; min-height:32px; padding:0; margin:0; border-radius:999px; }
[data-bb-chat-ui-fluid-options] button[aria-label^="Provider, model and reasoning"] { max-width:140px; min-width:32px; height:32px; margin:0; border-radius:999px; }
[data-bb-chat-ui-fluid-options] button[aria-label^="Provider, model and reasoning"] > span { min-width:0; overflow:hidden; text-overflow:ellipsis; }
[data-bb-chat-ui-fluid-composer] [data-promptbox-submit-label] { display:none; }
[data-bb-chat-ui-fluid-attachments]:empty { display:none; }
[data-bb-chat-ui-fluid-attachments], [data-bb-chat-ui-fluid-auxiliary] { flex-shrink:1; min-height:0; max-height:calc((var(--bb-chat-ui-fluid-max-height) - var(--bb-chat-ui-fluid-control-size) - 56px) / 2); overflow-y:auto; overscroll-behavior:contain; }
[data-bb-chat-ui-fluid-auxiliary]:empty { display:none; }
[data-bb-chat-ui-fluid-voice] { padding:8px; min-height:48px; display:flex; align-items:center; }
html[data-bb-chat-ui-root-device="phone"] [data-bb-chat-ui-fluid-row] { min-height:52px; }
html[data-bb-chat-ui-root-device="phone"] [data-bb-chat-ui-fluid-composer] [data-promptbox-editor-scroll] { font-size:16px; }
html[data-bb-chat-ui-root-device="phone"] [data-bb-chat-ui-fluid-composer] :is([data-promptbox-submit-action], button[aria-label="Prompt actions"], button[aria-label="Start voice input"], [data-bb-chat-ui-voice-record]) { width:36px; height:36px; min-width:36px; min-height:36px; }
html[data-bb-chat-ui-root-device="phone"] [data-bb-chat-ui-fluid-options] button[aria-label^="Provider, model and reasoning"] { width:32px; max-width:32px; padding-inline:6px; gap:0; }
html[data-bb-chat-ui-root-device="phone"] [data-bb-chat-ui-fluid-options] button[aria-label^="Provider, model and reasoning"] > :not(:first-child) { display:none; }
html[data-bb-chat-ui-root-device="phone"] [data-bb-chat-ui-fluid-native-controls] button[aria-label^="Provider, model and reasoning"] > span.contents > :not(:first-child) { display:none; }
[data-bb-chat-ui-voice-options] { display:flex; align-items:center; gap:4px; }
[data-bb-chat-ui-voice-options][inert] { opacity:.4; }
[data-bb-chat-ui-voice-actions] {
  --bb-chat-ui-voice-pill-width:calc(var(--bb-chat-ui-fluid-control-size) * 2.5);
  --bb-chat-ui-voice-pill-height:calc(var(--bb-chat-ui-fluid-control-size) + 16px);
  --bb-chat-ui-voice-orb-size:min(calc(var(--bb-chat-ui-fluid-control-size) * 2 + 48px),calc(var(--bb-chat-ui-fluid-max-height) - 16px));
  --bb-chat-ui-voice-shift:calc((var(--bb-chat-ui-voice-pill-width) + 16px) / 2);
  position:relative; display:inline-flex; align-items:center; height:var(--bb-chat-ui-fluid-control-size);
}
/* orb와 선택지는 같은 중심·고정 영역을 공유하고 pill 높이는 기존 한 줄 높이를 유지한다. */
[data-bb-chat-ui-voice-actions][data-active="true"] { width:calc(var(--bb-chat-ui-voice-pill-width) * 2 + 16px); height:calc(var(--bb-chat-ui-voice-orb-size) + 16px); }
[data-bb-chat-ui-voice-primary] { touch-action:manipulation; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none; }
html [data-bb-chat-ui-fluid-composer] :is([data-bb-chat-ui-voice-primary], [data-bb-chat-ui-voice-send]) { position:relative; flex:none; width:var(--bb-chat-ui-fluid-control-size); height:var(--bb-chat-ui-fluid-control-size); min-width:var(--bb-chat-ui-fluid-control-size); min-height:var(--bb-chat-ui-fluid-control-size); padding:0; margin:0; border-radius:999px; }
html [data-bb-chat-ui-fluid-composer] [data-bb-chat-ui-voice-actions][data-active="true"] > button {
  position:absolute; left:50%; top:50%; width:var(--bb-chat-ui-voice-pill-width); height:var(--bb-chat-ui-voice-pill-height); min-width:0; min-height:0; padding-inline:8px;
  border:0; background:transparent; color:var(--foreground);
  transform:translate(-50%,-50%); transition:width 520ms ${EASE.droplet}, height 520ms ${EASE.droplet}, transform 520ms ${EASE.droplet}, opacity 300ms ${EASE.out};
}
html [data-bb-chat-ui-fluid-composer] [data-bb-chat-ui-voice-actions][data-active="true"]:not([data-split="true"]) > [data-bb-chat-ui-voice-primary] { width:var(--bb-chat-ui-voice-orb-size); height:var(--bb-chat-ui-voice-orb-size); padding:0; }
[data-bb-chat-ui-voice-waveform] { position:absolute; left:50%; top:50%; z-index:1; display:block; width:min(72px,var(--bb-chat-ui-voice-orb-size)); height:min(72px,var(--bb-chat-ui-voice-orb-size)); transform:translate(-50%,-50%); overflow:visible; flex:none; opacity:1; pointer-events:none; transition:opacity 220ms ${EASE.out}; }
html[data-bb-chat-ui-root-device="phone"] [data-bb-chat-ui-voice-waveform] { width:min(80px,var(--bb-chat-ui-voice-orb-size)); height:min(80px,var(--bb-chat-ui-voice-orb-size)); }
[data-bb-chat-ui-voice-orbit] > svg { position:absolute; inset:0; width:100%; height:100%; overflow:visible; }
[data-bb-chat-ui-voice-actions][data-split="true"] [data-bb-chat-ui-voice-waveform] { opacity:0; }
[data-bb-chat-ui-voice-actions][data-leaving="true"] > [data-bb-chat-ui-voice-primary]:disabled { opacity:1; }
[data-bb-chat-ui-voice-actions][data-active="true"] > button::before { content:""; position:absolute; inset:0; border-radius:inherit; background:var(--foreground); opacity:0; pointer-events:none; }
[data-bb-chat-ui-voice-actions][data-split="true"] > button::before { opacity:1; animation:bb-chat-ui-voice-form 520ms ${EASE.droplet}; }
[data-bb-chat-ui-voice-send] [data-icon-root], [data-bb-chat-ui-voice-stop-symbol] { z-index:1; }
[data-bb-chat-ui-voice-send] [data-icon-root] { position:relative; }
[data-bb-chat-ui-voice-stop-symbol] { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity ${FLUID_COMPOSER_MORPH_MS}ms ${EASE.out}; }
html [data-bb-chat-ui-fluid-composer] [data-bb-chat-ui-voice-send] { opacity:0; pointer-events:none; }
html [data-bb-chat-ui-fluid-composer] [data-bb-chat-ui-voice-actions][data-split="true"] > button { color:var(--background); }
html [data-bb-chat-ui-fluid-composer] [data-bb-chat-ui-voice-actions][data-split="true"] > [data-bb-chat-ui-voice-primary] { transform:translate(calc(-50% - var(--bb-chat-ui-voice-shift)),-50%); }
[data-bb-chat-ui-voice-actions][data-split="true"] [data-bb-chat-ui-voice-stop-symbol] { opacity:1; }
html [data-bb-chat-ui-fluid-composer] [data-bb-chat-ui-voice-actions][data-split="true"] > [data-bb-chat-ui-voice-send] { opacity:1; transform:translate(calc(-50% + var(--bb-chat-ui-voice-shift)),-50%); pointer-events:auto; }
html [data-bb-chat-ui-fluid-composer] [data-bb-chat-ui-voice-actions][data-split="true"] > button:disabled { opacity:.5; }
[data-bb-chat-ui-voice-neck] { position:absolute; left:50%; top:50%; width:var(--bb-chat-ui-fluid-control-size); height:var(--bb-chat-ui-voice-pill-height); color:var(--foreground); opacity:0; pointer-events:none; transform:translate(-50%,-50%) scale(.5,1); }
[data-bb-chat-ui-voice-actions][data-split="true"] > [data-bb-chat-ui-voice-neck] { animation:bb-chat-ui-voice-separate 520ms ${EASE.droplet}; }
@keyframes bb-chat-ui-voice-separate {
  0%,15% { opacity:0; transform:translate(-50%,-50%) scale(.5,1); }
  25% { opacity:1; transform:translate(-50%,-50%) scale(.7,1); }
  55% { opacity:1; transform:translate(-50%,-50%) scale(1,.65); }
  76% { opacity:1; transform:translate(-50%,-50%) scale(1.1,.18); }
  88%,100% { opacity:0; transform:translate(-50%,-50%) scale(1.1,0); }
}
@keyframes bb-chat-ui-voice-form {
  0% { opacity:0; transform:scale(.24,.9); }
  24% { opacity:1; transform:scale(.68,1.15); }
  58% { opacity:1; transform:scale(1.12,.88); }
  80% { opacity:1; transform:scale(.98,1.04); }
  100% { opacity:1; transform:scale(1); }
}
[data-bb-chat-ui-voice-transcript] { flex:none; white-space:pre-wrap; overflow-wrap:anywhere; line-height:24px; min-height:24px; }
[data-bb-chat-ui-voice-transcript] p { margin:0; }
[data-bb-chat-ui-voice-transcript][data-placeholder] { color:var(--muted-foreground); }
[data-bb-chat-ui-voice-error] { color:var(--muted-foreground); }
[data-bb-chat-ui-voice-choice] { min-width:32px; height:32px; margin:0; padding:0 8px; border-radius:999px; font-size:12px; line-height:16px; }
[data-bb-chat-ui-voice-cancel] { width:24px; height:32px; min-width:24px; padding:0; border-radius:999px; }
[data-bb-chat-ui-voice-editor] { position:relative; }
html[data-bb-chat-ui-root-device="phone"] [data-bb-chat-ui-voice-choice],
html[data-bb-chat-ui-root-device="phone"] [data-bb-chat-ui-voice-cancel] { height:36px; font-size:13px; }
@media (prefers-reduced-motion: reduce) { [data-bb-chat-ui-fluid-composer], [data-bb-chat-ui-fluid-surface], [data-bb-chat-ui-fluid-height], [data-bb-chat-ui-fluid-input], [data-bb-chat-ui-fluid-panel-layer], [data-bb-chat-ui-fluid-toggle-face], [data-bb-chat-ui-fluid-toggle-glyph]::before, [data-bb-chat-ui-fluid-toggle-glyph]::after, [data-bb-chat-ui-voice-primary], [data-bb-chat-ui-voice-send], [data-bb-chat-ui-voice-stop-symbol] { transition:none !important; } }
/* 같은 분석으로 하단 glow와 길게 누르기의 링 또는 클릭 모드의 가는 막대를 그린다. */
[data-bb-chat-ui-voice-glow] { position:absolute; inset:0; z-index:0; overflow:hidden; border-radius:inherit; pointer-events:none; }
[data-bb-chat-ui-voice-glow] > i { position:absolute; left:5%; bottom:-6px; width:90%; height:20px; transform-origin:50% 100%; background:radial-gradient(ellipse at 50% 100%,color-mix(in oklab,var(--ring,var(--foreground)) 90%,transparent) 0%,color-mix(in oklab,var(--ring,var(--foreground)) 38%,transparent) 28%,transparent 74%); }
[data-bb-chat-ui-voice-actions][data-appearance="composer"][data-active="true"] { width:auto; height:var(--bb-chat-ui-fluid-control-size); gap:8px; }
html [data-bb-chat-ui-fluid-composer] [data-bb-chat-ui-voice-actions][data-appearance="composer"][data-active="true"] > :is([data-bb-chat-ui-voice-primary],[data-bb-chat-ui-voice-send]) { position:relative; left:auto; top:auto; width:var(--bb-chat-ui-fluid-control-size); height:var(--bb-chat-ui-fluid-control-size); min-width:var(--bb-chat-ui-fluid-control-size); min-height:var(--bb-chat-ui-fluid-control-size); padding:0; transform:none; background:transparent; color:var(--foreground); }
[data-bb-chat-ui-voice-actions][data-appearance="composer"] > button::before { display:none; }
[data-bb-chat-ui-voice-actions][data-appearance="composer"][data-active="true"] [data-bb-chat-ui-voice-stop-symbol] { opacity:1; }
[data-bb-chat-ui-voice-actions][data-appearance="composer"]:not([data-split="true"]) > [data-bb-chat-ui-voice-send] { display:none; }
[data-bb-chat-ui-voice-visual] { position:absolute; inset:0; pointer-events:none; color:var(--foreground); }
html [data-bb-chat-ui-fluid-composer] [data-bb-chat-ui-voice-visual] > [data-bb-chat-ui-voice-orbit] { left:auto; top:auto; right:4px; bottom:4px; width:calc(var(--bb-chat-ui-fluid-control-size) + 8px); height:calc(var(--bb-chat-ui-fluid-control-size) + 8px); transform:none; }
[data-bb-chat-ui-voice-bars] { position:absolute; left:calc(var(--bb-chat-ui-fluid-control-size) + 20px); right:calc(var(--bb-chat-ui-fluid-control-size) + 20px); top:calc((var(--bb-chat-ui-fluid-control-size) - 8px) / 2); height:24px; opacity:.8; }
[data-bb-chat-ui-voice-bars] > svg { display:block; width:100%; height:100%; overflow:visible; }
[data-bb-chat-ui-voice-bars-space] { flex:none; height:24px; }
[data-bb-chat-ui-voice-bars-space][data-has-preview="true"] { height:32px; }
@media (prefers-reduced-motion: reduce) { [data-bb-chat-ui-voice-neck] { animation:none !important; opacity:0; } [data-bb-chat-ui-voice-actions] > button::before { animation:none !important; } [data-bb-chat-ui-voice-waveform] { transition:none !important; } }
/* 한 줄은 반원을 유지하고 여러 줄 입력의 실제 clip과 배경만 스쿼클로 바꾼다. */
@supports (corner-shape: squircle) {
  [data-bb-chat-ui-fluid-height] { corner-shape:round; }
  [data-bb-chat-ui-fluid-height][data-multiline="true"][data-bb-chat-ui-fluid-view="input"] { border-radius:50.6px; corner-shape:squircle; }
  html[data-bb-chat-ui-root-device="phone"] [data-bb-chat-ui-fluid-height][data-multiline="true"][data-bb-chat-ui-fluid-view="input"] { border-radius:54.9px; }
  [data-bb-chat-ui-fluid-height] > [data-bb-chat-ui-fluid-surface],
  [data-bb-chat-ui-fluid-height] > [data-bb-chat-ui-voice-glow] { corner-shape:inherit; }
}
/* 함께 로드된 Chat UI의 이전 전역 규칙보다 Composer 소유 전환을 우선한다. */
html [data-bb-plugin="composer"] [data-bb-chat-ui-fluid-composer] :is([data-bb-chat-ui-fluid-surface], [data-bb-chat-ui-fluid-toggle-face], [data-bb-chat-ui-fluid-input], [data-bb-chat-ui-fluid-panel-layer], [data-bb-chat-ui-voice-stop-symbol]) { transition-duration:${FLUID_COMPOSER_MORPH_MS}ms; }
html [data-bb-plugin="composer"] [data-bb-chat-ui-fluid-composer] [data-bb-chat-ui-fluid-toggle-glyph]::before,
html [data-bb-plugin="composer"] [data-bb-chat-ui-fluid-composer] [data-bb-chat-ui-fluid-toggle-glyph]::after { transition-duration:${FLUID_COMPOSER_MORPH_MS}ms; }
html [data-bb-plugin="composer"] [data-bb-chat-ui-fluid-composer] [data-bb-chat-ui-voice-actions][data-active="true"] > button { transition-duration:520ms,520ms,520ms,300ms; }
html [data-bb-plugin="composer"] [data-bb-chat-ui-fluid-composer] [data-bb-chat-ui-voice-waveform] { transition-duration:220ms; }
html [data-bb-plugin="composer"] [data-bb-chat-ui-fluid-composer] [data-bb-chat-ui-voice-actions][data-split="true"] > button::before,
html [data-bb-plugin="composer"] [data-bb-chat-ui-fluid-composer] [data-bb-chat-ui-voice-actions][data-split="true"] > [data-bb-chat-ui-voice-neck] { animation-duration:520ms; }
`;

// Fluid 컴포저의 스타일과 활성 표식을 설치하고 해제 시 원래 상태로 돌린다.
export function injectFluidComposer(document: Document): () => void {
  const attribute = 'data-bb-chat-ui-fluid-mode';
  const previous = document.documentElement.getAttribute(attribute);
  document.documentElement.setAttribute(attribute, '');
  const style = document.createElement('style');
  style.id = 'bb-chat-ui-fluid-composer';
  style.textContent = fluidComposerCss;
  document.head.append(style);
  return () => {
    style.remove();
    if (previous === null) document.documentElement.removeAttribute(attribute);
    else document.documentElement.setAttribute(attribute, previous);
  };
}
