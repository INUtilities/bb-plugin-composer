// 세 기본 막대와 xhigh 강조 막대를 같은 16px 칸에 표시한다.
export function EffortIcon({ level, index, count }: { level: string; index: number; count: number }) {
  const special = level === 'max' || level === 'ultra';
  const bars = level === 'none' ? 0 : ({ minimal: 1, low: 1, medium: 2, high: 3, xhigh: 3 }[level] ?? Math.max(1, Math.ceil((index + 1) * 3 / Math.max(1, count))));
  return <svg data-effort-icon={special ? level : 'steps'} width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {special ? level === 'max'
      ? <path d="M10 2 12.2 7.8 18 10 12.2 12.2 10 18 7.8 12.2 2 10 7.8 7.8Z"/>
      : <><circle cx="10" cy="10" r="3"/><path d="M10 1v3m0 12v3M1 10h3m12 0h3M3.6 3.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"/></>
      : <>
        {[5, 8, 11].map((height, i) => <path key={height} d={`M${4 + i * 4} 17v-${height}`} strokeWidth="2.5" stroke={i < bars ? 'currentColor' : 'var(--muted-foreground, currentColor)'} opacity={i < bars ? 1 : .22}/>)}
        {level === 'xhigh' ? <path data-effort-accent="" d="M16 17v-15" strokeWidth="2.5" stroke="var(--brand, var(--ring, currentColor))"/> : null}
      </>}
  </svg>;
}
