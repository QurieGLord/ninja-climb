import Phaser from 'phaser';
import {ENEMY_TYPES,RULES,zoneAt,ZONES} from '../data/config';
import {terrainStyle} from '../data/terrain-style';
import {TERRAIN_TOP,TERRAIN_SPAN} from '../data/terrain';
import type {RunSnapshot} from '../game/types';
import {heroAnimation} from './animation';
import {RenderInterpolation} from './interpolation';
import {EffectPool} from './EffectPool';
import {LivingWorld} from './LivingWorld';
export class WorldView{
  private images=new Map<string,Phaser.GameObjects.Image>();
  private enemies=new Map<number,Phaser.GameObjects.Sprite>();
  private freeImages:Phaser.GameObjects.Image[]=[];
  private freeEnemies:Phaser.GameObjects.Sprite[]=[];
  private alive=new Set<string>();private enemiesAlive=new Set<number>();
  private ninja:Phaser.GameObjects.Sprite;
  private cues:Phaser.GameObjects.Graphics;
  private slash:Phaser.GameObjects.Image;
  private effects:EffectPool;
  private environment:LivingWorld;
  private lastGhost=0;
  private paused=false;
  constructor(private scene:Phaser.Scene,private skin:string){
    this.environment=new LivingWorld(scene);this.effects=new EffectPool(scene);
    this.ninja=scene.add.sprite(240,710,`hero-${skin}`,'idle-0').setOrigin(.5,146/160).setDepth(10);
    this.slash=scene.add.image(0,0,'fx-slash').setDepth(12).setVisible(false).setDisplaySize(88,60);
    this.cues=scene.add.graphics().setDepth(8);
  }
  setPaused(value:boolean){
    if(value===this.paused)return;this.paused=value;
    if(value)this.ninja.anims.pause();else this.ninja.anims.resume();
    for(const e of this.enemies.values())if(value)e.anims.pause();else e.anims.resume();
  }
  private image(id:string,key:string,x:number,y:number,depth:number,visible:boolean){
    this.alive.add(id);let object=this.images.get(id);
    if(!object&&visible){object=this.freeImages.pop()??this.scene.add.image(0,0,key);this.images.set(id,object);}
    if(!object)return;
    object.setVisible(visible);if(!visible)return;
    if(object.texture.key!==key)object.setTexture(key);
    return object.setPosition(x,y).setDepth(depth).setOrigin(.5).setAlpha(1).setScale(1);
  }
  render(s:RunSnapshot,interpolation?:RenderInterpolation,alpha=1,dt=0){
    const zone=zoneAt(s.height),p=s.player,camera=interpolation?.cameraY(s,alpha)??s.cameraY;
    const px=interpolation?.playerX(s,alpha)??p.x,py=interpolation?.playerY(s,alpha)??p.y;
    this.environment.render(ZONES.indexOf(zone),camera,dt,{x:px,y:py,dashLeft:p.dashLeft});
    this.effects.update(dt,camera);this.alive.clear();
    for(const wall of s.walls){
      const key=wall.gateFor?'gate':wall.hazard?'electric':zone.id==='inferno'?'volcanic':'wall';
      const top=Math.max(-100,wall.y-camera),bottom=Math.min(900,wall.y+wall.height-camera),visible=bottom>top;
      this.image(`w${wall.id}`,`terrain-${key}`,wall.x+wall.width/2,(top+bottom)/2,wall.gateFor?7:1,visible)?.setDisplaySize(wall.width,bottom-top);
    }
    for(const platform of s.platforms){
      if(platform.broken)continue;
      const y=platform.y-camera,key=terrainStyle(platform.kind,zone.id,platform.id),x=interpolation?.platformX(platform.id,platform.x,alpha)??platform.x;
      const object=this.image(`p${platform.id}`,`terrain-${key}`,x,y,3,y>-120&&y<880);
      if(object){const width=platform.width/TERRAIN_SPAN[key as keyof typeof TERRAIN_SPAN];object.setOrigin(.5,TERRAIN_TOP[key as keyof typeof TERRAIN_TOP]).setDisplaySize(width,Math.min(platform.kind==='arena'?145:72,width*object.frame.realHeight/object.frame.realWidth)).setAlpha(platform.crumble>0?.65+Math.sin(s.elapsed*35)*.2:1);}
    }
    for(const coin of s.coins){const y=coin.y-camera;this.image(`c${coin.id}`,'coin',coin.x,y+Math.sin(s.elapsed*3+coin.id)*3,5,y>-40&&y<840)?.setScale(.9,1);}
    for(const[id,object]of this.images)if(!this.alive.has(id)){object.setVisible(false);this.freeImages.push(object);this.images.delete(id);}
    this.enemiesAlive.clear();this.cues.clear();
    for(const enemy of s.enemies){
      this.enemiesAlive.add(enemy.id);let sprite=this.enemies.get(enemy.id);
      const texture=ENEMY_TYPES[enemy.kind].texture,ex=interpolation?.x(enemy.id,enemy.x,alpha)??enemy.x,ey=(interpolation?.y(enemy.id,enemy.y,alpha)??enemy.y)-camera,visible=ey>-180&&ey<980;
      if(!sprite&&visible){sprite=this.freeEnemies.pop()??this.scene.add.sprite(0,0,texture,'idle-0');sprite.setOrigin(.5,146/160).setDepth(6);this.enemies.set(enemy.id,sprite);}
      if(!sprite)continue;sprite.setVisible(visible);if(!visible){sprite.anims.pause();continue;}
      if(!this.paused)sprite.anims.resume();
      sprite.setPosition(ex,ey+(enemy.kind==='oni'?38:enemy.kind==='moth'?28:26)).setFlipX(enemy.facing<0).setScale(enemy.kind==='oni'?1.48:enemy.kind==='moth'?.82:.95);
      const animation=`${texture}-${enemy.reactionLeft>0&&enemy.hp>0?'hurt':enemy.state}`;if(sprite.anims.currentAnim?.key!==animation)sprite.play(animation);
      const duration=enemy.state==='windup'?ENEMY_TYPES[enemy.kind].windup*(enemy.kind==='oni'&&enemy.hp<=3?.75:1):enemy.state==='attack'?enemy.kind==='moth'?.4:.3:enemy.state==='hurt'?.16:enemy.state==='dying'?.6:ENEMY_TYPES[enemy.kind].recover;
      const loop=enemy.state==='idle'||enemy.state==='move';sprite.anims.timeScale=loop?1:0;if(!loop)sprite.anims.setProgress(Math.min(.9999,enemy.stateTime/duration));
      if(enemy.state==='windup'){
        const color=enemy.kind==='oni'?0xffb06c:0xe9cc8e,reach=enemy.kind==='oni'?145:65;
        this.cues.lineStyle(2,color,.7).strokeCircle(ex,ey-50,7+Math.sin(s.elapsed*12)*2);
        this.cues.fillStyle(color,.10+Math.sin(s.elapsed*12)*.04).fillRect(enemy.facing>0?ex:ex-reach,ey+25,reach,7);
      }
      if(enemy.kind==='oni'&&enemy.hp>0){this.cues.fillStyle(0x0e2632,.9).fillRoundedRect(ex-48,ey-105,96,6,3);this.cues.fillStyle(enemy.state==='recover'?0x9de3c0:0xf4bd80).fillRoundedRect(ex-48,ey-105,96*enemy.hp/6,6,3);}
    }
    for(const[id,sprite]of this.enemies)if(!this.enemiesAlive.has(id)){sprite.setVisible(false);sprite.anims.stop();this.freeEnemies.push(sprite);this.enemies.delete(id);}
    for(const wall of s.walls)if(wall.hazard&&wall.y-camera<900&&wall.y+wall.height-camera>-100){const x=wall.x+wall.width/2,y=wall.y-camera;this.cues.lineStyle(2,0x90ecff,.8).beginPath().moveTo(x,y);for(let i=1;i<8;i++)this.cues.lineTo(x+Math.sin(s.elapsed*20+i*4)*7,y+wall.height*i/7);this.cues.strokePath();}
    const duration=p.motion==='dashing'?RULES.dashDuration:p.motion==='attacking'?RULES.attackDuration:p.motion==='dead'?.6:p.motion==='hurt'?.25:p.motion==='landing'?.09:p.motion==='jumping'||p.motion==='wall_jump'?.1:undefined;
    const phase=p.motion==='attacking'?(RULES.attackDuration-p.attackTime)/RULES.attackDuration:duration?p.motionTime/duration:undefined;
    heroAnimation(this.ninja,`hero-${this.skin}`,p.motion,phase);
    this.ninja.setPosition(px,py-camera+24).setFlipX(p.facing<0).setAlpha(p.invincible>0&&Math.floor(s.elapsed*16)%2===0?.52:1).setRotation(p.dashLeft>0?Math.atan2(p.dashY,Math.abs(p.dashX))*p.facing:0);
    const age=RULES.attackDuration-p.attackTime;
    this.slash.setVisible(p.attackTime>0&&age>=RULES.attackStart&&age<=RULES.attackEnd).setPosition(px+p.facing*48,py-camera-7).setFlipX(p.facing<0);
    if(p.dashLeft>0&&s.elapsed-this.lastGhost>.028){this.lastGhost=s.elapsed;this.effects.ghost(this.ninja,py+24);}
  }
  burst(x:number,y:number,color:number){this.effects.burst(x,y,color);}
  floating(x:number,y:number,label:string,color='#f3d596'){this.effects.floating(x,y,label,color);}
}
