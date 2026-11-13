import { Button } from './components/ui/button';

// 기본 버튼과 기호 크기를 유지하고 열림 상태에 따라 +만 회전한다.
export function FluidComposerToggle({ open, disabled = false, onClick }: { open: boolean; disabled?: boolean; onClick(): void }) {
  return <Button type="button" size="icon" variant="ghost" aria-label="Prompt actions" aria-expanded={open}
    aria-description={open ? '옵션 닫기' : '옵션 열기'} disabled={disabled} onClick={onClick}>
    <span data-bb-chat-ui-fluid-toggle-face="" aria-hidden="true"/>
    <span data-bb-chat-ui-fluid-toggle-glyph="" aria-hidden="true"/>
  </Button>;
}
