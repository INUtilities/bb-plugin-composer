// @vitest-environment jsdom
import {expect,it,vi} from 'vitest';
import {createVoiceGlow} from './voice-glow-renderer';
it('uses a gentle fade without delaying its start and completes exit before cleanup',()=>{
 const root=document.createElement('span');root.innerHTML='<i></i><i></i><i></i>';
 const animations:{onfinish:(()=>void)|null;cancel:ReturnType<typeof vi.fn>}[]=[];
 const animate=vi.fn((_frames:Keyframe[]|PropertyIndexedKeyframes|null,_options?:number|KeyframeAnimationOptions)=>{const a={onfinish:null,cancel:vi.fn()};animations.push(a);return a as unknown as Animation;});
 root.animate=animate;
 const glow=createVoiceGlow(root),done=vi.fn();
 try{
  glow.enter();expect(animate).toHaveBeenLastCalledWith([{opacity:'0'},{opacity:'1'}],{duration:300,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});
  glow.leave(done);expect(animate.mock.calls.at(-1)![1]).toMatchObject({duration:220});
  expect(done).not.toHaveBeenCalled();animations.at(-1)!.onfinish?.();expect(done).toHaveBeenCalledOnce();expect(root.style.opacity).toBe('0');
 }finally{glow.dispose();}
});
it('spreads past sound through the glow zones and stops all writes after disposal',()=>{
 const root=document.createElement('span');root.innerHTML='<i></i><i></i><i></i>';
 const frame=vi.spyOn(window,'requestAnimationFrame'),glow=createVoiceGlow(root);
 glow.draw(0,0);const quiet=[...root.children].map(x=>(x as HTMLElement).style.opacity);
 glow.draw(.1,1);const loud=[...root.children].map(x=>(x as HTMLElement).style.opacity);
 expect(Number(loud[0])).toBeGreaterThan(Number(quiet[0]));expect(loud[2]).toBe(quiet[2]);
 glow.draw(.55,0);expect((root.children[0] as HTMLElement).style.opacity).toBe(quiet[0]);
 expect(Number((root.children[2] as HTMLElement).style.opacity)).toBeGreaterThan(Number(quiet[2]));
 glow.draw(50,0);expect([...root.children].map(x=>(x as HTMLElement).style.opacity)).toEqual(quiet);
 expect(frame).not.toHaveBeenCalled();glow.dispose();const frozen=root.innerHTML;glow.draw(51,1);expect(root.innerHTML).toBe(frozen);
 frame.mockRestore();
});
