import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useComposer, useSdk } from '@get-bb/plugin-sdk/app';
import { Button } from './components/ui/button';
import { useDeviceChrome } from '../lib/use-device';
import { postHaptic, readHapticBridge } from '../lib/send-haptic';

type Effort = { reasoningEffort: string; label?: string; description: string };
const labels: Record<string, string> = { none: 'None', minimal: 'Minimal', low: 'Low', medium: 'Medium', high: 'High', xhigh: 'Extra high', max: 'Max', ultra: 'Ultra' };

// 일반 단계는 올라가는 막대로, max와 ultra는 서로 다른 기호로 표시한다.
function EffortIcon({ level, index, count }: { level: string; index: number; count: number }) {
  const special = level === 'max' || level === 'ultra';
  const bars = level === 'none' ? 0 : ({ minimal: 1, low: 1, medium: 2, high: 3, xhigh: 4 }[level] ?? Math.max(1, Math.ceil((index + 1) * 4 / Math.max(1, count))));
  return <svg data-effort-icon={special ? level : 'steps'} width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {special ? level === 'max'
      ? <path d="M10 2 12.2 7.8 18 10 12.2 12.2 10 18 7.8 12.2 2 10 7.8 7.8Z"/>
      : <><circle cx="10" cy="10" r="3"/><path d="M10 1v3m0 12v3M1 10h3m12 0h3M3.6 3.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"/></>
      : [5, 8, 11, 14].map((height, i) => <path key={height} d={`M${4 + i * 4} 17v-${height}`} strokeWidth="2.5" opacity={i < bars ? 1 : .22}/>)}
  </svg>;
}

// 기존 모델 메뉴를 유지하고 현재 환경에서 지원하는 effort만 순서대로 선택한다.
export function FluidModelControls({ controls, disabled = false, onError }: { controls: ReactNode; disabled?: boolean; onError(message: string): void }) {
  const composer = useComposer(), sdk = useSdk();
  const { device } = useDeviceChrome();
  const { scope, selection } = composer;
  const providerId = selection?.providerId, model = selection?.model, level = selection?.reasoningLevel;
  const environment = selection?.environment, projectId = selection?.projectId;
  const key = JSON.stringify([scope, providerId, model, environment, projectId]);
  const current = useRef(key); current.current = key;
  const latest = useRef({ level, locked: disabled || composer.isSubmitting });
  latest.current = { level, locked: disabled || composer.isSubmitting };
  const [catalog, setCatalog] = useState<{ key: string; efforts: Effort[] } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
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
  // 화면을 떠난 뒤 도착한 선택 오류는 새 컴포저에 표시하지 않는다.
  useEffect(() => {
    current.current = key;
    return () => { request.current?.abort(); if (current.current === key) current.current = ''; };
  }, [key]);
  const efforts = catalog?.key === key ? catalog.efforts : [];
  const index = efforts.findIndex(item => item.reasoningEffort === level);
  const label = efforts[index]?.label || (level ? labels[level] ?? level : '');
  const blocked = disabled || composer.isSubmitting || pending === key || (catalog?.key === key && (index < 0 || efforts.length < 2));
  // 연속 클릭과 이전 화면의 오류 표시를 막고 호스트의 확정값을 기다린다.
  const cycle = async () => {
    if (blocked || activeRequest.current === key) return;
    activeRequest.current = key; setPending(key);
    const controller = new AbortController(); request.current = controller;
    try {
      const available = catalog?.key === key ? catalog.efforts : await load(controller.signal);
      if (controller.signal.aborted || current.current !== key || latest.current.locked) return;
      setCatalog({ key, efforts: available });
      const selected = available.findIndex(item => item.reasoningEffort === latest.current.level);
      if (selected < 0 || available.length < 2) return;
      await composer.setSelection({ reasoningLevel: available[(selected + 1) % available.length]!.reasoningEffort });
    }
    catch { if (!controller.signal.aborted && current.current === key) onError('Effort를 바꾸지 못했습니다. 모델 메뉴에서 다시 선택해 주세요.'); }
    finally {
      if (activeRequest.current === key) activeRequest.current = null;
      setPending(previous => previous === key ? null : previous);
    }
  };
  return <div data-bb-chat-ui-fluid-model-controls="">
    <div data-bb-chat-ui-fluid-native-controls="">{controls}</div>
    {providerId && model && level ? <Button type="button" variant="ghost" size="sm" data-bb-chat-ui-fluid-effort=""
      aria-label={`Effort: ${label}`} aria-busy={pending === key || undefined} disabled={blocked}
      aria-description={blocked ? '모델 메뉴에서 선택' : '클릭하면 다음 단계'}
      onClick={event => {
        if (!blocked && device === 'phone' && event.nativeEvent.isTrusted) postHaptic(readHapticBridge(window), 'impact-light');
        void cycle();
      }}>
      <EffortIcon level={level} index={index} count={efforts.length}/><span>{label}</span>
    </Button> : null}
  </div>;
}
