import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { needsFullWidthComposer } from './fluid-composer-layout.ts';

function fixture(){
 const dom=new JSDOM('<div id="row" style="padding:8px;column-gap:4px"><div id="left"></div><div id="scroll" data-promptbox-editor-scroll style="padding:0 4px"><div id="editor" style="line-height:24px"><p>draft</p></div></div><div id="right"></div></div>');
 const d=dom.window.document,row=d.getElementById('row')!,editor=d.getElementById('editor')!,left=d.getElementById('left')!,right=d.getElementById('right')!;
 let rowWidth=358,editorHeight=24,textWidth=200,rightWidth=36;
 row.getBoundingClientRect=()=>({width:rowWidth}as DOMRect);editor.getBoundingClientRect=()=>({height:editorHeight}as DOMRect);left.getBoundingClientRect=()=>({width:36}as DOMRect);right.getBoundingClientRect=()=>({width:rightWidth}as DOMRect);
 const create=d.createRange.bind(d);d.createRange=()=>{const r=create();r.getBoundingClientRect=()=>({width:textWidth}as DOMRect);return r;};
 return{dom,editor,probe:()=>needsFullWidthComposer(row,editor,left,right),text:(n:number)=>textWidth=n,height:(n:number)=>editorHeight=n,width:(n:number)=>rowWidth=n,actions:(n:number)=>rightWidth=n};
}
test('newlines and wrapping expand; a wide single line stays expanded until it also fits beside the controls',()=>{
 const f=fixture();try{
  assert.equal(f.probe(),false);f.height(48);assert.equal(f.probe(),true);
  f.height(24);f.text(290);assert.equal(f.probe(),true,'full-width one-line layout must not oscillate back to the narrow column');
  f.text(200);assert.equal(f.probe(),false);f.text(0);assert.equal(f.probe(),false);
 }finally{f.dom.window.close();}
});
test('viewport width and the actual send-action width participate in compact fit',()=>{
 const f=fixture();try{
  f.text(240);assert.equal(f.probe(),false);f.actions(68);assert.equal(f.probe(),true);
  f.width(500);assert.equal(f.probe(),false);f.width(250);assert.equal(f.probe(),true);
 }finally{f.dom.window.close();}
});
test('measures a clipped mention by its visible outer box instead of its long hidden label',()=>{
 const f=fixture();try{
  f.editor.innerHTML='<p><span style="margin:0 4px">very long clipped mention label</span></p>';
  f.editor.querySelector('span')!.getBoundingClientRect=()=>({width:140}as DOMRect);f.text(2000);
  assert.equal(f.probe(),false);
 }finally{f.dom.window.close();}
});
