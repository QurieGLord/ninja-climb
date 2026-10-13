import Phaser from 'phaser';
export const TERRAIN = ['stone','fragile','moving','gate','wall','electric','volcanic','arena'];
export function loadAssets(scene: Phaser.Scene) {
  const base=import.meta.env.BASE_URL+'assets/';
  for(const skin of ['ember','jade','moon']) {
    scene.load.spritesheet(`hero-${skin}`,`${base}characters/${skin}.png`,{frameWidth:384,frameHeight:256,endFrame:31});
    scene.load.spritesheet(`hero-${skin}-combat`,`${base}characters/${skin}-combat.png`,{frameWidth:384,frameHeight:256,endFrame:19});
  }
  for(const enemy of ['sentinel','moth','oni']) scene.load.spritesheet(enemy,`${base}enemies/${enemy}.png`,{frameWidth:384,frameHeight:256,endFrame:27});
  for(const zone of ['sky','night','inferno']) scene.load.image(`bg-${zone}`,`${base}backgrounds/${zone}.webp`);
  for(const terrain of TERRAIN) scene.load.image(`terrain-${terrain}`,`${base}platforms/${terrain}.png`);
}
