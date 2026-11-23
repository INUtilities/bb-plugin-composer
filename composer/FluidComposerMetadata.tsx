import {
  experimental_copyToClipboard as copyToClipboard,
  experimental_Icon as Icon,
  experimental_useComposerRenderer as useComposerRenderer,
  useSdk,
} from '@get-bb/plugin-sdk/app';
import { useEffect, useState } from 'react';

type Sdk = ReturnType<typeof useSdk>;
type ContextUsage = Awaited<ReturnType<Sdk['threads']['context']>>['usage'];
type WorkspaceMetadata = { projectName: string; worktreeName: string | null; branch: string | null };

// 입력 포커스와 별개로 현재 스레드의 프로젝트·작업트리·컨텍스트를 표시한다.
export function FluidComposerMetadata({ threadId }: { threadId: string }) {
  const sdk = useSdk();
  const { showError } = useComposerRenderer();
  const [workspace, setWorkspace] = useState<WorkspaceMetadata | null>(null);
  const [usage, setUsage] = useState<ContextUsage>(null);

  useEffect(() => {
    const lifetime = new AbortController();
    let workspaceRequest = 0;
    let contextRequest = 0;

    // 같은 스레드의 최신 읽기만 프로젝트와 작업트리 표시에 반영한다.
    async function refreshWorkspace() {
      const request = ++workspaceRequest;
      const { signal } = lifetime;
      try {
        const thread = await sdk.threads.get({ threadId, include: 'environment', signal });
        const environment = 'environment' in thread ? thread.environment : null;
        const project = await sdk.projects.get({ projectId: thread.projectId, signal });
        if (signal.aborted || request !== workspaceRequest) return;
        setWorkspace({
          projectName: project.name,
          worktreeName: environment?.branchName ?? environment?.name ?? null,
          branch: environment?.branchName ?? null,
        });
      } catch {
        // 일시적으로 읽지 못하면 같은 스레드의 마지막 값을 유지한다.
      }
    }

    // 컨텍스트 갱신과 초기 조회가 겹쳐도 최신 결과만 표시한다.
    async function refreshContext() {
      const request = ++contextRequest;
      const { signal } = lifetime;
      try {
        const { usage } = await sdk.threads.context({ threadId, signal });
        if (!signal.aborted && request === contextRequest) setUsage(usage);
      } catch {
        // 다음 컨텍스트 이벤트에서 다시 읽는다.
      }
    }

    const stopThread = sdk.subscribe({
      event: 'thread:changed',
      threadId,
      callback: event => {
        if (event.changes.includes('environment-changed')) void refreshWorkspace();
        const types = event.metadata?.eventTypes;
        if (event.changes.includes('history-compacted') || event.changes.includes('history-rewritten')
          || types?.includes('thread/contextWindowUsage/updated') || types?.includes('thread/context/cleared')) {
          void refreshContext();
        }
      },
    });
    const stopConnection = sdk.subscribe({
      event: 'realtime:connection',
      callback: event => {
        if (!event.reconnected) return;
        void refreshWorkspace();
        void refreshContext();
      },
    });
    void refreshWorkspace();
    void refreshContext();
    return () => {
      lifetime.abort();
      stopThread();
      stopConnection();
    };
  }, [sdk, threadId]);

  const usedPercent = usage && usage.modelContextWindow > 0
    ? Math.round(usage.usedTokens / usage.modelContextWindow * 100) : null;
  const branch = workspace?.branch;
  const worktreeLabel = <><Icon name="GitBranch" className="size-3.5 shrink-0" />
    <span>{workspace?.worktreeName ?? '—'}</span></>;

  // 기존 작업트리 버튼과 같이 현재 브랜치 이름을 복사한다.
  async function copyBranch() {
    if (!branch) return;
    if (!await copyToClipboard({ text: branch })) showError('Failed to copy branch name');
  }

  return <div data-bb-composer-metadata="" role="group" aria-label="Composer metadata">
    <span data-bb-composer-metadata-item="" title={workspace?.projectName} aria-label={`Project: ${workspace?.projectName ?? 'Unavailable'}`}>
      <Icon name="Folder" className="size-3.5 shrink-0" />
      <span>{workspace?.projectName ?? '—'}</span>
    </span>
    {branch ? <button data-bb-composer-metadata-item="" type="button" title={`Copy branch: ${branch}`} aria-label={`Worktree: ${branch}. Copy branch name`} onClick={copyBranch}>
      {worktreeLabel}
    </button> : <span data-bb-composer-metadata-item="" title={workspace?.worktreeName ?? undefined} aria-label={`Worktree: ${workspace?.worktreeName ?? 'Unavailable'}`}>
      {worktreeLabel}
    </span>}
    <details data-bb-composer-metadata-context="">
      <summary data-bb-composer-metadata-item="" aria-label={usedPercent === null ? 'Context usage unavailable' : `Context window ${usedPercent}% used`}>
        <span>Context {usedPercent === null ? '—' : `${usedPercent}%`}</span>
      </summary>
      <div data-bb-composer-metadata-breakdown="">
        {usage ? <>
          <p>{usage.estimated ? 'Estimated context' : 'Context window'} · {usage.usedTokens.toLocaleString()} / {usage.modelContextWindow.toLocaleString()} tokens</p>
          {usage.snapshot?.categories.map(category => <p key={category.id}>{category.label} · {category.tokens.toLocaleString()} tokens</p>)}
        </> : <p>Context usage is unavailable.</p>}
      </div>
    </details>
  </div>;
}
