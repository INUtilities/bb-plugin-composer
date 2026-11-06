// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { FluidVoiceWaveform } from './FluidVoiceWaveform';

beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('renders the composer glow without an orb or a second audio loop', () => {
  const frames=vi.spyOn(window,'requestAnimationFrame');
  const v=render(<FluidVoiceWaveform appearance="glow" stream={null}/>);
  expect(v.container.querySelector('[data-bb-chat-ui-voice-glow]')).toBeTruthy();
  expect(v.container.querySelectorAll('[data-bb-chat-ui-voice-glow] > i')).toHaveLength(3);
  expect(v.container.querySelector('svg')).toBeNull();expect(frames).not.toHaveBeenCalled();
});

it('shares one audio context and frame between glow, held rings and wide click bars across gesture changes',()=>{
 const frames=new Map<number,FrameRequestCallback>();let next=0,value=150;
 vi.spyOn(window,'requestAnimationFrame').mockImplementation(cb=>{frames.set(++next,cb);return next;});vi.spyOn(window,'cancelAnimationFrame').mockImplementation(id=>{frames.delete(id);});
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));
 const create=vi.fn(),close=vi.fn(async()=>{}),disconnect=vi.fn();
 vi.stubGlobal('AudioContext',class{state='running';constructor(){create();}resume=async()=>{};close=close;createAnalyser(){return{fftSize:256,getByteTimeDomainData:(buffer:Uint8Array)=>buffer.fill(value),disconnect};}createMediaStreamSource(){return{connect(){},disconnect};}});
 const stream={} as MediaStream,v=render(<FluidVoiceWaveform appearance="glow" indicator="orb" stream={stream}/>);
 const tick=(time:number)=>{const [id,cb]=[...frames][0];frames.delete(id);cb(time);};
 expect(v.container.querySelectorAll('[data-bb-chat-ui-voice-ring]')).toHaveLength(21);expect(v.container.querySelectorAll('[data-bb-chat-ui-voice-glow]>i')).toHaveLength(3);
 expect(create).toHaveBeenCalledOnce();expect(frames.size).toBe(1);tick(0);
 const glow=v.container.querySelector('[data-bb-chat-ui-voice-glow]'),light=glow!.innerHTML;
 v.rerender(<FluidVoiceWaveform appearance="glow" indicator="bars" stream={stream}/>);
 expect(v.container.querySelector('[data-bb-chat-ui-voice-glow]')).toBe(glow);expect(glow!.innerHTML).toBe(light);
 expect(create).toHaveBeenCalledOnce();expect(close).not.toHaveBeenCalled();expect(frames.size).toBe(1);
 const bars=[...v.container.querySelectorAll('[data-bb-chat-ui-voice-bar]')];expect(bars).toHaveLength(49);
 const height=(bar:Element)=>Number(bar.getAttribute('y2'))-Number(bar.getAttribute('y1'));
 expect(bars.map(height).every(h=>h===2)).toBe(true);
 for(let time=34;time<=1200;time+=34)tick(time);
 expect(bars.some(bar=>height(bar)>10)).toBe(true);expect(new Set(bars.map(height)).size).toBeGreaterThan(7);
 value=128;for(let time=1234;time<=4600;time+=34)tick(time);expect(bars.every(bar=>height(bar)<2.01)).toBe(true);
 v.unmount();expect(close).toHaveBeenCalledOnce();expect(frames.size).toBe(0);expect(disconnect).toHaveBeenCalledTimes(2);
});

it('keeps depth gradients local to each mounted sphere and uses the existing foreground color', () => {
  const v = render(<><FluidVoiceWaveform stream={null}/><FluidVoiceWaveform stream={null}/></>);
  const gradients = [...v.container.querySelectorAll<SVGLinearGradientElement>('[data-bb-chat-ui-voice-depth]')];
  expect(gradients).toHaveLength(42);
  expect(new Set(gradients.map(gradient => gradient.id)).size).toBe(42);
  for (const svg of v.container.querySelectorAll('svg')) {
    for (const path of svg.querySelectorAll('[data-bb-chat-ui-voice-ring]')) {
      const id = path.getAttribute('stroke')!.slice(5, -1);
      const gradient = [...svg.querySelectorAll('linearGradient')].find(gradient => gradient.id === id)!;
      expect(gradient).toBeTruthy(); expect(gradient.getAttribute('gradientUnits')).toBe('userSpaceOnUse');
      expect([...gradient.children].map(stop => stop.getAttribute('stop-color'))).toEqual(['currentColor', 'currentColor']);
    }
  }
});

it('starts the ring entrance on mount without an audio frame and cancels it on unmount', () => {
  const descriptor = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'animate');
  const cancel = vi.fn(), animate = vi.fn(() => ({ cancel } as unknown as Animation));
  Object.defineProperty(SVGElement.prototype, 'animate', { configurable: true, value: animate });
  const frames = vi.spyOn(window, 'requestAnimationFrame');
  try {
    const v = render(<FluidVoiceWaveform stream={null}/>);
    expect(animate).toHaveBeenCalledTimes(21); expect(frames).not.toHaveBeenCalled();
    v.unmount(); expect(cancel).toHaveBeenCalledTimes(21);
  } finally {
    if (descriptor) Object.defineProperty(SVGElement.prototype, 'animate', descriptor);
    else delete (SVGElement.prototype as unknown as { animate?: unknown }).animate;
  }
});

it('keeps the 02B SVG sphere if audio analysis fails and closes its context once', () => {
  const close = vi.fn(async () => {});
  vi.stubGlobal('AudioContext', class {
    state = 'running'; close = close;
    createAnalyser() { throw new Error('analysis unavailable'); }
  });
  const v = render(<FluidVoiceWaveform stream={{} as MediaStream} />);
  expect(v.container.querySelector('[data-bb-chat-ui-voice-orbit]')).toBeTruthy();
  expect(v.container.querySelectorAll('[data-bb-chat-ui-voice-ring]')).toHaveLength(21);
  expect(v.container.querySelector('canvas')).toBeNull();
  expect(v.container.querySelector('[data-bb-chat-ui-voice-orb] svg[aria-hidden]')).toBeTruthy();
  expect(v.container.querySelector('[data-bb-chat-ui-voice-bar]')).toBeNull();
  v.unmount(); expect(close).toHaveBeenCalledOnce();
});

it('propagates smoothed volume through the sphere, honors reduced motion, and leaves capture tracks owned by the session', () => {
  let reduced = false, nextFrame = 0;
  const frames = new Map<number, FrameRequestCallback>(), listeners = new Set<() => void>();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++nextFrame, callback); return nextFrame; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
  vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced; }, addEventListener(_type: string, callback: () => void) { listeners.add(callback); }, removeEventListener(_type: string, callback: () => void) { listeners.delete(callback); } }));
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  let audioValue = 144;
  const analyser = { fftSize: 0, getByteTimeDomainData: vi.fn((buffer: Uint8Array) => buffer.fill(audioValue)), disconnect: vi.fn() };
  const close = vi.fn(async () => {}), resume = vi.fn(async () => {}), create = vi.fn();
  vi.stubGlobal('AudioContext', class {
    state = 'running'; close = close; resume = resume;
    constructor() { create(); }
    createAnalyser() { return analyser; }
    createMediaStreamSource() { return source; }
  });
  const trackStop = vi.fn(), stream = { getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream;
  const v = render(<FluidVoiceWaveform stream={null} />);
  const orb = v.container.querySelector<HTMLElement>('[data-bb-chat-ui-voice-orb]')!;
  const level = () => Number(orb.style.getPropertyValue('--bb-chat-ui-voice-energy'));
  expect(orb).toBeTruthy();expect(create).not.toHaveBeenCalled();
  const tick = (time:number) => {const [id,callback]=[...frames][0];frames.delete(id);callback(time);};
  v.rerender(<FluidVoiceWaveform stream={stream} />);
  expect(create).toHaveBeenCalledOnce();expect(frames.size).toBe(1);tick(0);
  expect(analyser.getByteTimeDomainData).toHaveBeenCalledOnce();expect(level()).toBeGreaterThan(0);
  const first=level();audioValue=64;tick(16);
  expect(level()-first).toBeGreaterThan(0);expect(level()-first).toBeLessThan(.1);
  for(let time=32;time<=800;time+=16)tick(time);
  expect(level()).toBeGreaterThan(.9);expect(level()).toBeLessThanOrEqual(1);
  audioValue=128;for(let time=816;time<=1504;time+=16)tick(time);
  const rings = orb.querySelectorAll('[data-bb-chat-ui-voice-ring]');
  expect(Number(rings[13].getAttribute('stroke-opacity'))).toBeGreaterThan(Number(rings[0].getAttribute('stroke-opacity')) + .05);
  for(let time=1520;time<=4000;time+=16)tick(time);
  expect(level()).toBeLessThan(.01);
  reduced=true;tick(4016);expect(level()).toBe(0);
  for (const ring of rings) expect(ring.getAttribute('stroke-opacity')).toBe('0.6500');
  for(const listener of listeners)listener();expect(frames.size).toBe(0);
  reduced=false;for(const listener of listeners)listener();expect(frames.size).toBe(1);audioValue=64;tick(4032);
  const frozen=level(), frozenShape=orb.innerHTML;
  v.rerender(<FluidVoiceWaveform stream={null}/>);
  expect(level()).toEqual(frozen);expect(frames.size).toBe(0);expect(listeners.size).toBe(0);
  expect(orb.innerHTML).toBe(frozenShape);
  expect(Number(rings[0].getAttribute('stroke-opacity'))).toBeGreaterThan(.65);
  vi.stubGlobal('AudioContext', undefined);
  v.rerender(<FluidVoiceWaveform stream={{} as MediaStream}/>);
  for (const ring of rings) expect(ring.getAttribute('stroke-opacity')).toBe('0.6500');
  v.unmount();expect(close).toHaveBeenCalledOnce();expect(source.disconnect).toHaveBeenCalledOnce();expect(analyser.disconnect).toHaveBeenCalledOnce();expect(trackStop).not.toHaveBeenCalled();
});
