import {describe,it,expect} from 'vitest';
import {RunModel} from '../src/game/RunModel';
import {RenderInterpolation} from '../src/rendering/interpolation';
import {parallaxY,BIOME_LAYERS} from '../src/data/environment';
import {terrainStyle} from '../src/data/terrain-style';
import {IdleClock} from '../src/rendering/IdleClock';
describe('shared lobby idle tempo',()=>{
 it('has the same phase at 30/60/120 Hz and costume switches do not restart its cycle',()=>{
  for(const hz of [30,60,120]){const clock=new IdleClock();clock.frame(0);for(let i=1;i<=hz;i++)clock.frame(i*1000/hz);expect(clock.frame(1000)).toBe(7);expect(clock.frame(1000)).toBe(7);for(let i=1;i<=hz;i++)clock.frame(1000+i*1000/hz);expect(clock.frame(2000)).toBe(6);}
 });
 it('preserves phase during pause and does not catch up hidden time after resume',()=>{
  const clock=new IdleClock();clock.frame(0);for(let i=1;i<=30;i++)clock.frame(i*1000/60);const before=clock.frame(500);clock.resetTimestamp();expect(clock.frame(50000,true)).toBe(before);clock.resetTimestamp();expect(clock.frame(60000)).toBe(before);expect(clock.frame(60050)).toBe(before);
 });
});
describe('render-only position sampling',()=>{
 it('interpolates player, camera and moving surfaces without changing gameplay/save data',()=>{
  const m=new RunModel(undefined,42),v=new RenderInterpolation();v.capture(m.state);
  const before=m.snapshot();m.state.player.x+=20;m.state.player.y-=30;m.state.cameraY-=10;m.state.platforms[0]!.x+=8;
  const current=m.snapshot();expect(v.playerX(m.state,.25)).toBe(before.player.x+5);expect(v.playerY(m.state,.5)).toBe(before.player.y-15);expect(v.cameraY(m.state,.5)).toBe(-5);expect(v.platformX(0,m.state.platforms[0]!.x,.5)).toBe(244);expect(m.snapshot()).toEqual(current);
 });
 it('new objects use their real coordinate, alpha is bounded, resetting removes stale resume offsets',()=>{
  const m=new RunModel(undefined,42),v=new RenderInterpolation();v.capture(m.state);expect(v.x(999,123,.5)).toBe(123);m.state.player.x=300;expect(v.playerX(m.state,5)).toBe(300);expect(v.playerX(m.state,-1)).toBe(240);v.capture(m.state);expect(v.playerX(m.state,0)).toBe(300);
 });
});
describe('decorative depth independent of collision geometry',()=>{
 it('each layer moves opposite the camera, at a distinct depth rate, with bounded large restored coordinates',()=>{
  const rates=new Set<number>();for(const l of BIOME_LAYERS){const a=parallaxY(-10,l.factor,0,l.height),b=parallaxY(-20,l.factor,0,l.height);expect(b-a).toBeCloseTo(10*l.factor);rates.add(l.factor);for(const c of [-1e8,1e8,0])expect(Math.abs(parallaxY(c,l.factor,1,l.height))).toBeLessThan(l.height*2);}expect(rates.size).toBe(5);
 });
 it('surfaces retain function while stone appearances vary by stable id/biome',()=>{
  expect(new Set(Array.from({length:10},(_,i)=>terrainStyle('stone','sky',i))).size).toBe(5);expect(terrainStyle('cloud','inferno',4)).toBe('moving');expect(terrainStyle('fragile','night',5)).toBe('fragile');expect(terrainStyle('arena','sky',9)).toBe('arena');
 });
});
