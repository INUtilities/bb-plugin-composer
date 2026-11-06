import assert from 'node:assert/strict';
import test from 'node:test';
import { HoldVoiceSession, type HoldVoiceSnapshot } from './hold-voice.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
class Recorder extends EventTarget {
  state = 'inactive';
  mimeType = 'audio/webm';
  startCalls = 0;
  stopCalls = 0;
  start() { this.state = 'recording'; this.startCalls++; }
  stop() { this.state = 'inactive'; this.stopCalls++; }
  finish(content = 'audio') {
    const event = new Event('dataavailable');
    Object.assign(event, { data: new Blob(content ? [content] : [], { type: this.mimeType }) });
    this.dispatchEvent(event);
    this.dispatchEvent(new Event('stop'));
  }
}
function fixture(options: { capture?: Promise<MediaStream>; transcript?: Promise<string> } = {}) {
  let stops = 0;
  const stream = { getTracks: () => [{ stop: () => { stops++; } }] } as unknown as MediaStream;
  const recorder = new Recorder();
  const states: HoldVoiceSnapshot[] = [];
  const calls: { file: File; signal: AbortSignal }[] = [];
  const deliveries: { text: string; mode: string }[] = [];
  let captures = 0;
  const session = new HoldVoiceSession({
    capture: () => { captures++; return options.capture ?? Promise.resolve(stream); },
    createRecorder: () => recorder as unknown as MediaRecorder,
    transcribe: (file, signal) => { calls.push({ file, signal }); return options.transcript ?? Promise.resolve(' 안녕하세요 '); },
    deliver: (text, mode) => { deliveries.push({ text, mode }); },
    changed: state => { states.push(state); },
  });
  return { session, stream, recorder, states, calls, deliveries, get captures() { return captures; }, get stops() { return stops; } };
}

for (const mode of ['insert', 'send'] as const) {
  test(`finish ${mode} stops recording immediately and converts only after the file is complete`, async () => {
    const f = fixture(); await f.session.start();
    f.session.finish(mode);
    assert.equal(f.stops, 1); assert.equal(f.session.snapshot.phase, 'stopping');
    assert.equal(f.calls.length, 0); assert.equal(f.deliveries.length, 0);
    f.session.finish(mode === 'insert' ? 'send' : 'insert');
    f.recorder.finish(); await Promise.resolve();
    assert.equal(f.calls.length, 1); assert.deepEqual(f.deliveries, [{ text: '안녕하세요', mode }]);
    f.session.dispose();
  });
}

test('cancel between finish and the final audio event prevents conversion and delivery', async () => {
  const f = fixture(); await f.session.start(); f.session.finish('send');
  f.session.cancel(); f.recorder.finish(); await Promise.resolve();
  assert.equal(f.calls.length, 0); assert.equal(f.deliveries.length, 0);
  f.session.dispose();
});

test('hold records, release stops the microphone immediately and waits for a choice without transcription', async () => {
  const f = fixture();
  await f.session.start();
  assert.equal(f.session.snapshot.phase, 'recording');
  assert.equal(f.recorder.startCalls, 1);
  f.session.release();
  assert.equal(f.stops, 1, 'the microphone must stop before the final data event');
  assert.equal(f.recorder.stopCalls, 1);
  f.recorder.finish();
  assert.equal(f.session.snapshot.phase, 'ready');
  assert.equal(f.session.snapshot.hasRecording, true);
  assert.equal(f.calls.length, 0);
  assert.equal(f.deliveries.length, 0);
  f.session.dispose();
});

for (const mode of ['insert', 'send'] as const) {
  test(`${mode} processes the held recording once and preserves the selected delivery`, async () => {
    const f = fixture();
    await f.session.start(); f.session.release(); f.recorder.finish();
    await f.session.choose(mode);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].file.type, 'audio/webm');
    assert.ok(f.calls[0].file.size > 0);
    assert.deepEqual(f.deliveries, [{ text: '안녕하세요', mode }]);
    assert.equal(f.session.snapshot.phase, 'idle');
    assert.equal(f.session.snapshot.hasRecording, false);
    assert.equal(f.stops, 1);
    f.session.dispose();
  });
}

test('releasing while microphone permission is pending never starts a recorder and closes late tracks', async () => {
  const gate = deferred<MediaStream>(), f = fixture({ capture: gate.promise });
  const start = f.session.start();
  assert.equal(f.session.snapshot.phase, 'starting');
  f.session.release();
  gate.resolve(f.stream); await start;
  assert.equal(f.stops, 1);
  assert.equal(f.recorder.startCalls, 0);
  assert.equal(f.session.snapshot.phase, 'idle');
  assert.equal(f.calls.length, 0);
  f.session.dispose();
});

test('only publishes the current successfully started stream after a canceled permission request resolves', async () => {
  const first = deferred<MediaStream>(), second = deferred<MediaStream>();
  let captures = 0, firstStops = 0, secondStops = 0;
  const a = { getTracks: () => [{ stop: () => { firstStops++; } }] } as unknown as MediaStream;
  const b = { getTracks: () => [{ stop: () => { secondStops++; } }] } as unknown as MediaStream;
  const started: MediaStream[] = [], recorder = new Recorder();
  const session = new HoldVoiceSession({
    capture: () => ++captures === 1 ? first.promise : second.promise,
    createRecorder: () => recorder as unknown as MediaRecorder,
    started: stream => started.push(stream),
    transcribe: async () => '', deliver() {}, changed() {},
  });
  const old = session.start(); session.cancel(); const current = session.start();
  first.resolve(a); await old;
  assert.equal(firstStops, 1); assert.deepEqual(started, []);
  second.resolve(b); await current;
  assert.deepEqual(started, [b]); assert.equal(recorder.startCalls, 1);
  session.dispose(); assert.equal(secondStops, 1);
});

test('cancel during capture stops tracks and never offers or transcribes the discarded recording', async () => {
  const f = fixture(); await f.session.start();
  f.session.cancel(); f.recorder.finish();
  assert.equal(f.stops, 1);
  assert.equal(f.session.snapshot.phase, 'idle');
  assert.equal(f.session.snapshot.hasRecording, false);
  assert.equal(f.calls.length, 0);
  f.session.dispose();
});

test('repeated presses and choices cannot start or send the same recording twice', async () => {
  const gate = deferred<string>(), f = fixture({ transcript: gate.promise });
  await f.session.start(); await f.session.start();
  assert.equal(f.captures, 1);
  f.session.release(); f.session.release(); f.recorder.finish();
  const first = f.session.choose('send');
  await f.session.choose('insert');
  assert.equal(f.calls.length, 1);
  gate.resolve('한 번만 전송'); await first;
  assert.deepEqual(f.deliveries, [{ text: '한 번만 전송', mode: 'send' }]);
  assert.equal(f.recorder.stopCalls, 1);
  f.session.dispose();
});

test('transcription failure retains audio for retry, and an empty result never sends', async () => {
  const f = fixture({ transcript: Promise.resolve('  ') });
  await f.session.start(); f.session.release(); f.recorder.finish();
  await f.session.choose('send');
  assert.equal(f.session.snapshot.phase, 'error');
  assert.equal(f.session.snapshot.hasRecording, true);
  assert.ok(f.session.snapshot.error);
  assert.equal(f.deliveries.length, 0);
  await f.session.choose('insert');
  assert.equal(f.calls.length, 2, 'retry uses the retained recording');
  assert.equal(f.calls[0].file, f.calls[1].file);
  f.session.cancel();
  assert.equal(f.session.snapshot.hasRecording, false);
  f.session.dispose();
});

test('cancel aborts transcription and ignores a late transcript', async () => {
  const gate = deferred<string>(), f = fixture({ transcript: gate.promise });
  await f.session.start(); f.session.release(); f.recorder.finish();
  const pending = f.session.choose('send'); f.session.cancel();
  assert.equal(f.calls[0].signal.aborted, true);
  gate.resolve('취소한 결과'); await pending;
  assert.equal(f.deliveries.length, 0);
  assert.equal(f.session.snapshot.phase, 'idle');
  f.session.dispose();
});

test('disposal cancels pending permission and cannot update a departed composer', async () => {
  const gate = deferred<MediaStream>(), f = fixture({ capture: gate.promise });
  const pending = f.session.start(); f.session.dispose();
  const count = f.states.length;
  gate.resolve(f.stream); await pending;
  assert.equal(f.stops, 1);
  assert.equal(f.recorder.startCalls, 0);
  assert.equal(f.states.length, count);
  assert.equal(f.deliveries.length, 0);
});

test('permission errors and empty audio leave a usable retry state with no live microphone', async () => {
  const failed = fixture({ capture: Promise.reject(new DOMException('denied', 'NotAllowedError')) });
  await failed.session.start();
  assert.equal(failed.session.snapshot.phase, 'error');
  assert.match(failed.session.snapshot.error!, /마이크/);
  failed.session.dispose();
  const empty = fixture(); await empty.session.start(); empty.session.release(); empty.recorder.finish('');
  assert.equal(empty.session.snapshot.phase, 'error');
  assert.equal(empty.session.snapshot.hasRecording, false);
  assert.equal(empty.stops, 1);
  assert.equal(empty.calls.length, 0);
  empty.session.dispose();
});
