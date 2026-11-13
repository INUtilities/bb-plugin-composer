import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useComposer, useSdk } from '@get-bb/plugin-sdk/app';
import { Button } from './components/ui/button';
import { EffortIcon } from './EffortIcon';
import { useDeviceChrome } from '../lib/use-device';
import { postHaptic, readHapticBridge } from '../lib/send-haptic';

type Effort = { reasoningEffort: string; label?: string; description: string };
const labels: Record<string, string> = { none: 'None', minimal: 'Minimal', low: 'Low', medium: 'Medium', high: 'High', xhigh: 'Extra high', max: 'Max', ultra: 'Ultra' };
const EFFORT_LABEL_MS = 300;
const EFFORT_PEEK_MS = 1500;
const EFFORT_WIDTH_EASING = 'cubic-bezier(.175,.885,.32,1.275)';

// 기존 모델 메뉴를 유지하고 현재 환경에서 지원하는 effort만 순서대로 선택한다.
export function FluidModelControls({ controls, disabled = false, onError }: { controls: ReactNode; disabled?: boolean; onError(message: string): void }) {
  const composer = useComposer(), sdk = useSdk();
  const { device } = useDeviceChrome();
  const { scope, selection } = composer;
  const providerId = selection?.providerId, model = selection?.model, level = selection?.reasoningLevel;
  const environment = selection?.environment, projectId = selection?.projectId ?? (scope.kind === 'new-thread' ? scope.projectId ?? undefined : undefined);
  const key = JSON.stringify([scope, providerId, model, environment, projectId]);
  const current = useRef(key); current.current = key;
  const latest = useRef({ level, locked: disabled || composer.isSubmitting });
  latest.current = { level, locked: disabled || composer.isSubmitting };
  const [catalog, setCatalog] = useState<{ key: string; efforts: Effort[] } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [peekKey, setPeekKey] = useState<string | null>(null);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRequest = useRef<string | null>(null);
  const request = useRef<AbortController | null>(null);
  // 첫 활성화 때만 현재 환경의 목록을 읽고 입력·대화 전환에서는 조회하지 않는다.
  const load = async (signal: AbortSignal): Promise<Effort[]> => {
    if (!providerId || !model || scope.kind === 'queued-message') return [];
    let routing: { environmentId: string } | { hostId: string; projectId?: string } | { projectId?: string };
    if (scope.kind === 'thread') {
      const thread = await sdk.threads.get({ threadId: scope.threadId, signal });
      if (!thread.environmentId) return [];
      routing = { environmentId: thread.environmentId };
    } else if (environment?.type === 'reuse') routing = { environmentId: environment.environmentId };
    else if (environment?.type === 'host') routing = environment.hostId ? { hostId: environment.hostId, projectId } : { projectId };
    else if (!environment || environment.type === 'project-default') routing = { projectId };
    else return [];
    if (signal.aborted) return [];
    const result = await sdk.providers.models({ ...routing, providerId, signal });
    if (signal.aborted) return [];
    const selected = result.models.find(item => item.model === model || item.id === model);
    return selected?.supportedReasoningEfforts ?? [];
  };
  // 화면·잠금 변경과 해제는 요청과 임시 이름의 접힘 예약을 정리한다.
  useEffect(() => {
    current.current = key;
    setPeekKey(null);
    return () => { request.current?.abort(); if (peekTimer.current !== null) clearTimeout(peekTimer.current); if (current.current === key) current.current = ''; };
  }, [key, disabled, composer.isSubmitting]);
  const efforts = catalog?.key === key ? catalog.efforts : [];
  const index = efforts.findIndex(item => item.reasoningEffort === level);
  const label = efforts[index]?.label || (level ? labels[level] ?? level : '');
  const labelBox = useRef<HTMLSpanElement>(null), labelValue = useRef<HTMLSpanElement>(null);
  const previousLabel = useRef<{ key: string; label: string; width: number } | null>(null);
  const beforeLabelWidth = useRef<number | null>(null);
  const labelAnimations = useRef<Animation[]>([]);
  const labelWidthAnimation = useRef<Animation | null>(null);
  // 임시 이름이 접히면 기존 컴포저의 배치 예약만 갱신한다.
  useLayoutEffect(() => { labelBox.current?.closest('[data-bb-chat-ui-fluid-row]')?.dispatchEvent(new Event('bb-chat-ui:fluid-effort-layout', {bubbles:true})); }, [peekKey, key]);
  // 확정된 글자는 레퍼런스처럼 fade·zoom하고 바뀐 길이만큼 폭을 이어 준다.
  useLayoutEffect(() => {
    const box = labelBox.current, value = labelValue.current;
    if (!box || !value) return;
    const previous = previousLabel.current;
    const changed = previous?.key === key && previous.label !== label;
    const width = value.offsetWidth;
    const fromWidth = labelWidthAnimation.current?.playState === 'running'
      ? box.getBoundingClientRect().width
      : beforeLabelWidth.current ?? previous?.width ?? width;
    for (const animation of labelAnimations.current) animation.cancel();
    labelAnimations.current = []; labelWidthAnimation.current = null;
    previousLabel.current = { key, label, width }; beforeLabelWidth.current = null;
    if (!changed || box.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const motion: Array<Animation | undefined> = [];
    if (fromWidth > 0 && width > 0 && fromWidth !== width) {
      labelWidthAnimation.current = box.animate?.(
        [{ width: `${fromWidth}px` }, { width: `${width}px` }],
        { duration: EFFORT_LABEL_MS, easing: EFFORT_WIDTH_EASING },
      ) ?? null;
      if (labelWidthAnimation.current) motion.push(labelWidthAnimation.current);
    }
    motion.push(value.animate?.(
      [{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'scale(1)' }],
      { duration: EFFORT_LABEL_MS, easing: 'ease' },
    ));
    labelAnimations.current = motion.filter((animation): animation is Animation => !!animation);
  }, [key, label]);
  const showEffort = !!(providerId && model && level);
  // 모션 줄이기와 해제 시 이 글자에 연결한 모션과 리스너만 정리한다.
  useEffect(() => {
    const media = labelBox.current?.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)');
    // 진행 중인 폭과 글자 모션을 마치고 자연 크기의 확정값을 보여 준다.
    const cancel = () => { for (const animation of labelAnimations.current) animation.cancel(); labelAnimations.current = []; labelWidthAnimation.current = null; };
    // 모션 줄이기를 켜면 표시 중인 전환을 즉시 끝낸다.
    const reduce = () => { if (media?.matches) cancel(); };
    media?.addEventListener('change', reduce);
    return () => { media?.removeEventListener('change', reduce); cancel(); };
  }, [showEffort]);
  const blocked = disabled || composer.isSubmitting || pending === key || (catalog?.key === key && (index < 0 || efforts.length < 2));
  // 연속 클릭과 이전 화면의 오류 표시를 막고 호스트의 확정값을 기다린다.
  const cycle = async () => {
    if (blocked || activeRequest.current === key) return;
    beforeLabelWidth.current = labelWidthAnimation.current?.playState === 'running'
      ? null : labelBox.current?.getBoundingClientRect().width || labelValue.current?.offsetWidth || null;
    activeRequest.current = key; setPending(key);
    const controller = new AbortController(); request.current = controller;
    try {
      const available = catalog?.key === key ? catalog.efforts : await load(controller.signal);
      if (controller.signal.aborted || current.current !== key || latest.current.locked) return;
      setCatalog({ key, efforts: available });
      const selected = available.findIndex(item => item.reasoningEffort === latest.current.level);
      if (selected < 0 || available.length < 2) return;
      await composer.setSelection({ reasoningLevel: available[(selected + 1) % available.length]!.reasoningEffort });
      if (current.current === key && !latest.current.locked) {
        if (peekTimer.current !== null) clearTimeout(peekTimer.current);
        setPeekKey(key);
        peekTimer.current = setTimeout(() => { setPeekKey(null); peekTimer.current = null; }, EFFORT_PEEK_MS);
      }
    }
    catch { if (!controller.signal.aborted && current.current === key) onError('Effort를 바꾸지 못했습니다. 모델 메뉴에서 다시 선택해 주세요.'); }
    finally {
      if (activeRequest.current === key) activeRequest.current = null;
      setPending(previous => previous === key ? null : previous);
    }
  };
  return <div data-bb-chat-ui-fluid-model-controls="" data-bb-chat-ui-fluid-separate-effort={showEffort ? '' : undefined}>
    <div data-bb-chat-ui-fluid-native-controls="">{controls}</div>
    {showEffort ? <Button type="button" variant="ghost" size="sm" data-bb-chat-ui-fluid-effort=""
      data-bb-chat-ui-fluid-effort-peek={peekKey === key || undefined}
      aria-label={`Effort: ${label}`} aria-busy={pending === key || undefined} disabled={blocked}
      aria-description={blocked ? '모델 메뉴에서 선택' : '클릭하면 다음 단계'}
      onClick={event => {
        if (!blocked && device === 'phone' && event.nativeEvent.isTrusted) postHaptic(readHapticBridge(window), 'impact-light');
        void cycle();
      }}>
      <EffortIcon level={level!} index={index} count={efforts.length}/>
      <span ref={labelBox} data-bb-chat-ui-fluid-effort-label="" aria-hidden="true"><span ref={labelValue} data-bb-chat-ui-fluid-effort-value="">{label}</span></span>
    </Button> : null}
  </div>;
}
