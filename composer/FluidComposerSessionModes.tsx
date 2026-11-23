import {
  experimental_PermissionModePicker as PermissionModePicker,
  experimental_useComposerRenderer as useComposerRenderer,
  type ExperimentalPermissionModePickerProps,
  useComposer,
  useSdk,
} from '@get-bb/plugin-sdk/app';
import { useEffect, useRef, useState } from 'react';

type Sdk = ReturnType<typeof useSdk>;
type Timeline = Awaited<ReturnType<Sdk['threads']['timeline']>>;
type SessionModes = NonNullable<Extract<Timeline, { sessionOptions: unknown }>['sessionOptions']>;
type ModeValue = SessionModes[number]['value'];
type SessionSnapshot = { threadId: string; modes: SessionModes; planning: boolean };
type ModeRead = { signal: AbortSignal; refresh(): Promise<void> };

// 현재 스레드의 세션 모드와 BB 권한 선택기를 표시한다.
export function FluidComposerSessionModes({ threadId, environmentId }: { threadId: string; environmentId?: string | null }) {
  const sdk = useSdk();
  const composer = useComposer();
  const { showError } = useComposerRenderer();
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [pending, setPending] = useState<ReadonlyMap<string, ModeValue>>(new Map());
  const read = useRef<ModeRead | null>(null);

  useEffect(() => {
    const lifetime = new AbortController();
    const { signal } = lifetime;
    let latestRequest = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // 타임라인의 최신 모드 상태만 적용하며 일시적인 오류에서는 현재 값을 유지한다.
    async function refresh() {
      clearTimeout(timer);
      const request = ++latestRequest;
      try {
        const timeline = await sdk.threads.timeline({ threadId, summaryOnly: 'true', segmentLimit: '1', signal });
        if (signal.aborted || request !== latestRequest) return;
        setSnapshot({ threadId, modes: timeline.sessionOptions?.filter(option => option.category === 'mode') ?? [],
          planning: timeline.activePromptMode?.mode === 'plan' });
      } catch {
        // 다음 타임라인 이벤트나 재연결에서 다시 읽는다.
      }
    }

    const stopThread = sdk.subscribe({
      event: 'thread:changed',
      threadId,
      callback: event => {
        if (event.changes.includes('events-appended') || event.changes.includes('history-rewritten')
          || event.changes.includes('history-compacted') || event.changes.includes('status-changed')) {
          clearTimeout(timer);
          timer = setTimeout(refresh, 400);
        }
      },
    });
    const stopConnection = sdk.subscribe({
      event: 'realtime:connection',
      callback: event => {
        if (event.reconnected) void refresh();
      },
    });
    read.current = { signal, refresh };
    setPending(new Map());
    void refresh();
    return () => {
      lifetime.abort();
      clearTimeout(timer);
      read.current = null;
      stopThread();
      stopConnection();
    };
  }, [sdk, threadId]);

  // 선택값을 즉시 표시하고 서버가 거부하면 타임라인의 값으로 되돌린다.
  async function changeMode(id: string, value: ModeValue) {
    const active = read.current;
    if (!active || active.signal.aborted || pending.has(id)) return;
    setPending(current => new Map(current).set(id, value));
    try {
      await sdk.threads.update({ threadId, sessionOptions: { [id]: value } });
      if (!active.signal.aborted) await active.refresh();
    } catch {
      if (!active.signal.aborted) showError('Failed to change the agent option.');
    } finally {
      if (!active.signal.aborted) {
        setPending(current => {
          const next = new Map(current);
          next.delete(id);
          return next;
        });
      }
    }
  }

  // 현재 입력기의 네이티브 권한 설정을 갱신한다.
  async function changePermission(permissionMode: ExperimentalPermissionModePickerProps['value']) {
    try {
      await composer.setSelection({ permissionMode });
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to update permissions');
    }
  }

  const current = snapshot?.threadId === threadId ? snapshot : null;
  const { providerId, permissionMode } = composer.selection ?? {};
  return <>{current?.modes.map(mode => (
    <label key={mode.id} data-bb-composer-session-mode="" title={mode.description ?? undefined}>
      <span>{mode.label}</span>
      <select aria-label={mode.label} value={String(pending.get(mode.id) ?? mode.pendingValue ?? mode.value)}
        disabled={pending.has(mode.id)}
        onChange={event => {
          const choice = event.currentTarget.value;
          void changeMode(mode.id, mode.type === 'boolean' ? choice === 'true' : choice);
        }}>
        {mode.type === 'boolean' ? <><option value="true">On</option><option value="false">Off</option></>
          : mode.values.map(choice => <option key={choice.id} value={choice.id} title={choice.description ?? undefined}>{choice.label}</option>)}
      </select>
    </label>
  ))}
    {providerId && permissionMode !== undefined ? <PermissionModePicker providerId={providerId} value={permissionMode}
      disabled={composer.isSubmitting || current?.planning} routing={environmentId ? { kind: 'environment', environmentId } : undefined}
      onChange={changePermission} /> : null}
  </>;
}
