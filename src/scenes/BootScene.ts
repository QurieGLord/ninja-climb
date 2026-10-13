import Phaser from 'phaser';
import { loadAssets } from '../rendering/assets';
import { createEffectTextures } from '../rendering/art';
import { registerAnimations,registerMenuAnimation } from '../rendering/animation';
import type { Services } from '../game/Services';
export class BootScene extends Phaser.Scene {
  private failed=false;
  constructor(){super('Boot');}
  preload(){
    this.failed=false;
    this.load.on('loaderror',()=>{this.failed=true;window.dispatchEvent(new CustomEvent('game-load-error'));});
    loadAssets(this,(this.registry.get('services') as Services).store.data.selectedSkin);
  }
  create(){
    if(this.failed) return;
    const skin=(this.registry.get('services') as Services).store.data.selectedSkin;
    createEffectTextures(this);registerAnimations(this,skin);registerMenuAnimation(this,skin);this.scene.start('Menu');
  }
}
