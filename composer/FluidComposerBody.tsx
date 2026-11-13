import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { bindFluidComposerHeight, FLUID_COMPOSER_INPUT_MS, FLUID_COMPOSER_INPUT_EASING, FLUID_COMPOSER_INPUT_OVERSHOOT_BOUND, FLUID_COMPOSER_LINE_MS, FLUID_COMPOSER_MORPH_MS, FLUID_EDITOR_FOLLOW_ANIMATION, readFluidEditorPosition } from '../lib/fluid-composer-height';
import { needsFullWidthComposer } from '../lib/fluid-composer-layout';
import { EASE } from '../lib/motion';
import { bindComposerScrollBoundary } from '../lib/composer-scroll-boundary';

// 입력 높이와 모서리를 유지하고 옵션 필을 입력창 위에 독립적으로 표시한다.
export function FluidComposerBody({ editor, options, actions, attachments, voice, voiceMode = false, decoration, auxiliary, panel, panelOpen = false, toggle, draftText, draftEditVersion = 0, editorReady = true }: {
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
  draftEditVersion?: number;
  editorReady?: boolean;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const syncHeight = useRef<() => void>(() => {});
  const row = useRef<HTMLDivElement>(null), editorColumn = useRef<HTMLDivElement>(null);
  const optionColumn = useRef<HTMLDivElement>(null), actionColumn = useRef<HTMLDivElement>(null);
  const [multiline, setMultiline] = useState(false);
  const [panelPresent, setPanelPresent] = useState(panelOpen);
  const panelLayer = useRef<HTMLDivElement>(null);
  // 퇴장이 끝날 때까지 옵션 노드를 유지하고 재열림·동작 줄이기·해제 때 예약을 정리한다.
  useLayoutEffect(() => {
    if (panelOpen) { setPanelPresent(true); return; }
    if (!panelPresent) return;
    const win = panelLayer.current?.ownerDocument.defaultView;
    if (!win) return;
    const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
    const count = panelLayer.current?.querySelectorAll('[role="menuitem"]').length ?? 0;
    const timer = win.setTimeout(() => setPanelPresent(false), 200 + Math.max(0, count - 1) * 45);
    // 동작 줄이기를 켜면 남아 있는 옵션도 즉시 제거한다.
    const reduce = () => { if (motion.matches) setPanelPresent(false); };
    reduce(); motion.addEventListener('change', reduce);
    return () => { win.clearTimeout(timer); motion.removeEventListener('change', reduce); };
  }, [panelOpen, panelPresent]);
  const multilineRef = useRef(false), layoutFrame = useRef<number | null>(null);
  const previousDraft = useRef({ text: draftText, voiceMode, editVersion: draftEditVersion });
  const previousPosition = useRef<{ x: number; y: number } | null>(null);
  const inputPosition = useRef<{ x: number; y: number } | null>(null);
  const layoutAnimation = useRef<Animation | null>(null);
  const actionAnimation = useRef<Animation | null>(null);
  const actionPosition = useRef<{ x: number; y: number } | null>(null);
  const previousVoiceMode = useRef(voiceMode);
  const voicePane = useRef<HTMLElement | null>(null);
  const layoutProbe = useRef((_beforeInput?: { x: number; y: number }) => {});
  // 입력 전 위치를 사용해 원격의 첫 프레임 보정과 현재 높이 곡선을 함께 유지한다.
  layoutProbe.current = beforeInput => {
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
    if (viewport.current?.closest('[data-bb-chat-ui-slot-open]')) return;
    const input = editorColumn.current?.querySelector<HTMLElement>('[data-bb-chat-ui-voice-transcript], .ProseMirror');
    if (!input || !row.current || !optionColumn.current || !actionColumn.current || !editorColumn.current || !content.current) return;
    if (!draftText && !voiceMode) actionPosition.current = actionColumn.current.getBoundingClientRect();
    const next = voiceMode || needsFullWidthComposer(row.current, input, optionColumn.current, actionColumn.current);
    if (next === multilineRef.current) return;
    previousPosition.current = beforeInput ?? readFluidEditorPosition(editorColumn.current, content.current);
    layoutAnimation.current?.cancel();
    multilineRef.current = next; setMultiline(next);
  };
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
    syncHeight.current = stopHeight.sync;
    const stopScroll = bindComposerScrollBoundary(element.closest<HTMLElement>('[data-bb-chat-ui-fluid-composer]') ?? element);
    const interruptPosition = (event: Event) => {
      if (!(event.target instanceof win.Element) || !event.target.closest('[data-bb-chat-ui-fluid-editor]')) return;
      if (!multilineRef.current) {
        // 좁은 열에서 이미 줄바꿈된 좌표를 모션 시작점으로 삼지 않는다.
        inputPosition.current = editorColumn.current && content.current ? readFluidEditorPosition(editorColumn.current, content.current) : null;
      }
      const followers = editorColumn.current?.getAnimations?.().filter(animation => animation.id === FLUID_EDITOR_FOLLOW_ANIMATION && animation.playState === 'running') ?? [];
      if (layoutAnimation.current?.playState !== 'running' && !followers.length) return;
      if (element.getAttribute('data-bb-chat-ui-fluid-view') !== 'input') return;
      layoutAnimation.current?.cancel();
      layoutAnimation.current = null;
      for (const animation of followers) animation.cancel();
      editorColumn.current?.removeAttribute('data-bb-chat-ui-fluid-moving');
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
      syncHeight.current = () => {};
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
    element.addEventListener('bb-chat-ui:fluid-effort-layout', scheduleLayout);
    for (const element of [row.current, optionColumn.current, actionColumn.current]) if (element) observer.observe(element);
    if (pane) { observer.observe(pane); if (pane !== element) observer.observe(element); }
    scheduleLayout();
    return () => {
      observer.disconnect(); voicePane.current = null;
      element.removeEventListener('bb-chat-ui:fluid-effort-layout', scheduleLayout);
      element.style.removeProperty('--bb-chat-ui-voice-backdrop-width'); element.style.removeProperty('--bb-chat-ui-voice-backdrop-left'); element.style.removeProperty('--bb-chat-ui-voice-backdrop-bottom');
    };
  }, [!!voice, voiceMode, scheduleLayout]);
  useLayoutEffect(() => {
    // 입력이 좁은 열에서 먼저 줄바꿈된 한 프레임을 그리지 않게 한다.
    if (layoutFrame.current !== null) {
      viewport.current?.ownerDocument.defaultView?.cancelAnimationFrame(layoutFrame.current);
      layoutFrame.current = null;
    }
    const beforeInput = previousDraft.current.text !== draftText ? inputPosition.current : null;
    inputPosition.current = null;
    layoutProbe.current(beforeInput ?? undefined);
  }, [draftText, editorReady, panelOpen, voiceMode]);
  // 호스트 초안의 편집기 DOM 반영은 commit 뒤일 수 있으므로 기존 예약 프레임으로 한 번 더 맞춘다.
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
  // 직접 지울 때는 접힘 전환을 유지하고 호스트가 초안을 비울 때만 즉시 초기화한다.
  useLayoutEffect(() => {
    const cleared = !previousDraft.current.voiceMode && previousDraft.current.text !== undefined && previousDraft.current.text !== '' && draftText === '';
    const edited = previousDraft.current.editVersion !== draftEditVersion;
    previousDraft.current = { text: draftText, voiceMode, editVersion: draftEditVersion };
    const element = viewport.current;
    if (!element) return;
    if (edited || draftText !== '' || voiceMode) { element.removeAttribute('data-bb-chat-ui-fluid-reset'); return; }
    if (!cleared) return;
    element.setAttribute('data-bb-chat-ui-fluid-reset', 'true');
    element.style.transition = 'none';
    previousPosition.current = null;
    layoutAnimation.current?.cancel(); layoutAnimation.current = null;
    for (const animation of editorColumn.current?.getAnimations?.() ?? []) if (animation.id === FLUID_EDITOR_FOLLOW_ANIMATION) animation.cancel();
    editorColumn.current?.removeAttribute('data-bb-chat-ui-fluid-moving');
    if (layoutFrame.current !== null) { element.ownerDocument.defaultView?.cancelAnimationFrame(layoutFrame.current); layoutFrame.current = null; }
    multilineRef.current = false; setMultiline(false);
  }, [draftText, draftEditVersion, voiceMode]);
  // 같은 입력 노드의 가로 위치를 큰 펼침과 빠른 접힘에 맞춰 보정한다.
  useLayoutEffect(() => {
    // 여러 줄 commit의 첫 paint부터 목표 높이를 적용하고 기존 전환은 유지한다.
    syncHeight.current();
    const previous = previousPosition.current, column = editorColumn.current;
    previousPosition.current = null;
    if (!previous || !column?.animate || column.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const next = content.current ? readFluidEditorPosition(column, content.current) : null;
    if (!next) return;
    const dx = previous.x - next.x;
    if (!dx) return;
    const horizontalEase = next.x - Math.max(0, dx) * FLUID_COMPOSER_INPUT_OVERSHOOT_BOUND < 0 ? EASE.out : FLUID_COMPOSER_INPUT_EASING;
    const animation = column.animate([{ transform: `translate(${dx}px, 0px)` }, { transform: 'translate(0, 0)' }], { duration: multiline ? FLUID_COMPOSER_INPUT_MS : FLUID_COMPOSER_LINE_MS, easing: multiline ? horizontalEase : 'ease-out' });
    layoutAnimation.current = animation;
    // iOS draws its caret outside the page and does not follow this transform,
    // so phone CSS hides the caret until the column reaches its new place.
    column.setAttribute('data-bb-chat-ui-fluid-moving', '');
    animation.onfinish = animation.oncancel = () => {
      if (layoutAnimation.current === animation || layoutAnimation.current === null) column.removeAttribute('data-bb-chat-ui-fluid-moving');
    };
  }, [multiline]);
  return <>
    {panelOpen || panelPresent ? <div ref={panelLayer} data-bb-chat-ui-fluid-panel-layer="" inert={!panelOpen || undefined} aria-hidden={!panelOpen || undefined}>{panel}</div> : null}
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
