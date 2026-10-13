import Phaser from 'phaser';
import { createTextures } from '../rendering/art';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    this.load.svg('temple', `${import.meta.env.BASE_URL}assets/temple.svg`, { width: 480, height: 800 });
    this.load.on('loaderror', () => window.dispatchEvent(new CustomEvent('game-load-error')));
  }
  create() {
    if (!this.textures.exists('temple')) return;
    createTextures(this);
    this.scene.start('Menu');
  }
}
