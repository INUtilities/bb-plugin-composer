import { experimental_useComposerRenderer as useComposerRenderer } from '@get-bb/plugin-sdk/app';
import { useDeviceChrome } from '../lib/use-device';
import { CompactViewportOverrideProvider } from './components/ui/hooks/use-compact-viewport';
import { FluidComposerMetadata } from './FluidComposerMetadata';
import { PromptBoxInternal } from './src/PromptBoxInternal';
import './src/composer.css';

// 활성 입력기 아래에 현재 스레드 정보를 고정한다.
export function FluidComposer() {
  const renderer = useComposerRenderer();
  const { device } = useDeviceChrome();
  const { scope } = renderer.view;
  return <CompactViewportOverrideProvider isCompactViewport={device === 'phone'}>
    <PromptBoxInternal {...renderer.input} fluid={scope.kind !== 'queued-message'} />
    {scope.kind === 'thread' ? <FluidComposerMetadata key={scope.threadId} threadId={scope.threadId} /> : null}
  </CompactViewportOverrideProvider>;
}
