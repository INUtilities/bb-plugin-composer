import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { bindFluidComposerHeight, FLUID_COMPOSER_INPUT_MS, FLUID_COMPOSER_MORPH_MS, readFluidEditorPosition } from '../lib/fluid-composer-height';
import { needsFullWidthComposer } from '../lib/fluid-composer-layout';
import { EASE } from '../lib/motion';
import { bindComposerScrollBoundary } from '../lib/composer-scroll-boundary';

// 입력 엔진과 분리한 레이아웃에서 내용 높이와 한 줄·여러 줄 모서리 상태를 전달한다.
export function FluidComposerBody({ editor, options, actions, attachments, voice, voiceMode = false, decoration, auxiliary, panel, panelOpen = false, toggle, draftText, editorReady = true }: {
  editor: ReactNode;
  options: ReactNode;
  actions: ReactNode;
  attachments: ReactNode;
  voice?: ReactNode;
  voiceMode?: boolean;
  decoration?: ReactNode;
  auxiliary?: ReactNode;
  panel?: ReactNode;
  panelOpen?: boolean;
  toggle?: ReactNode;
  draftText?: string;
  editorReady?: boolean;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const panelLayer = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null), editorColumn = useRef<HTMLDivElement>(null);
  const optionColumn = useRef<HTMLDivElement>(null), actionColumn = useRef<HTMLDivElement>(null);
  const [multiline, setMultiline] = useState(false);
  const multilineRef = useRef(false), layoutFrame = useRef<number | null>(null);
  const previousDraft = useRef({ text: draftText, voiceMode });
  const previousPosition = useRef<{ x: number; y: number } | null>(null);
  const layoutAnimation = useRef<Animation | null>(null);
  const actionAnimation = useRef<Animation | null>(null);
  const actionPosition = useRef<{ x: number; y: number } | null>(null);
  const previousVoiceMode = useRef(voiceMode);
  const voicePane = useRef<HTMLElement | null>(null);
  const layoutProbe = useRef(() => {});
  // 접힌 입력의 가용 폭으로 배치를 정하고 가로 전환의 시작점을 보관한다.
  layoutProbe.current = () => {
    if (voiceMode) {
      const element = viewport.current, pane = voicePane.current;
      if (!element || !pane) return;
      const outer = pane.getBoundingClientRect(), inner = element.getBoundingClientRect();
      if (outer.width <= 0) return;
      for (const [key, value] of [['--bb-chat-ui-voice-backdrop-width', pane.clientWidth || outer.width], ['--bb-chat-ui-voice-backdrop-left', outer.left + pane.clientLeft - inner.left], ['--bb-chat-ui-voice-backdrop-bottom', Math.min(-24, inner.bottom - outer.bottom)]] as const) {
        const next = `${value}px`; if (element.style.getPropertyValue(key) !== next) element.style.setProperty(key, next);
      }
      return;
    }
    const input = editorColumn.current?.querySelector<HTMLElement>('[data-bb-chat-ui-voice-transcript], .ProseMirror');
    if (panelOpen || !input || !row.current || !optionColumn.current || !actionColumn.current || !editorColumn.current || !content.current) return;
    if (!draftText && !voiceMode) actionPosition.current = actionColumn.current.getBoundingClientRect();
    const next = voiceMode || needsFullWidthComposer(row.current, input, optionColumn.current, actionColumn.current);
    if (next === multilineRef.current) return;
    previousPosition.current = readFluidEditorPosition(editorColumn.current, content.current);
    layoutAnimation.current?.cancel();
    multilineRef.current = next; setMultiline(next);
  };
  // 같은 프레임의 배치 요청을 한 번만 처리한다.
  const scheduleLayout = useCallback(() => {
    const win = viewport.current?.ownerDocument.defaultView;
    if (!win || layoutFrame.current !== null) return;
    layoutFrame.current = win.requestAnimationFrame(() => { layoutFrame.current = null; layoutProbe.current(); });
  }, []);
  const [retainedPanel, setRetainedPanel] = useState(false);
  const [entered, setEntered] = useState(false);
  useLayoutEffect(() => {
    if (!viewport.current || !content.current) return;
    const win = viewport.current.ownerDocument.defaultView!;
    const element = viewport.current;
    const stopHeight = bindFluidComposerHeight(element, content.current);
    const stopScroll = bindComposerScrollBoundary(element.closest<HTMLElement>('[data-bb-chat-ui-fluid-composer]') ?? element);
    // 입력을 시작하면 남은 가로 이동만 풀고 native 커서 위치를 유지한다.
    const interruptPosition = (event: Event) => {
      if (!(event.target instanceof win.Element) || !event.target.closest('[data-bb-chat-ui-fluid-editor]')) return;
      if (layoutAnimation.current?.playState !== 'running') return;
      if (element.getAttribute('data-bb-chat-ui-fluid-view') !== 'input') return;
      layoutAnimation.current?.cancel();
      layoutAnimation.current = null;
    };
    // 줄바꿈 키도 새 입력 전에 가로 위치 보정만 끝낸다.
    const interruptEnter = (event: KeyboardEvent) => { if (event.key === 'Enter') interruptPosition(event); };
    element.addEventListener('beforeinput', interruptPosition, true);
    element.addEventListener('keydown', interruptEnter, true);
    const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
    const reduce = () => { if (motion.matches) { layoutAnimation.current?.cancel(); actionAnimation.current?.cancel(); } };
    motion.addEventListener('change', reduce);
    return () => {
      stopHeight(); layoutAnimation.current?.cancel(); actionAnimation.current?.cancel();
      stopScroll();
      element.removeEventListener('beforeinput', interruptPosition, true);
      element.removeEventListener('keydown', interruptEnter, true);
      if (layoutFrame.current !== null) win.cancelAnimationFrame(layoutFrame.current);
      motion.removeEventListener('change', reduce);
    };
  }, []);
  useLayoutEffect(() => {
    const win = viewport.current?.ownerDocument.defaultView;
    if (!win?.ResizeObserver || !row.current) return;
    const element = viewport.current!;
    const pane = voiceMode ? element.closest<HTMLElement>('[data-thread-window], [data-pane-content]') ?? element : null;
    voicePane.current = pane;
    const observer = new win.ResizeObserver(scheduleLayout);
    for (const element of [row.current, optionColumn.current, actionColumn.current]) if (element) observer.observe(element);
    if (pane) { observer.observe(pane); if (pane !== element) observer.observe(element); }
    scheduleLayout();
    return () => {
      observer.disconnect(); voicePane.current = null;
      element.style.removeProperty('--bb-chat-ui-voice-backdrop-width'); element.style.removeProperty('--bb-chat-ui-voice-backdrop-left'); element.style.removeProperty('--bb-chat-ui-voice-backdrop-bottom');
    };
  }, [!!voice, voiceMode, scheduleLayout]);
  // 입력 후 줄 배치는 다음 frame을 기다리지 않고 화면을 그리기 전에 확정한다.
  useLayoutEffect(() => {
    const win = viewport.current?.ownerDocument.defaultView;
    if (layoutFrame.current !== null && win) { win.cancelAnimationFrame(layoutFrame.current); layoutFrame.current = null; }
    layoutProbe.current();
  }, [draftText, editorReady, panelOpen, voiceMode]);
  useLayoutEffect(() => {
    const column = actionColumn.current, previous = actionPosition.current;
    const changed = previousVoiceMode.current !== voiceMode;
    previousVoiceMode.current = voiceMode;
    if (!column) return;
    actionAnimation.current?.cancel();
    const next = column.getBoundingClientRect(); actionPosition.current = next;
    if (!changed || !previous || !column.animate || column.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const dx = previous.x - next.x, dy = previous.y - next.y;
    if (dx || dy) actionAnimation.current = column.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { duration: FLUID_COMPOSER_MORPH_MS, easing: EASE.out });
  }, [voiceMode]);
  // 빈 초안은 최종 배치를 바로 정하되, 표면과 placeholder는 같은 접힘 곡선으로 잇는다.
  useLayoutEffect(() => {
    const cleared = !previousDraft.current.voiceMode && previousDraft.current.text !== undefined && previousDraft.current.text !== '' && draftText === '';
    previousDraft.current = { text: draftText, voiceMode };
    const element = viewport.current;
    if (!element) return;
    if (draftText !== '' || panelOpen || voiceMode) { element.removeAttribute('data-bb-chat-ui-fluid-reset'); return; }
    if (!cleared) return;
    element.setAttribute('data-bb-chat-ui-fluid-reset', 'true');
    // 모서리는 다음 layout부터 바뀌므로 높이 observer보다 먼저 접힘 시간을 맞춘다.
    element.style.transition = element.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'none'
      : ['height', 'border-radius', 'corner-shape'].map(property => `${property} ${FLUID_COMPOSER_INPUT_MS}ms ${EASE.out}`).join(', ');
    previousPosition.current = editorColumn.current && content.current ? readFluidEditorPosition(editorColumn.current, content.current) : null;
    layoutAnimation.current?.cancel(); layoutAnimation.current = null;
    if (layoutFrame.current !== null) { element.ownerDocument.defaultView?.cancelAnimationFrame(layoutFrame.current); layoutFrame.current = null; }
    multilineRef.current = false; setMultiline(false);
  }, [draftText, panelOpen, voiceMode]);
  useLayoutEffect(() => {
    const previous = previousPosition.current, column = editorColumn.current;
    previousPosition.current = null;
    if (column?.contains(column.ownerDocument.activeElement)) {
      const element = viewport.current, body = content.current;
      // 첫 줄의 커서 공간은 ResizeObserver를 기다리지 않고 같은 배치에서 확보한다.
      if (element && body && !element.hasAttribute('data-bb-chat-ui-fluid-reset')) {
        element.style.transition = 'none';
        element.style.height = `${body.getBoundingClientRect().height}px`;
      }
      return;
    }
    if (!previous || !column?.animate || column.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const next = content.current ? readFluidEditorPosition(column, content.current) : null;
    if (!next) return;
    const dx = previous.x - next.x;
    if (!dx) return;
    layoutAnimation.current = column.animate([{ transform: `translate(${dx}px, 0px)` }, { transform: 'translate(0, 0)' }], { duration: FLUID_COMPOSER_INPUT_MS, easing: EASE.out });
  }, [multiline]);
  useLayoutEffect(() => {
    const win = viewport.current?.ownerDocument.defaultView;
    if (!win) return;
    if (panelOpen) {
      setRetainedPanel(true);
      if (!entered && panelLayer.current) {
        // Establish the incoming layer's initial style once; reversals use the live CSS transition.
        void win.getComputedStyle(panelLayer.current).opacity;
        setEntered(true);
      }
      return;
    }
    if (!retainedPanel) return;
    const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
    const finish = () => { setRetainedPanel(false); setEntered(false); };
    if (motion.matches) { finish(); return; }
    const timer = win.setTimeout(finish, FLUID_COMPOSER_MORPH_MS);
    const reduce = () => { if (motion.matches) finish(); };
    motion.addEventListener('change', reduce);
    return () => { win.clearTimeout(timer); motion.removeEventListener('change', reduce); };
  }, [panelOpen, retainedPanel, entered]);
  return <div ref={viewport} data-bb-chat-ui-fluid-height="" data-multiline={multiline} data-bb-chat-ui-fluid-view={panelOpen ? 'options' : 'input'} data-voice-mode={voiceMode || undefined}>
    <div data-bb-chat-ui-fluid-surface="" aria-hidden="true"/>
    {decoration}
    <div ref={content} data-bb-chat-ui-fluid-content="">
      <div data-bb-chat-ui-fluid-auxiliary="" hidden={voiceMode}>{auxiliary}</div>
      <div data-bb-chat-ui-fluid-input="" inert={panelOpen || undefined} aria-hidden={panelOpen || undefined}>
      <div data-bb-chat-ui-fluid-attachments="" hidden={voiceMode}>{attachments}</div>
      {voice ? <div data-bb-chat-ui-fluid-voice="">{voice}</div> : <div ref={row} data-bb-chat-ui-fluid-row="" data-multiline={multiline} data-voice-mode={voiceMode || undefined}>
        <div ref={optionColumn} data-bb-chat-ui-fluid-options="" hidden={voiceMode}>{options}</div>
        <div ref={editorColumn} data-bb-chat-ui-fluid-editor="" hidden={voiceMode}>{editor}</div>
        <div ref={actionColumn} data-bb-chat-ui-fluid-actions="">{actions}</div>
      </div>}
      </div>
      {panelOpen || retainedPanel ? <div ref={panelLayer} data-bb-chat-ui-fluid-panel-layer="" data-entered={panelOpen && entered}
        inert={!panelOpen || undefined} aria-hidden={!panelOpen || undefined}>{panel}</div> : null}
    </div>
    {toggle ? <div data-bb-chat-ui-fluid-toggle="" hidden={voiceMode}>{toggle}</div> : null}
  </div>;
}
