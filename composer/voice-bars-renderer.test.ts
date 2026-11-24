// @vitest-environment jsdom
import {expect,it,vi} from 'vitest';
import {createVoiceBars,VOICE_BAR_COUNT} from './voice-bars-renderer';

// 높이와 시간의 변화는 실제 SVG에 그려진 막대에서 확인한다.
it('keeps quiet bars uneven and makes neighboring bars rise by different amounts with sound',()=>{
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 for(let i=0;i<VOICE_BAR_COUNT;i++){const line=document.createElementNS(svg.namespaceURI,'line');line.setAttribute('data-bb-chat-ui-voice-bar','');svg.append(line);}
 const bars=createVoiceBars(svg);
 // 각 SVG 선의 길이를 같은 장면의 막대 높이로 읽는다.
 const heights=()=>[...svg.children].map(bar=>Number(bar.getAttribute('y2'))-Number(bar.getAttribute('y1')));
 try{
  bars.draw(0,0);const quiet=heights();
  expect(Math.max(...quiet)-Math.min(...quiet)).toBeGreaterThan(1.5);
  bars.draw(.2,0);expect(heights()).not.toEqual(quiet);
  expect(Math.max(...heights())).toBeLessThan(5.1);
  for(let time=.25;time<=1.5;time+=.05)bars.draw(time,.35);
  const expressive=heights();
  expect(Math.max(...expressive)).toBeGreaterThan(16);
  expect(expressive.some((height,index)=>index>0&&Math.abs(height-expressive[index-1])>8)).toBe(true);
  expect(expressive[0]).toBeLessThan(2);expect(expressive.at(-1)).toBeLessThan(2);
  bars.draw(1.7,.35);expect(heights()).not.toEqual(expressive);
 }finally{bars.dispose();}
});

// 오래된 음량을 버리고 해제한 렌더러가 SVG를 수정하지 않는지 확인한다.
it('bounds bar heights, clears stale sound and stops writes after disposal without scheduling frames',()=>{
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 for(let i=0;i<VOICE_BAR_COUNT;i++){const line=document.createElementNS(svg.namespaceURI,'line');line.setAttribute('data-bb-chat-ui-voice-bar','');svg.append(line);}
 const frame=vi.spyOn(window,'requestAnimationFrame'),bars=createVoiceBars(svg);
 try{
  bars.draw(0,0);bars.draw(.5,1);
  const heights=[...svg.children].map(bar=>Number(bar.getAttribute('y2'))-Number(bar.getAttribute('y1')));
  expect(heights.every(h=>h>=1&&h<=24)).toBe(true);expect(heights.some(h=>h>7)).toBe(true);
  bars.draw(50,0);
  expect([...svg.children].every(bar=>Number(bar.getAttribute('y2'))-Number(bar.getAttribute('y1'))<5.1)).toBe(true);
  const quiet=svg.innerHTML;bars.draw(NaN,1);expect(svg.innerHTML).toBe(quiet);
  bars.dispose();bars.draw(51,1);expect(svg.innerHTML).toBe(quiet);expect(frame).not.toHaveBeenCalled();
 }finally{bars.dispose();frame.mockRestore();}
});
