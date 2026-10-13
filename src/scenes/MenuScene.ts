import Phaser from 'phaser';
import type { Services } from '../game/Services';
import { TERRAIN_TOP } from '../data/terrain';
import { heroAnimation } from '../rendering/animation';
import {ensureSkin,releaseOtherSkins} from '../rendering/assets';
import {LivingWorld} from '../rendering/LivingWorld';
import {IdleClock} from '../rendering/IdleClock';
export class MenuScene extends Phaser.Scene {
  private hero!:Phaser.GameObjects.Sprite;
  private environment!:LivingWorld;
  private currentSkin='ember';
  private loading=false;
  private failedSelection='';
  private idleClock=new IdleClock();
  constructor(){super('Menu');}
  create(){
    const services=this.registry.get('services') as Services;
    this.currentSkin=services.store.data.selectedSkin;this.loading=false;this.failedSelection='';
    this.idleClock.resetTimestamp();
    this.environment=new LivingWorld(this);this.environment.render(1,0,1,{x:240,y:565,dashLeft:0});
    this.add.rectangle(240,400,480,800,0x0c2833,0.25);
    this.add.image(240,565,'terrain-stone').setOrigin(0.5,TERRAIN_TOP.stone).setDisplaySize(205,63).setDepth(3);
    this.hero=this.add.sprite(240,565,`hero-${this.currentSkin}-menu`,0).setOrigin(0.5,205/224).setScale(1.075).setDepth(10);
    for(let i=0;i<8;i++){
      const dust=this.add.image(35+i*63,115+i*79,'fx-dot').setScale(0.2).setAlpha(0.25).setTint(0xd4c59d);
      this.tweens.add({targets:dust,x:dust.x-42,y:dust.y-85,alpha:0,duration:6000+i*500,repeat:-1});
    }
    services.onReady();
  }
  resetTiming(){this.idleClock.resetTimestamp();}
  update(_time:number,delta:number){
    const services=this.registry.get('services') as Services;
    const selected=services.store.data.selectedSkin;
    if(selected!==this.currentSkin&&!this.loading&&selected!==this.failedSelection){this.loading=true;void ensureSkin(this,selected).then(()=>{if(this.scene.isActive()){this.currentSkin=selected;this.failedSelection='';heroAnimation(this.hero,`hero-${selected}-menu`,'idle');releaseOtherSkins(this,selected);}}).catch(()=>{this.failedSelection=selected;window.dispatchEvent(new CustomEvent('costume-load-error'));}).finally(()=>{this.loading=false;});}
    heroAnimation(this.hero,`hero-${this.currentSkin}-menu`,'idle');
    this.hero.anims.timeScale=0;
    const frame=this.hero.anims.currentAnim?.frames[this.idleClock.frame(_time,services.pause.paused)];
    if(frame&&this.hero.anims.currentFrame!==frame)this.hero.anims.setCurrentFrame(frame);
    this.environment.render(1,0,services.pause.paused?0:Math.min(delta/1000,.05),{x:240,y:565,dashLeft:0});
    if(services.pause.paused)this.hero.anims.pause();else this.hero.anims.resume();
    this.tweens.timeScale=services.pause.paused?0:1;
  }
}
