import Phaser from 'phaser';
import type { Services } from '../game/Services';

export class MenuScene extends Phaser.Scene {
  private hero?: Phaser.GameObjects.Image;
  constructor() { super('Menu'); }
  create() {
    const services = this.registry.get('services') as Services;
    this.add.image(240, 400, 'temple');
    this.add.ellipse(240, 572, 160, 18, 0x102c34, 0.25);
    this.add.image(240, 579, 'platform').setDisplaySize(202, 49);
    this.hero = this.add.image(240, 469, `ninja-${services.store.data.selectedSkin}`).setDisplaySize(145, 163);
    this.tweens.add({ targets: this.hero, y: 461, angle: 2, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    for (let i = 0; i < 9; i++) {
      const leaf = this.add.ellipse(i * 61, 100 + i * 70, 6, 3, i % 2 === 0 ? 0xe7bf85 : 0x81b2a5, 0.5).setRotation(i);
      this.tweens.add({ targets: leaf, x: leaf.x - 130, y: leaf.y + 80, angle: 160, duration: 6000 + i * 700, repeat: -1 });
    }
    services.onReady();
  }
  update() {
    const services = this.registry.get('services') as Services;
    this.hero?.setTexture(`ninja-${services.store.data.selectedSkin}`);
    this.tweens.timeScale = services.pause.paused ? 0 : 1;
  }
}
