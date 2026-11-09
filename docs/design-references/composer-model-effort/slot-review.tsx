import React, { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createRoot } from 'react-dom/client';
import { FluidComposerBody } from '__SNAP__/composer/FluidComposerBody.tsx';
import { FluidComposerToggle } from '__SNAP__/composer/FluidComposerToggle.tsx';
import { Button } from '__SNAP__/composer/components/ui/button.tsx';
import { injectFluidComposer } from '__SNAP__/lib/fluid-composer.ts';
import { composerMenuGlassCss } from '__SNAP__/lib/composer-menu-glass.ts';
import { eventHop, prefersReducedMotion } from '__SNAP__/lib/motion.ts';

import { EffortIcon } from '__SNAP__/composer/EffortIcon.tsx';

// ── 검수 데이터 ───────────────────────────────────────────────
type Provider = 'claude' | 'codex' | 'cursor';
type Model = { id: string; name: string; provider: Provider; efforts: string[] };
const PROVIDER_NAME: Record<Provider, string> = { claude: 'Claude Code', codex: 'Codex', cursor: 'Cursor' };
const MODELS: Model[] = [
  { id: 'opus', name: 'Opus 5.5', provider: 'claude', efforts: ['low', 'medium', 'high', 'xhigh', 'max'] },
  { id: 'sonnet', name: 'Sonnet 5.5', provider: 'claude', efforts: ['low', 'medium', 'high', 'max'] },
  { id: 'haiku', name: 'Haiku 5.5', provider: 'claude', efforts: ['low', 'medium', 'high'] },
  { id: 'fable', name: 'Fable 5.1', provider: 'claude', efforts: ['low', 'medium', 'high', 'max', 'ultra'] },
  { id: 'gpt', name: 'GPT-6.1', provider: 'codex', efforts: ['minimal', 'low', 'medium', 'high', 'xhigh'] },
  { id: 'gpt-mini', name: 'GPT-6.1 mini', provider: 'codex', efforts: ['low', 'medium', 'high'] },
  { id: 'composer', name: 'Composer 2', provider: 'cursor', efforts: ['low', 'medium', 'high'] },
  { id: 'auto', name: 'Auto', provider: 'cursor', efforts: ['medium'] },
];
const LABEL: Record<string, string> = { none: 'None', minimal: 'Minimal', low: 'Low', medium: 'Medium', high: 'High', xhigh: 'Extra high', max: 'Max', ultra: 'Ultra' };
const ORDER = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
const DRAFTS = { empty: '', short: '이 함수 이름만 바꿔줘', long: '로그인 실패 때 재시도 간격을 늘리고, 세 번 연속 실패하면 잠시 잠그는 흐름을 추가해줘. 기존 테스트도 같이 고쳐줘.' };
type DraftKey = keyof typeof DRAFTS;
type Selection = { model: Model; effort: string; setModel(id: string): void; setEffort(effort: string): void };
type View = 'effort' | 'model';

// 새 모델에 같은 단계가 없으면 가장 가까운 지원 단계로 옮긴다.
function nearestEffort(model: Model, effort: string): string {
  if (model.efforts.includes(effort)) return effort;
  const rank = ORDER.indexOf(effort);
  return model.efforts.reduce((best, item) => Math.abs(ORDER.indexOf(item) - rank) < Math.abs(ORDER.indexOf(best) - rank) ? item : best, model.efforts[0]!);
}
// 선택한 Effort의 목록 위치를 읽는다.
const effortIndex = (sel: Selection) => Math.max(0, sel.model.efforts.indexOf(sel.effort));
// 제품과 같은 동작 줄이기 설정을 읽는다.
const reduced = () => prefersReducedMotion();

// 공통 크기와 선 규격으로 검수 아이콘을 그린다.
function Glyph({ size = 16, children }: { size?: number; children: ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>;
}
// 검수용 전송 화살표를 그린다.
const ArrowUp = () => <Glyph><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></Glyph>;
// 01과 같은 확인 표시를 그린다.
const Check = ({ size = 16 }: { size?: number }) => <Glyph size={size}><path d="M20 6 9 17l-5-5"/></Glyph>;
// 제품의 정보와 설정 버튼과 같은 Settings2 변형이다.
const SettingsGlyph = () => <Glyph><path d="M10 17H19"/><path d="M5 7h9"/><circle cx="7" cy="17" r="3"/><circle cx="17" cy="7" r="3"/></Glyph>;
// 실제 provider 로고 대신 쓰는 검수용 기호다.
function ProviderMark({ provider }: { provider: Provider }) {
  return <span data-proto-mark="" aria-hidden="true">{provider === 'claude'
    ? <Glyph size={14}><path d="M12 3.5 20.5 12 12 20.5 3.5 12Z"/></Glyph>
    : provider === 'codex'
      ? <Glyph size={14}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/></Glyph>
      : <Glyph size={14}><path d="M12 4 20 18H4Z"/></Glyph>}</span>;
}
// 제품의 Effort 아이콘에 현재 선택을 전달한다.
const Effort = ({ sel, level = sel.effort }: { sel: Selection; level?: string }) =>
  <EffortIcon level={level} index={sel.model.efforts.indexOf(level)} count={sel.model.efforts.length}/>;

// ── 공통 입력 ────────────────────────────────────────────────
// ProseMirror와 같은 문단 구조로 검수용 초안을 그린다. 전송은 하지 않는다.
const Editor = forwardRef<HTMLDivElement, { seed: string; placeholder: string; label: string; onText(text: string): void; overlay?: ReactNode }>(
  // 입력 엔진을 유지하면서 검수용 초안을 편집한다.
  function Editor({ seed, placeholder, label, onText, overlay }, ref) {
    const node = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => node.current!, []);
    // 편집된 문단과 빈 입력 안내를 동기화한다.
    const sync = useCallback(() => {
      const element = node.current;
      if (!element) return;
      if (!element.querySelector('p')) {
        const paragraph = document.createElement('p');
        while (element.firstChild) paragraph.append(element.firstChild);
        if (!paragraph.firstChild) paragraph.append(document.createElement('br'));
        element.append(paragraph);
      }
      const text = element.innerText.replace(/\n+$/, '');
      const first = element.firstElementChild as HTMLElement;
      first.classList.toggle('is-editor-empty', !text);
      if (placeholder) first.setAttribute('data-placeholder', placeholder); else first.removeAttribute('data-placeholder');
      onText(text);
    }, [placeholder, onText]);
    useLayoutEffect(() => {
      const element = node.current!;
      element.replaceChildren();
      for (const line of seed.split('\n')) {
        const paragraph = document.createElement('p');
        if (line) paragraph.textContent = line; else paragraph.append(document.createElement('br'));
        element.append(paragraph);
      }
      sync();
    }, [seed]);
    useLayoutEffect(sync, [placeholder]);
    return <div data-promptbox-editor-scroll="" data-proto-editor-scroll="">
      <div ref={node} className="ProseMirror" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true"
        aria-label={label} data-promptbox-editor-content="" onInput={sync}/>
      {overlay}
    </div>;
  });

// + 옵션은 제품의 상단 옵션 필 CSS를 그대로 쓴다.
function OptionPills({ onClose }: { onClose(): void }) {
  return <div data-bb-chat-ui-fluid-panel="" role="region" aria-label="컴포저 옵션">
    <div data-bb-chat-ui-fluid-panel-list="" role="menu">
      {['Attach files', 'Skills', 'Plan', 'Goal'].map(label => <button key={label} type="button" role="menuitem" onClick={onClose}><span>{label}</span></button>)}
    </div>
  </div>;
}

// 제품과 같은 크기의 검수용 전송 버튼을 만든다.
const SendButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { ring?: ReactNode }>(
  // 전달된 동작과 접근성 속성을 실제 버튼에 연결한다.
  function SendButton({ ring, ...props }, ref) {
    return <div data-promptbox-submit-group="" data-proto-send-group="">
      {ring}
      <button ref={ref} type="button" data-promptbox-submit-action="" aria-label="전송 (검수용)" {...props}><ArrowUp/></button>
    </div>;
  });

// 제품의 FluidComposerBody에 각 시안의 조작부만 끼워 넣는다.
function Composer({ id, seed, placeholder = '메시지 입력', mode, attrs, options, actions, decoration, auxiliary, editorOverlay, outside, onText, onSent, rootRef }: {
  id: string; seed: string; placeholder?: string; mode?: string | null; attrs?: Record<string, string | undefined>;
  options?: ReactNode; actions(send: () => void): ReactNode; decoration?: ReactNode; auxiliary?: ReactNode; editorOverlay?: ReactNode; outside?: ReactNode;
  onText?(text: string): void; onSent?(): void; rootRef?: RefObject<HTMLDivElement | null>;
}) {
  const [text, setText] = useState(seed);
  const [panel, setPanel] = useState(false);
  const editor = useRef<HTMLDivElement>(null);
  // 편집기의 값을 제품 높이 계산에 전달한다.
  const report = useCallback((value: string) => { setText(value); onText?.(value); }, [onText]);
  // 외부로 보내지 않고 초안만 비워 제품의 즉시 복귀를 확인한다.
  const send = () => {
    const element = editor.current;
    if (element) { const paragraph = document.createElement('p'); paragraph.append(document.createElement('br')); element.replaceChildren(paragraph); element.dispatchEvent(new Event('input', { bubbles: true })); }
    report(''); setPanel(false); onSent?.();
  };
  return <div ref={rootRef} data-proto-root="">
    <div data-promptbox-shell="">
      <form data-bb-chat-ui-fluid-composer="" data-proto={id} data-proto-mode={mode || undefined} {...attrs} onSubmit={event => event.preventDefault()}>
        <FluidComposerBody draftText={text}
          editor={<Editor ref={editor} seed={seed} placeholder={placeholder} label={`시안 ${id} 메시지`} onText={report} overlay={editorOverlay}/>}
          options={options} actions={actions(send)} attachments={null} decoration={decoration} auxiliary={auxiliary}
          toggle={<FluidComposerToggle open={panel} onClick={() => setPanel(value => !value)}/>}
          panelOpen={panel} panel={<OptionPills onClose={() => setPanel(false)}/>}/>
        {outside}
      </form>
    </div>
  </div>;
}

// 바깥 누르기·Esc·글 영역 누르기로 설정 모양을 닫는다.
function useDismiss(active: boolean, root: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!active) return;
    // 컴포저 밖이나 입력 본문을 누르면 설정을 닫는다.
    const down = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!root.current?.contains(target)) close();
      else if (target.closest('[data-bb-chat-ui-fluid-editor]') && !target.closest('[data-proto-keep]')) close();
    };
    // 슬롯의 Escape를 처리하고 입력의 기본 키 동작을 유지한다.
    const key = (event: KeyboardEvent) => {
      const focus = document.activeElement;
      if (event.key === 'Escape' && (root.current?.contains(focus) || focus === document.body)) { event.preventDefault(); event.stopPropagation(); close(); }
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', key, true); };
  }, [active, close]);
}

// 06 슬롯: 전송 왼쪽의 설정 버튼을 누르면 컴포저 전체가 잠시 provider·모델·effort 슬롯이 된다.
const PROVIDERS = Object.keys(PROVIDER_NAME) as Provider[];
type WheelItem = { key: string; label: string; icon?: ReactNode; iconOnly?: boolean };

// 시간 선택기처럼 위아래로 굴려 한 칸을 가운데에 맞춘다. 멈춘 자리의 칸을 고른다.
function Wheel({ kind, label, items, index, onPick }: { kind: string; label: string; items: WheelItem[]; index: number; onPick(index: number): void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const latest = useRef({ index, count: items.length, onPick });
  latest.current = { index, count: items.length, onPick };
  const keys = items.map(item => item.key).join('|');
  const previousKeys = useRef<string | null>(null);
  const frame = useRef(0), timer = useRef(0), suppressClick = useRef(false);
  const drag = useRef<{ id: number; y: number; top: number; moving: boolean } | null>(null);
  const id = useId();
  // 렌더된 항목에서 현재 기기의 한 칸 높이를 읽는다.
  const rowHeight = () => scroller.current?.querySelector<HTMLElement>('[role="option"]')?.offsetHeight || 36;
  // 가운데에서 멀수록 옅고 기울어져 원통 위의 칸처럼 보인다. 값은 CSS 변수로 넘기고
  // CSS가 열림 정도(--proto-slot-open)와 곱해 transform·opacity만 바꾼다.
  const paint = useCallback(() => {
    frame.current = 0;
    const element = scroller.current;
    if (!element) return;
    const row = rowHeight(), center = element.scrollTop + element.clientHeight / 2;
    for (const option of element.querySelectorAll<HTMLElement>('[role="option"]')) {
      const distance = Math.max(-3, Math.min(3, (option.offsetTop + option.offsetHeight / 2 - center) / row));
      const reach = Math.abs(distance);
      option.style.setProperty('--d', distance.toFixed(3));
      option.style.setProperty('--o', String(Math.max(.08, 1 - reach * .55)));
      option.style.setProperty('--s', String(1 - reach * .05));
    }
  }, []);
  // 손을 뗀 뒤 가장 가까운 칸을 고르고, 이미 고른 칸이면 가운데로 다시 맞춘다.
  const settle = useCallback(() => {
    window.clearTimeout(timer.current);
    const element = scroller.current;
    if (!element || drag.current) return;
    const row = rowHeight(), { index, count, onPick } = latest.current;
    const next = Math.max(0, Math.min(count - 1, Math.round(element.scrollTop / row)));
    if (next !== index) onPick(next);
    else if (Math.abs(element.scrollTop - next * row) > 1) element.scrollTo({ top: next * row, behavior: reduced() ? 'auto' : 'smooth' });
  }, []);
  // 선택이 바뀌면 굴려서 맞추고, 목록 자체가 바뀌면(다른 provider) 바로 맞춘다.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const replaced = previousKeys.current !== keys;
    previousKeys.current = keys;
    const target = index * rowHeight();
    if (Math.abs(element.scrollTop - target) > 1) element.scrollTo({ top: target, behavior: replaced || reduced() ? 'auto' : 'smooth' });
    paint();
  }, [index, keys]);
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    // 브라우저 스크롤 종료 때 선택을 확정한다.
    const end = () => settle();
    element.addEventListener('scrollend', end);
    return () => { element.removeEventListener('scrollend', end); cancelAnimationFrame(frame.current); window.clearTimeout(timer.current); };
  }, [settle]);
  // 목록 범위 안의 새 항목만 선택한다.
  const pick = (next: number) => { const { index, count, onPick } = latest.current; const clamped = Math.max(0, Math.min(count - 1, next)); if (clamped !== index) onPick(clamped); };
  // 끌기를 마치고 뒤따르는 클릭 한 번을 억제한다.
  const release = (event: React.PointerEvent<HTMLDivElement>, click: boolean) => {
    const state = drag.current;
    if (state?.id !== event.pointerId) return;
    drag.current = null;
    if (!state.moving) return;
    event.currentTarget.removeAttribute('data-dragging');
    // 끈 뒤 바로 따라오는 click 한 번만 막는다.
    if (click) { suppressClick.current = true; window.setTimeout(() => { suppressClick.current = false; }, 0); }
    settle();
  };
  return <div data-proto-wheel={kind} role="listbox" aria-label={label} tabIndex={0} aria-activedescendant={`${id}-${index}`}
    onKeyDown={event => {
      const delta = ({ ArrowUp: -1, ArrowDown: 1, PageUp: -3, PageDown: 3 } as Record<string, number>)[event.key];
      if (delta) { event.preventDefault(); pick(latest.current.index + delta); }
      else if (event.key === 'Home') { event.preventDefault(); pick(0); }
      else if (event.key === 'End') { event.preventDefault(); pick(latest.current.count - 1); }
    }}>
    <div ref={scroller} data-proto-wheel-scroll=""
      onScroll={() => {
        if (!frame.current) frame.current = requestAnimationFrame(paint);
        window.clearTimeout(timer.current); timer.current = window.setTimeout(settle, 140);
      }}
      onPointerDown={event => {
        // 마우스는 끌어서도 굴린다. 터치는 기본 스크롤과 snap에 맡긴다.
        // 4px 넘게 움직였을 때만 끌기로 잡아, 옅은 칸을 누르는 click은 그대로 칸에 간다.
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        drag.current = { id: event.pointerId, y: event.clientY, top: event.currentTarget.scrollTop, moving: false };
      }}
      onPointerMove={event => {
        const state = drag.current;
        if (state?.id !== event.pointerId) return;
        if (!state.moving) {
          if (Math.abs(event.clientY - state.y) <= 4) return;
          state.moving = true;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          event.currentTarget.setAttribute('data-dragging', '');
        }
        event.currentTarget.scrollTop = state.top - (event.clientY - state.y);
      }}
      onPointerUp={event => release(event, true)} onPointerCancel={event => release(event, false)}>
      {items.map((item, i) => <div key={item.key} id={`${id}-${i}`} role="option" aria-selected={i === index} data-proto-wheel-item=""
        aria-label={item.iconOnly ? item.label : undefined} title={item.iconOnly ? item.label : undefined}
        onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } pick(i); }}>
        {item.icon}{item.iconOnly ? null : <span>{item.label}</span>}
      </div>)}
    </div>
  </div>;
}

// 공급자 변경을 나타내는 두 방향 화살표를 그린다.
function HandoffGlyph() {
  return <Glyph><path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/></Glyph>;
}

// Fast 상태를 나타내는 번개를 같은 크기의 SVG로 그린다.
function FastGlyph() {
  return <Glyph size={14}><path d="m13 2-8 11h6l-1 9 9-12h-6l1-8Z"/></Glyph>;
}

// 같은 입력을 유지하면서 슬롯과 기존 모델·Effort 배치를 비교한다.
function SlotPicker({ sel, seed, layout = 'slot', fast = false, onFast = () => {} }: { sel: Selection; seed: string;
  layout?: 'slot' | 'current'; fast?: boolean; onFast?(): void;
}) {
  const root = useRef<HTMLDivElement>(null), gear = useRef<HTMLButtonElement>(null);
  const done = useRef<HTMLButtonElement>(null), reels = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const originProvider = useRef(sel.model.provider);
  const lastModel = useRef<Partial<Record<Provider, string>>>({});
  lastModel.current[sel.model.provider] = sel.model.id;
  const handoff = open && originProvider.current !== sel.model.provider;
  // Fast 가용성은 시안 비교용 자료이며 실제 공급자 기능을 나타내지 않는다.
  const fastAvailable = sel.model.provider !== 'cursor';
  // 닫을 때 슬롯 안의 포커스를 원래 설정 버튼으로 돌려준다.
  const close = useCallback(() => {
    const inside = root.current?.querySelector('[data-proto-slot-layer]')?.contains(document.activeElement);
    setOpen(false);
    if (inside || document.activeElement === done.current) gear.current?.focus({ preventScroll: true });
  }, []);
  useDismiss(open, root, close);
  // 설정을 열 때의 공급자를 기억하고 입력 엔진은 그대로 둔다.
  const show = (event: React.MouseEvent) => {
    if (open) { close(); return; }
    originProvider.current = sel.model.provider;
    (document.activeElement as HTMLElement | null)?.blur?.();
    setOpen(true);
    if (event.detail === 0) requestAnimationFrame(() => reels.current?.querySelectorAll<HTMLElement>('[role="listbox"]')[1]?.focus({ preventScroll: true }));
  };
  // 01과 같은 eventHop을 새 확인 버튼에 한 번 적용하고 해제 때 정리한다.
  useLayoutEffect(() => {
    if (!open || !done.current) return;
    const animation = eventHop(done.current);
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    // 표시 중 동작 줄이기를 켜면 진행 중 모션도 끝낸다.
    const stop = () => { if (motion.matches) animation?.cancel(); };
    motion.addEventListener('change', stop);
    return () => { animation?.cancel(); motion.removeEventListener('change', stop); };
  }, [open, handoff]);
  // 기존 순환 버튼과 같은 순서로 지원하는 Effort만 고른다.
  const cycleEffort = () => {
    const steps = sel.model.efforts;
    sel.setEffort(steps[(effortIndex(sel) + 1) % steps.length]!);
  };
  const models = MODELS.filter(model => model.provider === sel.model.provider);
  return <Composer id="6" rootRef={root} seed={seed} mode={open ? 'slot' : null}
    attrs={{ 'data-proto-open': open ? '' : undefined, 'data-review-layout': layout }}
    options={layout === 'current' ? <div data-review-inline-controls="">
      <Button type="button" variant="ghost" size="sm" onClick={show} aria-label={`모델 ${sel.model.name}. 눌러서 모델 고르기`}>
        <ProviderMark provider={sel.model.provider}/><span>{sel.model.name}</span>
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={cycleEffort} aria-label={`Effort: ${LABEL[sel.effort]}`}>
        <Effort sel={sel}/><span>{LABEL[sel.effort]}</span>
      </Button>
    </div> : null}
    actions={send => <>
      <Button ref={gear} type="button" size="icon" variant="ghost" data-proto-gear="" aria-expanded={open} onClick={show}
        aria-label={`모델과 Effort 설정. ${PROVIDER_NAME[sel.model.provider]}, ${sel.model.name}, ${LABEL[sel.effort]}${fast && fastAvailable ? ', Fast' : ''}`}>
        <SettingsGlyph/>{fast && fastAvailable ? <span data-review-fast-badge="" aria-hidden="true"><FastGlyph/></span> : null}
      </Button>
      <div data-review-send-slot="">
        <SendButton onClick={send}/>
        {open ? <button ref={done} type="button" data-proto-done="" data-review-done={handoff ? 'handoff' : 'check'}
          aria-label={handoff ? `${PROVIDER_NAME[sel.model.provider]}로 핸드오프` : '설정 완료'} onClick={close}>
          {handoff ? <HandoffGlyph/> : <Check/>}
        </button> : null}
      </div>
    </>}
    outside={<>
      <span data-proto-slot-backdrop="" data-open={open || undefined} aria-hidden="true"/>
      <div data-proto-slot-layer="" data-open={open || undefined} inert={!open} aria-hidden={!open || undefined} role="group" aria-label="Provider, 모델, Effort 설정">
        <div ref={reels} data-proto-slot-reels="">
          <Wheel kind="provider" label="Provider" index={PROVIDERS.indexOf(sel.model.provider)}
            items={PROVIDERS.map(provider => ({ key: provider, label: PROVIDER_NAME[provider], icon: <ProviderMark provider={provider}/>, iconOnly: true }))}
            onPick={i => { const provider = PROVIDERS[i]!; sel.setModel(lastModel.current[provider] ?? MODELS.find(model => model.provider === provider)!.id); }}/>
          <div data-review-model-column="" data-fast-available={fastAvailable || undefined}>
            <Wheel kind="model" label="모델" index={Math.max(0, models.indexOf(sel.model))}
              items={models.map(model => ({ key: model.id, label: model.name }))} onPick={i => sel.setModel(models[i]!.id)}/>
            {fastAvailable ? <button type="button" data-review-fast="" aria-label="Fast mode" aria-pressed={fast} title={fast ? 'Fast mode 켜짐' : 'Fast mode 꺼짐'} onClick={onFast}>
              <FastGlyph/>
            </button> : null}
          </div>
          <Wheel kind="effort" label="Effort" index={effortIndex(sel)}
            items={sel.model.efforts.map(level => ({ key: level, label: LABEL[level]!, icon: <Effort sel={sel} level={level}/> }))}
            onPick={i => sel.setEffort(sel.model.efforts[i]!)}/>
        </div>
      </div>
    </>}/>;
}

// ── 페이지 ───────────────────────────────────────────────────
// 컴포저 뒤로 지나가는 대화. frost 면과 모양 변화가 보이게 한다.
function Transcript() {
  return <p className="transcript" aria-hidden="true">로그인 재시도 흐름을 고쳤습니다. 실패 횟수는 세션에 저장하고, 세 번째 실패부터 30초 동안 잠급니다. 기존 테스트 네 개를 고쳤고 새 테스트 두 개를 더했습니다. 모두 통과합니다.</p>;
}

// 선택 상태가 보이는 검수용 비교 버튼을 나란히 놓는다.
function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: ReadonlyArray<readonly [T, string]>; onChange(value: T): void }) {
  return <div className="control"><span>{label}</span><div className="segmented" role="group" aria-label={label}>
    {options.map(([option, text]) => <button key={String(option)} type="button" aria-pressed={value === option} onClick={() => onChange(option)}>{text}</button>)}
  </div></div>;
}

// 검수 전용 상태로 06의 두 배치와 Fast 표시를 비교한다.
function App() {
  const [device, setDevice] = useState<'phone' | 'desktop'>('phone');
  const [width, setWidth] = useState(390);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [draft, setDraft] = useState<DraftKey>('long');
  const [layout, setLayout] = useState<'slot' | 'current'>('slot');
  const [modelId, setModelId] = useState('opus');
  const [effort, setEffort] = useState('high');
  const [fastByProvider, setFastByProvider] = useState<Partial<Record<Provider, boolean>>>({});
  const model = MODELS.find(item => item.id === modelId)!;
  const sel: Selection = { model, effort, setModel: id => {
    const next = MODELS.find(item => item.id === id)!;
    setModelId(id); setEffort(value => nearestEffort(next, value));
  }, setEffort };
  // 검수용 기기와 테마를 제품의 루트 속성으로 전달한다.
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-bb-chat-ui-root-device', device);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  }, [device, theme]);
  return <main style={{ '--stage-width': `${device === 'phone' ? width : 680}px` } as React.CSSProperties}>
    <header className="intro"><h1>06 · 컴포저 설정 비교</h1><p>설정을 열어도 입력 크기와 위치를 유지합니다.</p></header>
    <div className="toolbar">
      <Segmented label="기기" value={device} options={[[ 'phone', '휴대폰' ], [ 'desktop', '데스크톱' ]]} onChange={setDevice}/>
      {device === 'phone' ? <Segmented label="화면 폭" value={width} options={[[320,'320'],[360,'360'],[390,'390']]} onChange={setWidth}/> : null}
      <Segmented label="테마" value={theme} options={[[ 'light', '라이트' ], [ 'dark', '다크' ]]} onChange={setTheme}/>
      <Segmented label="초안" value={draft} options={[[ 'empty','비움' ],[ 'short','한 줄' ],[ 'long','긴 글' ]]} onChange={setDraft}/>
    </div>
    <section className="case" data-case="6">
      <div className="stage">
        <div data-review-layout-toggle=""><Segmented label="여러 줄 설정" value={layout} options={[[ 'slot','06 슬롯' ],[ 'current','현재 모델·Effort 배치' ]]} onChange={setLayout}/></div>
        <Transcript/>
        <SlotPicker key={draft} sel={sel} seed={DRAFTS[draft]} layout={layout}
          fast={!!fastByProvider[model.provider]} onFast={() => setFastByProvider(value => ({ ...value, [model.provider]: !value[model.provider] }))}/>
      </div>
    </section>
    <p className="selection" aria-live="polite">{PROVIDER_NAME[model.provider]} · <strong>{model.name}</strong> · {LABEL[effort]}{fastByProvider[model.provider] && model.provider !== 'cursor' ? ' · Fast' : ''}</p>
    <p className="idea">같은 공급자에서는 ✓, 다른 공급자를 고르면 핸드오프 화살표가 나타납니다. Fast는 모델 칸 옆 번개로 켜고 끕니다.</p>
    <footer>미적용 시안 · 제품 기준 <code>__COMMIT__</code> · 검수 소스 <code>__REVIEW_COMMIT__</code><br/>모델·Fast·핸드오프·전송은 검수용입니다. 실제 폰과 실제 BB 설정 연결은 확인하지 않았습니다.</footer>
  </main>;
}

injectFluidComposer(document);
const glass = document.createElement('style'); glass.id = 'bb-chat-ui-composer-menu-glass'; glass.textContent = composerMenuGlassCss; document.head.append(glass);
document.execCommand('defaultParagraphSeparator', false, 'p');
createRoot(document.getElementById('app')!).render(<App/>);
(window as unknown as { __ready: boolean }).__ready = true;
