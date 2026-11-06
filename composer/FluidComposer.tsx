import { experimental_useComposerRenderer as useComposerRenderer } from '@get-bb/plugin-sdk/app';
import { useDeviceChrome } from '../lib/use-device';
import { CompactViewportOverrideProvider } from './components/ui/hooks/use-compact-viewport';
import { PromptBoxInternal } from './src/PromptBoxInternal';
import './src/composer.css';

export function FluidComposer() {
  const renderer = useComposerRenderer();
  const { device } = useDeviceChrome();
  return <CompactViewportOverrideProvider isCompactViewport={device === 'phone'}>
    <PromptBoxInternal {...renderer.input} fluid={renderer.view.scope.kind !== 'queued-message'} />
  </CompactViewportOverrideProvider>;
}
