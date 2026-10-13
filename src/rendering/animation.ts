import Phaser from 'phaser';
import type { Motion } from '../game/types';
export const HERO_ACTIONS: Motion[] = ['idle','running','jumping','rising','falling','landing','wall_cling','wall_slide','wall_jump','dashing','attacking','hurt','dead'];
export const FRAME_COUNT=8;
export const ENEMY_FRAME_COUNTS={sentinel:8,moth:7,oni:7} as const;
const fps: Record<Motion, number> = { idle: 7, running: 14, jumping: 10, rising: 10, falling: 10, landing: 12, wall_cling: 8, wall_slide: 10, wall_jump: 16, dashing: 24, attacking: 24, hurt: 16, dead: 12 };
const loops = new Set<Motion>(['idle','running','rising','falling','wall_cling','wall_slide']);
export const ENEMY_ACTIONS = ['idle','move','windup','attack','recover','hurt','dying'] as const;
export const frameName=(action:string,index:number)=>`${action}-${index}`;
export function registerMenuAnimation(scene:Phaser.Scene,skin:string){const texture=`hero-${skin}-menu`,key=`${texture}-idle`;if(!scene.anims.exists(key))scene.anims.create({key,frames:scene.anims.generateFrameNumbers(texture,{start:0,end:7}),frameRate:7,repeat:-1});}
export function registerHeroAnimations(scene:Phaser.Scene,texture:string){
  for(const state of HERO_ACTIONS){const key=`${texture}-${state}`;if(scene.anims.exists(key))continue;
    scene.anims.create({key,frames:Array.from({length:FRAME_COUNT},(_,i)=>({key:texture,frame:frameName(state,i)})),frameRate:fps[state],repeat:loops.has(state)?-1:0});
  }
}
export function registerAnimations(scene: Phaser.Scene,skin:string) {
  registerHeroAnimations(scene,`hero-${skin}`);
  for (const texture of ['sentinel','moth','oni'] as const) for(let row=0;row<ENEMY_ACTIONS.length;row++) {
    const state=ENEMY_ACTIONS[row]!;
    scene.anims.create({key:`${texture}-${state}`,frames:Array.from({length:ENEMY_FRAME_COUNTS[texture]},(_,i)=>({key:texture,frame:frameName(state,i)})),frameRate:state==='attack'?20:state==='dying'?12:state==='move'&&texture==='sentinel'?8:10,repeat:state==='idle'||state==='move'?-1:0});
  }
}
export function heroAnimation(sprite: Phaser.GameObjects.Sprite, texture: string, state: Motion,progress?:number) {
  const key=`${texture}-${state}`;
  if(sprite.anims.currentAnim?.key !== key) sprite.play(key);
  // Phase-sample short physical actions without changing their gameplay duration.
  sprite.anims.timeScale=progress===undefined?1:0;
  if(progress!==undefined)sprite.anims.setProgress(Math.max(0,Math.min(.9999,progress)));
}
