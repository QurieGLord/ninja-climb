import Phaser from 'phaser';
import { loadAssets } from '../rendering/assets';
import { createEffectTextures } from '../rendering/art';
import { registerAnimations } from '../rendering/animation';
export class BootScene extends Phaser.Scene {
  private failed=false;
  constructor(){super('Boot');}
  preload(){
    this.failed=false;
    this.load.on('loaderror',()=>{this.failed=true;window.dispatchEvent(new CustomEvent('game-load-error'));});
    loadAssets(this);
  }
  create(){
    if(this.failed) return;
    createEffectTextures(this);registerAnimations(this);this.scene.start('Menu');
  }
}
