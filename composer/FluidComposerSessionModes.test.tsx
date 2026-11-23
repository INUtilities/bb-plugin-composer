// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { ExperimentalComposerRendererApi } from '@get-bb/plugin-sdk/app';
import { renderSlot } from '@get-bb/plugin-sdk/testing/app';
import { expect, it, vi } from 'vitest';
import { FluidComposerSessionModes } from './FluidComposerSessionModes';

const threadId = 'thr_session_modes';

// 호스트의 현재 모드, 예약된 값, 다른 위치에 속하는 설정을 함께 제공한다.
function mountModes() {
  const showError = vi.fn();
  const scope: ExperimentalComposerRendererApi['view']['scope'] = { kind: 'thread', threadId };
  const renderer: ExperimentalComposerRendererApi = {
    key: threadId, inputLocked: false, focusComposerShortcut: null, decorationSources: [],
    view: { scope, layout: 'expanded', draft: { text: '', isEmpty: true, attachmentCount: 0 },
      run: { isRunning: false, isSubmitting: false } },
    input: { surface: 'thread', mentionTriggers: [], commandTriggers: [], resolveMentionLink: () => null, mentionMenuPlacement: 'top',
      submission: { enter: { kind: 'send', requiresInput: true, shortcut: { ariaKeyshortcuts: 'Enter', label: 'Enter' }, run: vi.fn() },
        modifier: null, showModifierInMenu: false } },
    threadLinks: { parse: () => null, cached: () => null, resolve: async () => {} },
    clipboard: { readMessage: () => null, readMessageImage: async () => new File([], 'unused') },
    dispatchAppCommandKey: () => false, showError, attachmentSrc: () => '',
  };
  const mode = { id: 'strategy', label: 'Strategy', description: null, category: 'mode', type: 'select', value: 'edit', pendingValue: 'review',
    values: [{ id: 'edit', label: 'Edit', description: null, group: null }, { id: 'review', label: 'Review', description: null, group: null }] };
  const booleanMode = { id: 'stream', label: 'Stream', description: null, category: 'mode', type: 'boolean', value: true, pendingValue: null };
  const unrelated = { ...booleanMode, id: 'trace', label: 'Trace', category: 'advanced' };
  const timeline = vi.fn().mockResolvedValueOnce({ sessionOptions: [mode, booleanMode, unrelated] })
    .mockResolvedValue({ sessionOptions: [{ ...mode, pendingValue: 'edit' }, booleanMode, unrelated] });
  const update = vi.fn().mockResolvedValue({});
  const view = renderSlot({ component: () => <FluidComposerSessionModes threadId={threadId} /> }, {}, {
    composer: { scope }, composerRenderer: renderer, sdk: { subscribe: () => vi.fn(), threads: { timeline, update } },
  });
  return { view, showError, update };
}

// 모드의 예약값을 보여 주고 선택한 값 하나만 현재 스레드에 보낸다.
it('shows only footer modes and applies the selected option to the current thread', async () => {
  const { view, update } = mountModes();
  try {
    const strategy = await screen.findByRole('combobox', { name: 'Strategy' });
    expect(strategy).toHaveProperty('value', 'review');
    expect(screen.queryByRole('combobox', { name: 'Trace' })).toBeNull();
    fireEvent.change(strategy, { target: { value: 'edit' } });
    await waitFor(() => expect(strategy).toHaveProperty('disabled', false));
    expect(strategy).toHaveProperty('value', 'edit');
    expect(update).toHaveBeenCalledExactlyOnceWith({ threadId, sessionOptions: { strategy: 'edit' } });
  } finally {
    view.unmount();
  }
});

// 거부된 변경은 복구하며 비활성 선택값은 boolean false로 전달한다.
it('restores the last known value when the host rejects a mode change', async () => {
  const { view, update, showError } = mountModes();
  try {
    update.mockRejectedValueOnce(new Error('invalid'));
    const stream = await screen.findByRole('combobox', { name: 'Stream' });
    fireEvent.change(stream, { target: { value: 'false' } });
    await waitFor(() => expect(showError).toHaveBeenCalledOnce());
    expect(update).toHaveBeenCalledExactlyOnceWith({ threadId, sessionOptions: { stream: false } });
    expect(stream).toHaveProperty('value', 'true');
    expect(stream).toHaveProperty('disabled', false);
  } finally {
    view.unmount();
  }
});
