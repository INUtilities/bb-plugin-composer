export type HoldVoiceDelivery = 'insert' | 'send';
export type HoldVoicePhase = 'idle' | 'starting' | 'recording' | 'stopping' | 'ready' | 'transcribing' | 'error';
export interface HoldVoiceSnapshot {
  readonly phase: HoldVoicePhase;
  readonly hasRecording: boolean;
  readonly error: string | null;
  readonly delivery: HoldVoiceDelivery | null;
}
export const IDLE_HOLD_VOICE: HoldVoiceSnapshot = { phase: 'idle', hasRecording: false, error: null, delivery: null };
export interface HoldVoiceIO {
  capture(): Promise<MediaStream>;
  createRecorder(stream: MediaStream): MediaRecorder;
  started?(stream: MediaStream): void;
  transcribe(file: File, signal: AbortSignal): Promise<string>;
  deliver(text: string, mode: HoldVoiceDelivery): void;
  changed(snapshot: HoldVoiceSnapshot): void;
}
export function holdVoiceIsActive(state: HoldVoiceSnapshot): boolean {
  return state.hasRecording || (state.phase !== 'idle' && state.phase !== 'error');
}

/** 녹음 파일은 선택 전까지 메모리에만 보관한다. 변환·전송은 명시적 선택에서 시작한다. */
export class HoldVoiceSession {
  snapshot = IDLE_HOLD_VOICE;
  private io: HoldVoiceIO;
  private generation = 0;
  private disposed = false;
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private detachRecorder: (() => void) | null = null;
  private file: File | null = null;
  private chunks: Blob[] = [];
  private transcription: AbortController | null = null;
  private pendingDelivery: HoldVoiceDelivery | null = null;

  constructor(io: HoldVoiceIO) { this.io = io; }

  private update(phase: HoldVoicePhase, error: string | null = null, delivery: HoldVoiceDelivery | null = null): void {
    if (this.disposed) return;
    this.snapshot = { phase, error, delivery, hasRecording: this.file !== null };
    this.io.changed(this.snapshot);
  }
  private stopTracks(): void {
    const stream = this.stream;
    this.stream = null;
    stream?.getTracks().forEach(track => track.stop());
  }
  private discardRecorder(): void {
    this.detachRecorder?.(); this.detachRecorder = null;
    const recorder = this.recorder; this.recorder = null;
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch { /* 종료된 장치도 나머지 수명을 정리한다. */ }
    }
    this.stopTracks();
    this.chunks = [];
  }

  async start(): Promise<void> {
    if (this.disposed || holdVoiceIsActive(this.snapshot)) return;
    const generation = ++this.generation;
    this.update('starting');
    try {
      const stream = await this.io.capture();
      if (this.disposed || generation !== this.generation) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this.stream = stream;
      const recorder = this.io.createRecorder(stream);
      this.recorder = recorder;
      this.chunks = [];
      const current = () => !this.disposed && generation === this.generation;
      const onData = (event: Event) => {
        const data = (event as BlobEvent).data;
        if (current() && data.size > 0) this.chunks.push(data);
      };
      const onStop = () => {
        if (!current()) return;
        const chunks = this.chunks;
        const mime = recorder.mimeType || chunks[0]?.type || 'audio/webm';
        this.discardRecorder();
        if (!chunks.length) {
          this.pendingDelivery = null;
          this.update('error', '녹음된 음성이 없습니다. 다시 눌러 녹음해 주세요.');
          return;
        }
        const extension = mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : 'webm';
        this.file = new File(chunks, `recording.${extension}`, { type: mime });
        this.update('ready');
        const delivery = this.pendingDelivery;
        this.pendingDelivery = null;
        if (delivery) void this.choose(delivery);
      };
      const onError = () => {
        if (!current()) return;
        this.pendingDelivery = null;
        this.discardRecorder();
        this.update('error', '녹음을 마치지 못했습니다. 다시 눌러 녹음해 주세요.');
      };
      recorder.addEventListener('dataavailable', onData);
      recorder.addEventListener('stop', onStop);
      recorder.addEventListener('error', onError);
      this.detachRecorder = () => {
        recorder.removeEventListener('dataavailable', onData);
        recorder.removeEventListener('stop', onStop);
        recorder.removeEventListener('error', onError);
      };
      recorder.start();
      this.io.started?.(stream);
      this.update('recording');
    } catch (error) {
      if (this.disposed || generation !== this.generation) return;
      this.discardRecorder();
      const name = error instanceof Error ? error.name : '';
      this.update('error', name === 'NotAllowedError'
        ? '마이크 사용을 허용한 뒤 다시 눌러 녹음해 주세요.'
        : '마이크를 시작하지 못했습니다. 장치와 권한을 확인해 주세요.');
    }
  }

  release(): void {
    if (this.snapshot.phase === 'starting') { this.cancel(); return; }
    if (this.disposed || this.snapshot.phase !== 'recording' || !this.recorder) return;
    this.update('stopping');
    try { this.recorder.stop(); }
    catch {
      this.pendingDelivery = null;
      this.discardRecorder();
      this.update('error', '녹음을 마치지 못했습니다. 다시 눌러 녹음해 주세요.');
    } finally { this.stopTracks(); }
  }

  /** 중지는 입력으로 복귀하고 전송은 보낸다. 마지막 음성 데이터 이후에 변환한다. */
  finish(mode: HoldVoiceDelivery): void {
    if (this.disposed) return;
    if (this.file && ['ready', 'error'].includes(this.snapshot.phase)) { void this.choose(mode); return; }
    if (this.snapshot.phase !== 'recording') return;
    this.pendingDelivery = mode;
    this.release();
  }

  async choose(mode: HoldVoiceDelivery): Promise<void> {
    if (this.disposed || !this.file || !['ready', 'error'].includes(this.snapshot.phase)) return;
    const file = this.file, generation = ++this.generation;
    const controller = new AbortController();
    this.transcription = controller;
    this.update('transcribing', null, mode);
    try {
      const text = (await this.io.transcribe(file, controller.signal)).trim();
      if (this.disposed || generation !== this.generation || controller.signal.aborted) return;
      if (!text) throw new Error('empty transcript');
      this.file = null; this.transcription = null;
      this.update('idle');
      this.io.deliver(text, mode);
    } catch {
      if (this.disposed || generation !== this.generation || controller.signal.aborted) return;
      this.transcription = null; this.file = file;
      this.update('error', '음성을 변환하지 못했습니다. 중지로 닫거나 전송으로 재시도할 수 있습니다.', mode);
    }
  }

  cancel(): void {
    ++this.generation;
    this.pendingDelivery = null;
    this.transcription?.abort(); this.transcription = null;
    this.discardRecorder(); this.file = null;
    this.update('idle');
  }
  dispose(): void {
    this.cancel();
    this.disposed = true;
  }
}
