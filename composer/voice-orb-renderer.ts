import { EASE } from '../lib/motion';

export const VOICE_ORBIT_RINGS = 21;
// 링을 촘촘하게 늘려도 구 전체의 전파 시간과 감쇠는 유지한다.
const RING_STEP = 12 / (VOICE_ORBIT_RINGS - 1);
const SAMPLE_RATE = 30, HISTORY_SIZE = 64, RING_DELAY = .075 * RING_STEP;

/** 최근 음량 64개만 보관하며 일정한 시간차로 다음 링에 전달한다. */
export class VoiceOrbitHistory {
  private readonly samples = new Float32Array(HISTORY_SIZE);
  private time: number | null = null;
  private value = 0;
  private tick = -1;
  private firstTick = 0;

  reset(): void {
    this.samples.fill(0); this.time = null; this.value = 0; this.tick = -1; this.firstTick = 0;
  }

  push(seconds: number, volume: number): void {
    if (!Number.isFinite(seconds)) return;
    seconds = Math.max(0, seconds);
    volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0;
    if (this.time !== null && (seconds < this.time || seconds - this.time >= HISTORY_SIZE / SAMPLE_RATE)) this.reset();
    const tick = Math.floor(seconds * SAMPLE_RATE);
    if (this.time === null) {
      this.firstTick = tick; this.samples[tick % HISTORY_SIZE] = volume;
    } else {
      for (let next = this.tick + 1; next <= tick; next++) {
        const blend = Math.max(0, Math.min(1, (next / SAMPLE_RATE - this.time) / (seconds - this.time)));
        this.samples[next % HISTORY_SIZE] = this.value + (volume - this.value) * blend;
      }
    }
    this.tick = tick; this.time = seconds; this.value = volume;
  }

  level(ring: number): number {
    if (this.time === null) return 0;
    if (ring === 0) return this.value;
    const at = this.time - ring * RING_DELAY, position = at * SAMPLE_RATE, before = Math.floor(position);
    if (before < this.firstTick || before < this.tick - HISTORY_SIZE + 1) return 0;
    const low = this.samples[before % HISTORY_SIZE];
    const fraction = before === this.tick
      ? (at - before / SAMPLE_RATE) / Math.max(Number.EPSILON, this.time - before / SAMPLE_RATE)
      : position - before;
    const high = before === this.tick ? this.value : this.samples[(before + 1) % HISTORY_SIZE];
    return (low + (high - low) * fraction) * .92 ** (ring * RING_STEP);
  }
}

const rings = Array.from({ length: VOICE_ORBIT_RINGS }, (_, ring) => {
  const latitude = -.94 + 1.88 * ring / (VOICE_ORBIT_RINGS - 1);
  return { latitude, radius: Math.sqrt(1 - latitude ** 2) };
});

export interface VoiceOrbRenderer {
  draw(seconds: number, level: number): void;
  enter(): void;
  leave(done: () => void): () => void;
  finishEntrance(): void;
  reset(): void;
  dispose(): void;
}

/** SVG 02B: 시간은 전파 속도를, 과거 음량은 각 링의 크기를 정한다. */
export function createVoiceOrb(svg: SVGSVGElement): VoiceOrbRenderer {
  const paths = Array.from(svg.querySelectorAll<SVGPathElement>('[data-bb-chat-ui-voice-ring]'));
  const gradients = Array.from(svg.querySelectorAll<SVGLinearGradientElement>('[data-bb-chat-ui-voice-depth]'));
  const history = new VoiceOrbitHistory();
  const turn = .84, tilt = -.38;
  const ct = Math.cos(turn), st = Math.sin(turn), ci = Math.cos(tilt), si = Math.sin(tilt);
  // 원의 앞뒤 깊이는 고정 음영이다. 음량에 따라 음영 대비가 깜빡이지 않게 한다.
  const shade = (z: number) => .12 + .88 * Math.max(0, Math.min(1, (z + 1) / 2)) ** 2;
  gradients.forEach((gradient, index) => {
    const { latitude, radius } = rings[index];
    gradient.children[0]?.setAttribute('stop-opacity', shade(-latitude * st - radius * ct).toFixed(4));
    gradient.children[1]?.setAttribute('stop-opacity', shade(-latitude * st + radius * ct).toFixed(4));
  });
  type Sequence = { leaving: boolean; done?: () => void; motion?: MediaQueryList; reduce(): void; animations: Animation[] };
  let sequence: Sequence | null = null, disposed = false;
  const cancelSequence = () => {
    const current = sequence; sequence = null;
    current?.motion?.removeEventListener('change', current.reduce);
    current?.animations.forEach(animation => { animation.onfinish = null; animation.cancel(); });
  };
  const completeSequence = () => {
    const current = sequence; if (!current) return;
    paths.forEach(path => { path.style.opacity = current.leaving ? '0' : '1'; });
    cancelSequence(); current.done?.();
  };
  const playSequence = (leaving: boolean, done?: () => void) => {
    const win = svg.ownerDocument.defaultView;
    const from = leaving ? paths.map(path => Number(win?.getComputedStyle(path).opacity || '1')) : [];
    cancelSequence();
    if (disposed) return () => {};
    const motion = win?.matchMedia?.('(prefers-reduced-motion: reduce)');
    const current: Sequence = { leaving, done, motion, reduce: () => {}, animations: [] };
    current.reduce = () => { if (motion?.matches && sequence === current) completeSequence(); };
    sequence = current;
    paths.forEach(path => { path.style.opacity = '1'; });
    if (!motion?.matches) paths.forEach((path, index) => {
      // 02A는 선을 그리지 않고 링의 면 전체를 순서대로 fade한다.
      const animation = path.animate?.([
        { opacity: leaving ? from[index] : 0 }, { opacity: leaving ? 0 : 1 },
      ], { duration: leaving ? 180 : 260, delay: index * (leaving ? 420 : 540) / (VOICE_ORBIT_RINGS - 1), easing: EASE.out, fill: 'both' });
      if (animation) {
        current.animations.push(animation);
        animation.onfinish = () => {
          if (sequence === current && current.animations.every(item => item.playState === 'finished')) completeSequence();
        };
      }
    });
    if (motion?.matches || !current.animations.length) completeSequence();
    else motion?.addEventListener('change', current.reduce);
    return () => { if (sequence === current) cancelSequence(); };
  };
  return {
    draw(seconds, level) {
      if (disposed || !Number.isFinite(seconds)) return;
      history.push(seconds, level);
      for (let ring = 0; ring < rings.length; ring++) {
        const path = paths[ring]; if (!path) continue;
        // 미세한 잡음은 멈추고 작은 발화도 크기로 읽히게 표시 음량만 보정한다.
        const energy = Math.sqrt(Math.max(0, history.level(ring) - .02) / .98);
        const scale = 31.5 * (1 + .48 * energy);
        const { latitude, radius } = rings[ring];
        // 구의 원을 두 타원 호로 투영한다. 프레임마다 점 수백 개를 생성하지 않는다.
        const x = 40 + latitude * ct * ci * 31.5, y = 40 + latitude * ct * si * 31.5;
        const major = radius * scale, minor = major * st, dx = -si * major, dy = ci * major;
        const start = `${(x + dx).toFixed(5)},${(y + dy).toFixed(5)}`;
        const end = `${(x - dx).toFixed(5)},${(y - dy).toFixed(5)}`;
        const arc = `A${major.toFixed(5)},${minor.toFixed(5)} ${(90 + tilt * 180 / Math.PI).toFixed(5)} 0 1 `;
        const outline = `M${start}${arc}${end}${arc}${start}Z`;
        path.setAttribute('d', outline);
        path.setAttribute('stroke-opacity', (.65 + .16 * energy).toFixed(4));
        path.setAttribute('stroke-width', (.65 + .15 * energy).toFixed(4));
        gradients[ring]?.setAttribute('gradientTransform', `matrix(${[minor * ci, minor * si, -major * si, major * ci, x, y].map(value => value.toFixed(5)).join(',')})`);
      }
    },
    enter() { playSequence(false); },
    leave(done) { return playSequence(true, done); },
    finishEntrance() { if (sequence && !sequence.leaving) completeSequence(); },
    reset() { if (!disposed) history.reset(); },
    dispose() { disposed = true; cancelSequence(); history.reset(); },
  };
}
