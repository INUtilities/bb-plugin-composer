import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FluidComposerBody } from '../../../composer/FluidComposerBody';
import { FluidVoiceControl } from '../../../composer/FluidVoiceControl';
import { FluidVoiceWaveform } from '../../../composer/FluidVoiceWaveform';
import { IDLE_HOLD_VOICE, holdVoiceIsActive } from '../../../lib/hold-voice';
import { injectFluidComposer } from '../../../lib/fluid-composer';
import { experimental_Icon as Icon } from './sdk-demo';

const sample = '파형이 밝아지고 막대의 높낮이가 달라집니다.';

// 데모는 브라우저의 실시간 받아쓰기 대신 합성 음성만 사용한다.
for (const name of ['SpeechRecognition', 'webkitSpeechRecognition']) {
  Object.defineProperty(window, name, { value: undefined, configurable: true });
}

// 파형이 강약을 나타낼 수 있도록 반복되는 합성 음성 스트림을 만든다.
function sampleStream(audio: AudioContext): MediaStream {
  const buffer = audio.createBuffer(1, audio.sampleRate * 4, audio.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index++) {
    const seconds = index / audio.sampleRate;
    const syllable = Math.max(0, Math.sin(seconds * Math.PI * 4.5)) ** 1.5;
    const strength = (.55 + .45 * Math.sin(seconds * Math.PI * 1.5) ** 2) * syllable;
    samples[index] = strength * .66 * (Math.sin(seconds * Math.PI * 380) + .25 * Math.sin(seconds * Math.PI * 570));
  }
  const source = audio.createBufferSource();
  const capture = audio.createMediaStreamDestination();
  source.buffer = buffer;
  source.loop = true;
  source.connect(capture);
  source.start();
  return capture.stream;
}

// 실제 컴포저의 음성 컨트롤과 파형을 합성 마이크로 실행한다.
function VoiceWaveDemo() {
  const [state, setState] = useState(IDLE_HOLD_VOICE);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  const audio = useRef<AudioContext | null>(null);
  const active = holdVoiceIsActive(state);
  const canRecord = !!navigator.mediaDevices && typeof MediaRecorder === 'function';
  const wave = active && state.phase !== 'ready' && state.phase !== 'error';

  // 데모 마이크의 오디오 처리를 종료한다.
  const closeSample = useCallback(() => {
    const context = audio.current;
    audio.current = null;
    if (context) void context.close().catch(() => {});
  }, []);

  // 이 문서 안에서만 실제 마이크 호출을 합성 스트림으로 대체한다.
  useLayoutEffect(() => {
    const removeStyles = injectFluidComposer(document);
    const devices = navigator.mediaDevices;
    const getUserMedia = devices?.getUserMedia;
    if (devices) {
      // 브라우저 오디오를 시작하고 데모용 스트림을 녹음기로 전달한다.
      devices.getUserMedia = async () => {
        closeSample();
        const context = new AudioContext();
        audio.current = context;
        const stream = sampleStream(context);
        await context.resume();
        return stream;
      };
    }
    return () => {
      if (devices && getUserMedia) devices.getUserMedia = getUserMedia;
      closeSample();
      removeStyles();
    };
  }, [closeSample]);

  return <main className="voice-demo">
    <div className="demo-stage">
      <form data-bb-chat-ui-fluid-composer="" data-bb-chat-ui-fluid-voice-only={active || undefined}
        onSubmit={
          // 전송 버튼의 결과는 데모의 메모리에 보관한다.
          event => { event.preventDefault(); setDraft(''); setStatus('데모 전송 완료'); }
        }>
        <FluidComposerBody voiceMode={active} draftText={draft} options={null} attachments={null}
          editor={<input className="demo-editor" aria-label="메시지" placeholder="메시지를 입력하세요"
            value={draft}
            onChange={
              // 전송 버튼을 메시지 입력과 같은 상태에 연결한다.
              event => { setDraft(event.target.value); setStatus(''); }
            } />}
          decoration={wave ? <FluidVoiceWaveform appearance="glow" indicator="bars" stream={stream}/> : null}
          actions={<FluidVoiceControl appearance="composer"
            disabled={!canRecord} warning={canRecord ? null : '이 브라우저에서 데모 녹음을 사용할 수 없습니다.'}
            sendDisabled={false} showFallback={!!draft.trim()}
            fallback={<button type="submit" data-promptbox-submit-action="" aria-label="메시지 전송"><Icon name="Send" /></button>}
            onStateChange={setState}
            onStreamChange={
              // 녹음기가 끝나면 합성 입력과 파형 분석을 해제한다.
              captured => { setStream(captured); if (!captured) closeSample(); }
            }
            transcribe={
              // 실제 전사 요청 대신 정해진 문장을 반환한다.
              async () => sample
            }
            deliver={
              // 음성 전사 결과가 입력에 들어오는 상태를 보여 준다.
              text => { setDraft(text); setStatus('예시 전사문을 입력했습니다.'); }
            }
          />}
        />
      </form>
    </div>
    <output role="status">{status || '탭해서 녹음하거나, 누르는 동안 말하기'}</output>
  </main>;
}

const root = document.getElementById('app');
if (root) createRoot(root).render(<VoiceWaveDemo />);
