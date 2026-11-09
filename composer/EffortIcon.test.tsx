// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { EffortIcon } from './EffortIcon';

afterEach(cleanup);

// 기본 세 단계는 같은 폭의 세 막대에서 켜진 수만 바꾼다.
it.each([['low', 1], ['medium', 2], ['high', 3]] as const)('renders three bars for %s with %i active', (level, active) => {
  const { container } = render(<EffortIcon level={level} index={0} count={4}/>);
  const bars = [...container.querySelectorAll('path')];
  expect(bars).toHaveLength(3);
  expect(bars.filter(bar => bar.getAttribute('opacity') === '1')).toHaveLength(active);
  expect(bars.filter(bar => bar.getAttribute('opacity') === '0.22')).toHaveLength(3 - active);
  for (const bar of bars.slice(active)) expect(bar.getAttribute('stroke')).toBe('var(--muted-foreground, currentColor)');
});

// xhigh의 긴 강조 막대는 미리 확보한 같은 아이콘 칸 안에만 추가한다.
it('adds a taller accent bar for xhigh without changing the icon viewport', () => {
  const regular = render(<EffortIcon level="high" index={2} count={4}/>);
  const extra = render(<EffortIcon level="xhigh" index={3} count={4}/>);
  const a = regular.container.querySelector('svg')!, b = extra.container.querySelector('svg')!;
  for (const name of ['width', 'height', 'viewBox']) expect(b.getAttribute(name)).toBe(a.getAttribute(name));
  expect(b.querySelectorAll('path')).toHaveLength(4);
  expect([...b.querySelectorAll('path')].slice(0, 3).map(bar => bar.getAttribute('d'))).toEqual([...a.querySelectorAll('path')].map(bar => bar.getAttribute('d')));
  const accent = b.querySelector('[data-effort-accent]')!;
  expect(accent.getAttribute('d')).toBe('M16 17v-15');
  expect(accent.getAttribute('stroke')).toBe('var(--brand, var(--ring, currentColor))');
});

// 미선정 특수 단계와 provider의 추가 단계도 고정 크기와 접근성 경계를 유지한다.
it.each(['none', 'minimal', 'max', 'ultra', 'provider-level'])('keeps %s decorative and in the same icon slot', level => {
  const { container } = render(<EffortIcon level={level} index={1} count={3}/>);
  const svg = container.querySelector('svg')!;
  expect(svg.getAttribute('width')).toBe('16');
  expect(svg.getAttribute('viewBox')).toBe('0 0 20 20');
  expect(svg.getAttribute('aria-hidden')).toBe('true');
  expect(container.querySelector('[data-effort-accent]')).toBeNull();
  if (level === 'max' || level === 'ultra') expect(svg.getAttribute('data-effort-icon')).toBe(level);
});
