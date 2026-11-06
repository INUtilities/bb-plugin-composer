// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createVoiceOrb, VoiceOrbitHistory, VOICE_ORBIT_RINGS } from './voice-orb-renderer';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); delete (SVGElement.prototype as unknown as { animate?: unknown }).animate; document.body.replaceChildren(); });

it('propagates a past loud sample through successive rings after the current input is silent', () => {
  const history = new VoiceOrbitHistory();
  const advance = (start: number, end: number) => {
    for (let tick = start; tick <= end; tick++) history.push(tick / 30, tick >= 6 && tick <= 10 ? 1 : 0);
  };
  advance(0, 18);
  expect(history.level(0)).toBe(0);
  expect(history.level(7)).toBeGreaterThan(.6);
  expect(history.level(20)).toBe(0);
  advance(19, 36);
  expect(history.level(7)).toBe(0);
  expect(history.level(20)).toBeGreaterThan(.3);
  advance(37, 60);
  for (let ring = 0; ring < VOICE_ORBIT_RINGS; ring++) expect(history.level(ring)).toBe(0);
});

it('sets ring size from volume rather than a periodic pulse and tolerates irregular frame intervals', () => {
  const regular = new VoiceOrbitHistory(), irregular = new VoiceOrbitHistory();
  for (let tick = 0; tick <= 90; tick++) regular.push(tick / 30, .6);
  for (const time of [0, .017, .06, .12, .29, .48, .79, 1.04, 1.6, 2, 2.4, 2.8, 3]) irregular.push(time, .6);
  for (let ring = 0; ring < VOICE_ORBIT_RINGS; ring++) expect(irregular.level(ring)).toBeCloseTo(regular.level(ring), 5);
  const levels = Array.from({ length: VOICE_ORBIT_RINGS }, (_, ring) => regular.level(ring));
  expect(levels.at(-1)).toBeCloseTo(.6 * .92 ** 12, 5);
  regular.push(3.417, .6);
  levels.forEach((level, ring) => expect(regular.level(ring)).toBeCloseTo(level, 5));
});

it('discards stale sound after a long gap, rewind or explicit reset and bounds invalid input', () => {
  const history = new VoiceOrbitHistory();
  history.push(0, 1); history.push(.3, 1); history.push(600, 0);
  for (let ring = 0; ring < VOICE_ORBIT_RINGS; ring++) expect(history.level(ring)).toBe(0);
  history.push(601, 1); history.push(0, 0);
  expect(history.level(0)).toBe(0); expect(history.level(VOICE_ORBIT_RINGS - 1)).toBe(0);
  history.push(.1, Infinity); expect(history.level(0)).toBe(0);
  history.push(.2, 5); expect(history.level(0)).toBe(1);
  history.reset(); for (let ring = 0; ring < VOICE_ORBIT_RINGS; ring++) expect(history.level(ring)).toBe(0);
});

function sphere() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const defs = document.createElementNS(svg.namespaceURI, 'defs');
  for (let i = 0; i < VOICE_ORBIT_RINGS; i++) {
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('data-bb-chat-ui-voice-ring', ''); svg.append(path);
    const gradient = document.createElementNS(svg.namespaceURI, 'linearGradient');
    gradient.setAttribute('data-bb-chat-ui-voice-depth', '');
    gradient.append(document.createElementNS(svg.namespaceURI, 'stop'), document.createElementNS(svg.namespaceURI, 'stop'));
    defs.append(gradient);
  }
  svg.append(defs);
  return svg;
}

it('keeps silent orientation and ring centers still while volume expands the radius by forty-eight percent', () => {
  const svg = sphere(), orb = createVoiceOrb(svg);
  orb.draw(0, 0); const quiet = svg.innerHTML;
  orb.draw(5, 0); expect(svg.innerHTML).toBe(quiet);
  const ellipse = () => {
    const d = svg.firstElementChild!.getAttribute('d')!;
    const match = d.match(/^M([\d.]+),([\d.]+)A([\d.]+),([\d.]+) ([\d.]+) 0 1 ([\d.]+),([\d.]+)/)!;
    return { x: (Number(match[1]) + Number(match[6])) / 2, y: (Number(match[2]) + Number(match[7])) / 2, radius: Number(match[3]) };
  };
  const before = ellipse(); orb.draw(5.1, 1); const after = ellipse();
  expect(Math.abs(after.x - before.x)).toBeLessThan(.02);
  expect(Math.abs(after.y - before.y)).toBeLessThan(.02);
  expect(after.radius).toBeGreaterThan(before.radius);
  expect(after.radius / before.radius).toBeGreaterThanOrEqual(1.479);
  expect(after.radius / before.radius).toBeLessThanOrEqual(1.481);
});

it('keeps voice brightness and stroke changes modest while preserving the quiet noise floor', () => {
  const svg = sphere(), orb = createVoiceOrb(svg), path = svg.firstElementChild!;
  orb.draw(0, 0);
  const opacity = Number(path.getAttribute('stroke-opacity')), width = Number(path.getAttribute('stroke-width'));
  orb.draw(.1, 1);
  expect(Number(path.getAttribute('stroke-opacity')) - opacity).toBeGreaterThan(0);
  expect(Number(path.getAttribute('stroke-opacity')) - opacity).toBeLessThanOrEqual(.2);
  expect(Number(path.getAttribute('stroke-width')) - width).toBeGreaterThan(0);
  expect(Number(path.getAttribute('stroke-width')) - width).toBeLessThanOrEqual(.2);
  orb.draw(.3, .01);
  expect(Number(path.getAttribute('stroke-opacity'))).toBe(opacity);
});

it('shades the far and near portions by depth independently of volume', () => {
  const svg = sphere(), orb = createVoiceOrb(svg);
  orb.draw(0, 0);
  const gradients = [...svg.querySelectorAll('[data-bb-chat-ui-voice-depth]')];
  const shades = () => gradients.map(gradient => [...gradient.children].map(stop => Number(stop.getAttribute('stop-opacity'))));
  const quiet = shades();
  for (const [far, near] of quiet) { expect(far).toBeGreaterThan(0); expect(near).toBeGreaterThan(far); expect(near).toBeLessThanOrEqual(1); }
  expect(quiet[0][0]).toBeGreaterThan(quiet[VOICE_ORBIT_RINGS - 1][1]);
  const before = gradients[0].getAttribute('gradientTransform');
  expect(before).toMatch(/^matrix\(/);
  orb.draw(.1, 1);
  expect(shades()).toEqual(quiet);
  expect(gradients[0].getAttribute('gradientTransform')).not.toBe(before);
});

it('reveals rings sequentially with opacity and releases the native animations', () => {
  const svg = sphere(), animations: { cancel: ReturnType<typeof vi.fn> }[] = [];
  const animate = vi.fn(() => { const animation = { cancel: vi.fn() }; animations.push(animation); return animation as unknown as Animation; });
  Object.defineProperty(SVGElement.prototype, 'animate', { configurable: true, value: animate });
  const orb = createVoiceOrb(svg); orb.draw(0, 0); orb.enter();
  expect(animate).toHaveBeenCalledTimes(21);
  for (let i = 0; i < VOICE_ORBIT_RINGS; i++) {
    const [frames, options] = animate.mock.calls[i] as unknown as [Keyframe[], KeyframeAnimationOptions];
    expect(frames).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    expect(options).toMatchObject({ duration: 260, delay: i * 27, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' });
  }
  orb.finishEntrance(); orb.dispose();
  for (const animation of animations) expect(animation.cancel).toHaveBeenCalledOnce();
});

it('removes rings in sequence and completes only once the last ring has disappeared', () => {
  const animations: { cancel: ReturnType<typeof vi.fn>; playState: string; onfinish: (() => void) | null }[] = [];
  const animate = vi.fn(() => { const animation = { cancel: vi.fn(), playState: 'running', onfinish: null }; animations.push(animation); return animation as unknown as Animation; });
  Object.defineProperty(SVGElement.prototype, 'animate', { configurable: true, value: animate });
  const svg = sphere(), orb = createVoiceOrb(svg), done = vi.fn(); orb.draw(0, 0);
  const cancel = orb.leave(done);
  expect(animate).toHaveBeenCalledTimes(21); expect(done).not.toHaveBeenCalled();
  for (let i = 0; i < VOICE_ORBIT_RINGS; i++) {
    const [frames, options] = animate.mock.calls[i] as unknown as [Keyframe[], KeyframeAnimationOptions];
    expect(frames).toEqual([{ opacity: 1 }, { opacity: 0 }]);
    expect(options).toMatchObject({ duration: 180, delay: i * 21, fill: 'both' });
    animations[i].playState = 'finished'; animations[i].onfinish?.();
    expect(done).toHaveBeenCalledTimes(i === VOICE_ORBIT_RINGS - 1 ? 1 : 0);
  }
  for (const path of svg.querySelectorAll<SVGElement>('[data-bb-chat-ui-voice-ring]')) expect(path.style.opacity).toBe('0');
  cancel(); orb.dispose(); expect(done).toHaveBeenCalledOnce();
  for (const animation of animations) expect(animation.cancel).toHaveBeenCalledOnce();
});

it('cancels an interrupted exit without completing it and finishes immediately for reduced motion', () => {
  let reduced = false;
  const listeners = new Set<() => void>(), cancelAnimation = vi.fn();
  vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced; }, addEventListener(_type: string, fn: () => void) { listeners.add(fn); }, removeEventListener(_type: string, fn: () => void) { listeners.delete(fn); } }));
  Object.defineProperty(SVGElement.prototype, 'animate', { configurable: true, value: vi.fn(() => ({ cancel: cancelAnimation } as unknown as Animation)) });
  const orb = createVoiceOrb(sphere()), done = vi.fn(); const cancel = orb.leave(done);
  cancel(); expect(done).not.toHaveBeenCalled(); expect(listeners.size).toBe(0);
  orb.leave(done); reduced = true; for (const fn of listeners) fn();
  expect(done).toHaveBeenCalledOnce(); expect(listeners.size).toBe(0);
  orb.dispose(); expect(done).toHaveBeenCalledOnce();
});

it('immediately ends the entrance when reduced motion changes and skips subsequent entrances', () => {
  let reduced = false;
  const listeners = new Set<() => void>(), cancel = vi.fn();
  vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced; }, addEventListener(_type: string, listener: () => void) { listeners.add(listener); }, removeEventListener(_type: string, listener: () => void) { listeners.delete(listener); } }));
  const animate = vi.fn(() => ({ cancel } as unknown as Animation));
  Object.defineProperty(SVGElement.prototype, 'animate', { configurable: true, value: animate });
  const orb = createVoiceOrb(sphere()); orb.draw(0, 0); orb.enter();
  expect(animate).toHaveBeenCalledTimes(21); expect(listeners.size).toBe(1);
  reduced = true; for (const listener of listeners) listener();
  expect(cancel).toHaveBeenCalledTimes(21); expect(listeners.size).toBe(0);
  orb.enter(); expect(animate).toHaveBeenCalledTimes(21); orb.dispose();
});

it('draws closed SVG rings without a GPU and stops writing after disposal', () => {
  const svg = sphere(), orb = createVoiceOrb(svg);
  const gpu = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
  orb.draw(0, 0); const quiet = svg.innerHTML;
  orb.draw(.1, 1); expect(svg.innerHTML).not.toBe(quiet);
  for (const path of svg.querySelectorAll('[data-bb-chat-ui-voice-ring]')) {
    const d = path.getAttribute('d')!;
    expect(d.startsWith('M')).toBe(true); expect(d.endsWith('Z')).toBe(true);
    expect(d).not.toMatch(/NaN|Infinity/);
    for (const coordinate of d.match(/-?\d+(?:\.\d+)?/g)!.map(Number)) {
      expect(coordinate).toBeGreaterThanOrEqual(0); expect(coordinate).toBeLessThanOrEqual(80);
    }
  }
  const frozen = svg.innerHTML;
  orb.dispose(); orb.dispose(); orb.draw(.3, 1); orb.reset();
  expect(svg.innerHTML).toBe(frozen); expect(gpu).not.toHaveBeenCalled();
});

it('resets old waves and reuses the same SVG on StrictMode effect replay', () => {
  const svg = sphere(), first = createVoiceOrb(svg);
  first.draw(0, 0); const quiet = svg.innerHTML;
  first.draw(.1, 1); first.dispose();
  const replay = createVoiceOrb(svg); replay.draw(0, 0);
  expect(svg.innerHTML).toBe(quiet);
  replay.draw(.3, 1); replay.reset(); replay.draw(0, 0);
  expect(svg.innerHTML).toBe(quiet);
});
