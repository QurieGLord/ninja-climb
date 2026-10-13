import Phaser from 'phaser';
import { PLATFORM_TYPES } from '../data/config';
import type { RunSnapshot } from '../game/RunModel';

export class WorldView {
  private sprites = new Map<string, Phaser.GameObjects.Image>();
  private ninja: Phaser.GameObjects.Image;
  private slash: Phaser.GameObjects.Graphics;
  private marks: Phaser.GameObjects.Graphics;
  private bg: Phaser.GameObjects.Image;
  constructor(private scene: Phaser.Scene, skin: string) {
    this.bg = scene.add.image(240, 400, 'temple');
    this.ninja = scene.add.image(240, 670, `ninja-${skin}`).setDepth(10).setDisplaySize(54, 61);
    this.slash = scene.add.graphics().setDepth(11);
    this.marks = scene.add.graphics().setDepth(7);
  }
  render(s: RunSnapshot) {
    this.bg.setY(400 + Math.sin(s.cameraY * 0.00015) * 10);
    const alive = new Set<string>();
    const sprite = (id: string, texture: string, x: number, y: number, depth: number) => {
      alive.add(id);
      let image = this.sprites.get(id);
      if (!image) { image = this.scene.add.image(x, y, texture).setDepth(depth); this.sprites.set(id, image); }
      image.setPosition(x, y - s.cameraY);
      return image;
    };
    for (const p of s.platforms) {
      if (p.broken) continue;
      const roof = sprite(`p${p.id}`, 'platform', p.x, p.y + 11, 3);
      roof.setDisplaySize(PLATFORM_TYPES[p.kind].width + 8, 30);
      roof.setTint(p.kind === 'fragile' ? 0xe2ac8c : p.kind === 'cloud' ? 0xbbdded : 0xffffff);
    }
    for (const c of s.coins) sprite(`c${c.id}`, 'coin', c.x, c.y + Math.sin(s.elapsed * 3 + c.id) * 3, 5).setScale(0.9 + Math.sin(s.elapsed * 4 + c.id) * 0.08, 1);
    this.marks.clear();
    for (const e of s.enemies) {
      const enemy = sprite(`e${e.id}`, e.kind, e.x, e.y + Math.sin(s.elapsed * 2 + e.id) * 5, 6);
      enemy.setDisplaySize(e.kind === 'oni' ? 86 : 53, e.kind === 'oni' ? 86 : 53);
      enemy.setAlpha(s.elapsed - e.hitAt < 0.15 ? 0.4 : 1);
      if (e.kind === 'oni') {
        this.marks.fillStyle(0x112d37, 0.8).fillRoundedRect(e.x - 26, e.y - s.cameraY - 49, 52, 5, 2);
        this.marks.fillStyle(0xed9d73).fillRoundedRect(e.x - 26, e.y - s.cameraY - 49, 52 * e.hp / 3, 5, 2);
      }
    }
    for (const [id, image] of this.sprites) { if (!alive.has(id)) { image.destroy(); this.sprites.delete(id); } }
    this.ninja.setPosition(s.player.x, s.player.y - s.cameraY).setFlipX(s.player.facing < 0);
    this.ninja.setRotation(Math.max(-0.14, Math.min(0.14, s.player.vx * 0.0005)));
    this.ninja.setAlpha(s.player.invincible > 0 && Math.floor(s.elapsed * 15) % 2 === 0 ? 0.5 : 1);
    this.slash.clear();
    if (s.attackLeft > 0) {
      const angle = (1 - s.attackLeft / 0.24) * 4;
      const x = s.player.x, y = s.player.y - s.cameraY;
      this.slash.lineStyle(10, 0xd9e6c6, 0.14).beginPath().arc(x, y, 101, angle, angle + 2.9).strokePath();
      this.slash.lineStyle(3, 0xf8e6ba, 0.95).beginPath().arc(x, y, 98, angle + 0.3, angle + 2.5).strokePath();
      this.slash.lineStyle(1, 0xffffff, 0.9).beginPath().arc(x, y, 92, angle + 0.5, angle + 2.1).strokePath();
    }
  }
  burst(x: number, y: number, color: number) {
    for (let i = 0; i < 8; i++) {
      const dot = this.scene.add.rectangle(x, y, 3 + i % 3, 3, color).setDepth(15).setRotation(i);
      this.scene.tweens.add({ targets: dot, x: x + Math.cos(i * 0.79) * 38, y: y + Math.sin(i * 0.79) * 38, alpha: 0, rotation: i + 3, duration: 420, onComplete: () => dot.destroy() });
    }
  }
  floating(x: number, y: number, label: string, color = '#f3d596') {
    const text = this.scene.add.text(x, y, label, { fontFamily: 'Arial, sans-serif', fontSize: '19px', fontStyle: 'bold', color, stroke: '#12323a', strokeThickness: 4 }).setOrigin(0.5).setDepth(20);
    this.scene.tweens.add({ targets: text, y: y - 52, alpha: 0, duration: 900, onComplete: () => text.destroy() });
  }
}
