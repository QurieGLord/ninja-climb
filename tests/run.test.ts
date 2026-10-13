import { describe, expect, it } from 'vitest';
import { RunModel, freshPlayer, restoreCheckpoint, IDLE_INPUT } from '../src/game/RunModel';
import type { Controls, Platform, Enemy } from '../src/game/types';
import { RULES } from '../src/data/config';
import { bladeBox, updateCombat } from '../src/game/combat';
import { spawnEnemy, segmentReachable, CLIMB_ROUTE } from '../src/game/level';
const idle={...IDLE_INPUT};
const floor=(id=0,x=240,y=710,width=360,kind:Platform['kind']='stone'):Platform=>({id,x,y,width,kind,baseX:x,broken:false,crumble:0,dx:0});
function isolated(){
 const r=new RunModel(undefined,42);Object.assign(r.state,{platforms:[floor()],walls:[],enemies:[],coins:[],topY:-10000,cameraY:0,cameraTarget:0});return r;
}
function air(){const r=isolated();r.state.platforms=[];Object.assign(r.state.player,{y:360,grounded:null,coyote:0,vy:0});return r;}
function advance(r:RunModel,time:number,input:Controls=idle){for(let i=0;i<Math.ceil(time*120);i++)r.step(1/120,input);}
function enemy(r:RunModel,x=290,y=r.state.player.y,kind:Enemy['kind']='wisp',hp=1){const e=spawnEnemy(r.state,kind,x,y);e.hp=hp;return e;}
describe('manual movement and one-way ledges',()=>{
 it('lands without auto-jumping, then stays idle on the surface',()=>{
  const r=isolated();Object.assign(r.state.player,{y:630,vy:600,grounded:null,coyote:0});advance(r,0.3);
  expect(r.state.player.y).toBe(686);expect(r.state.player.vy).toBe(0);expect(r.state.player.grounded).toBe(0);expect(r.state.player.motion).toBe('idle');
  expect(r.drainEvents().filter(e=>e.type==='jump')).toHaveLength(0);
 });
 it('allows a new jump after landing, but holding one press never auto-repeats it',()=>{
  const r=isolated(),held={...idle,jump:true,jumpHeld:true};advance(r,1,held);
  expect(r.drainEvents().filter(e=>e.type==='jump')).toHaveLength(1);expect(r.state.player.grounded).toBe(0);
  r.step(1/120,idle);r.step(1/120,held);expect(r.state.player.vy).toBeLessThan(-600);
 });
 it('held jump rises higher than a short tap',()=>{
  const a=isolated(),b=isolated();a.step(1/120,{...idle,jump:true,jumpHeld:true});b.step(1/120,{...idle,jump:true,jumpHeld:true});
  let highA=686,highB=686;for(let i=0;i<65;i++){a.step(1/120,{...idle,jumpHeld:true});b.step(1/120,idle);highA=Math.min(highA,a.state.player.y);highB=Math.min(highB,b.state.player.y);}
  expect(highB-highA).toBeGreaterThan(40);
 });
 it('buffers jump shortly before touching a platform',()=>{
  const r=isolated();Object.assign(r.state.player,{y:650,vy:320,grounded:null,coyote:0});advance(r,0.15,{...idle,jump:true,jumpHeld:true});
  expect(r.drainEvents().some(e=>e.type==='jump')).toBe(true);expect(r.state.player.vy).toBeLessThan(0);
 });
 it('coyote jump works just after leaving a ledge',()=>{
  const r=isolated();r.state.platforms=[floor(0,240,710,90)];r.state.player.x=292;r.state.player.vx=270;
  advance(r,0.04,{...idle,direction:1});expect(r.state.player.grounded).toBeNull();
  r.step(1/120,{...idle,jump:true,jumpHeld:true,direction:1});expect(r.state.player.vy).toBeLessThan(-600);
 });
 it('accelerates, brakes, and reverses in the air without a long inertial delay',()=>{
  const r=air();advance(r,0.15,{...idle,direction:1});expect(r.state.player.vx).toBe(270);
  advance(r,0.1,{...idle,direction:-1});expect(r.state.player.vx).toBeLessThan(0);
  advance(r,0.1);expect(r.state.player.vx).toBe(0);
 });
 it('passes upward through one-way platforms and sweeps fast downward falls',()=>{
  const r=air();r.state.platforms=[floor(1,240,340,160)];r.state.player.vy=-500;r.step(1/30,{...idle,jumpHeld:true});expect(r.state.player.vy).toBeGreaterThan(-500);
  Object.assign(r.state.player,{y:280,vy:3000});r.step(0.05,idle);expect(r.state.player.y).toBe(316);expect(r.state.player.vy).toBe(0);
 });
 it('carries the player on moving supports and delays fragile collapse',()=>{
  const r=isolated();r.state.platforms[0]!.kind='cloud';const before=r.state.player.x;advance(r,0.2);expect(r.state.player.x).not.toBe(before);expect(r.state.player.grounded).toBe(0);
  const f=isolated();f.state.platforms[0]!.kind='fragile';Object.assign(f.state.player,{y:650,vy:300,grounded:null,coyote:0});advance(f,0.15);expect(f.state.platforms[0]!.broken).toBe(false);
  advance(f,1);expect(f.state.platforms[0]!.broken).toBe(true);expect(f.state.player.grounded).toBeNull();
 });
});
describe('walls and directed dash',()=>{
 function onWall(){const r=air();r.state.walls=[{id:7,x:200,y:200,width:14,height:400,grip:true,hazard:false}];Object.assign(r.state.player,{x:186,y:350,vy:5,wallId:7,wallSide:1});return r;}
 it('cling expires, then slide speed stays bounded',()=>{
  const r=onWall();advance(r,0.2,{...idle,direction:1});expect(r.state.player.motion).toBe('wall_cling');expect(r.state.player.vy).toBe(0);
  advance(r,0.35,{...idle,direction:1});expect(r.state.player.motion).toBe('wall_slide');expect(r.state.player.vy).toBeLessThanOrEqual(RULES.wallSlideSpeed);
 });
 it('wall-jump pushes away and upward, then unlocks air steering',()=>{
  const r=onWall();r.step(1/120,{...idle,direction:1,jump:true,jumpHeld:true});expect(r.state.player.vx).toBeLessThan(0);expect(r.state.player.x).toBeLessThan(186);expect(r.state.player.vy).toBeLessThan(-600);
  advance(r,0.25,{...idle,direction:1,jumpHeld:true});expect(r.state.player.vx).toBeGreaterThan(0);
 });
 it('does not cling to electric surfaces and contact causes one protected damage event',()=>{
  const r=onWall();r.state.walls[0]!.hazard=true;r.state.walls[0]!.grip=false;
  advance(r,0.3,{...idle,direction:1});expect(r.state.player.health).toBe(2);expect(r.state.player.motion).not.toBe('wall_cling');
 });
 it('dash is a short two-dimensional action, ends, and does not repeat from held input',()=>{
  const r=isolated();advance(r,0.08,{...idle,dash:true,direction:1,vertical:-1});expect(r.state.player.motion).toBe('dashing');expect(r.state.player.vy).toBeLessThan(-600);
  advance(r,0.1,{...idle,dash:true,direction:1,vertical:-1});expect(r.state.player.dashLeft).toBe(0);expect(r.state.player.motion).not.toBe('dashing');
  advance(r,0.3,{...idle,dash:true,direction:-1,vertical:-1});expect(r.drainEvents().filter(e=>e.type==='dash')).toHaveLength(1);expect(r.state.player.vx).toBeLessThan(0);
 });
 it('dash collides with a three-pixel wall instead of tunnelling through',()=>{
  const r=air();r.state.walls=[{id:7,x:270,y:100,width:3,height:600,grip:true,hazard:false}];r.state.player.x=240;
  r.step(1/30,{...idle,dash:true,direction:1});expect(r.state.player.x).toBeLessThanOrEqual(256);expect(r.state.player.dashLeft).toBe(0);
 });
 it('upward dash cannot cross a thin full-solid ceiling',()=>{
  const r=air();r.state.player.y=550;r.state.walls=[{id:7,x:100,y:500,width:300,height:3,grip:false,hazard:false}];
  r.step(1/30,{...idle,dash:true,vertical:-1});expect(r.state.player.y).toBeGreaterThanOrEqual(527);expect(r.state.player.dashLeft).toBe(0);
 });
 it('dash uses the direction captured at the input edge, even after the key is released',()=>{
  const r=air();r.step(1/120,{...idle,dash:true,dashDirection:{x:0,y:-1}});
  expect(r.state.player.dashX).toBe(0);expect(r.state.player.dashY).toBe(-1);
  r.step(1/120,{...idle,direction:1,vertical:1});expect(r.state.player.dashX).toBe(0);expect(r.state.player.vy).toBe(-980);
 });
});
describe('directed katana, combos and real boss windows',()=>{
 it('a forward blade hits only during its active frames; it misses behind and far above',()=>{
  const r=air();enemy(r,290);const behind=enemy(r,190),above=enemy(r,280,210);
  r.step(1/120,{...idle,attack:true});expect(r.state.earned).toBe(0);
  advance(r,0.12);expect(r.state.earned).toBe(3);expect(behind.hp).toBe(1);expect(above.hp).toBe(1);expect(bladeBox(r.state).width).toBe(78);
 });
 it('one swing cannot damage the same enemy repeatedly or repeat while held',()=>{
  const r=air(),e=enemy(r,285,360,'wisp',5);advance(r,0.3,{...idle,attack:true});expect(e.hp).toBe(4);expect(r.state.player.attackId).toBe(1);
 });
 it('air hit restores dash, gives a small controllable lift and rewards a kill once',()=>{
  const r=air();r.state.player.dashReady=false;r.state.player.dashCooldown=0.3;enemy(r,290);
  r.step(1/120,{...idle,attack:true});advance(r,0.09);expect(r.state.player.dashReady).toBe(true);expect(r.state.player.vy).toBeGreaterThanOrEqual(-RULES.airHitLift);
  expect(r.state.earned).toBe(3);advance(r,0.12);expect(r.state.earned).toBe(3);
 });
 it('chains separate hits without landing; expiration and landing reset the combo',()=>{
  const r=air();enemy(r,290);r.step(1/120,{...idle,attack:true});advance(r,0.36);
  enemy(r,290,r.state.player.y);r.step(1/120,{...idle,attack:true});advance(r,0.10);expect(r.state.combo).toBe(2);expect(r.state.score).toBe(300);
  for(let i=0;i<260;i++){r.state.player.y=360;r.state.player.vy=0;r.step(1/120,idle);}expect(r.state.combo).toBe(0);expect(r.state.bestCombo).toBe(2);
 });
 it('boss telegraphs, attacks, then exposes a vulnerability window; phase II speeds telegraph',()=>{
  const r=isolated(),b=enemy(r,330,672,'oni',6);b.platformId=0;
  advance(r,0.05);expect(b.state).toBe('windup');const hp=b.hp;
  Object.assign(r.state.player,{x:270,attackTime:0.2,hitIds:[]});updateCombat(r.state,idle,1/120,[]);expect(b.hp).toBe(hp);
  advance(r,0.9);expect(['attack','recover']).toContain(b.state);advance(r,0.35);expect(b.state).toBe('recover');
  r.state.player.x=b.x-50;Object.assign(r.state.player,{attackTime:0.2,hitIds:[]});updateCombat(r.state,idle,1/120,[]);expect(b.hp).toBe(hp-1);
  b.hp=3;b.state='windup';b.stateTime=0;r.state.hitStop=0;advance(r,0.68);expect(b.state).toBe('attack');
 });
 it('boss defeat removes its gate and grants its reward exactly once',()=>{
  const r=air(),b=enemy(r,290,360,'oni',1);b.state='recover';r.state.walls=[{id:8,x:28,y:-200,width:424,height:20,grip:false,hazard:false,gateFor:b.id}];
  r.step(1/120,{...idle,attack:true});advance(r,0.10);expect(r.state.earned).toBe(30);expect(r.state.walls.some(w=>w.gateFor===b.id)).toBe(false);
  advance(r,0.25);expect(r.state.earned).toBe(30);expect(r.state.kills).toBe(1);
 });
 it('hitting a recovering boss does not extend its vulnerability indefinitely',()=>{
  const r=air(),b=enemy(r,290,360,'oni',6);b.state='recover';b.stateTime=1.0;
  r.state.player.attackTime=0.2;updateCombat(r.state,idle,1/120,[]);
  expect(b.state).toBe('recover');expect(b.stateTime).toBe(1.0);expect(b.reactionLeft).toBeGreaterThan(0);
 });
});
describe('segments, pause, checkpoints and fixed-step stability',()=>{
 it('checked routes and their mirrors are reachable with ordinary jumps',()=>{
  expect(segmentReachable()).toBe(true);expect(segmentReachable(CLIMB_ROUTE.map(p=>({...p,x:480-p.x})))).toBe(true);
 });
 it('first area includes walls, moving support and a practice enemy; later areas include gates and hazards',()=>{
  const r=new RunModel(undefined,42);expect(r.state.walls.some(w=>w.grip)).toBe(true);expect(r.state.platforms.some(p=>p.kind==='cloud')).toBe(true);
  r.state.cameraY=-2200;r.state.player.y=-1800;r.step(1/120,idle);
  expect(r.state.enemies.some(e=>e.kind==='oni')).toBe(true);expect(r.state.walls.some(w=>w.hazard)).toBe(true);
 });
 it('a controller using real jump/dash input reaches the first arena on generated geometry',()=>{
  const r=new RunModel(undefined,71);let goal:Platform|undefined;
  for(let i=0;i<6500&&!r.state.ended;i++){
   const p=r.state.player;r.state.enemies=[];
   if(p.grounded!==null){const ground=r.state.platforms.find(v=>v.id===p.grounded);if(ground?.kind==='arena')break;
    goal=r.state.platforms.filter(v=>!v.broken&&v.y<(ground?.y??p.y+24)-20).sort((a,b)=>b.y-a.y)[0];}
   const direction=goal?Math.abs(goal.x-p.x)<12?0:Math.sign(goal.x-p.x):0;
   r.step(1/120,{...idle,direction,jump:p.grounded!==null,jumpHeld:true,vertical:-1,dash:!!goal&&p.grounded===null&&p.dashReady&&p.vy>-240&&p.y+24>goal.y&&p.y+24-goal.y<70});
  }
  expect(r.state.ended).toBe(false);expect(r.state.height).toBeGreaterThan(260);expect(r.state.platforms.find(v=>v.id===r.state.player.grounded)?.kind).toBe('arena');
 });
 it('pause freezes every gameplay value and resumes without simulating missed wall time',()=>{
  const r=isolated();r.setPaused(true);const before=r.snapshot();advance(r,2,{...idle,jump:true,dash:true,attack:true});expect(r.snapshot()).toEqual(before);
  r.setPaused(false);r.step(1/120,idle);expect(r.state.elapsed).toBeCloseTo(1/120);
 });
 it('restored simulation follows the same future, independently of mutable arrays',()=>{
  const a=isolated();advance(a,0.2,{...idle,direction:1,jump:true,jumpHeld:true});const b=new RunModel(a.snapshot());advance(a,0.2,idle);advance(b,0.2,idle);
  expect(b.snapshot()).toEqual(a.snapshot());b.state.player.health=1;expect(a.state.player.health).toBe(3);
 });
 it('1/30 and 1/120 input schedules give the same movement',()=>{
  const a=isolated(),b=isolated(),input={...idle,direction:1,jump:true,jumpHeld:true};
  for(let i=0;i<12;i++)a.step(1/30,input);for(let i=0;i<48;i++)b.step(1/120,input);
  expect(a.state.player.x).toBeCloseTo(b.state.player.x,8);expect(a.state.player.y).toBeCloseTo(b.state.player.y,8);
 });
 it('old progress migrates to a safe manual checkpoint without resetting height or awarding earned money',()=>{
  const current=new RunModel().snapshot();const legacy={...current,modelVersion:undefined,height:987,score:500,earned:42,player:{x:240,y:-5000,vx:0,vy:500}};
  const s=restoreCheckpoint(legacy)!;expect(s.modelVersion).toBe(2);expect(s.height).toBe(987);expect(s.earned).toBe(42);expect(s.player.grounded).toBe(0);expect(s.player.motion).toBe('idle');
 });
 it('incomplete or non-finite new checkpoints are rejected before simulation starts',()=>{
  const s=new RunModel().snapshot();expect(restoreCheckpoint({...s,player:{x:0,y:0,vx:0,vy:0,motion:'idle'}})).toBeNull();
  expect(restoreCheckpoint({...s,player:{...s.player,health:NaN}})).toBeNull();
 });
 it('fall runs death animation before ending, then accepts no more gameplay input',()=>{
  const r=air();r.state.player.y=910;r.step(1/120,idle);expect(r.state.player.motion).toBe('dead');expect(r.state.ended).toBe(false);advance(r,0.7);expect(r.state.ended).toBe(true);
  const before=r.snapshot();r.step(1/120,{...idle,jump:true});expect(r.snapshot()).toEqual(before);
 });
});
