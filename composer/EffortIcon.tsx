// 원본 간격의 채운 막대와 xhigh 예약 공간을 같은 20×16px 칸에 표시한다.
export function EffortIcon({ level, index, count }: { level: string; index: number; count: number }) {
  const special = level === 'max' || level === 'ultra';
  const bars = level === 'none' ? 0 : ({ minimal: 1, low: 1, medium: 2, high: 3, xhigh: 3 }[level] ?? Math.max(1, Math.ceil((index + 1) * 3 / Math.max(1, count))));
  return <svg data-effort-icon={special ? level : 'steps'} width="20" height="16" viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {special ? <g transform="translate(2 0) scale(.8)">{level === 'max'
      ? <path d="M10 2 12.2 7.8 18 10 12.2 12.2 10 18 7.8 12.2 2 10 7.8 7.8Z"/>
      : <><circle cx="10" cy="10" r="3"/><path d="M10 1v3m0 12v3M1 10h3m12 0h3M3.6 3.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"/></>}</g>
      : <>
        {[4.5, 7.5, 10.5].map((height, i) => <rect key={height} x={1.5 + i * 4.25} y={13.5 - height} width="2.5" height={height} rx="1" stroke="none" fill={i < bars ? 'currentColor' : 'var(--muted-foreground, currentColor)'} opacity={i < bars ? 1 : .3}/>)}
        {level === 'xhigh' ? <rect data-effort-accent="" x="14.25" y=".5" width="2.5" height="13" rx="1" stroke="none" fill="var(--brand, var(--ring, currentColor))"/> : null}
      </>}
  </svg>;
}
