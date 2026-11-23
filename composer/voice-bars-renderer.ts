import { VoiceOrbitHistory, type VoiceOrbRenderer } from './voice-orb-renderer';

export const VOICE_BAR_COUNT = 41;

// 음량을 오른쪽에서 왼쪽으로 전달하며 각 막대의 높이와 밝기를 조절한다.
export function createVoiceBars(svg: SVGSVGElement): VoiceOrbRenderer {
  const lines = Array.from(svg.querySelectorAll<SVGLineElement>('[data-bb-chat-ui-voice-bar]'));
  // 각 막대의 위치에 따른 밝기, 움직임의 위상, 음량 지연을 한 번만 정한다.
  const bars = lines.map((line, index) => {
    const position = index / Math.max(1, lines.length - 1);
    const envelope = Math.sin(position * Math.PI) ** 1.65;
    line.setAttribute('stroke-opacity', (.38 + .62 * envelope).toFixed(3));
    return { line, envelope, phase: index * 2.39996, delay: (1 - position) * 20, clusterPhase: position * Math.PI * 1.6 };
  });
  const history = new VoiceOrbitHistory();
  let disposed = false;
  return {
    // 무음의 작은 움직임에 과거 음량과 서로 다른 막대 높이를 더한다.
    draw(seconds, volume) {
      if (disposed || !Number.isFinite(seconds)) return;
      history.push(seconds, volume);
      for (const { line, envelope, phase, delay, clusterPhase } of bars) {
        const energy = Math.sqrt(Math.min(1, Math.max(0, history.level(delay) - .02) * 3));
        const grain = Math.sin(seconds * 6.1 + phase) ** 2;
        const cluster = .70 + .30 * Math.sin(seconds * 3.4 - clusterPhase) ** 2;
        const floor = 1.35 + envelope * (.5 + 3.2 * grain);
        const height = floor + (24 - floor) * energy * envelope * (.12 + .88 * grain) * cluster;
        line.setAttribute('y1', (12 - height / 2).toFixed(4));
        line.setAttribute('y2', (12 + height / 2).toFixed(4));
      }
    },
    enter() {}, leave(done) { done(); return () => {}; }, finishEntrance() {},
    reset() { if (!disposed) history.reset(); },
    dispose() { disposed = true; history.reset(); },
  };
}
