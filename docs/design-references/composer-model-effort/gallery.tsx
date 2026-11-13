import React, { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createRoot } from 'react-dom/client';
import { FluidComposerBody } from '__SNAP__/composer/FluidComposerBody.tsx';
import { FluidComposerToggle } from '__SNAP__/composer/FluidComposerToggle.tsx';
import { Button } from '__SNAP__/composer/components/ui/button.tsx';
import { injectFluidComposer } from '__SNAP__/lib/fluid-composer.ts';
import { composerMenuGlassCss } from '__SNAP__/lib/composer-menu-glass.ts';
import { mountEffortWave } from '__SNAP__/lib/composer-effort-wave.ts';
import { EASE, eventHop, prefersReducedMotion } from '__SNAP__/lib/motion.ts';

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
// 컴포저 안 눈금은 폭이 좁아 짧은 이름을 쓴다. 읽기 도구에는 전체 이름을 준다.
const SHORT: Record<string, string> = { none: 'None', minimal: 'Min', low: 'Low', medium: 'Med', high: 'High', xhigh: 'XHigh', max: 'Max', ultra: 'Ultra' };
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
const effortIndex = (sel: Selection) => Math.max(0, sel.model.efforts.indexOf(sel.effort));
const reduced = () => prefersReducedMotion();

// ── 아이콘 ────────────────────────────────────────────────────
function Glyph({ size = 16, children }: { size?: number; children: ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>;
}
const ArrowUp = () => <Glyph><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></Glyph>;
const Check = ({ size = 16 }: { size?: number }) => <Glyph size={size}><path d="M20 6 9 17l-5-5"/></Glyph>;
const ChevronLeft = () => <Glyph size={14}><path d="m15 18-6-6 6-6"/></Glyph>;
const ChevronRight = () => <Glyph size={14}><path d="m9 18 6-6-6-6"/></Glyph>;
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
const Effort = ({ sel, level = sel.effort }: { sel: Selection; level?: string }) =>
  <EffortIcon level={level} index={sel.model.efforts.indexOf(level)} count={sel.model.efforts.length}/>;

// ── 공통 입력 ────────────────────────────────────────────────
// ProseMirror와 같은 문단 구조로 검수용 초안을 그린다. 전송은 하지 않는다.
const Editor = forwardRef<HTMLDivElement, { seed: string; placeholder: string; label: string; onText(text: string): void; overlay?: ReactNode }>(
  function Editor({ seed, placeholder, label, onText, overlay }, ref) {
    const node = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => node.current!, []);
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

const SendButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { ring?: ReactNode }>(
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
    const down = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!root.current?.contains(target)) close();
      else if (target.closest('[data-bb-chat-ui-fluid-editor]') && !target.closest('[data-proto-keep]')) close();
    };
    const key = (event: KeyboardEvent) => {
      const focus = document.activeElement;
      if (event.key === 'Escape' && (root.current?.contains(focus) || focus === document.body)) { event.preventDefault(); event.stopPropagation(); close(); }
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', key, true); };
  }, [active, close]);
}

// ── 공통 조절기 ─────────────────────────────────────────────
type RulerHandle = { scrub(clientX: number): void; focus(): void };
// 제품 팝오버의 effort 눈금(mountEffortWave)을 컴포저 안에서 그대로 움직인다.
const Ruler = forwardRef<RulerHandle, { sel: Selection }>(function Ruler({ sel }, ref) {
  const track = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null), box = useRef<HTMLDivElement>(null);
  const wave = useRef<ReturnType<typeof mountEffortWave> | null>(null);
  const steps = sel.model.efforts, index = effortIndex(sel);
  const latest = useRef({ steps, effort: sel.effort, set: sel.setEffort });
  latest.current = { steps, effort: sel.effort, set: sel.setEffort };
  useLayoutEffect(() => { const next = mountEffortWave(track.current!); wave.current = next; return () => { next.stop(); wave.current = null; }; }, []);
  useLayoutEffect(() => { wave.current?.sync(steps.map(step => SHORT[step]!), index, sel.model.id); }, [steps.join('|'), index, sel.model.id]);
  const pick = useCallback((clientX: number) => {
    const { steps, effort, set } = latest.current;
    const bounds = track.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 48) return;
    const target = Math.max(0, Math.min(steps.length - 1, Math.round((clientX - bounds.left - 24) / (bounds.width - 48) * (steps.length - 1))));
    if (steps[target] !== effort) set(steps[target]!);
  }, []);
  useImperativeHandle(ref, () => ({ scrub: pick, focus: () => input.current?.focus({ preventScroll: true }) }), [pick]);
  const pointer = useRef<number | null>(null);
  const end = (event: React.PointerEvent) => { if (pointer.current === event.pointerId) { pointer.current = null; box.current?.removeAttribute('data-dragging'); } };
  return <div ref={box} data-bb-chat-ui-effort="" data-proto-ruler="">
    <div ref={track} data-effort-track=""
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0) return;
        pointer.current = event.pointerId; event.currentTarget.setPointerCapture?.(event.pointerId);
        box.current?.setAttribute('data-dragging', ''); input.current?.focus({ preventScroll: true }); pick(event.clientX);
      }}
      onPointerMove={event => { if (pointer.current === event.pointerId) pick(event.clientX); }}
      onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
      <input ref={input} type="range" aria-label="Effort" min={0} max={steps.length - 1} step={1} value={index}
        aria-valuetext={LABEL[sel.effort]} onChange={event => sel.setEffort(steps[Number(event.target.value)]!)}/>
    </div>
  </div>;
});

// 한 줄 안에서 가로로 넘기는 모델 목록이다. 누른 모델만 고른다.
function ModelStrip({ sel, onPicked }: { sel: Selection; onPicked?(): void }) {
  const list = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = list.current, chosen = element?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (element && chosen) element.scrollLeft = chosen.offsetLeft - (element.clientWidth - chosen.offsetWidth) / 2;
    chosen?.focus({ preventScroll: true });
  }, []);
  const move = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const items = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? []);
    const next = items[(items.indexOf(document.activeElement as HTMLButtonElement) + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length];
    event.preventDefault(); next?.focus(); next?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  };
  return <div ref={list} data-proto-strip="" role="radiogroup" aria-label="모델" onKeyDown={move}>
    {MODELS.map((model, index) => {
      const first = index === 0 || MODELS[index - 1]!.provider !== model.provider;
      return <React.Fragment key={model.id}>
        {first && index > 0 ? <span data-proto-strip-divider="" aria-hidden="true"/> : null}
        <button type="button" role="radio" aria-checked={model.id === sel.model.id} tabIndex={model.id === sel.model.id ? 0 : -1}
          onClick={() => { sel.setModel(model.id); onPicked?.(); }}>
          {first ? <ProviderMark provider={model.provider}/> : null}<span>{model.name}</span>
        </button>
      </React.Fragment>;
    })}
  </div>;
}

// 입력줄(또는 여러 줄의 아래 줄)을 덮는 설정 줄. 왼쪽 칩은 다른 설정으로 바꾼다.
function SettingsLayer({ open, view, setView, sel, onDone, ruler, done }: {
  open: boolean; view: View; setView(view: View): void; sel: Selection; onDone(): void;
  ruler: RefObject<RulerHandle | null>; done: RefObject<HTMLButtonElement | null>;
}) {
  return <div data-proto-layer="" data-open={open || undefined} data-view={view} inert={!open} aria-hidden={!open || undefined} role="group" aria-label="모델과 Effort 설정">
    <button type="button" data-proto-chip="" onClick={() => setView(view === 'effort' ? 'model' : 'effort')}
      aria-label={view === 'effort' ? `모델 ${sel.model.name}. 눌러서 모델 고르기` : `Effort ${LABEL[sel.effort]}. 눌러서 눈금으로`}>
      {view === 'effort'
        ? <><ProviderMark provider={sel.model.provider}/><span data-proto-chip-text="">{sel.model.name}</span></>
        : <><Effort sel={sel}/><span data-proto-chip-text="">{LABEL[sel.effort]}</span></>}
    </button>
    <div data-proto-slot="">
      <div data-proto-pane="effort" aria-hidden={view !== 'effort' || undefined} inert={view !== 'effort'}><Ruler ref={ruler} sel={sel}/></div>
      <div data-proto-pane="model">{open && view === 'model' ? <ModelStrip sel={sel} onPicked={() => setView('effort')}/> : null}</div>
    </div>
    <button ref={done} type="button" data-proto-done="" aria-label="설정 닫기" onClick={onDone}><Check/></button>
  </div>;
}

// 설정 줄을 여닫는 공통 상태. 열 때 editor를 내려 놓고, 커밋된 뒤 조절기에 포커스를 준다.
// 타이머(길게 누르기)에서 열면 커밋이 다음 frame 뒤일 수 있어 rAF 대신 layout effect를 쓴다.
function useSettingsRow(root: RefObject<HTMLElement | null>, restore: () => HTMLElement | null) {
  const [view, setView] = useState<View | null>(null);
  const ruler = useRef<RulerHandle>(null), done = useRef<HTMLButtonElement>(null), opening = useRef(false);
  const close = useCallback(() => { setView(null); restore()?.focus({ preventScroll: true }); }, [restore]);
  useDismiss(view !== null, root, close);
  const open = useCallback((next: View) => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    opening.current = true;
    setView(next);
  }, []);
  useLayoutEffect(() => {
    if (view === null) return;
    const lost = !root.current?.contains(document.activeElement);
    if (view === 'effort' && (opening.current || lost)) ruler.current?.focus();
    if (opening.current && done.current) eventHop(done.current);
    opening.current = false;
  }, [view]);
  return { view, setView, open, close, ruler, done };
}

// ── 시안 ─────────────────────────────────────────────────────
type ConceptProps = { sel: Selection; seed: string; onWidth(width: number | null): void };

// 한 줄일 때 글이 들어갈 폭을 제품의 줄바꿈 판단(needsFullWidthComposer)과 같은 식으로 읽는다.
function useEditorWidth(root: RefObject<HTMLElement | null>, onWidth: (width: number | null) => void, paused: boolean) {
  useLayoutEffect(() => {
    const element = root.current;
    const row = element?.querySelector<HTMLElement>('[data-bb-chat-ui-fluid-row]');
    const options = element?.querySelector<HTMLElement>('[data-bb-chat-ui-fluid-options]');
    const actions = element?.querySelector<HTMLElement>('[data-bb-chat-ui-fluid-actions]');
    const scroll = element?.querySelector<HTMLElement>('[data-promptbox-editor-scroll]');
    if (!row || !options || !actions || !scroll || paused) return;
    const px = (value: string) => Number.parseFloat(value) || 0;
    const read = () => {
      const style = getComputedStyle(row), inner = getComputedStyle(scroll);
      onWidth(Math.round(row.getBoundingClientRect().width - px(style.paddingLeft) - px(style.paddingRight) - options.getBoundingClientRect().width
        - actions.getBoundingClientRect().width - 2 * px(style.columnGap) - px(inner.paddingLeft) - px(inner.paddingRight)));
    };
    const observer = new ResizeObserver(read);
    for (const node of [row, options, actions]) observer.observe(node);
    read();
    return () => observer.disconnect();
  }, [paused, onWidth]);
}

// 00 지금: 비교 기준. 모델 버튼과 순환 Effort 버튼을 현재 제품과 같은 자리에 둔다.
function Current({ sel, seed, onWidth }: ConceptProps) {
  const root = useRef<HTMLDivElement>(null);
  useEditorWidth(root, onWidth, false);
  const cycle = () => { const steps = sel.model.efforts; sel.setEffort(steps[(effortIndex(sel) + 1) % steps.length]!); };
  return <Composer id="0" rootRef={root} seed={seed}
    options={<div data-bb-chat-ui-fluid-model-controls="" data-bb-chat-ui-fluid-separate-effort="">
      <div data-bb-chat-ui-fluid-native-controls="">
        <Button type="button" variant="ghost" size="sm" aria-label="Provider, model and reasoning (검수용)" onClick={() => sel.setModel(MODELS[(MODELS.indexOf(sel.model) + 1) % MODELS.length]!.id)}>
          <ProviderMark provider={sel.model.provider}/><span>{sel.model.name}</span>
        </Button>
      </div>
      <Button type="button" variant="ghost" size="sm" data-bb-chat-ui-fluid-effort="" aria-label={`Effort: ${LABEL[sel.effort]}`} onClick={cycle}>
        <Effort sel={sel}/><span data-bb-chat-ui-fluid-effort-label="" aria-hidden="true"><span data-bb-chat-ui-fluid-effort-value="">{LABEL[sel.effort]}</span></span>
      </Button>
    </div>}
    actions={send => <><Button type="button" size="icon" variant="ghost" data-bb-chat-ui-fluid-details-toggle="" aria-label="정보와 설정"><SettingsGlyph/></Button><SendButton onClick={send}/></>}/>;
}

// 01 눈금 줄: effort 버튼을 누르면 입력줄이 눈금자가 된다.
function RulerRow({ sel, seed, onWidth }: ConceptProps) {
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const row = useSettingsRow(root, useCallback(() => trigger.current, []));
  useEditorWidth(root, onWidth, row.view !== null);
  return <Composer id="1" rootRef={root} seed={seed} mode={row.view}
    options={<Button ref={trigger} type="button" variant="ghost" size="icon" data-proto-icon-button="" aria-expanded={row.view !== null}
      aria-label={`Effort ${LABEL[sel.effort]}, 모델 ${sel.model.name}`} onClick={() => row.open('effort')}><Effort sel={sel}/></Button>}
    actions={send => <SendButton onClick={send}/>}
    decoration={<SettingsLayer open={row.view !== null} view={row.view ?? 'effort'} setView={row.setView} sel={sel} onDone={row.close} ruler={row.ruler} done={row.done}/>}/>;
}

// 02 캡슐: 모델 기호와 막대가 붙은 작은 버튼이 옆으로 늘어나 조절기가 된다.
function Capsule({ sel, seed, onWidth }: ConceptProps) {
  const root = useRef<HTMLDivElement>(null), seedButton = useRef<HTMLButtonElement>(null), first = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => { setOpen(false); seedButton.current?.focus({ preventScroll: true }); }, []);
  useDismiss(open, root, close);
  useEditorWidth(root, onWidth, open);
  const name = useRef<HTMLSpanElement>(null), direction = useRef(1), previous = useRef(sel.model.id);
  // 모델 이름은 넘긴 방향으로 짧게 굴러 들어온다.
  useLayoutEffect(() => {
    if (previous.current === sel.model.id) return;
    previous.current = sel.model.id;
    if (!reduced()) name.current?.animate([{ opacity: 0, transform: `translateX(${direction.current * 10}px)` }, { opacity: 1, transform: 'none' }], { duration: 180, easing: EASE.roll });
  }, [sel.model.id]);
  const step = (delta: number) => { direction.current = delta; sel.setModel(MODELS[(MODELS.indexOf(sel.model) + delta + MODELS.length) % MODELS.length]!.id); };
  const steps = sel.model.efforts, index = effortIndex(sel);
  const normal = steps.filter(item => item !== 'max' && item !== 'ultra').length;
  const bars = useRef<HTMLDivElement>(null), dragging = useRef<number | null>(null);
  // 막대 위를 끌면 손가락 아래 단계로 바로 옮긴다.
  const scrubBars = (clientX: number) => {
    const buttons = Array.from(bars.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? []);
    const hit = buttons.findIndex(button => { const box = button.getBoundingClientRect(); return clientX >= box.left && clientX < box.right; });
    if (hit >= 0 && steps[hit] !== sel.effort) sel.setEffort(steps[hit]!);
  };
  return <Composer id="2" rootRef={root} seed={seed} mode={open ? 'capsule' : null}
    options={<Button ref={seedButton} type="button" variant="ghost" size="sm" data-proto-seed="" aria-expanded={open}
      aria-label={`모델 ${sel.model.name}, Effort ${LABEL[sel.effort]}`}
      onClick={event => {
        // 키보드로 열 때만 캡슐 안으로 포커스를 옮겨 마우스·터치에는 포커스 링을 띄우지 않는다.
        const keyboard = event.detail === 0;
        (document.activeElement as HTMLElement | null)?.blur?.(); setOpen(true);
        if (keyboard) requestAnimationFrame(() => first.current?.focus({ preventScroll: true }));
      }}>
      <ProviderMark provider={sel.model.provider}/><Effort sel={sel}/></Button>}
    actions={send => <SendButton onClick={send}/>}
    decoration={<div data-proto-capsule-track="" data-open={open || undefined}><div data-proto-capsule="" data-open={open || undefined} inert={!open} aria-hidden={!open || undefined} role="group" aria-label="모델과 Effort 설정">
      <span data-proto-capsule-face="" aria-hidden="true"/>
      <button ref={first} type="button" data-proto-capsule-close="" aria-label="접기" onClick={close} style={{ '--i': 0 } as React.CSSProperties}><ProviderMark provider={sel.model.provider}/></button>
      <button type="button" data-proto-prev="" aria-label="이전 모델" onClick={() => step(-1)} style={{ '--i': 1 } as React.CSSProperties}><ChevronLeft/></button>
      <span data-proto-capsule-name="" style={{ '--i': 2 } as React.CSSProperties} aria-live="polite"><span ref={name}>{sel.model.name}</span></span>
      <button type="button" data-proto-next="" aria-label="다음 모델" onClick={() => step(1)} style={{ '--i': 3 } as React.CSSProperties}><ChevronRight/></button>
      <span data-proto-capsule-sep="" aria-hidden="true" style={{ '--i': 4 } as React.CSSProperties}/>
      <div ref={bars} data-proto-bars="" role="radiogroup" aria-label="Effort" style={{ '--i': 5 } as React.CSSProperties}
        onPointerDown={event => { if (!event.isPrimary) return; dragging.current = event.pointerId; event.currentTarget.setPointerCapture?.(event.pointerId); scrubBars(event.clientX); }}
        onPointerMove={event => { if (dragging.current === event.pointerId) scrubBars(event.clientX); }}
        onPointerUp={() => { dragging.current = null; }} onPointerCancel={() => { dragging.current = null; }}>
        {steps.map((level, i) => {
          const special = level === 'max' || level === 'ultra';
          const height = 7 + 12 * (normal > 1 ? Math.min(i, normal - 1) / (normal - 1) : 1);
          return <button key={level} type="button" role="radio" aria-checked={level === sel.effort} aria-label={LABEL[level]} title={LABEL[level]}
            data-on={i <= index || undefined} onClick={() => sel.setEffort(level)} onKeyDown={event => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); const next = Math.max(0, Math.min(steps.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1))); sel.setEffort(steps[next]!); requestAnimationFrame(() => bars.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus()); }
            }} tabIndex={level === sel.effort ? 0 : -1}>
            {special ? <EffortIcon level={level} index={i} count={steps.length}/>
              : <svg width="8" height="20" viewBox="0 0 8 20" aria-hidden="true"><rect x="2.5" y={20 - height - 1} width="3" height={height} rx="1.5" fill="currentColor"/></svg>}
          </button>;
        })}
      </div>
      <span data-proto-capsule-label="" aria-hidden="true" style={{ '--i': 6 } as React.CSSProperties}>{LABEL[sel.effort]}</span>
    </div></div>}/>;
}

// 03 전송 버튼: 설정 버튼 없이 안내 문구에 모델, 전송 테두리에 effort를 둔다.
function SendDial({ sel, seed, onWidth }: ConceptProps) {
  const root = useRef<HTMLDivElement>(null), send = useRef<HTMLButtonElement>(null);
  const row = useSettingsRow(root, useCallback(() => send.current, []));
  const [empty, setEmpty] = useState(!seed);
  useEditorWidth(root, onWidth, row.view !== null);
  const press = useRef<{ id: number; timer: number; long: boolean } | null>(null);
  const suppress = useRef(false);
  // 길게 누르면 같은 손가락으로 바로 눈금을 끌 수 있게 창 전체의 이동을 따른다.
  const startPress = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0 || row.view) return;
    const id = event.pointerId, target = event.currentTarget;
    target.setPointerCapture?.(id);
    const state = { id, long: false, timer: window.setTimeout(() => { state.long = true; row.open('effort'); }, 320) };
    press.current = state;
    const move = (next: PointerEvent) => { if (next.pointerId === id && state.long) row.ruler.current?.scrub(next.clientX); };
    const up = (next: PointerEvent) => {
      if (next.pointerId !== id) return;
      window.clearTimeout(state.timer);
      if (state.long) suppress.current = true;
      press.current = null;
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };
  const steps = sel.model.efforts, index = effortIndex(sel), gap = 14, arc = (360 - steps.length * gap) / steps.length;
  const point = (angle: number) => { const radian = (angle - 90) * Math.PI / 180; return `${22 + 20 * Math.cos(radian)} ${22 + 20 * Math.sin(radian)}`; };
  const ring = <svg data-proto-ring="" viewBox="0 0 44 44" aria-hidden="true">
    {steps.map((level, i) => { const start = gap / 2 + i * (arc + gap); return <path key={level} d={`M ${point(start)} A 20 20 0 ${arc > 180 ? 1 : 0} 1 ${point(start + arc)}`} data-on={i <= index || undefined}/>; })}
  </svg>;
  return <Composer id="3" rootRef={root} seed={seed} mode={row.view} placeholder="" onText={text => setEmpty(!text)}
    editorOverlay={<div data-proto-placeholder="" hidden={!empty}>
      <button type="button" data-proto-keep="" onClick={() => row.open('model')} aria-label={`모델 ${sel.model.name}. 눌러서 모델 고르기`}>{sel.model.name}</button><span>에게 메시지</span>
    </div>}
    actions={sendDraft => <SendButton ref={send} ring={ring} aria-description={`Effort ${LABEL[sel.effort]}. 길게 누르면 단계 조절, 위아래 화살표로도 바꿉니다.`}
      onPointerDown={startPress} onContextMenu={event => event.preventDefault()}
      onKeyDown={event => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault(); sel.setEffort(steps[Math.max(0, Math.min(steps.length - 1, index + (event.key === 'ArrowUp' ? 1 : -1)))]!);
      }}
      onClick={() => { if (suppress.current) { suppress.current = false; return; } sendDraft(); }}/>}
    decoration={<SettingsLayer open={row.view !== null} view={row.view ?? 'effort'} setView={row.setView} sel={sel} onDone={row.close} ruler={row.ruler} done={row.done}/>}/>;
}

// 04 둘째 줄: 설정 버튼은 여러 줄 모양을 불러오고, 아래 줄에 모델과 effort를 둔다.
function SecondRow({ sel, seed, onWidth }: ConceptProps) {
  const root = useRef<HTMLDivElement>(null), gear = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [multiline, setMultiline] = useState(false);
  const row = useSettingsRow(root, useCallback(() => gear.current, []));
  const closeAll = useCallback(() => { row.setView(null); setOpen(false); }, []);
  useDismiss(open && row.view === null, root, closeAll);
  useEditorWidth(root, onWidth, open);
  useLayoutEffect(() => {
    const height = root.current?.querySelector('[data-bb-chat-ui-fluid-height]');
    if (!height) return;
    const read = () => setMultiline(height.getAttribute('data-multiline') === 'true');
    const observer = new MutationObserver(read); observer.observe(height, { attributes: true, attributeFilter: ['data-multiline'] }); read();
    return () => observer.disconnect();
  }, []);
  // 한 줄에서 두 줄 모양으로 바뀔 때 글의 가로 이동을 제품과 같은 320ms로 잇는다.
  const before = useRef<number | null>(null);
  const editorX = () => root.current?.querySelector<HTMLElement>('[data-bb-chat-ui-fluid-editor] .ProseMirror')?.getBoundingClientRect().left ?? null;
  const toggle = () => { before.current = editorX(); setOpen(value => !value); if (row.view) row.setView(null); };
  useLayoutEffect(() => {
    const from = before.current, column = root.current?.querySelector<HTMLElement>('[data-bb-chat-ui-fluid-editor]');
    before.current = null;
    const to = editorX();
    if (from === null || to === null || !column || reduced() || Math.abs(from - to) < .5) return;
    column.animate([{ transform: `translateX(${from - to}px)` }, { transform: 'none' }], { duration: 320, easing: EASE.out });
  }, [open]);
  const labels = (open || multiline) && row.view === null;
  return <Composer id="4" rootRef={root} seed={seed} mode={row.view} attrs={{ 'data-proto-open': open ? '' : undefined }}
    actions={send => <><Button ref={gear} type="button" size="icon" variant="ghost" data-bb-chat-ui-fluid-details-toggle="" aria-label="정보와 설정"
      aria-expanded={open} onClick={toggle}><SettingsGlyph/></Button><SendButton onClick={send}/></>}
    decoration={<>
      <div data-proto-labels="" data-shown={labels || undefined} inert={!labels} aria-hidden={!labels || undefined}>
        <button type="button" onClick={() => row.open('model')} aria-label={`모델 ${sel.model.name}. 눌러서 고르기`}><ProviderMark provider={sel.model.provider}/><span>{sel.model.name}</span></button>
        <button type="button" onClick={() => row.open('effort')} aria-label={`Effort ${LABEL[sel.effort]}. 눌러서 조절`}><Effort sel={sel}/><span>{LABEL[sel.effort]}</span></button>
      </div>
      <SettingsLayer open={row.view !== null} view={row.view ?? 'effort'} setView={row.setView} sel={sel} onDone={() => row.setView(null)} ruler={row.ruler} done={row.done}/>
    </>}/>;
}

// 05 목록: 모델명을 누르면 컴포저가 위로 자라 목록과 눈금을 담는다.
function GrowList({ sel, seed, onWidth }: ConceptProps) {
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => { setOpen(false); trigger.current?.focus({ preventScroll: true }); }, []);
  useDismiss(open, root, close);
  useEditorWidth(root, onWidth, open);
  useLayoutEffect(() => {
    if (!open) return;
    const chosen = list.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    chosen?.scrollIntoView({ block: 'nearest' }); chosen?.focus({ preventScroll: true });
  }, [open]);
  const groups = (Object.keys(PROVIDER_NAME) as Provider[]).map(provider => ({ provider, models: MODELS.filter(model => model.provider === provider) }));
  return <Composer id="5" rootRef={root} seed={seed} attrs={{ 'data-proto-open': open ? '' : undefined }}
    options={<Button ref={trigger} type="button" variant="ghost" size="sm" data-proto-model-trigger="" aria-expanded={open}
      aria-label={`모델 ${sel.model.name}`} onClick={() => { (document.activeElement as HTMLElement | null)?.blur?.(); setOpen(value => !value); }}>
      <ProviderMark provider={sel.model.provider}/><span>{sel.model.name}</span></Button>}
    actions={send => <SendButton onClick={() => { setOpen(false); send(); }}/>}
    auxiliary={open ? <div ref={list} data-proto-list="" role="radiogroup" aria-label="모델" data-proto-keep="">
      {groups.map(group => <div key={group.provider} data-proto-list-group="">
        <p data-proto-list-caption=""><ProviderMark provider={group.provider}/>{PROVIDER_NAME[group.provider]}</p>
        {group.models.map(model => {
          const chosen = model.id === sel.model.id;
          return <div key={model.id} data-proto-list-item="" data-chosen={chosen || undefined}>
            <button type="button" role="radio" aria-checked={chosen} onClick={() => sel.setModel(model.id)}>
              <span>{model.name}</span>{chosen ? <Check size={14}/> : <span data-proto-list-range="">{LABEL[model.efforts[0]!]}–{LABEL[model.efforts[model.efforts.length - 1]!]}</span>}
            </button>
            {chosen ? <div data-proto-list-ruler=""><Ruler sel={sel}/></div> : null}
          </div>;
        })}
      </div>)}
    </div> : null}/>;
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
    const end = () => settle();
    element.addEventListener('scrollend', end);
    return () => { element.removeEventListener('scrollend', end); cancelAnimationFrame(frame.current); window.clearTimeout(timer.current); };
  }, [settle]);
  const pick = (next: number) => { const { index, count, onPick } = latest.current; const clamped = Math.max(0, Math.min(count - 1, next)); if (clamped !== index) onPick(clamped); };
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

function SlotPicker({ sel, seed, onWidth }: ConceptProps) {
  const root = useRef<HTMLDivElement>(null), gear = useRef<HTMLButtonElement>(null), reels = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // provider를 오갈 때 그 provider에서 마지막으로 고른 모델로 돌아간다.
  const lastModel = useRef<Partial<Record<Provider, string>>>({});
  lastModel.current[sel.model.provider] = sel.model.id;
  const close = useCallback(() => {
    const inside = root.current?.querySelector('[data-proto-slot-layer]')?.contains(document.activeElement);
    setOpen(false);
    if (inside) gear.current?.focus({ preventScroll: true });
  }, []);
  useDismiss(open, root, close);
  useEditorWidth(root, onWidth, open);
  const toggle = (event: React.MouseEvent) => {
    if (open) { close(); return; }
    if ((document.activeElement as HTMLElement | null)?.closest?.('[contenteditable]')) (document.activeElement as HTMLElement).blur();
    setOpen(true);
    if (event.detail === 0) requestAnimationFrame(() => reels.current?.querySelectorAll<HTMLElement>('[role="listbox"]')[1]?.focus({ preventScroll: true }));
  };
  const providerIndex = PROVIDERS.indexOf(sel.model.provider);
  const models = MODELS.filter(model => model.provider === sel.model.provider);
  return <Composer id="6" rootRef={root} seed={seed} mode={open ? 'slot' : null} attrs={{ 'data-proto-open': open ? '' : undefined }}
    actions={send => <>
      <Button ref={gear} type="button" size="icon" variant="ghost" data-proto-gear="" aria-expanded={open} onClick={toggle}
        aria-label={open ? '설정 완료' : `모델과 Effort 설정. ${PROVIDER_NAME[sel.model.provider]}, ${sel.model.name}, ${LABEL[sel.effort]}`}>
        <span data-proto-gear-glyph="settings"><SettingsGlyph/></span>
        <span data-proto-gear-glyph="check"><Check/></span>
      </Button>
      <SendButton onClick={send}/>
    </>}
    outside={<>
      {/* 컴포저 크기는 그대로 두고, 가운데 칸을 입력줄에 맞춘 채 위아래 칸과 배경만 밖으로 펼친다. */}
      <span data-proto-slot-backdrop="" data-open={open || undefined} aria-hidden="true"/>
      <div data-proto-slot-layer="" data-open={open || undefined} inert={!open} aria-hidden={!open || undefined} role="group" aria-label="Provider, 모델, Effort 설정">
      <div ref={reels} data-proto-slot-reels="">
        <Wheel kind="provider" label="Provider" index={providerIndex}
          items={PROVIDERS.map(provider => ({ key: provider, label: PROVIDER_NAME[provider], icon: <ProviderMark provider={provider}/>, iconOnly: true }))}
          onPick={i => { const provider = PROVIDERS[i]!; sel.setModel(lastModel.current[provider] ?? MODELS.find(model => model.provider === provider)!.id); }}/>
        <Wheel kind="model" label="모델" index={Math.max(0, models.indexOf(sel.model))}
          items={models.map(model => ({ key: model.id, label: model.name }))}
          onPick={i => sel.setModel(models[i]!.id)}/>
        <Wheel kind="effort" label="Effort" index={effortIndex(sel)}
          items={sel.model.efforts.map(level => ({ key: level, label: LABEL[level]!, icon: <Effort sel={sel} level={level}/> }))}
          onPick={i => sel.setEffort(sel.model.efforts[i]!)}/>
      </div>
      </div>
    </>}/>;
}

// ── 페이지 ───────────────────────────────────────────────────
const CONCEPTS = [
  { id: 1, title: '눈금으로 바뀌는 입력줄', Component: RulerRow,
    idea: '입력줄 옆에는 effort 아이콘 하나만 둡니다. 누르면 같은 줄이 팝오버의 effort 눈금으로 바뀝니다.',
    how: ['눈금을 끌거나 누르면 단계가 바뀝니다.', '왼쪽 모델명을 누르면 같은 자리가 모델 목록이 되고, 고르면 새 모델의 눈금으로 돌아옵니다.', '전송 자리의 ✓, Esc, 바깥 누르기로 입력줄에 돌아옵니다.'],
    trade: '한 줄일 때는 설정하는 동안 입력한 글이 잠시 가려집니다.' },
  { id: 2, title: '옆으로 늘어나는 캡슐', Component: Capsule,
    idea: '모델 기호와 effort 막대만 붙은 작은 버튼입니다. 누르면 그 자리에서 양옆으로 늘어나 + 자리까지 덮는 조절기가 됩니다.',
    how: ['‹ ›로 모델을 넘깁니다. 좁은 화면에서는 › 하나만 남습니다.', '막대를 누르거나 막대 위를 끌어 단계를 고릅니다. Max는 별, Ultra는 광선입니다.', '맨 왼쪽 기호를 다시 누르면 접힙니다.'],
    trade: '가장 좁은 화면에서는 단계 이름을 빼고 막대 수로만 보여 줍니다. 모델을 하나씩 넘기므로 모델이 많으면 느립니다.' },
  { id: 3, title: '설정 버튼 없는 전송 버튼', Component: SendDial,
    idea: '설정 버튼이 없어 입력 폭이 가장 넓습니다. 모델은 빈 입력의 안내 문구에, effort는 전송 버튼의 테두리 눈금에 있습니다.',
    how: ['전송 버튼을 길게 누른 채 좌우로 밀면 단계가 바뀝니다. 짧게 누르면 평소처럼 보냅니다.', '안내 문구의 모델명을 누르면 입력줄이 모델 목록이 됩니다.', '키보드에서는 전송 버튼에서 ↑ ↓로 단계를 바꿉니다.'],
    trade: '글을 쓰는 동안 모델명이 보이지 않고, 길게 누르기를 알아야 찾을 수 있습니다.' },
  { id: 4, title: '여러 줄 모양의 아래 줄', Component: SecondRow,
    idea: '설정 버튼은 기존 정보와 설정 버튼 하나입니다. 누르면 컴포저가 여러 줄 모양으로 바뀌고 비어 있던 아래 줄에 모델과 effort가 나타납니다.',
    how: ['글이 길어져 이미 여러 줄이면 버튼을 누르지 않아도 아래 줄에 보입니다.', '모델명이나 effort를 누르면 아래 줄만 목록이나 눈금이 되고, 글은 위에 그대로 남습니다.', '설정 버튼을 다시 누르면 한 줄로 돌아갑니다.'],
    trade: '설정을 여는 동안 높이가 한 줄 늘어납니다.' },
  { id: 5, title: '위로 자라는 모델 목록', Component: GrowList,
    idea: '모델명을 누르면 컴포저가 위로 자라 모델 목록을 담습니다. 고른 모델 바로 아래에 그 모델의 effort 눈금이 붙습니다.',
    how: ['다른 모델을 누르면 눈금이 그 모델 아래로 옮겨 갑니다.', '아래 입력줄은 그대로 남아 계속 쓸 수 있습니다.', '모델명을 다시 누르거나 Esc, 전송으로 접힙니다.'],
    trade: '모델이 많을 때 가장 빨리 고를 수 있지만 높이를 가장 많이 씁니다. 평소에는 effort가 보이지 않습니다.' },
  { id: 6, title: '슬롯으로 바뀌는 컴포저', Component: SlotPicker,
    idea: '전송 버튼 왼쪽에 설정 버튼 하나만 둡니다. 누르면 컴포저는 크기와 자리를 그대로 두고 그 줄이 provider·모델·effort 슬롯의 가운데 칸이 됩니다. 위아래 칸은 배경색 그라데이션과 함께 컴포저 밖으로 옅게 펼쳐지고, 설정 버튼은 ✓로 바뀌어 전송 버튼 자리로 옮겨 갑니다.',
    how: ['각 칸을 위아래로 밀거나 휠을 굴려 고릅니다. 옅게 보이는 위아래 칸을 눌러도 됩니다. provider 칸은 아이콘만 보입니다.', 'provider를 바꾸면 옆 칸이 그 provider의 모델과 지원 effort로 바뀝니다. provider마다 마지막에 고른 모델을 기억합니다.', '✓, Esc, 바깥 누르기로 입력 모양에 돌아옵니다. 키보드에서는 칸마다 ↑ ↓로 바꿉니다.'],
    trade: '설정하는 동안 입력한 글이 가려지고, 위아래 칸이 대화와 화면 아래 여백을 잠시 덮습니다. 평소에는 모델과 effort가 보이지 않습니다.' },
] as const;

// 컴포저 뒤로 지나가는 대화. frost 면과 모양 변화가 보이게 한다.
function Transcript() {
  return <p className="transcript" aria-hidden="true">로그인 재시도 흐름을 고쳤습니다. 실패 횟수는 세션에 저장하고, 세 번째 실패부터 30초 동안 잠급니다. 기존 테스트 네 개를 고쳤고 새 테스트 두 개를 더했습니다. 모두 통과합니다.</p>;
}

function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: ReadonlyArray<readonly [T, string]>; onChange(value: T): void }) {
  return <div className="control"><span>{label}</span><div className="segmented" role="group" aria-label={label}>
    {options.map(([option, text]) => <button key={String(option)} type="button" aria-pressed={value === option} onClick={() => onChange(option)}>{text}</button>)}
  </div></div>;
}

function App() {
  const [device, setDevice] = useState<'phone' | 'desktop'>('phone');
  const [width, setWidth] = useState(390);
  const [theme, setTheme] = useState<'light' | 'dark'>(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const [draft, setDraft] = useState<DraftKey>('empty');
  const [modelId, setModelId] = useState('opus');
  const [effort, setEffort] = useState('high');
  const [widths, setWidths] = useState<Record<number, number | null>>({});
  const model = MODELS.find(item => item.id === modelId)!;
  const sel: Selection = { model, effort, setModel: id => { const next = MODELS.find(item => item.id === id)!; setModelId(id); setEffort(value => nearestEffort(next, value)); }, setEffort };
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-bb-chat-ui-root-device', device);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  }, [device, theme]);
  const reporters = useRef(new Map<number, (width: number | null) => void>());
  const reporter = (id: number) => {
    let report = reporters.current.get(id);
    if (!report) { report = value => setWidths(previous => previous[id] === value ? previous : { ...previous, [id]: value }); reporters.current.set(id, report); }
    return report;
  };
  const stage = device === 'phone' ? width : 680;
  const base = widths[0];
  const metric = (id: number) => {
    const value = widths[id];
    if (value === undefined) return '…';
    if (value === null) return '';
    return `한 줄 입력 폭 ${value}px` + (id && base ? ` · 지금보다 +${value - base}px` : '');
  };
  return <main style={{ '--stage-width': `${stage}px` } as React.CSSProperties}>
    <header className="intro">
      <h1>컴포저가 모양을 바꿔 모델·Effort를 다루는 시안 6개</h1>
      <p>모든 시안은 제품의 한 줄 입력과 넘치면 여러 줄로 펼쳐지는 동작을 그대로 씁니다. 팝오버는 열지 않습니다. 모델명에는 effort를 붙이지 않습니다.</p>
    </header>
    <div className="toolbar">
      <Segmented label="기기" value={device} options={[['phone', '휴대폰'], ['desktop', '데스크톱']]} onChange={setDevice}/>
      {device === 'phone' ? <Segmented label="화면 폭" value={width} options={[[320, '320'], [360, '360'], [390, '390']]} onChange={setWidth}/> : null}
      <Segmented label="테마" value={theme} options={[['light', '라이트'], ['dark', '다크']]} onChange={setTheme}/>
      <Segmented label="초안" value={draft} options={[['empty', '비움'], ['short', '한 줄'], ['long', '긴 글']]} onChange={setDraft}/>
    </div>
    <p className="selection">공통 선택 · <strong>{model.name}</strong> · Effort <strong>{LABEL[effort]}</strong> <span>(한 시안에서 바꾸면 모두 같이 바뀝니다)</span></p>
    <section className="case case-base" data-case="0">
      <header><span className="case-number">00</span><h2>지금</h2><span className="metric">{metric(0)}</span></header>
      <div className="stage"><Transcript/><Current key={`0-${draft}`} sel={sel} seed={DRAFTS[draft]} onWidth={reporter(0)}/></div>
    </section>
    {CONCEPTS.map(concept => <section key={concept.id} className="case" data-case={concept.id}>
      <header><span className="case-number">0{concept.id}</span><h2>{concept.title}</h2><span className="metric">{metric(concept.id)}</span></header>
      <p className="idea">{concept.idea}</p>
      <div className="stage"><Transcript/><concept.Component key={`${concept.id}-${draft}`} sel={sel} seed={DRAFTS[draft]} onWidth={reporter(concept.id)}/></div>
      <ul className="how">{concept.how.map(line => <li key={line}>{line}</li>)}</ul>
      <p className="trade">맞바꿈 · {concept.trade}</p>
    </section>)}
    <footer>미적용 시안입니다. 입력 틀·높이 전환·+ 옵션·effort 눈금은 커밋 <code>__COMMIT__</code>의 제품 코드를 그대로 썼고, 모델 목록과 전송은 검수용입니다. 실제 설정 변경과 전송은 하지 않습니다.</footer>
  </main>;
}

injectFluidComposer(document);
const glass = document.createElement('style'); glass.id = 'bb-chat-ui-composer-menu-glass'; glass.textContent = composerMenuGlassCss; document.head.append(glass);
document.execCommand('defaultParagraphSeparator', false, 'p');
createRoot(document.getElementById('app')!).render(<App/>);
(window as unknown as { __ready: boolean }).__ready = true;
