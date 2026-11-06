const pixels = (value: string): number => Number.parseFloat(value) || 0;

/** 펼친 입력에서도 접힌 열의 가용 폭으로 판단해 줄바꿈 경계의 왕복을 막는다. */
export function needsFullWidthComposer(row: HTMLElement, editor: HTMLElement, options: HTMLElement, actions: HTMLElement): boolean {
  const win = row.ownerDocument.defaultView;
  if (!win || row.getBoundingClientRect().width <= 0) return false;
  const rowStyle = win.getComputedStyle(row);
  const lineHeight = pixels(win.getComputedStyle(editor).lineHeight) || 24;
  if (editor.getBoundingClientRect().height > lineHeight + 1) return true;

  const scroll = editor.closest<HTMLElement>('[data-promptbox-editor-scroll]');
  const scrollStyle = scroll ? win.getComputedStyle(scroll) : null;
  const available = row.getBoundingClientRect().width - pixels(rowStyle.paddingLeft) - pixels(rowStyle.paddingRight)
    - options.getBoundingClientRect().width - actions.getBoundingClientRect().width - 2 * pixels(rowStyle.columnGap)
    - (scrollStyle ? pixels(scrollStyle.paddingLeft) + pixels(scrollStyle.paddingRight) : 0);
  const range = row.ownerDocument.createRange();
  const inlineWidth = (node: Node): number => {
    if (node.nodeType === 3) { range.selectNodeContents(node); return range.getBoundingClientRect().width; }
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
