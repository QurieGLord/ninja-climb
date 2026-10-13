import Phaser from 'phaser';
import { ENEMY_TYPES, PLATFORM_TYPES, RULES, zoneAt, ZONES } from '../data/config';
import type { RunSnapshot } from '../game/types';
import { TERRAIN_TOP } from '../data/terrain';
import { heroAnimation } from './animation';
export class WorldView {
  private images=new Map<string,Phaser.GameObjects.Image>();
  private enemies=new Map<number,Phaser.GameObjects.Sprite>();
  private ninja:Phaser.GameObjects.Sprite;
  private backgrounds:Phaser.GameObjects.Image[]=[];
  private mist:Phaser.GameObjects.Image[]=[];
  private cues:Phaser.GameObjects.Graphics;
  private slash:Phaser.GameObjects.Image;
  private lastGhost=0;
  private zoneIndex=-1;
  constructor(private scene:Phaser.Scene,private skin:string){
    this.backgrounds=ZONES.map(zone=>scene.add.image(240,400,`bg-${zone.background}`).setDisplaySize(500,834).setDepth(-10).setAlpha(0));
    scene.add.rectangle(240,400,480,800,0x0b2935,0.18).setDepth(-8);
    for(let i=0;i<4;i++)this.mist.push(scene.add.image(80+i*125,160+i*170,'fx-mist').setDepth(i%2?-2:4).setAlpha(0.16).setScale(1.4,1));
    this.ninja=scene.add.sprite(240,686,`hero-${skin}`).setOrigin(0.5,235/256).setDisplaySize(168,112).setDepth(10);
    this.slash=scene.add.image(0,0,'fx-slash').setDepth(12).setVisible(false).setDisplaySize(88,60);
    this.cues=scene.add.graphics().setDepth(8);
  }
  setPaused(value:boolean){
    if(value)this.ninja.anims.pause();else this.ninja.anims.resume();
    for(const enemy of this.enemies.values())if(value)enemy.anims.pause();else enemy.anims.resume();
  }
  render(s:RunSnapshot){
    const zone=zoneAt(s.height),index=ZONES.indexOf(zone),p=s.player;
    if(index!==this.zoneIndex){this.backgrounds.forEach((bg,i)=>{if(this.zoneIndex<0)bg.setAlpha(i===index?1:0);else this.scene.tweens.add({targets:bg,alpha:i===index?1:0,duration:1200});});this.zoneIndex=index;}
    this.backgrounds.forEach(bg=>bg.setY(400+Math.sin(s.cameraY*0.0008)*15));
    this.mist.forEach((fog,i)=>fog.setPosition(((s.elapsed*(i+2)*3+i*157)%700)-100,130+i*190+Math.sin(s.cameraY*0.001+i)*20).setTint(zone.atmosphere));
    const alive=new Set<string>();
    const image=(id:string,key:string,x:number,y:number,depth:number)=>{
      alive.add(id);let object=this.images.get(id);
      if(!object){object=this.scene.add.image(x,y,key).setDepth(depth);this.images.set(id,object);}
      if(object.texture.key!==key)object.setTexture(key);
      return object.setPosition(x,y-s.cameraY);
    };
    for(const wall of s.walls){
      const key=wall.gateFor?'gate':wall.hazard?'electric':zone.id==='inferno'?'volcanic':'wall';
      image(`w${wall.id}`,`terrain-${key}`,wall.x+wall.width/2,wall.y+wall.height/2,wall.gateFor?7:1).setDisplaySize(wall.width,wall.height);
    }
    for(const platform of s.platforms){
      if(platform.broken)continue;
      const object=image(`p${platform.id}`,`terrain-${PLATFORM_TYPES[platform.kind].texture}`,platform.x,platform.y,3).setOrigin(0.5,TERRAIN_TOP[PLATFORM_TYPES[platform.kind].texture as keyof typeof TERRAIN_TOP]);
      const width=platform.width+5;
      object.setDisplaySize(width,Math.min(platform.kind==='arena'?170:72,width*object.frame.realHeight/object.frame.realWidth));
      object.setAlpha(platform.crumble>0?0.65+Math.sin(s.elapsed*35)*0.2:1);
    }
    for(const coin of s.coins)image(`c${coin.id}`,'coin',coin.x,coin.y+Math.sin(s.elapsed*3+coin.id)*3,5).setScale(0.9,1);
    for(const[id,object]of this.images)if(!alive.has(id)){object.destroy();this.images.delete(id);}
    const enemiesAlive=new Set<number>();this.cues.clear();
    for(const enemy of s.enemies){
      enemiesAlive.add(enemy.id);let sprite=this.enemies.get(enemy.id);
      const texture=ENEMY_TYPES[enemy.kind].texture;
      if(!sprite){sprite=this.scene.add.sprite(enemy.x,enemy.y,texture).setOrigin(0.5,235/256).setDepth(6);this.enemies.set(enemy.id,sprite);}
      sprite.setPosition(enemy.x,enemy.y-s.cameraY+(enemy.kind==='oni'?38:enemy.kind==='moth'?28:26)).setFlipX(enemy.facing<0).setDisplaySize(enemy.kind==='oni'?264:enemy.kind==='moth'?136.5:160.5,enemy.kind==='oni'?176:enemy.kind==='moth'?91:107);
      const animation=`${texture}-${enemy.reactionLeft>0&&enemy.hp>0?'hurt':enemy.state}`;if(sprite.anims.currentAnim?.key!==animation)sprite.play(animation);
      if(enemy.state==='windup'){
        const color=enemy.kind==='oni'?0xffb06c:0xe9cc8e;
        this.cues.lineStyle(2,color,0.7).strokeCircle(enemy.x,enemy.y-s.cameraY-50,7+Math.sin(s.elapsed*12)*2);
        const reach=enemy.kind==='oni'?145:65;
        this.cues.fillStyle(color,0.10+Math.sin(s.elapsed*12)*0.04).fillRect(enemy.facing>0?enemy.x:enemy.x-reach,enemy.y-s.cameraY+25,reach,7);
      }
      if(enemy.kind==='oni'&&enemy.hp>0){
        this.cues.fillStyle(0x0e2632,0.9).fillRoundedRect(enemy.x-48,enemy.y-s.cameraY-105,96,6,3);
        this.cues.fillStyle(enemy.state==='recover'?0x9de3c0:0xf4bd80).fillRoundedRect(enemy.x-48,enemy.y-s.cameraY-105,96*enemy.hp/6,6,3);
      }
    }
    for(const[id,sprite]of this.enemies)if(!enemiesAlive.has(id)){sprite.destroy();this.enemies.delete(id);}
    for(const wall of s.walls)if(wall.hazard){
      const x=wall.x+wall.width/2,y=wall.y-s.cameraY;
      this.cues.lineStyle(2,0x90ecff,0.8).beginPath().moveTo(x,y);
      for(let i=1;i<8;i++)this.cues.lineTo(x+Math.sin(s.elapsed*20+i*4)*7,y+wall.height*i/7);
      this.cues.strokePath();
    }
    heroAnimation(this.ninja,`hero-${this.skin}`,p.motion);
    this.ninja.setPosition(p.x,p.y-s.cameraY+24).setFlipX(p.facing<0).setAlpha(p.invincible>0&&Math.floor(s.elapsed*16)%2===0?0.52:1);
    this.ninja.setRotation(p.dashLeft>0?Math.atan2(p.dashY,Math.abs(p.dashX))*p.facing:0);
    const attackAge=RULES.attackDuration-p.attackTime;
    this.slash.setVisible(p.attackTime>0&&attackAge>=RULES.attackStart&&attackAge<=RULES.attackEnd).setPosition(p.x+p.facing*48,p.y-s.cameraY-7).setFlipX(p.facing<0);
    if(p.dashLeft>0&&s.elapsed-this.lastGhost>0.028){
      this.lastGhost=s.elapsed;
      const ghost=this.scene.add.image(this.ninja.x,this.ninja.y,this.ninja.texture.key,this.ninja.frame.name).setOrigin(0.5,235/256).setDisplaySize(168,112).setFlipX(p.facing<0).setRotation(this.ninja.rotation).setTint(0xd2e9d4).setAlpha(0.3).setDepth(9);
      this.scene.tweens.add({targets:ghost,alpha:0,duration:190,onComplete:()=>ghost.destroy()});
    }
  }
  burst(x:number,y:number,color:number){
    for(let i=0;i<8;i++){
      const dot=this.scene.add.image(x,y,'fx-dot').setTint(color).setScale(0.18+i%3*0.08).setDepth(15);
      this.scene.tweens.add({targets:dot,x:x+Math.cos(i*0.79)*30,y:y+Math.sin(i*0.79)*24,alpha:0,duration:310,onComplete:()=>dot.destroy()});
    }
  }
  floating(x:number,y:number,label:string,color='#f3d596'){
    const text=this.scene.add.text(x,y,label,{fontFamily:'Arial, sans-serif',fontSize:'15px',fontStyle:'bold',color,stroke:'#12323a',strokeThickness:3}).setOrigin(0.5).setDepth(20);
    this.scene.tweens.add({targets:text,y:y-38,alpha:0,duration:650,onComplete:()=>text.destroy()});
  }
}
