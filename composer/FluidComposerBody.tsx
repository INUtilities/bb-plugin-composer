import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { bindFluidComposerHeight, FLUID_COMPOSER_INPUT_MS, FLUID_COMPOSER_MORPH_MS, FLUID_EDITOR_FOLLOW_ANIMATION, readFluidEditorPosition } from '../lib/fluid-composer-height';
import { needsFullWidthComposer } from '../lib/fluid-composer-layout';
import { EASE } from '../lib/motion';
import { bindComposerScrollBoundary } from '../lib/composer-scroll-boundary';

// 입력 높이와 모서리를 유지하고 옵션 필을 입력창 위에 독립적으로 표시한다.
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
    if (!input || !row.current || !optionColumn.current || !actionColumn.current || !editorColumn.current || !content.current) return;
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
  useLayoutEffect(() => {
    if (!viewport.current || !content.current) return;
    const win = viewport.current.ownerDocument.defaultView!;
    const element = viewport.current;
    const stopHeight = bindFluidComposerHeight(element, content.current, () => editorColumn.current);
    const stopScroll = bindComposerScrollBoundary(element.closest<HTMLElement>('[data-bb-chat-ui-fluid-composer]') ?? element);
    // 후속 입력은 가로·세로 이동을 즉시 끝내고 입력 사건을 그대로 전달한다.
    const interruptPosition = (event: Event) => {
      if (!(event.target instanceof win.Element) || !event.target.closest('[data-bb-chat-ui-fluid-editor]')) return;
      const followers = editorColumn.current?.getAnimations?.().filter(animation => animation.id === FLUID_EDITOR_FOLLOW_ANIMATION && animation.playState === 'running') ?? [];
      if (layoutAnimation.current?.playState !== 'running' && !followers.length) return;
      if (element.getAttribute('data-bb-chat-ui-fluid-view') !== 'input') return;
      layoutAnimation.current?.cancel();
      layoutAnimation.current = null;
      for (const animation of followers) animation.cancel();
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
    // 줄바꿈 키도 새 입력 전에 진행 중인 위치 보정을 끝낸다.
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
  useEffect(scheduleLayout, [draftText, editorReady, voiceMode, scheduleLayout]);
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
  // 호스트가 초안을 비웠을 때만 대기 중인 배치·위치 모션 없이 접힌 입력으로 복귀한다.
  useLayoutEffect(() => {
    const cleared = !previousDraft.current.voiceMode && previousDraft.current.text !== undefined && previousDraft.current.text !== '' && draftText === '';
    previousDraft.current = { text: draftText, voiceMode };
    const element = viewport.current;
    if (!element) return;
    if (draftText !== '' || voiceMode) { element.removeAttribute('data-bb-chat-ui-fluid-reset'); return; }
    if (!cleared) return;
    element.setAttribute('data-bb-chat-ui-fluid-reset', 'true');
    element.style.transition = 'none';
    layoutAnimation.current?.cancel(); layoutAnimation.current = null;
    previousPosition.current = null;
    for (const animation of editorColumn.current?.getAnimations?.() ?? []) if (animation.id === FLUID_EDITOR_FOLLOW_ANIMATION) animation.cancel();
    if (layoutFrame.current !== null) { element.ownerDocument.defaultView?.cancelAnimationFrame(layoutFrame.current); layoutFrame.current = null; }
    multilineRef.current = false; setMultiline(false);
  }, [draftText, voiceMode]);
  useLayoutEffect(() => {
    const previous = previousPosition.current, column = editorColumn.current;
    previousPosition.current = null;
    if (!previous || !column?.animate || column.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const next = content.current ? readFluidEditorPosition(column, content.current) : null;
    if (!next) return;
    const dx = previous.x - next.x;
    if (!dx) return;
    layoutAnimation.current = column.animate([{ transform: `translate(${dx}px, 0px)` }, { transform: 'translate(0, 0)' }], { duration: FLUID_COMPOSER_INPUT_MS, easing: EASE.out });
  }, [multiline]);
  return <>
    {panelOpen ? <div data-bb-chat-ui-fluid-panel-layer="">{panel}</div> : null}
    <div ref={viewport} data-bb-chat-ui-fluid-height="" data-multiline={multiline} data-bb-chat-ui-fluid-view="input" data-voice-mode={voiceMode || undefined}>
    <div data-bb-chat-ui-fluid-surface="" aria-hidden="true"/>
    {decoration}
    <div ref={content} data-bb-chat-ui-fluid-content="">
      <div data-bb-chat-ui-fluid-auxiliary="" hidden={voiceMode}>{auxiliary}</div>
      <div data-bb-chat-ui-fluid-input="">
      <div data-bb-chat-ui-fluid-attachments="" hidden={voiceMode}>{attachments}</div>
      {voice ? <div data-bb-chat-ui-fluid-voice="">{voice}</div> : <div ref={row} data-bb-chat-ui-fluid-row="" data-multiline={multiline} data-voice-mode={voiceMode || undefined}>
        <div ref={optionColumn} data-bb-chat-ui-fluid-options="" hidden={voiceMode}>{options}</div>
        <div ref={editorColumn} data-bb-chat-ui-fluid-editor="" hidden={voiceMode}>{editor}</div>
        <div ref={actionColumn} data-bb-chat-ui-fluid-actions="">{actions}</div>
      </div>}
      </div>
    </div>
    {toggle ? <div data-bb-chat-ui-fluid-toggle="" hidden={voiceMode}>{toggle}</div> : null}
    </div>
  </>;
}
