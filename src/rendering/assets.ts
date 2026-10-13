import Phaser from 'phaser';
import {BIOME_LAYERS} from '../data/environment';
import {registerHeroAnimations,registerMenuAnimation,HERO_ACTIONS} from './animation';
export const TERRAIN=['stone','roof','broken-roof','temple','bamboo','fragile','moving','gate','wall','electric','volcanic','arena'];
const base=import.meta.env.BASE_URL+'assets/';
function queueSkin(scene:Phaser.Scene,skin:string){
  if(!scene.textures.exists(`hero-${skin}`))scene.load.atlas(`hero-${skin}`,`${base}characters/${skin}.png`,`${base}characters/${skin}.json`);
  if(!scene.textures.exists(`hero-${skin}-menu`))scene.load.spritesheet(`hero-${skin}-menu`,`${base}characters/${skin}-menu.png`,{frameWidth:320,frameHeight:224,endFrame:7});
}
export function loadAssets(scene:Phaser.Scene,skin:string){
  queueSkin(scene,skin);
  for(const enemy of ['sentinel','moth','oni'])scene.load.atlas(enemy,`${base}enemies/${enemy}.png`,`${base}enemies/${enemy}.json`);
  for(const zone of ['sky','night','inferno']){
    scene.load.image(`bg-${zone}`,`${base}backgrounds/${zone}.webp`);
    for(const layer of BIOME_LAYERS)scene.load.image(`env-${zone}-${layer.id}`,`${base}backgrounds/${zone}-${layer.id}.webp`);
  }
  for(const terrain of TERRAIN)scene.load.image(`terrain-${terrain}`,`${base}platforms/${terrain}.png`);
}
const pending=new Map<string,Promise<void>>();
export function ensureSkin(scene:Phaser.Scene,skin:string):Promise<void>{
  if(scene.textures.exists(`hero-${skin}`)&&scene.textures.exists(`hero-${skin}-menu`))return Promise.resolve();
  const existing=pending.get(skin);if(existing)return existing;
  const promise=new Promise<void>((resolve,reject)=>{
    let failed=false;
    const error=(file:Phaser.Loader.File)=>{if(file.key.startsWith(`hero-${skin}`))failed=true;};
    scene.load.on('loaderror',error);
    scene.load.once('complete',()=>{
      scene.load.off('loaderror',error);pending.delete(skin);
      if(failed||!scene.textures.exists(`hero-${skin}`)||!scene.textures.exists(`hero-${skin}-menu`))reject(new Error('Costume loading failed'));
      else{registerHeroAnimations(scene,`hero-${skin}`);registerMenuAnimation(scene,skin);resolve();}
    });
    queueSkin(scene,skin);scene.load.start();
  });pending.set(skin,promise);return promise;
}
export function releaseOtherSkins(scene:Phaser.Scene,selected:string){
  for(const skin of ['ember','jade','moon'])if(skin!==selected){for(const state of HERO_ACTIONS)scene.anims.remove(`hero-${skin}-${state}`);scene.anims.remove(`hero-${skin}-menu-idle`);for(const key of [`hero-${skin}`,`hero-${skin}-menu`])if(scene.textures.exists(key))scene.textures.remove(key);}
}
