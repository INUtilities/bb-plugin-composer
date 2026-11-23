import {
  experimental_copyToClipboard as copyToClipboard,
  experimental_Icon as Icon,
  experimental_useAppPanel as useAppPanel,
  experimental_useComposerRenderer as useComposerRenderer,
  useBbNavigate,
  useEnvironmentProviders,
  useSdk,
} from '@get-bb/plugin-sdk/app';
import { useEffect, useState } from 'react';
import { FluidComposerSessionModes } from './FluidComposerSessionModes';

type Sdk = ReturnType<typeof useSdk>;
type ContextUsage = Awaited<ReturnType<Sdk['threads']['context']>>['usage'];
type WorkspaceMetadata = {
  projectId: string;
  projectName: string;
  worktreeName: string | null;
  branch: string | null;
  environmentProviderId: string | null;
  environmentId: string | null;
  reuseEnvironment: boolean;
  placement: { sectionId: string | null; pinned: boolean };
};

// 입력 포커스와 별개로 스레드 정보와 설정을 입력창 아래에 표시한다.
export function FluidComposerMetadata({ threadId }: { threadId: string }) {
  const sdk = useSdk();
  const { showError } = useComposerRenderer();
  const navigate = useBbNavigate();
  const panel = useAppPanel();
  const { providers: environmentProviders } = useEnvironmentProviders();
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
          projectId: thread.projectId,
          projectName: project.name,
          worktreeName: environment?.name?.trim() || environment?.branchName || null,
          branch: environment?.branchName ?? null,
          environmentProviderId: environment?.environmentProviderId ?? null,
          environmentId: thread.environmentId,
          reuseEnvironment: environment?.status === 'ready' && environment.hostLifecycle === 'active' && environment.path !== null,
          placement: { sectionId: thread.sectionId, pinned: thread.pinnedAt !== null },
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
  const worktreeName = workspace?.worktreeName
    ?? environmentProviders.find(provider => provider.id === workspace?.environmentProviderId)?.displayName;
  const worktreeLabel = <><Icon name="GitBranch" className="size-3.5 shrink-0" />
    <span>{worktreeName ?? '—'}</span></>;
  const environmentId = workspace?.environmentId;
  const infoTab = panel.getTabs().tabs.find(tab => tab.detail.kind === 'info');

  // 기존 작업트리 버튼과 같이 현재 브랜치 이름을 복사한다.
  async function copyBranch() {
    if (!branch) return;
    if (!await copyToClipboard({ text: branch })) showError('Failed to copy branch name');
  }

  // 현재 프로젝트·작업 환경·배치를 새 스레드 초안에 전달한다.
  function openNewThread() {
    if (!workspace?.reuseEnvironment || !workspace.environmentId) return;
    navigate.toCompose({ projectId: workspace.projectId, environmentId: workspace.environmentId, placement: workspace.placement, focusPrompt: true });
  }

  return <div data-bb-composer-footer="" role="group" aria-label="Composer footer">
    <div data-bb-composer-metadata="" role="group" aria-label="Composer metadata">
      <span data-bb-composer-metadata-item="" title={workspace?.projectName} aria-label={`Project: ${workspace?.projectName ?? 'Unavailable'}`}>
        <Icon name="Folder" className="size-3.5 shrink-0" />
        <span>{workspace?.projectName ?? '—'}</span>
      </span>
      {branch ? <button data-bb-composer-metadata-item="" type="button"
        title={worktreeName === branch ? `Copy branch: ${branch}` : `${worktreeName} · Copy branch: ${branch}`}
        aria-label={`Worktree: ${worktreeName}. ${worktreeName === branch ? 'Copy branch name' : `Copy branch ${branch}`}`}
        onClick={copyBranch}>
        {worktreeLabel}
      </button> : <span data-bb-composer-metadata-item="" title={worktreeName ?? undefined} aria-label={`Worktree: ${worktreeName ?? 'Unavailable'}`}>
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
    </div>
    <div data-bb-composer-footer-actions="">
      {workspace?.reuseEnvironment && environmentId ? <button type="button" data-bb-composer-metadata-item=""
        aria-label="New thread in this environment" title="New thread in this environment" onClick={openNewThread}>
        <Icon name="Plus" />
      </button> : null}
      {infoTab ? <button type="button" data-bb-composer-metadata-item="" aria-label="Thread details" title="Thread details"
        onClick={() => { panel.selectTab(infoTab.key); }}>
        <Icon name="PanelRight" />
      </button> : null}
      <FluidComposerSessionModes threadId={threadId} environmentId={environmentId} />
    </div>
  </div>;
}
