// @vitest-environment jsdom
import {expect,it,vi} from 'vitest';
import {createVoiceBars,VOICE_BAR_COUNT} from './voice-bars-renderer';

it('bounds the thin bars, clears stale sound and stops writes after disposal without scheduling frames',()=>{
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 for(let i=0;i<VOICE_BAR_COUNT;i++){const line=document.createElementNS(svg.namespaceURI,'line');line.setAttribute('data-bb-chat-ui-voice-bar','');svg.append(line);}
 const frame=vi.spyOn(window,'requestAnimationFrame'),bars=createVoiceBars(svg);
 try{
  bars.draw(0,0);bars.draw(.5,1);
  const heights=[...svg.children].map(bar=>Number(bar.getAttribute('y2'))-Number(bar.getAttribute('y1')));
  expect(heights.every(h=>h>=2&&h<=22)).toBe(true);expect(heights.some(h=>h>10)).toBe(true);
  bars.draw(50,0);expect([...svg.children].every(bar=>bar.getAttribute('y1')==='11.0000'&&bar.getAttribute('y2')==='13.0000')).toBe(true);
  const quiet=svg.innerHTML;bars.draw(NaN,1);expect(svg.innerHTML).toBe(quiet);
  bars.dispose();bars.draw(51,1);expect(svg.innerHTML).toBe(quiet);expect(frame).not.toHaveBeenCalled();
 }finally{bars.dispose();frame.mockRestore();}
});
