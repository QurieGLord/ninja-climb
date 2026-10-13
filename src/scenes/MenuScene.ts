import Phaser from 'phaser';
import type { Services } from '../game/Services';
import { TERRAIN_TOP } from '../data/terrain';
import { heroAnimation } from '../rendering/animation';
export class MenuScene extends Phaser.Scene {
  private hero!:Phaser.GameObjects.Sprite;
  constructor(){super('Menu');}
  create(){
    const services=this.registry.get('services') as Services;
    this.add.image(240,400,'bg-night').setDisplaySize(480,800);
    this.add.rectangle(240,400,480,800,0x0c2833,0.25);
    this.add.image(240,565,'terrain-stone').setOrigin(0.5,TERRAIN_TOP.stone).setDisplaySize(205,63);
    this.hero=this.add.sprite(240,565,`hero-${services.store.data.selectedSkin}`).setOrigin(0.5,235/256).setDisplaySize(357,238);
    for(let i=0;i<8;i++){
      const dust=this.add.image(35+i*63,115+i*79,'fx-dot').setScale(0.2).setAlpha(0.25).setTint(0xd4c59d);
      this.tweens.add({targets:dust,x:dust.x-42,y:dust.y-85,alpha:0,duration:6000+i*500,repeat:-1});
    }
    services.onReady();
  }
  update(){
    const services=this.registry.get('services') as Services;
    heroAnimation(this.hero,`hero-${services.store.data.selectedSkin}`,'idle');
    if(services.pause.paused)this.hero.anims.pause();else this.hero.anims.resume();
    this.tweens.timeScale=services.pause.paused?0:1;
  }
}
