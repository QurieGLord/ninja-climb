import Phaser from 'phaser';
// Only small effects/currency are procedural. Characters, blades and terrain are external painted assets.
export function createEffectTextures(scene: Phaser.Scene) {
  const dot=scene.make.graphics({x:0,y:0});
  dot.fillStyle(0xffffff).fillCircle(5,5,4);dot.generateTexture('fx-dot',10,10);dot.destroy();
  const lantern=scene.make.graphics({x:0,y:0});
  lantern.fillStyle(0xffcc87,.12).fillCircle(14,17,14);lantern.fillStyle(0xf1b76c).fillRoundedRect(8,7,12,20,4);lantern.lineStyle(2,0x73555a).strokeRoundedRect(8,7,12,20,4);lantern.fillStyle(0x64495b).fillRect(7,5,14,3);lantern.generateTexture('fx-lantern',28,34);lantern.destroy();
  const mist=scene.make.graphics({x:0,y:0});
  for(let i=12;i>0;i--) mist.fillStyle(0xffffff,0.014).fillEllipse(160,32,300-i*10,60-i*3);
  mist.generateTexture('fx-mist',320,64);mist.destroy();
  const slash=scene.make.graphics({x:0,y:0});
  slash.lineStyle(9,0xe9d5a1,0.14).beginPath().moveTo(10,90).lineTo(44,31).lineTo(95,12).lineTo(160,50).strokePath();
  slash.lineStyle(3,0xffedbf,0.85).beginPath().moveTo(16,88).lineTo(48,34).lineTo(96,18).lineTo(154,49).strokePath();
  slash.generateTexture('fx-slash',176,112);slash.destroy();
  const coin=scene.make.graphics({x:0,y:0});
  coin.fillStyle(0xe7bc6c,0.12).fillCircle(14,14,14);coin.fillStyle(0x85663e).fillCircle(14,15,9);
  coin.fillStyle(0xf0cc7b).fillCircle(14,13,9);coin.lineStyle(1.5,0xffe4a1).strokeCircle(14,13,6);coin.fillStyle(0x947448).fillRect(12,11,4,4);
  coin.generateTexture('coin',28,28);coin.destroy();
}
