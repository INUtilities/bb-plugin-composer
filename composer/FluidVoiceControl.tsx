import { useCallback, useLayoutEffect, useRef, useState, type ReactNode, type ReactElement } from 'react';
import { Button } from './components/ui/button';
import { Icon } from './components/ui/icon';
import { HoldVoiceSession, IDLE_HOLD_VOICE, holdVoiceIsActive, type HoldVoiceDelivery, type HoldVoiceSnapshot } from '../lib/hold-voice';
import { postHaptic, readHapticBridge } from '../lib/send-haptic';
import { EMPTY_VOICE_PREVIEW, startLiveVoicePreview, type VoicePreview } from '../lib/live-voice-preview';
import { FluidVoiceWaveform } from './FluidVoiceWaveform';

export type FluidVoiceGesture = 'hold' | 'toggle';
export interface FluidVoiceControlProps {
  disabled: boolean;
  sendDisabled: boolean;
  showFallback: boolean;
  warning: string | null;
  fallback: ReactNode;
  sendIcon?: string | ReactElement | null;
  beforeCapture?(): void;
  transcribe(file: File, signal: AbortSignal): Promise<string>;
  deliver(text: string, mode: HoldVoiceDelivery): void;
  onStateChange(state: HoldVoiceSnapshot): void;
  onPreviewChange?(preview: VoicePreview): void;
  appearance?: 'orb' | 'composer';
  onStreamChange?(stream: MediaStream | null): void;
  onGestureChange?(gesture: FluidVoiceGesture): void;
}

function createRecorder(stream: MediaStream): MediaRecorder {
  const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(mime => MediaRecorder.isTypeSupported(mime));
  return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
}
function pulse(): void {
  if (document.documentElement.getAttribute('data-bb-chat-ui-root-device') === 'phone') postHaptic(readHapticBridge(window), 'selection');
}
const HOLD_TO_TRANSCRIBE_MS = 250;

// 녹음과 전사 동작을 같은 버튼 수명에 연결한다.
export function FluidVoiceControl(props: FluidVoiceControlProps) {
  const current = useRef(props); current.current = props;
  const [state, setState] = useState(IDLE_HOLD_VOICE);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [choicesOpen, setChoicesOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [gesture, setGesture] = useState<FluidVoiceGesture>('toggle');
  const primary = useRef<HTMLButtonElement>(null);
  const focusChoices = useRef(false);
  const press = useRef<{ pointerId: number; at: number; button: HTMLButtonElement } | null>(null);
  const ignorePointerClick = useRef(false);
  const clearReleaseClick = useRef<() => void>(() => {});
  const session = useRef<HoldVoiceSession | null>(null), preview = useRef<(() => void) | null>(null);
  const stopPreview = useCallback(() => { preview.current?.(); preview.current = null; }, []);
  const releasePress = useCallback(() => {
    const held = press.current; press.current = null;
    if (held) { try { held.button.releasePointerCapture?.(held.pointerId); } catch { /* OS가 먼저 capture를 해제했을 수 있다. */ } }
    return held;
  }, []);
  const cancel = useCallback(() => { if (press.current) ignorePointerClick.current = true; releasePress(); focusChoices.current = false; stopPreview(); setLeaving(false); setChoicesOpen(false); session.current?.cancel(); }, [stopPreview, releasePress]);
  // 별도 파형 버튼에서 녹음한 내용의 사용 방식을 선택할 수 있게 한다.
  const openChoices = useCallback((focus = false) => {
    if (session.current?.snapshot.phase === 'starting') { cancel(); return; }
    if (session.current?.snapshot.phase !== 'recording') return;
    focusChoices.current = focus;
    setLeaving(true);
    pulse(); stopPreview(); session.current.release();
  }, [cancel, stopPreview]);
  // 키보드로 사용하던 버튼의 초점을 선택 또는 오류 복구 단계에서 돌려준다.
  useLayoutEffect(() => {
    if (!choicesOpen || (state.phase !== 'ready' && state.phase !== 'error') || !focusChoices.current) return;
    focusChoices.current = false; primary.current?.focus({ preventScroll: true });
  }, [choicesOpen, state.phase]);
  const start = useCallback((mode: FluidVoiceGesture = 'toggle') => {
    if (!session.current || holdVoiceIsActive(session.current.snapshot)) return;
    setGesture(mode); current.current.onGestureChange?.(mode);
    focusChoices.current = false; stopPreview(); setLeaving(false); setChoicesOpen(false); pulse();
    preview.current = startLiveVoicePreview(window, value => current.current.onPreviewChange?.(value));
    void session.current.start();
  }, [stopPreview]);
  const finish = (mode: HoldVoiceDelivery) => { stopPreview(); pulse(); session.current?.finish(mode); };

  useLayoutEffect(() => {
    let mounted = true;
    const recording = new HoldVoiceSession({
      capture: () => { current.current.beforeCapture?.(); return navigator.mediaDevices.getUserMedia({ audio: true }); },
      createRecorder,
      started: captured => { if (mounted) { setStream(captured); current.current.onStreamChange?.(captured); } },
      transcribe: (file, signal) => current.current.transcribe(file, signal),
      deliver: (text, mode) => current.current.deliver(text, mode),
      changed: snapshot => {
        if (!mounted) return;
        current.current.onStateChange(snapshot);
        setState(snapshot);
        if (snapshot.phase !== 'starting' && snapshot.phase !== 'recording') { stopPreview(); setStream(null); current.current.onStreamChange?.(null); }
        if (snapshot.phase === 'error' && snapshot.hasRecording) { setLeaving(false); setChoicesOpen(true); }
        if (!holdVoiceIsActive(snapshot)) { setLeaving(false); setChoicesOpen(false); current.current.onPreviewChange?.(EMPTY_VOICE_PREVIEW); }
      },
    });
    session.current = recording;
    current.current.onStateChange(recording.snapshot);
    const loseFocus = () => { if (['starting','recording'].includes(recording.snapshot.phase)) cancel(); };
    const visibility = () => { if (document.hidden) loseFocus(); };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !holdVoiceIsActive(recording.snapshot)) return;
      event.preventDefault(); event.stopPropagation(); cancel();
    };
    window.addEventListener('blur', loseFocus); document.addEventListener('visibilitychange', visibility); window.addEventListener('keydown', escape, true);
    return () => {
      mounted = false; clearReleaseClick.current(); releasePress(); stopPreview();
      window.removeEventListener('blur', loseFocus); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('keydown', escape, true);
      recording.dispose(); current.current.onStreamChange?.(null); if (session.current === recording) session.current = null;
    };
  }, [cancel, stopPreview, releasePress]);
  useLayoutEffect(() => { if (props.disabled && session.current && holdVoiceIsActive(session.current.snapshot)) cancel(); }, [props.disabled, cancel]);

  const active = holdVoiceIsActive(state), busy = leaving || state.phase === 'stopping' || state.phase === 'transcribing';
  const composerAppearance = props.appearance === 'composer';
  const showStopSymbol = active && (!composerAppearance || (choicesOpen ? !busy : gesture === 'toggle'));
  const showMic = !active || (composerAppearance && gesture === 'hold' && !choicesOpen);
  const actionDescription = choicesOpen
    ? '변환된 내용을 입력에 남깁니다.'
    : active
      ? !composerAppearance
        ? '누르면 녹음을 멈추고 중지와 전송을 선택합니다.'
        : gesture === 'hold'
          ? '손을 떼면 녹음을 멈추고 전사문을 입력에 넣습니다.'
          : '누르면 녹음을 멈추고 전사문을 입력에 넣습니다.'
      : composerAppearance
        ? '짧게 누르면 계속 녹음합니다. 길게 누르면 손을 뗄 때 녹음을 마칩니다.'
        : '클릭하면 음성모드가 시작됩니다.';
  if (props.showFallback && !active) return props.fallback;
  return <span data-bb-chat-ui-voice-actions="" data-appearance={props.appearance} data-state={state.phase} data-gesture={props.appearance === 'composer' && active ? gesture : undefined} data-active={active || undefined} data-leaving={leaving || undefined} data-split={choicesOpen && active || undefined}
    data-bb-chat-ui-voice-split={choicesOpen && active ? '' : undefined} role={choicesOpen ? 'group' : undefined} aria-label={choicesOpen ? '음성 입력 동작' : undefined}>
    {active && props.appearance !== 'composer' ? <svg data-bb-chat-ui-voice-neck="" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path d="M0 0C12 0 16 18 24 18C32 18 36 0 48 0V48C36 48 32 30 24 30C16 30 12 48 0 48Z" fill="currentColor"/>
    </svg> : null}
    <Button ref={primary} type="button" size="icon" variant="default" data-bb-chat-ui-voice-primary=""
      data-bb-chat-ui-voice-record={choicesOpen ? undefined : ''} data-bb-chat-ui-voice-stop={choicesOpen ? '' : undefined}
      aria-label={choicesOpen ? '음성 입력 중지' : active ? '음성 녹음 중지' : '음성모드 시작'} aria-pressed={choicesOpen ? undefined : active} aria-busy={busy}
      aria-description={state.error ?? props.warning ?? actionDescription}
      disabled={props.disabled || busy}
      onPointerDown={event => {
        if (event.button !== 0 || event.isPrimary === false || press.current) return;
        ignorePointerClick.current = false;
        if (props.appearance !== 'composer' || props.disabled || busy || !session.current || holdVoiceIsActive(session.current.snapshot)) return;
        event.preventDefault();
        press.current = { pointerId: event.pointerId, at: event.timeStamp, button: event.currentTarget };
        ignorePointerClick.current = true;
        try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* capture 미지원과 합성 입력도 기본 동작을 유지한다. */ }
        start('hold');
      }}
      onPointerUp={event => {
        if (press.current?.pointerId !== event.pointerId) return;
        const held = releasePress()!;
        if (event.timeStamp - held.at < HOLD_TO_TRANSCRIBE_MS) {
          setGesture('toggle'); current.current.onGestureChange?.('toggle'); return;
        }
        if (session.current?.snapshot.phase === 'starting') cancel();
        else if (session.current?.snapshot.phase === 'recording') {
          // 빠른 전사로 버튼이 교체돼도 같은 손뗌의 호환 click이 전송으로 넘어가지 않게 한다.
          clearReleaseClick.current();
          const doc = held.button.ownerDocument, form = held.button.closest('form');
          const clear = () => {
            doc.removeEventListener('click', click, true); doc.removeEventListener('pointerdown', clear, true); doc.removeEventListener('keydown', clear, true);
            clearReleaseClick.current = () => {};
          };
          const click = (event: MouseEvent) => {
            const native = event as MouseEvent & { pointerType?: string; sourceCapabilities?: { firesTouchEvents?: boolean } };
            if ((!form || form.contains(event.target as Node)) && (event.detail > 0 || native.pointerType || native.sourceCapabilities?.firesTouchEvents)) {
              event.preventDefault(); event.stopImmediatePropagation(); ignorePointerClick.current = false;
            }
            clear();
          };
          clearReleaseClick.current = clear;
          doc.addEventListener('click', click, true); doc.addEventListener('pointerdown', clear, true); doc.addEventListener('keydown', clear, true);
          finish('insert');
        }
      }}
      onPointerCancel={event => { if (press.current?.pointerId === event.pointerId) cancel(); }}
      onLostPointerCapture={event => { if (press.current?.pointerId === event.pointerId) cancel(); }}
      onClick={
      // 작성 중 녹음은 전사문을 입력하고 별도 파형은 기존 선택을 연다.
      event => {
        event.preventDefault();
        const native = event.nativeEvent as MouseEvent & { pointerType?: string; sourceCapabilities?: { firesTouchEvents?: boolean } };
        const pointerClick = event.detail > 0 || !!native.pointerType || !!native.sourceCapabilities?.firesTouchEvents;
        const ignored = ignorePointerClick.current; ignorePointerClick.current = false;
        if (ignored && pointerClick) return;
        if (props.disabled || busy) return;
        if (choicesOpen) { if (state.phase === 'error') { pulse(); cancel(); } else finish('insert'); }
        else if (active && composerAppearance) {
          if (session.current?.snapshot.phase === 'starting') cancel();
          else { focusChoices.current = event.detail === 0; finish('insert'); }
        } else if (active) openChoices(event.detail === 0);
        else start();
      }}
      onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { if (event.repeat) event.preventDefault(); else ignorePointerClick.current = false; } }}
      onContextMenu={event => event.preventDefault()}>
      {active && !composerAppearance ? <FluidVoiceWaveform stream={stream} exiting={leaving} onExited={() => {
        if (session.current && holdVoiceIsActive(session.current.snapshot) && !current.current.disabled) { setLeaving(false); setChoicesOpen(true); }
      }}/> : null}
      {showStopSymbol ? <span data-bb-chat-ui-voice-stop-symbol="" aria-hidden="true"><Icon name="Square" className="size-3.5 fill-current [&_*]:stroke-0"/></span> : null}
      {showMic ? <Icon name="Mic" className="size-4"/> : null}
    </Button>
    {active ? <Button type="button" size="icon" variant="default" data-bb-chat-ui-voice-send="" aria-label="음성 내용 전송" aria-busy={busy}
      inert={!choicesOpen || undefined} aria-hidden={!choicesOpen || undefined} tabIndex={choicesOpen ? 0 : -1}
      disabled={!choicesOpen || busy || props.disabled || props.sendDisabled} onClick={() => finish('send')}>{typeof props.sendIcon === 'object' && props.sendIcon !== null
        ? props.sendIcon : <Icon name={props.sendIcon ?? 'CornerDownLeft'} className="size-4"/>}</Button> : null}
    {state.error ? <span className="sr-only" role="alert">{state.error}</span> : null}
  </span>;
}
