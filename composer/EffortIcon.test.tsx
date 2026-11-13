// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { EffortIcon } from './EffortIcon';

afterEach(cleanup);

// Hermes의 아홉 단계는 이름뿐 아니라 실제 도형도 서로 달라야 한다.
it('distinguishes all nine Hermes effort glyphs without growing the icon slot', () => {
  const levels = ['default', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
  const shapes = levels.map((level, index) => {
    const view = render(<EffortIcon level={level} index={index} count={levels.length}/>);
    const svg = view.container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 20 16');
    const shape = svg.innerHTML;
    view.unmount();
    return shape;
  });
  expect(new Set(shapes).size).toBe(levels.length);
});

// 기본 세 단계는 같은 폭의 세 막대에서 켜진 수만 바꾼다.
it.each([['low', 1], ['medium', 2], ['high', 3]] as const)('renders three bars for %s with %i active', (level, active) => {
  const { container } = render(<EffortIcon level={level} index={0} count={4}/>);
  const bars = [...container.querySelectorAll('rect')];
  expect(bars).toHaveLength(3);
  for(const bar of bars){expect(bar.getAttribute('width')).toBe('2.5');expect(bar.getAttribute('rx')).toBe('1');}
  expect(Number(bars[1]!.getAttribute('x'))-Number(bars[0]!.getAttribute('x'))-Number(bars[0]!.getAttribute('width'))).toBe(1.75);
  expect(bars.filter(bar => bar.getAttribute('opacity') === '1')).toHaveLength(active);
  expect(bars.filter(bar => bar.getAttribute('opacity') === '0.3')).toHaveLength(3 - active);
  for (const bar of bars.slice(active)) expect(bar.getAttribute('fill')).toBe('var(--muted-foreground, currentColor)');
});

// xhigh의 긴 강조 막대는 미리 확보한 같은 아이콘 칸 안에만 추가한다.
it('adds a taller accent bar for xhigh without changing the icon viewport', () => {
  const regular = render(<EffortIcon level="high" index={2} count={4}/>);
  const extra = render(<EffortIcon level="xhigh" index={3} count={4}/>);
  const a = regular.container.querySelector('svg')!, b = extra.container.querySelector('svg')!;
  for (const name of ['width', 'height', 'viewBox']) expect(b.getAttribute(name)).toBe(a.getAttribute(name));
  expect(b.querySelectorAll('rect')).toHaveLength(4);
  expect([...b.querySelectorAll('rect')].slice(0, 3).map(bar => bar.getAttribute('x'))).toEqual([...a.querySelectorAll('rect')].map(bar => bar.getAttribute('x')));
  const accent = b.querySelector('[data-effort-accent]')!;
  expect(accent.getAttribute('x')).toBe('14.25');
  expect(accent.getAttribute('height')).toBe('13');
  expect(accent.getAttribute('fill')).toBe('var(--brand, var(--ring, currentColor))');
});

// 미선정 특수 단계와 provider의 추가 단계도 고정 크기와 접근성 경계를 유지한다.
it.each(['none', 'minimal', 'max', 'ultra', 'provider-level'])('keeps %s decorative and in the same icon slot', level => {
  const { container } = render(<EffortIcon level={level} index={1} count={3}/>);
  const svg = container.querySelector('svg')!;
  expect(svg.getAttribute('width')).toBe('20');
  expect(svg.getAttribute('viewBox')).toBe('0 0 20 16');
  expect(svg.getAttribute('aria-hidden')).toBe('true');
  expect(container.querySelector('[data-effort-accent]')).toBeNull();
  if (level === 'max' || level === 'ultra') expect(svg.getAttribute('data-effort-icon')).toBe(level);
});
