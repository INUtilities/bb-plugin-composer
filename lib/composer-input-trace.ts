// 임시 opt-in 진단이다. 본문·문자·키·scope ID는 읽거나 저장하지 않는다.
export type ComposerTraceEvent = 'compositionstart' | 'compositionend' | 'beforeinput'
  | 'layoutProbe.enter' | 'layoutProbe.result' | 'raf.schedule' | 'raf.run' | 'raf.cancel'
  | 'ResizeObserver.layout' | 'ResizeObserver.height' | 'height.measure'
  | 'animation.start' | 'animation.cancel' | 'animation.finish';
export type ComposerTraceEntry = {
  timestamp: number; event: ComposerTraceEvent; composing: boolean; multiline: boolean;
  inputType: string | null; needsFullWidth: boolean | null; animation: AnimationKind | null;
  editorScrollHeight: number | null; editorClientHeight: number | null; editorRectHeight: number | null;
  rowRectHeight: number | null; viewportRectHeight: number | null;
};
type AnimationKind = 'height' | 'height-follow' | 'layout';
type Fields = { composing?: boolean; inputType?: string; needsFullWidth?: boolean; animation?: AnimationKind };
export type ComposerInputTraceApi = {
  start(viewport?: HTMLElement): void;
  stop(): ComposerTraceEntry[];
  remove(): void;
};
declare global { interface Window { __bbComposerInputTrace?: ComposerInputTraceApi; } }
const sessions = new WeakMap<Document, TraceSession>();
const INPUT_TYPES = new Set(['insertText','insertCompositionText','insertParagraph','insertLineBreak','insertFromPaste','insertFromDrop','insertReplacementText','deleteCompositionText','deleteContentBackward','deleteContentForward','deleteByCut','deleteByDrag','deleteWordBackward','deleteWordForward','historyUndo','historyRedo']);
const numeric = (value: number | undefined) => value !== undefined && Number.isFinite(value) ? value : null;
class TraceSession {
  readonly targets = new Set<HTMLElement>();
  readonly api: ComposerInputTraceApi;
  private target: HTMLElement | null = null;
  private entries: ComposerTraceEntry[] = [];
  private composing = false;
  private active = false;
  private timer: number | null = null;
  private cleanups = new Set<() => void>();
  readonly doc: Document;
  readonly win: Window;
  constructor(doc: Document, win: Window) {
    this.doc = doc; this.win = win;
    this.api = { start: viewport => this.start(viewport), stop: () => {const result = this.entries.map(entry => ({...entry})); this.remove(); return result;}, remove: () => this.remove() };
  }
  private start(explicit?: HTMLElement) {
    if (this.active || this.timer !== null) throw new Error('Composer trace is already started');
    const focused = this.doc.activeElement?.closest<HTMLElement>('[data-bb-chat-ui-fluid-height]');
    const target = explicit ?? focused ?? (this.targets.size === 1 ? [...this.targets][0] : null);
    if (!target || !target.isConnected || !this.targets.has(target) || sessions.get(this.doc) !== this) throw new Error('Focus an owned Composer or pass its viewport');
    this.target = target; this.active = true; this.entries = []; this.composing = false;
    // 60초 뒤 API·buffer·리스너를 모두 제거한다. 녹화가 끝나기 전에 stop()으로 내보낸다.
    this.timer = this.win.setTimeout(() => this.remove(), 60_000);
    const transition = (event: Event) => {
      if (event.target !== target || (event as TransitionEvent).propertyName !== 'height') return;
      this.record(target, event.type === 'transitionrun' ? 'animation.start' : event.type === 'transitioncancel' ? 'animation.cancel' : 'animation.finish', {animation:'height'});
    };
    for (const name of ['transitionrun','transitioncancel','transitionend']) target.addEventListener(name, transition);
    this.cleanups.add(() => {for (const name of ['transitionrun','transitioncancel','transitionend']) target.removeEventListener(name, transition);});
  }
  record(target: HTMLElement, event: ComposerTraceEvent, fields: Fields = {}) {
    if (!this.active || this.target !== target || this.entries.length >= 1024) return;
    if (fields.composing !== undefined) this.composing = fields.composing;
    try {
    const editor = target.querySelector<HTMLElement>('.ProseMirror');
    const row = target.querySelector<HTMLElement>('[data-bb-chat-ui-fluid-row]');
    this.entries.push({ timestamp:this.win.performance.now(), event, composing:this.composing,
      multiline:row?.getAttribute('data-multiline') === 'true',
      inputType:fields.inputType === undefined ? null : INPUT_TYPES.has(fields.inputType) ? fields.inputType : 'other',
      needsFullWidth:fields.needsFullWidth ?? null, animation:fields.animation ?? null,
      editorScrollHeight:numeric(editor?.scrollHeight), editorClientHeight:numeric(editor?.clientHeight),
      editorRectHeight:numeric(editor?.getBoundingClientRect().height), rowRectHeight:numeric(row?.getBoundingClientRect().height), viewportRectHeight:numeric(target.getBoundingClientRect().height) });
    } catch { this.remove(); }
  }
  animation(target: HTMLElement, animation: Animation, kind: AnimationKind) {
    if (!this.active || this.target !== target || this.entries.length >= 1024) return;
    this.record(target,'animation.start',{animation:kind});
    const end = (event: Event) => { this.record(target,event.type === 'cancel' ? 'animation.cancel' : 'animation.finish',{animation:kind}); cleanup(); };
    const cleanup = () => {animation.removeEventListener('cancel',end);animation.removeEventListener('finish',end);this.cleanups.delete(cleanup);};
    animation.addEventListener('cancel',end);animation.addEventListener('finish',end);this.cleanups.add(cleanup);
  }
  detach(viewport: HTMLElement) {
    this.targets.delete(viewport);
    if (!this.targets.size || this.target === viewport) this.remove();
  }
  remove() {
    this.active = false;
    if (this.timer !== null) this.win.clearTimeout(this.timer);
    this.timer = null;
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups.clear(); this.entries = []; this.target = null;
    if (this.win.__bbComposerInputTrace === this.api) delete this.win.__bbComposerInputTrace;
    if (sessions.get(this.doc) === this) sessions.delete(this.doc);
  }
}
// 일반 mount에서는 API만 제공한다. start 전에는 리스너·timer·observer·rAF·기하 읽기가 없다.
export function attachComposerInputTrace(viewport: HTMLElement): () => void {
  const doc = viewport.ownerDocument, win = doc.defaultView;
  if (!win) return () => {};
  let session = sessions.get(doc);
  if (!session) {
    if (Object.getOwnPropertyDescriptor(win,'__bbComposerInputTrace')) return () => {};
    session = new TraceSession(doc,win); sessions.set(doc,session);
    Object.defineProperty(win,'__bbComposerInputTrace',{configurable:true,value:session.api});
  }
  session.targets.add(viewport);
  const owner = session;
  return () => owner.detach(viewport);
}
export function traceComposerInput(viewport: HTMLElement | null, event: ComposerTraceEvent, fields?: Fields): void {
  if (viewport) sessions.get(viewport.ownerDocument)?.record(viewport,event,fields);
}
export function traceComposerAnimation(viewport: HTMLElement, animation: Animation, kind: AnimationKind = 'layout'): void {
  sessions.get(viewport.ownerDocument)?.animation(viewport,animation,kind);
}
