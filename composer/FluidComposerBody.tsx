import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { bindFluidComposerHeight, FLUID_COMPOSER_INPUT_MS, FLUID_COMPOSER_MORPH_MS } from '../lib/fluid-composer-height';
import { needsFullWidthComposer } from '../lib/fluid-composer-layout';
import { EASE } from '../lib/motion';
import { bindComposerScrollBoundary } from '../lib/composer-scroll-boundary';

/** 입력 엔진과 분리한 한 줄 기본 레이아웃. 내용의 자연 높이만 전환한다. */
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
    if (panelOpen || !input || !row.current || !optionColumn.current || !actionColumn.current || !editorColumn.current) return;
    if (!draftText && !voiceMode) actionPosition.current = actionColumn.current.getBoundingClientRect();
    const next = voiceMode || needsFullWidthComposer(row.current, input, optionColumn.current, actionColumn.current);
    if (next === multilineRef.current) return;
    previousPosition.current = input.getBoundingClientRect();
    layoutAnimation.current?.cancel();
    multilineRef.current = next; setMultiline(next);
  };
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
    const interruptPosition = (event: Event) => {
      if (!(event.target instanceof win.Element) || !event.target.closest('[data-bb-chat-ui-fluid-editor]')) return;
      if (layoutAnimation.current?.playState !== 'running') return;
      if (element.getAttribute('data-bb-chat-ui-fluid-view') !== 'input') return;
      layoutAnimation.current?.cancel();
      layoutAnimation.current = null;
      // 연속 입력 때는 커서를 즉시 풀고, 아직 작은 창에 새 줄이 잘리지 않게 한다.
      const height = content.current?.getBoundingClientRect().height;
      if (height !== undefined && Number.isFinite(height) && height > 0) {
        const transition = element.style.transition;
        element.style.transition = 'none';
        element.style.height = `${height}px`;
        void element.offsetHeight;
        element.style.transition = transition;
      }
    };
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
  useEffect(scheduleLayout, [draftText, editorReady, panelOpen, voiceMode, scheduleLayout]);
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
    previousPosition.current = editorColumn.current?.querySelector<HTMLElement>('[data-bb-chat-ui-voice-transcript], .ProseMirror')?.getBoundingClientRect() ?? null;
    layoutAnimation.current?.cancel(); layoutAnimation.current = null;
    if (layoutFrame.current !== null) { element.ownerDocument.defaultView?.cancelAnimationFrame(layoutFrame.current); layoutFrame.current = null; }
    multilineRef.current = false; setMultiline(false);
  }, [draftText, panelOpen, voiceMode]);
  useLayoutEffect(() => {
    const previous = previousPosition.current, column = editorColumn.current;
    previousPosition.current = null;
    if (!previous || !column?.animate || column.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const next = (column.querySelector('[data-bb-chat-ui-voice-transcript], .ProseMirror') ?? column).getBoundingClientRect(), dx = previous.x - next.x, dy = previous.y - next.y;
    if (!dx && !dy) return;
    layoutAnimation.current = column.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { duration: FLUID_COMPOSER_MORPH_MS, easing: multiline ? EASE.droplet : EASE.out });
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
