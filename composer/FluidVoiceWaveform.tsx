import { useId, useLayoutEffect, useRef } from 'react';
import { createVoiceOrb, VOICE_ORBIT_RINGS, type VoiceOrbRenderer } from './voice-orb-renderer';
import { createVoiceGlow } from './voice-glow-renderer';
import { createVoiceBars, VOICE_BAR_COUNT } from './voice-bars-renderer';

/** 같은 음량 분석으로 레퍼런스 구 또는 컴포저 하단 glow를 그린다. 원본 track은 session이 소유한다. */
export function FluidVoiceWaveform({ stream, exiting = false, onExited, appearance = 'orb', indicator }: { stream: MediaStream | null; exiting?: boolean; onExited?(): void; appearance?: 'orb' | 'glow'; indicator?: 'orb' | 'bars' }) {
  const root = useRef<HTMLSpanElement>(null), glow = useRef<HTMLSpanElement>(null), svg = useRef<SVGSVGElement>(null);
  const renderers = useRef<VoiceOrbRenderer[]>([]);
  const exited = useRef(onExited); exited.current = onExited;
  const leaving = useRef(exiting); leaving.current = exiting;
  const depthId = useId();
  useLayoutEffect(() => {
    const main = appearance === 'glow' ? createVoiceGlow(glow.current!) : createVoiceOrb(svg.current!);
    renderers.current.push(main); main.draw(0, 0); main.enter();
    return () => {
      main.dispose(); renderers.current = renderers.current.filter(renderer => renderer !== main);
    };
  }, [appearance]);
  useLayoutEffect(() => {
    if (appearance !== 'glow' || !indicator) return;
    const detail = indicator === 'orb' ? createVoiceOrb(svg.current!) : createVoiceBars(svg.current!);
    renderers.current.push(detail); detail.draw(0, 0); detail.enter();
    return () => { detail.dispose(); renderers.current = renderers.current.filter(renderer => renderer !== detail); };
  }, [appearance, indicator]);
  useLayoutEffect(() => {
    if (!exiting) return;
    let remaining = renderers.current.length;
    const cleanups = renderers.current.map(renderer => renderer.leave(() => { if (--remaining === 0) exited.current?.(); }));
    return () => cleanups.forEach(cleanup => cleanup());
  }, [exiting, appearance, indicator]);
  useLayoutEffect(() => {
    if (!stream || !root.current) return;
    const wrapper = root.current, win = wrapper.ownerDocument.defaultView!;
    renderers.current.forEach(renderer => { renderer.reset(); renderer.draw(0, 0); });
    wrapper.style.setProperty('--bb-chat-ui-voice-energy', '0');
    const browser = win as Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Constructor = browser.AudioContext ?? browser.webkitAudioContext;
    if (!Constructor) return;
    let context: AudioContext | null = null, source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null, frame: number | null = null, stopped = false;
    const motion = win.matchMedia?.('(prefers-reduced-motion: reduce)');
    const paint = (time: number, level: number) => {
      wrapper.style.setProperty('--bb-chat-ui-voice-energy', level.toFixed(4));
      renderers.current.forEach(renderer => renderer.draw(time/1000, level));
    };
    const reset = () => { renderers.current.forEach(renderer => renderer.reset()); paint(0,0); };
    const cancel = () => { if (frame !== null) win.cancelAnimationFrame(frame); frame = null; };
    const cleanup = () => {
      if (stopped) return;
      stopped = true; cancel(); motion?.removeEventListener('change', refresh);
      if (!leaving.current) renderers.current.forEach(renderer => renderer.finishEntrance());
      source?.disconnect(); analyser?.disconnect();
      if (context && context.state !== 'closed') void context.close().catch(() => {});
    };
    let samples: Uint8Array<ArrayBuffer>;
    let level = 0, previousTime: number | null = null, previousPaint = -Infinity, startTime: number | null = null;
    const draw = (time: number) => {
      frame = null;
      if (stopped || !analyser) return;
      if (motion?.matches) { renderers.current.forEach(renderer => renderer.finishEntrance()); reset(); return; }
      analyser.getByteTimeDomainData(samples);
      let power = 0;
      for (const sample of samples) power += ((sample - 128) / 128) ** 2;
      const target = Math.min(1, Math.sqrt(power / samples.length) * 3);
      const elapsed = previousTime === null ? 16 : Math.max(0, Math.min(50, time - previousTime));
      previousTime = time;
      level += (target - level) * (1 - Math.exp(-elapsed / 240));
      wrapper.style.setProperty('--bb-chat-ui-voice-energy', level.toFixed(4));
      startTime ??= time;
      if (time - previousPaint >= 1000/30) { const seconds = (time-startTime)/1000; renderers.current.forEach(renderer => renderer.draw(seconds,level)); previousPaint = time; }
      frame = win.requestAnimationFrame(draw);
    };
    function refresh() {
      cancel(); reset();
      if (motion?.matches) renderers.current.forEach(renderer => renderer.finishEntrance());
      level = 0; previousTime = null; previousPaint = -Infinity; startTime = null;
      if (!motion?.matches && !stopped) frame = win.requestAnimationFrame(draw);
    }
    try {
      context = new Constructor(); analyser = context.createAnalyser(); analyser.fftSize = 256;
      samples = new Uint8Array(analyser.fftSize);
      source = context.createMediaStreamSource(stream); source.connect(analyser);
      void context.resume().catch(() => {});
      motion?.addEventListener('change', refresh); refresh();
    } catch { cleanup(); }
    return cleanup;
  }, [stream, appearance]);
  const sphere = <svg ref={svg} viewBox="0 0 80 80" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth=".7">
      <defs>{Array.from({ length: VOICE_ORBIT_RINGS }, (_, ring) =>
        <linearGradient key={ring} id={`${depthId}-${ring}`} data-bb-chat-ui-voice-depth="" gradientUnits="userSpaceOnUse" x1="-1" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="currentColor"/><stop offset="1" stopColor="currentColor"/>
        </linearGradient>)}</defs>
      {Array.from({ length: VOICE_ORBIT_RINGS }, (_, ring) => <path key={ring} data-bb-chat-ui-voice-ring="" stroke={`url(#${depthId}-${ring})`} vectorEffect="non-scaling-stroke" />)}
    </svg>;
  return <span ref={root} data-bb-chat-ui-voice-waveform={appearance === 'orb' ? '' : undefined} data-bb-chat-ui-voice-orb={appearance === 'orb' ? '' : undefined} data-bb-chat-ui-voice-orbit={appearance === 'orb' ? '' : undefined} data-bb-chat-ui-voice-visual={appearance === 'glow' ? indicator ?? 'glow' : undefined} aria-hidden="true">
    {appearance !== 'glow' ? sphere : <>
      <span ref={glow} data-bb-chat-ui-voice-glow=""><i/><i/><i/></span>
      {indicator === 'orb' ? <span data-bb-chat-ui-voice-waveform="" data-bb-chat-ui-voice-orb="" data-bb-chat-ui-voice-orbit="">{sphere}</span> : indicator === 'bars' ?
        <span data-bb-chat-ui-voice-bars=""><svg ref={svg} viewBox="0 0 320 24" preserveAspectRatio="none" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
          {Array.from({length:VOICE_BAR_COUNT},(_,index)=><line key={index} data-bb-chat-ui-voice-bar="" x1={(index+.5)*320/VOICE_BAR_COUNT} x2={(index+.5)*320/VOICE_BAR_COUNT} y1="11" y2="13" vectorEffect="non-scaling-stroke"/>)}
        </svg></span> : null}
    </>}
  </span>;
}
