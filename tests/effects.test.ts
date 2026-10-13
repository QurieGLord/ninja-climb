import {describe,it,expect} from 'vitest';
import {EffectPool} from '../src/rendering/EffectPool';
describe('bounded effects under sustained action',()=>{
 it('reuses objects across thousands of simultaneous impacts and expires them without creating tweens',()=>{
  const images:any[]=[],texts:any[]=[];
  const object=()=>{const o:any={visible:false};for(const method of ['setDepth','setOrigin','setDisplaySize','setFlipX','setRotation','setTint','setScale','setTexture','setPosition','setAlpha','setText','setColor'])o[method]=()=>o;o.setVisible=(value:boolean)=>{o.visible=value;return o;};return o;};
  const scene:any={add:{image:()=>{const o=object();images.push(o);return o;},text:()=>{const o=object();texts.push(o);return o;}},tweens:{add:()=>{throw Error('Per-effect tween allocation');}}};
  const pool=new EffectPool(scene),sprite:any={x:240,texture:{key:'hero-ember'},frame:{name:'dashing-0'},originX:.5,originY:.9,displayWidth:256,displayHeight:160,flipX:false,rotation:0};
  for(let i=0;i<10000;i++){pool.burst(240,-i,0xffffff);pool.ghost(sprite,-i);pool.floating(240,-i,'+3');if(i%10===0)pool.update(.016,-i);}
  expect(images).toHaveLength(72);expect(texts).toHaveLength(8);expect(images.filter(o=>o.visible).length).toBeLessThanOrEqual(72);
  pool.update(1,0);expect(images.every(o=>!o.visible)).toBe(true);expect(texts.every(o=>!o.visible)).toBe(true);
 });
});
