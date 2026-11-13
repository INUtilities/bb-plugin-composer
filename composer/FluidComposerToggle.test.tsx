// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FluidComposerToggle } from './FluidComposerToggle';

const chrome=vi.hoisted(()=>({device:'phone'}));
vi.mock('../lib/use-device',()=>({useDeviceChrome:()=>chrome}));
afterEach(()=>{cleanup();vi.restoreAllMocks();chrome.device='phone';delete (window as Window & {bb?:unknown}).bb;});

it('pulses once on phone open and close while suppressing rapid repeat haptics',()=>{
 const post=vi.fn(),click=vi.fn();Object.assign(window,{bb:{native:{capabilities:['haptic'],post}}});
 const now=vi.spyOn(performance,'now').mockReturnValue(1000);
 const view=render(<FluidComposerToggle open={false} onClick={click}/>),button=screen.getByRole('button',{name:'Prompt actions'});
 fireEvent.click(button);expect(post).toHaveBeenCalledExactlyOnceWith({type:'haptic',kind:'impact-light'});
 view.rerender(<FluidComposerToggle open onClick={click}/>);
 now.mockReturnValue(1500);fireEvent.click(button);expect(post).toHaveBeenCalledTimes(2);
 now.mockReturnValue(1600);fireEvent.click(button);expect(post).toHaveBeenCalledTimes(2);expect(click).toHaveBeenCalledTimes(3);
 view.rerender(<FluidComposerToggle open disabled onClick={click}/>);
 now.mockReturnValue(2100);fireEvent.click(button);expect(post).toHaveBeenCalledTimes(2);expect(click).toHaveBeenCalledTimes(3);
});

it('keeps desktop and phone without a native haptic capability silent',()=>{
 const post=vi.fn(),click=vi.fn();Object.assign(window,{bb:{native:{capabilities:['haptic'],post}}});
 chrome.device='desktop';const view=render(<FluidComposerToggle open={false} onClick={click}/>);
 fireEvent.click(screen.getByRole('button',{name:'Prompt actions'}));expect(post).not.toHaveBeenCalled();
 chrome.device='phone';Object.assign(window,{bb:{native:{capabilities:[],post}}});
 view.rerender(<FluidComposerToggle open onClick={click}/>);
 fireEvent.click(screen.getByRole('button',{name:'Prompt actions'}));expect(post).not.toHaveBeenCalled();expect(click).toHaveBeenCalledTimes(2);
});
