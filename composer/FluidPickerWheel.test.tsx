// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FluidPickerWheel } from './FluidPickerWheel';

let reduce=false;
const changes=new Set<()=>void>();
const scrolls:ScrollToOptions[]=[];
const oldScroll=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'scrollTo');
beforeEach(()=>{
 reduce=false;changes.clear();scrolls.length=0;vi.useFakeTimers();
 vi.stubGlobal('matchMedia',()=>({get matches(){return reduce;},addEventListener(_type:string,listener:()=>void){changes.add(listener);},removeEventListener(_type:string,listener:()=>void){changes.delete(listener);}}));
 Object.defineProperty(HTMLElement.prototype,'scrollTo',{configurable:true,value:function(this:HTMLElement,options:ScrollToOptions){scrolls.push(options);if(options.behavior!=='smooth')this.scrollTop=options.top??0;}});
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();if(oldScroll)Object.defineProperty(HTMLElement.prototype,'scrollTo',oldScroll);else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;});

// 실제 클릭이 같은 목록의 선택을 바꾸는 입력 화면을 만든다.
function Wheel({disabled=false,alternate=false}:{disabled?:boolean;alternate?:boolean}){
 const [index,setIndex]=useState(0);
 return <FluidPickerWheel label="모델" rowSize={40} index={index} disabled={disabled} items={(alternate?['새1','새2','새3']:['첫째','둘째','셋째']).map(key=>({key,label:key}))} onPick={setIndex}/>;
}

// 클릭 이동 중 생기는 중간 scroll은 이미 고른 항목을 다른 항목으로 되돌리지 않는다.
it('animates a clicked row without selecting an intermediate scroll position',()=>{
 const view=render(<Wheel/>);scrolls.length=0;
 fireEvent.click(screen.getByRole('option',{name:'셋째'}));
 expect(scrolls.at(-1)).toEqual({top:80,behavior:'smooth'});
 const scroller=view.container.querySelector<HTMLElement>('[data-bb-chat-ui-slot-scroll]')!;
 scroller.scrollTop=32;fireEvent.scroll(scroller);act(()=>vi.advanceTimersByTime(180));
 expect(screen.getByRole('option',{name:'셋째'}).getAttribute('aria-selected')).toBe('true');
 fireEvent.click(screen.getByRole('option',{name:'둘째'}));
 expect(scrolls.at(-1)).toEqual({top:40,behavior:'smooth'});
 expect(screen.getByRole('option',{name:'둘째'}).getAttribute('aria-selected')).toBe('true');
});

// 닫기·재열기와 목록 교체는 진행 중 이동을 즉시 마쳐 잘못된 칸을 남기지 않는다.
it('finishes scrolling immediately when hidden, reopened or given another list',()=>{
 const view=render(<Wheel/>);fireEvent.click(screen.getByRole('option',{name:'셋째'}));
 view.rerender(<Wheel disabled/>);expect(scrolls.at(-1)).toEqual({top:80,behavior:'instant'});
 view.rerender(<Wheel/>);expect(scrolls.at(-1)).toEqual({top:80,behavior:'instant'});
 view.rerender(<Wheel alternate/>);
 expect(scrolls.at(-1)).toEqual({top:80,behavior:'instant'});
 expect(screen.getByRole('option',{name:'새3'}).getAttribute('aria-selected')).toBe('true');
});

// 동작 줄이기를 켜면 현재 이동과 이후 클릭을 모두 즉시 반영한다.
it('finishes an active transition and future clicks when reduced motion is enabled',()=>{
 render(<Wheel/>);fireEvent.click(screen.getByRole('option',{name:'셋째'}));
 expect(scrolls.at(-1)?.behavior).toBe('smooth');
 act(()=>{reduce=true;for(const change of changes)change();});
 expect(scrolls.at(-1)).toEqual({top:80,behavior:'instant'});
 fireEvent.click(screen.getByRole('option',{name:'둘째'}));
 expect(scrolls.at(-1)).toEqual({top:40,behavior:'instant'});
});
