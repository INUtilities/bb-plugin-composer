import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {injectFluidComposer} from './fluid-composer.ts';
const mark='data-bb-chat-ui-fluid-mode';
const styles=(d:Document)=>d.querySelectorAll('#bb-chat-ui-fluid-composer');

test('active composers share a stylesheet and preserve the mode until the last owner releases it',()=>{
 const dom=new JSDOM('<!doctype html>'),d=dom.window.document;
 const first=injectFluidComposer(d),second=injectFluidComposer(d);
 try{
  assert.equal(styles(d).length,1);
  first();first();assert.equal(d.documentElement.getAttribute(mark),'');assert.equal(styles(d).length,1);
  second();assert.equal(d.documentElement.hasAttribute(mark),false);assert.equal(styles(d).length,0,'no style remains without a mounted owner');
 }finally{first();second();dom.window.close();}
});

test('last release restores native chrome immediately and later mounts cannot lose their new sheet',async()=>{
 const dom=new JSDOM('<!doctype html>'),d=dom.window.document;d.documentElement.setAttribute(mark,'previous');
 let stop=injectFluidComposer(d);const old=styles(d)[0];
 try{
  stop();assert.equal(d.documentElement.getAttribute(mark),'previous');assert.equal(styles(d).length,0);
  stop=injectFluidComposer(d);assert.notEqual(styles(d)[0],old);await Promise.resolve();assert.equal(styles(d).length,1);
  stop();assert.equal(d.documentElement.getAttribute(mark),'previous');assert.equal(styles(d).length,0);
 }finally{stop();dom.window.close();}
});

test('documents own independent styles and duplicate release cannot remove another owner',()=>{
 const a=new JSDOM('<!doctype html>'),b=new JSDOM('<!doctype html>');const da=a.window.document,db=b.window.document;
 const first=injectFluidComposer(da),peer=injectFluidComposer(da),other=injectFluidComposer(db);
 try{
  first();first();assert.equal(styles(da).length,1);assert.equal(styles(db).length,1);
  peer();assert.equal(styles(da).length,0);assert.equal(styles(db).length,1);assert.equal(db.documentElement.getAttribute(mark),'');
 }finally{first();peer();other();a.window.close();b.window.close();}
});
