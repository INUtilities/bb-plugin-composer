import type { SVGProps } from 'react';

const mic = 'M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zm6-3a6 6 0 0 1-12 0m6 6v3';
const stop = 'M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z';
const send = 'M3.45 3.8 21.7 11.35a.7.7 0 0 1 0 1.3L3.45 20.2a.7.7 0 0 1-.94-.81l1.63-6.3L14.64 12l-10.5-1.09-1.63-6.3a.7.7 0 0 1 .94-.81Z';

// BB 아이콘을 데모에 필요한 접근성 비노출 SVG로 표시한다.
export function experimental_Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name?: string }) {
  return <svg {...props} aria-hidden="true" viewBox="0 0 24 24" data-icon-root="">
    <path d={name === 'Mic' ? mic : name === 'Square' ? stop : send}
      fill={name === 'Mic' ? 'none' : 'currentColor'} stroke={name === 'Mic' ? 'currentColor' : 'none'}
      strokeWidth="1.6" strokeLinecap="round" />
  </svg>;
}
