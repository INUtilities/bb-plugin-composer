import { EASE } from '../lib/motion';
import { VoiceOrbitHistory, type VoiceOrbRenderer } from './voice-orb-renderer';

/** 기존 음량 기록과 frame loop를 쓰고 하단 세 영역의 번짐만 갱신한다. */
export function createVoiceGlow(root: HTMLElement): VoiceOrbRenderer {
  const zones = Array.from(root.children) as HTMLElement[], history = new VoiceOrbitHistory();
  const win = root.ownerDocument.defaultView!, motion = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  let disposed = false, animation: Animation | null = null, done: (() => void) | undefined, target = '1';
  const cancel = () => {
    motion?.removeEventListener('change', reduce);
    if (animation) { animation.onfinish = null; animation.cancel(); animation = null; }
    done = undefined;
  };
  const complete = () => { const callback = done; root.style.opacity = target; cancel(); callback?.(); };
  function reduce() { if (motion?.matches) complete(); }
  const fade = (leaving: boolean, callback?: () => void) => {
    const from = leaving ? win.getComputedStyle(root).opacity || '1' : '0';
    cancel(); if (disposed) return () => {};
    target = leaving ? '0' : '1'; done = callback; root.style.opacity = target;
    if (!motion?.matches) animation = root.animate?.([{ opacity: from }, { opacity: target }], { duration: leaving ? 180 : 260, easing: EASE.out, fill: 'both' }) ?? null;
    if (animation) { animation.onfinish = complete; motion?.addEventListener('change', reduce); }
    else complete();
    return cancel;
  };
  return {
    draw(seconds, volume) {
      if (disposed || !Number.isFinite(seconds)) return;
      history.push(seconds, volume);
      zones.forEach((zone, index) => {
        const energy = Math.sqrt(Math.max(0, history.level(index * 6)));
        const x = (index - 1) * 34 + Math.sin(seconds * .45 + index * 1.8) * 9;
        zone.style.transform = `translate3d(${x.toFixed(3)}%,0,0) scale(${(.72 + .65 * energy).toFixed(4)},${(.55 + 1.65 * energy).toFixed(4)})`;
        zone.style.opacity = (.16 + .54 * energy).toFixed(4);
      });
    },
    enter() { fade(false); }, leave(callback) { return fade(true, callback); },
    finishEntrance() { if (target === '1') complete(); },
    reset() { if (!disposed) history.reset(); },
    dispose() { disposed = true; cancel(); history.reset(); },
  };
}
