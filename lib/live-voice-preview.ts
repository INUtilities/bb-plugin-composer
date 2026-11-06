export interface VoicePreview {
  readonly text: string;
  readonly available: boolean;
}
export const EMPTY_VOICE_PREVIEW: VoicePreview = { text: '', available: false };

interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}

/** 브라우저의 받아쓰기는 미리보기만 제공한다. 최종 변환·전송은 기존 BB 경로다. */
export function startLiveVoicePreview(win: Window, changed: (preview: VoicePreview) => void): () => void {
  const browser = win as Window & {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
  if (!Constructor) { changed(EMPTY_VOICE_PREVIEW); return () => {}; }
  let active = true, recognition: Recognition | null = null, text = '', prefix = '', received = false;
  const stop = () => {
    if (!active) return;
    active = false;
    if (!recognition) return;
    recognition.onresult = recognition.onerror = recognition.onend = null;
    try { recognition.abort(); } catch { /* 이미 끝난 인식도 함께 정리한다. */ }
  };
  const unavailable = () => {
    if (!active) return;
    changed({ text, available: false }); stop();
  };
  try {
    recognition = new Constructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = win.navigator.language || win.document.documentElement.lang;
    recognition.onresult = event => {
      if (!active) return;
      // results 전체를 다시 읽어 바뀌는 interim 문장을 중복해서 붙이지 않는다.
      received = true;
      text = (prefix + Array.from(event.results, result => result[0].transcript).join('')).trim();
      changed({ text, available: true });
    };
    recognition.onerror = unavailable;
    recognition.onend = () => {
      if (!active) return;
      // 잠깐 쉰 뒤에도 계속 받아쓴다. 빈 종료는 재시도 루프를 만들지 않는다.
      if (!received) { unavailable(); return; }
      prefix = text ? `${text} ` : ''; received = false;
      try { recognition?.start(); } catch { unavailable(); }
    };
    recognition.start();
    if (active) changed({ text, available: true });
  } catch { unavailable(); }
  return stop;
}
