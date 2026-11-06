/** Lift only the theme surface lightness; keep its chroma and hue, including sidebar chats. */
export const glassSurfaceScopeCss = `
[data-thread-window] {
  --bb-chat-ui-glass-base: var(--background);
}
[data-thread-window][data-surface-tone="sidebar"] {
  --bb-chat-ui-glass-base: var(--sidebar);
}
`;

export const LIGHT_GLASS_FACE = "oklch(from var(--bb-chat-ui-glass-base, var(--background)) min(1, calc(l + 0.075)) c h / 0.68)";
export const DARK_GLASS_FACE = "oklch(from var(--bb-chat-ui-glass-base, var(--background)) min(1, calc(l + 0.075)) c h / 0.76)";
