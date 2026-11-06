import { VoiceOrbitHistory, type VoiceOrbRenderer } from './voice-orb-renderer';

export const VOICE_BAR_COUNT = 49;

/** 얇은 막대를 넓게 배치하고 같은 음량 기록을 오른쪽에서 왼쪽으로 전파한다. */
export function createVoiceBars(svg: SVGSVGElement): VoiceOrbRenderer {
  const bars = Array.from(svg.querySelectorAll<SVGLineElement>('[data-bb-chat-ui-voice-bar]'));
  const history = new VoiceOrbitHistory();
  let disposed = false;
  return {
    draw(seconds, volume) {
      if (disposed || !Number.isFinite(seconds)) return;
      history.push(seconds, volume);
      bars.forEach((bar, index) => {
        const position = index / (bars.length - 1);
        const energy = Math.sqrt(Math.max(0, history.level((1 - position) * 20) - .02) / .98);
        const envelope = .35 + .65 * Math.sin(position * Math.PI);
        const height = 2 + 20 * energy * envelope * (.72 + .28 * Math.sin(seconds * 2.4 + index * .55));
        bar.setAttribute('y1', (12 - height / 2).toFixed(4));
        bar.setAttribute('y2', (12 + height / 2).toFixed(4));
      });
    },
    enter() {}, leave(done) { done(); return () => {}; }, finishEntrance() {},
    reset() { if (!disposed) history.reset(); },
    dispose() { disposed = true; history.reset(); },
  };
}
