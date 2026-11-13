const pixels = (value: string): number => Number.parseFloat(value) || 0;

/** 펼친 입력에서도 접힌 열의 가용 폭으로 판단해 줄바꿈 경계의 왕복을 막는다. */
export function needsFullWidthComposer(row: HTMLElement, editor: HTMLElement, options: HTMLElement, actions: HTMLElement): boolean {
  const win = row.ownerDocument.defaultView;
  if (!win) return false;
  const rowWidth = row.getBoundingClientRect().width;
  if (rowWidth <= 0) return false;
  const rowStyle = win.getComputedStyle(row);
  const lineHeight = pixels(win.getComputedStyle(editor).lineHeight) || 24;
  const label = options.querySelector<HTMLElement>('[data-bb-chat-ui-fluid-effort]:not([data-bb-chat-ui-fluid-effort-peek]) > [data-bb-chat-ui-fluid-effort-label]');
  const compactSpace = label && !label.closest('[hidden]') ? label.getBoundingClientRect().width + pixels(win.getComputedStyle(label.parentElement!).columnGap) : 0;
  const hardLines = editor.childElementCount > 1 || !!editor.querySelector('br:not(.ProseMirror-trailingBreak)');
  if (editor.getBoundingClientRect().height > lineHeight + 1 && (!compactSpace || hardLines)) return true;

  const scroll = editor.closest<HTMLElement>('[data-promptbox-editor-scroll]');
  const scrollStyle = scroll ? win.getComputedStyle(scroll) : null;
  const available = rowWidth - pixels(rowStyle.paddingLeft) - pixels(rowStyle.paddingRight)
    - options.getBoundingClientRect().width + compactSpace - actions.getBoundingClientRect().width - 2 * pixels(rowStyle.columnGap)
    - (scrollStyle ? pixels(scrollStyle.paddingLeft) + pixels(scrollStyle.paddingRight) : 0);
  const range = row.ownerDocument.createRange();
  // 접히는 이름 때문에 감긴 글도 조각의 합으로 원래 한 줄 폭을 읽는다.
  const inlineWidth = (node: Node): number => {
    if (node.nodeType === 3) {
      range.selectNodeContents(node);
      const fragments = compactSpace ? Array.from(range.getClientRects?.() ?? []) : [];
      return fragments.length ? fragments.reduce((sum, rect) => sum + rect.width, 0) : range.getBoundingClientRect().width;
    }
    if (node.nodeType !== 1) return 0;
    const element = node as HTMLElement, style = win.getComputedStyle(element);
    if (style.display === 'none' || style.position === 'absolute' || style.position === 'fixed') return 0;
    if (style.display === 'contents') return Array.from(element.childNodes).reduce((sum, child) => sum + inlineWidth(child), 0);
    return element.getBoundingClientRect().width + pixels(style.marginLeft) + pixels(style.marginRight);
  };
  const paragraph = editor.firstElementChild?.tagName === 'P' ? editor.firstElementChild : editor;
  const width = Array.from(paragraph.childNodes).reduce((sum, child) => sum + inlineWidth(child), 0);
  return width > Math.max(1, available) + 1;
}
