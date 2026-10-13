import Phaser from 'phaser';
import { SKINS } from '../data/config';
import type { Motion } from '../game/types';
export const HERO_ACTIONS: Motion[] = ['idle','running','jumping','rising','falling','landing','wall_cling','wall_slide','wall_jump','dashing','attacking','hurt','dead'];
const fps: Record<Motion, number> = { idle: 7, running: 14, jumping: 40, rising: 9, falling: 9, landing: 44, wall_cling: 11, wall_slide: 11, wall_jump: 40, dashing: 27, attacking: 13.3, hurt: 16, dead: 6.7 };
const loops = new Set<Motion>(['idle','running','rising','falling','wall_cling','wall_slide']);
export const ENEMY_ACTIONS = ['idle','move','windup','attack','recover','hurt','dying'] as const;
export function registerAnimations(scene: Phaser.Scene) {
  for (const skin of SKINS) for (let row=0;row<HERO_ACTIONS.length;row++) {
    const state=HERO_ACTIONS[row]!;
    scene.anims.create({ key: `${skin.texture}-${state}`, frames: scene.anims.generateFrameNumbers(row>=8?skin.texture+'-combat':skin.texture,{start:(row%8)*4,end:(row%8)*4+3}), frameRate:fps[state], repeat:loops.has(state)?-1:0 });
  }
  for (const texture of ['sentinel','moth','oni']) for(let row=0;row<ENEMY_ACTIONS.length;row++) {
    const state=ENEMY_ACTIONS[row]!;
    scene.anims.create({key:`${texture}-${state}`,frames:scene.anims.generateFrameNumbers(texture,{start:row*4,end:row*4+3}),frameRate:state==='attack'?14:state==='hurt'?24:state==='dying'?7:7,repeat:state==='idle'||state==='move'?-1:0});
  }
}
export function heroAnimation(sprite: Phaser.GameObjects.Sprite, texture: string, state: Motion) {
  const key=`${texture}-${state}`;
  if(sprite.anims.currentAnim?.key !== key) sprite.play(key);
}
