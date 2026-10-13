import Phaser from 'phaser';
import { SKINS } from '../data/config';
const vectors = (points: { x: number; y: number }[]) => points.map(p => new Phaser.Math.Vector2(p.x, p.y));

export function createTextures(scene: Phaser.Scene) {
  for (const skin of SKINS) {
    const g = scene.make.graphics({ x: 0, y: 0 }).scaleCanvas(3, 3);
    const outline = 0x0c232e;
    // Wind-blown scarf and katana, behind the silhouette.
    g.fillStyle(outline).fillPoints(vectors([{ x: 24, y: 37 }, { x: 2, y: 28 }, { x: 1, y: 17 }, { x: 17, y: 26 }, { x: 36, y: 29 }]), true);
    g.fillStyle(skin.appearance.scarf).fillPoints(vectors([{ x: 26, y: 36 }, { x: 5, y: 26 }, { x: 4, y: 21 }, { x: 17, y: 30 }, { x: 34, y: 31 }]), true);
    g.lineStyle(6, outline).lineBetween(20, 66, 59, 15);
    g.lineStyle(3, 0xb1b9ad).lineBetween(21, 66, 58, 17);
    g.lineStyle(5, 0xd4b17d).lineBetween(56, 21, 63, 12);
    g.lineStyle(4, outline).lineBetween(53, 19, 61, 25);
    // Legs and split-toe boots.
    g.fillStyle(outline).fillRoundedRect(25, 63, 13, 23, 5).fillRoundedRect(43, 61, 13, 22, 5);
    g.fillStyle(skin.appearance.suit).fillRoundedRect(28, 63, 8, 17, 3).fillRoundedRect(45, 63, 8, 15, 3);
    g.fillStyle(0x527075).fillRoundedRect(24, 79, 15, 7, 3).fillRoundedRect(43, 76, 15, 7, 3);
    g.fillStyle(outline).fillRoundedRect(22, 40, 36, 29, 12);
    g.fillStyle(skin.appearance.suit).fillRoundedRect(25, 40, 30, 26, 10);
    g.fillStyle(0x47626a).fillPoints(vectors([{ x: 29, y: 44 }, { x: 41, y: 45 }, { x: 42, y: 61 }, { x: 29, y: 61 }]), true);
    g.fillStyle(outline).fillRoundedRect(16, 42, 11, 21, 5).fillRoundedRect(54, 39, 11, 20, 5);
    g.fillStyle(skin.appearance.suit).fillRoundedRect(18, 43, 7, 15, 3).fillRoundedRect(56, 41, 7, 14, 3);
    g.fillStyle(0xd9ba92).fillCircle(22, 59, 4).fillCircle(61, 56, 4);
    g.fillStyle(skin.appearance.scarf).fillRect(25, 59, 30, 5);
    g.fillStyle(0xe8c78e).fillRect(38, 59, 6, 5);
    // Oversized hood, narrow focused eyes.
    g.fillStyle(outline).fillCircle(40, 27, 25);
    g.fillStyle(skin.appearance.suit).fillCircle(40, 26, 22);
    g.fillStyle(0x3c5860).fillEllipse(33, 18, 24, 20);
    g.fillStyle(0xe4c59b).fillRoundedRect(20, 24, 40, 14, 5);
    g.fillStyle(0xf4ddb8).fillRoundedRect(23, 25, 34, 5, 2);
    g.fillStyle(outline).fillPoints(vectors([{ x: 25, y: 27 }, { x: 36, y: 30 }, { x: 34, y: 33 }, { x: 27, y: 32 }]), true);
    g.fillStyle(outline).fillPoints(vectors([{ x: 45, y: 30 }, { x: 56, y: 27 }, { x: 54, y: 32 }, { x: 47, y: 33 }]), true);
    g.fillStyle(skin.appearance.suit).fillRoundedRect(21, 35, 38, 13, 6);
    g.fillStyle(skin.appearance.scarf).fillRoundedRect(16, 19, 47, 7, 2);
    g.fillStyle(0xffa08b, 0.5).fillRect(20, 20, 37, 1);
    g.fillStyle(skin.appearance.scarf).fillPoints(vectors([{ x: 17, y: 22 }, { x: 7, y: 34 }, { x: 9, y: 39 }, { x: 22, y: 25 }]), true);
    g.generateTexture(`ninja-${skin.id}`, 240, 270); g.destroy();
  }
  const roof = scene.make.graphics({ x: 0, y: 0 });
  roof.fillStyle(0x0d3039).fillRoundedRect(13, 10, 98, 19, 3);
  roof.fillStyle(0x37616a).fillRect(18, 12, 88, 11);
  roof.fillStyle(0x73a59e).fillPoints(vectors([{ x: 1, y: 0 }, { x: 15, y: 5 }, { x: 106, y: 5 }, { x: 123, y: 0 }, { x: 117, y: 12 }, { x: 7, y: 12 }]), true);
  roof.lineStyle(2, 0xa3c7b4).lineBetween(8, 5, 115, 5);
  roof.lineStyle(1, 0x274e59);
  for (let x = 18; x < 110; x += 13) roof.lineBetween(x, 7, x - 3, 12);
  roof.fillStyle(0xbdab78).fillRect(19, 22, 7, 3).fillRect(98, 22, 7, 3);
  roof.generateTexture('platform', 124, 32); roof.destroy();

  const coin = scene.make.graphics({ x: 0, y: 0 });
  coin.fillStyle(0xe7bc6c, 0.12).fillCircle(14, 14, 14);
  coin.fillStyle(0x85663e).fillCircle(14, 15, 9);
  coin.fillStyle(0xf0cc7b).fillCircle(14, 13, 9);
  coin.lineStyle(1.5, 0xffe4a1).strokeCircle(14, 13, 6);
  coin.fillStyle(0x947448).fillRect(12, 11, 4, 4);
  coin.generateTexture('coin', 28, 28); coin.destroy();

  for (const boss of [false, true]) {
    const e = scene.make.graphics({ x: 0, y: 0 });
    e.fillStyle(0xea8e71, 0.08).fillCircle(40, 40, 40);
    e.fillStyle(0x3a2638).fillPoints(vectors([{ x: 18, y: 40 }, { x: 20, y: 65 }, { x: 32, y: 57 }, { x: 42, y: 72 }, { x: 49, y: 58 }, { x: 62, y: 64 }, { x: 63, y: 38 }]), true);
    e.fillStyle(boss ? 0xe9ac77 : 0xd78774).fillRoundedRect(15, 16, 51, 40, 18);
    e.fillStyle(0x7c4550).fillPoints(vectors([{ x: 18, y: 28 }, { x: 10, y: 4 }, { x: 31, y: 22 }]), true).fillPoints(vectors([{ x: 51, y: 22 }, { x: 71, y: 4 }, { x: 63, y: 30 }]), true);
    e.fillStyle(0xf9d794).fillTriangle(14, 8, 20, 23, 25, 20).fillTriangle(66, 8, 62, 23, 57, 20);
    e.fillStyle(0x492e3f).fillPoints(vectors([{ x: 22, y: 29 }, { x: 36, y: 35 }, { x: 29, y: 39 }, { x: 23, y: 36 }]), true).fillPoints(vectors([{ x: 45, y: 35 }, { x: 59, y: 29 }, { x: 57, y: 36 }, { x: 51, y: 39 }]), true);
    e.fillStyle(0xffdea3).fillCircle(29, 34, 2).fillCircle(52, 34, 2);
    e.fillStyle(0x713d46).fillTriangle(40, 34, 35, 42, 45, 42);
    e.lineStyle(2, 0x492e3f).lineBetween(27, 47, 53, 47);
    e.fillStyle(0xffe5b4).fillTriangle(28, 46, 33, 46, 30, 52).fillTriangle(48, 46, 53, 46, 51, 52);
    if (boss) { e.lineStyle(3, 0xa15350).lineBetween(37, 19, 40, 26).lineBetween(44, 19, 41, 26); }
    e.generateTexture(boss ? 'oni' : 'wisp', 80, 80); e.destroy();
  }
}
